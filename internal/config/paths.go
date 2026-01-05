package config

import (
	"os"
	"path/filepath"
	"runtime"
)

const (
	HostName            = "com.xray.native.bridge"
	ManifestNameChrome  = "nm_manifest_chrome.json"
	ManifestNameFirefox = "nm_manifest_firefox.json"

	// Default ID if none provided (should be ideally passed during build or install)
	DefaultExtensionID = "gpicgkilhllpbeinpfonhpealagmhblp"

	// Firefox requires a specific email-like ID in manifest.json
	FirefoxExtensionID = "homa@foxfig.lol"
)

// App Structure:
// Root/
//  ├── bin/ (executables)
//  ├── config/ (logs, json)
//  └── manifest.json

func GetInstallDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	switch runtime.GOOS {
	case "windows":
		local := os.Getenv("LOCALAPPDATA")
		if local == "" {
			local = home
		}
		return filepath.Join(local, "Homa"), nil
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Homa"), nil
	case "linux":
		config := os.Getenv("XDG_CONFIG_HOME")
		if config == "" {
			config = filepath.Join(home, ".config")
		}
		return filepath.Join(config, "homa"), nil
	default:
		return filepath.Join(home, "homa"), nil
	}
}

func GetBinDir(installDir string) string {
	return filepath.Join(installDir, "bin")
}

func GetConfigDir(installDir string) string {
	return filepath.Join(installDir, "config")
}

func GetLogFile(installDir string) string {
	return filepath.Join(GetConfigDir(installDir), "homa.log")
}
