package platform

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"

	"v2rayng-extension/internal/config"
)

type Manifest struct {
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	Path              string   `json:"path"`
	Type              string   `json:"type"`
	AllowedOrigins    []string `json:"allowed_origins,omitempty"`
	AllowedExtensions []string `json:"allowed_extensions,omitempty"`
}

func CreateManifest(installDir string, hostExePath string, extensionID string, browserType string, filename string) error {
	// hostExePath should be absolute path to the .exe

	manifest := Manifest{
		Name:        config.HostName,
		Description: "Homa Native Bridge",
		Path:        hostExePath,
		Type:        "stdio",
	}

	if browserType == "chrome" {
		// Chrome/Edge/Brave use AllowedOrigins (Requires Chrome Extension ID)
		manifest.AllowedOrigins = []string{"chrome-extension://" + extensionID + "/"}
	} else if browserType == "firefox" {
		// Firefox uses AllowedExtensions (Requires Firefox Extension ID)
		manifest.AllowedExtensions = []string{config.FirefoxExtensionID}
	} else {
		// Fallback or "both" (deprecated logic, but for safety)
		manifest.AllowedOrigins = []string{"chrome-extension://" + extensionID + "/"}
		manifest.AllowedExtensions = []string{config.FirefoxExtensionID}
	}

	manifestPath := filepath.Join(installDir, filename)
	file, err := os.Create(manifestPath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(manifest)
}

func CheckAdmin() bool {
	if runtime.GOOS == "windows" {
		_, err := os.Open("\\\\.\\PHYSICALDRIVE0")
		return err == nil
	}
	return os.Geteuid() == 0 // Unix
}
