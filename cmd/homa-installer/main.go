package main

import (
	_ "embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
	"v2rayng-extension/internal/config"
	"v2rayng-extension/internal/downloader"
	"v2rayng-extension/internal/platform"
	"v2rayng-extension/internal/ui"
)

//go:embed embedded/homa-host.exe
var hostBinary []byte

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--host" {
		fmt.Println("This is the installer. Please run homa-host for the native host.")
		return
	}

	ui.ClearScreen()
	ui.PrintLogo()
	fmt.Printf("OS: %s | Arch: %s\n", runtime.GOOS, runtime.GOARCH)

	installDir, _ := config.GetInstallDir()

	// Check previous installation (Check if executable exists)
	isInstalled := false
	exeName := "homa-host.exe"
	if runtime.GOOS != "windows" {
		exeName = "homa-host"
	}
	if _, err := os.Stat(filepath.Join(config.GetBinDir(installDir), exeName)); err == nil {
		isInstalled = true
	}

	if !isInstalled {
		// --- Fresh Install Flow ---
		ui.Header("Welcome to Homa")
		fmt.Println("This installer will set up the Homa Native Host for your browser.")
		fmt.Println("It works with Chrome, Edge, Brave, and Firefox.")
		fmt.Println("")
		fmt.Println("Press [ENTER] to install...")
		ui.Pause() // Waits for enter
		doInstall(installDir)
	} else {
		// --- Existing Install Flow ---
		ui.Header("Manage Installation")
		ui.Warning(fmt.Sprintf("Homa is currently installed at: %s", installDir))
		fmt.Println("")
		fmt.Println("Select Action:")
		fmt.Println(" [1] Update / Reinstall (Fix issues)")
		fmt.Println(" [2] Uninstall (Remove all files)")
		fmt.Println(" [3] Exit")

		choice := ui.Prompt("\nChoice [1] > ")
		if choice == "" {
			choice = "1"
		} // Default to 1

		switch choice {
		case "1":
			doInstall(installDir)
		case "2":
			doUninstall()
		case "3":
			os.Exit(0)
		default:
			doInstall(installDir)
		}
	}
}

func doInstall(installDir string) {
	ui.Header("INSTALLATION")

	// 1. Get Extension ID
	ui.Info("Detecting Extension ID...")
	id := detectExtensionID()
	ui.Info("Using Extension ID: " + id)

	// 2. Prepare Directories
	binDir := config.GetBinDir(installDir)
	configDir := config.GetConfigDir(installDir)

	ui.Info("Creating directories...")
	os.MkdirAll(binDir, 0755)
	os.MkdirAll(configDir, 0755)

	// 3. Download Xray
	ui.Info("Checking Xray Core...")
	if err := downloader.DownloadXray(binDir); err != nil {
		ui.Error("Failed to download Xray: " + err.Error())
		pause()
		return
	}
	ui.Success("Xray Core installed.")

	// 4. Install Host Binary
	ui.Info("Installing Host Binary...")

	killProcess("homa-host")
	time.Sleep(500 * time.Millisecond)

	hostDst := filepath.Join(binDir, "homa-host.exe")
	if runtime.GOOS != "windows" {
		hostDst = filepath.Join(binDir, "homa-host")
	}

	var writeErr error
	if len(hostBinary) > 0 {
		writeErr = os.WriteFile(hostDst, hostBinary, 0755)
	} else {
		ui.Warning("Embedded binary empty. Attempting local copy...")
		src := "homa-host.exe"
		if runtime.GOOS != "windows" {
			src = "homa-host"
		}
		if _, err := os.Stat(src); err == nil {
			writeErr = copyFile(src, hostDst)
		} else {
			writeErr = fmt.Errorf("host binary not found (embedded or local)")
		}
	}

	if writeErr != nil {
		ui.Error("Failed to install host binary: " + writeErr.Error())
		pause()
		return
	}
	ui.Success("Host binary installed.")

	// 5. Create Manifest & Register
	ui.Info("Configuring Native Messaging for ALL browsers...")

	absExePath, _ := filepath.Abs(hostDst)

	// --- SETUP CHROME ---
	// Create Manifest
	if err := platform.CreateManifest(installDir, absExePath, id, "chrome", config.ManifestNameChrome); err != nil {
		ui.Error("Failed to create Chrome manifest: " + err.Error())
	}
	// Register
	if err := platform.Register(installDir, "chrome", config.ManifestNameChrome); err != nil {
		ui.Warning("Failed to register for Chrome: " + err.Error())
	} else {
		ui.Success("Registered for Chrome/Edge")
	}

	// --- SETUP FIREFOX ---
	// Create Manifest
	if err := platform.CreateManifest(installDir, absExePath, id, "firefox", config.ManifestNameFirefox); err != nil {
		ui.Error("Failed to create Firefox manifest: " + err.Error())
	}
	// Register
	if err := platform.Register(installDir, "firefox", config.ManifestNameFirefox); err != nil {
		ui.Warning("Failed to register for Firefox: " + err.Error())
	} else {
		ui.Success("Registered for Firefox")
	}

	ui.Header("DONE")
	ui.Success("Installation successfully completed!")
	ui.Info("Please restart your browser or reload the extension.")
	pause()
}

func killProcess(name string) {
	if runtime.GOOS == "windows" {
		// name usually needs .exe extension for taskkill?
		// taskkill /F /IM homa-host.exe
		exec.Command("taskkill", "/F", "/IM", name+".exe").Run()
	} else {
		exec.Command("pkill", name).Run()
	}
}

func doUninstall() {
	ui.Header("UNINSTALLATION")

	// 1. Kill running process first
	ui.Info("Stopping Homa Host...")
	killProcess("homa-host")
	time.Sleep(1 * time.Second) // Wait for release

	// 2. Remove Registry
	ui.Info("Removing Registry Keys...")
	platform.Unregister()
	// Also try generic unregister for Firefox if we can, or just rely on platform logic.
	// Current platform.Unregister only handles Chrome registry key based on previous code.
	// Ideally we should have platform.UnregisterAll() but for now let's stick to what we have or improve later.

	// 3. Remove Files
	installDir, _ := config.GetInstallDir()
	ui.Info("Removing Files in " + installDir)

	// Retry logic for potential file locks
	var err error
	for i := 0; i < 3; i++ {
		err = os.RemoveAll(installDir)
		if err == nil {
			break
		}
		ui.Warning(fmt.Sprintf("Failed to remove files (Attempt %d/3): %v", i+1, err))
		time.Sleep(1 * time.Second)
		killProcess("homa-host") // Try killing again
	}

	if err != nil {
		ui.Error("Could not remove all files. Please make sure Homa is not running and try again.")
		ui.Error("Error: " + err.Error())
	} else {
		ui.Success("Uninstall complete.")
	}
	pause()
}

func detectExtensionID() string {
	defaultID := config.DefaultExtensionID
	// Smart Check 1: Chrome Default Profile
	home, _ := os.UserHomeDir()
	if runtime.GOOS == "windows" {
		chromePath := filepath.Join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "Extensions", defaultID)
		if _, err := os.Stat(chromePath); err == nil {
			ui.Success(fmt.Sprintf("Detected Homa Extension installed! (ID: %s)", defaultID))
			return defaultID
		}
	}
	// Fallback
	return defaultID
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func pause() {
	ui.Pause()
}
