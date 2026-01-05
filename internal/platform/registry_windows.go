//go:build windows

package platform

import (
	"fmt"
	"path/filepath"
	"v2rayng-extension/internal/config"

	"golang.org/x/sys/windows/registry"
)

func Register(installDir string, browserType string, manifestFilename string) error {
	manifestPath := filepath.Join(installDir, manifestFilename)

	var keyPath string
	if browserType == "firefox" {
		keyPath = fmt.Sprintf(`Software\Mozilla\NativeMessagingHosts\%s`, config.HostName)
	} else {
		// Chrome / Edge
		keyPath = fmt.Sprintf(`Software\Google\Chrome\NativeMessagingHosts\%s`, config.HostName)
	}

	if err := setRegistryKey(keyPath, manifestPath); err != nil {
		return err
	}

	return nil
}

func Unregister() error {
	keyPath := fmt.Sprintf(`Software\Google\Chrome\NativeMessagingHosts\%s`, config.HostName)
	return deleteRegistryKey(keyPath)
}

func setRegistryKey(path string, value string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, path, registry.ALL_ACCESS)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue("", value)
}

func deleteRegistryKey(path string) error {
	return registry.DeleteKey(registry.CURRENT_USER, path)
}
