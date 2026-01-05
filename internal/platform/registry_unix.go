//go:build !windows

package platform

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"v2rayng-extension/internal/config"
)

// Standard paths for Native Messaging Hosts
func getTargetPaths(browserType string) []string {
	home, _ := os.UserHomeDir()

	// Define base paths
	var chromePaths []string
	var firefoxPaths []string

	if runtime.GOOS == "darwin" {
		// macOS
		chromePaths = []string{
			filepath.Join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts"),
			filepath.Join(home, "Library", "Application Support", "Chromium", "NativeMessagingHosts"),
			filepath.Join(home, "Library", "Application Support", "Microsoft Edge", "NativeMessagingHosts"),
			filepath.Join(home, "Library", "Application Support", "Vivaldi", "NativeMessagingHosts"),
			filepath.Join(home, "Library", "Application Support", "BraveSoftware", "Brave-Browser", "NativeMessagingHosts"),
		}
		firefoxPaths = []string{
			filepath.Join(home, "Library", "Application Support", "Mozilla", "NativeMessagingHosts"),
		}
	} else {
		// Linux
		chromePaths = []string{
			filepath.Join(home, ".config", "google-chrome", "NativeMessagingHosts"),
			filepath.Join(home, ".config", "chromium", "NativeMessagingHosts"),
			filepath.Join(home, ".config", "microsoft-edge", "NativeMessagingHosts"),
			filepath.Join(home, ".config", "vivaldi", "NativeMessagingHosts"),
			filepath.Join(home, ".config", "BraveSoftware", "Brave-Browser", "NativeMessagingHosts"),
		}
		firefoxPaths = []string{
			filepath.Join(home, ".mozilla", "native-messaging-hosts"),
		}
	}

	if browserType == "firefox" {
		return firefoxPaths
	}
	// Default to chrome paths for "chrome" or any other type
	return chromePaths
}

func Register(installDir string, browserType string, manifestFilename string) error {
	manifestSrc := filepath.Join(installDir, manifestFilename)
	// Check if source manifest exists
	srcInput, err := os.ReadFile(manifestSrc)
	if err != nil {
		return fmt.Errorf("source manifest not found at %s: %v", manifestSrc, err)
	}

	// Get specific paths for this browser type
	targets := getTargetPaths(browserType)
	successCount := 0

	for _, dir := range targets {
		// Create the Host dir if the Browser config dir exists (or just force create)
		if err := os.MkdirAll(dir, 0755); err != nil {
			continue // Skip permission errors or such
		}

		manifestDst := filepath.Join(dir, config.HostName+".json")
		if err := os.WriteFile(manifestDst, srcInput, 0644); err == nil {
			fmt.Printf("Registered %s at: %s\n", browserType, manifestDst)
			successCount++
		}
	}

	if successCount == 0 {
		fmt.Printf("Warning: Could not register for %s in any standard path.\n", browserType)
	}
	return nil
}

func Unregister() error {
	// For uninstall, we want to clear ALL traces
	chromePaths := getTargetPaths("chrome")
	firefoxPaths := getTargetPaths("firefox")
	allPaths := append(chromePaths, firefoxPaths...)

	for _, dir := range allPaths {
		manifestDst := filepath.Join(dir, config.HostName+".json")
		os.Remove(manifestDst)
	}
	return nil
}

// CopyFile helper logic if needed elsewhere, but we used Read/WriteFile above
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
