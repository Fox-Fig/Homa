package xray

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"v2rayng-extension/internal/config"
)

var coreProcess *exec.Cmd

// Start launches the Xray core with the provided outbound configuration.
// It returns the local SOCKS port, a unique ID (if needed), or error.
func Start(installDir string, outboundJSON json.RawMessage) (int, error) {
	// Stop existing if any (simple singleton management for now)
	Stop()

	// 1. Find free port
	port, err := getFreePort()
	if err != nil {
		return 0, fmt.Errorf("no free port: %v", err)
	}

	// 2. Generate Config
	fullConfig, err := generateConfig(port, outboundJSON)
	if err != nil {
		return 0, err
	}

	// 3. Write Config File
	configDir := config.GetConfigDir(installDir)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return 0, err
	}

	configPath := filepath.Join(configDir, "config_run.json")
	if err := os.WriteFile(configPath, fullConfig, 0644); err != nil {
		return 0, err
	}

	// 4. Run Xray
	binDir := config.GetBinDir(installDir)
	xrayPath := filepath.Join(binDir, "xray")
	if runtimeInfo() == "windows" {
		xrayPath += ".exe"
	}

	cmd := exec.Command(xrayPath, "-c", configPath)

	// Redirect logs or silence them to avoid interfering with Stdout
	logFile := config.GetLogFile(installDir)
	f, _ := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f != nil {
		cmd.Stderr = f
		cmd.Stdout = f // Xray stdout is logs
	}

	if err := cmd.Start(); err != nil {
		return 0, fmt.Errorf("failed to start xray: %v", err)
	}

	coreProcess = cmd

	// Wait a bit for startup?
	time.Sleep(200 * time.Millisecond)

	return port, nil
}

func Stop() error {
	if coreProcess != nil && coreProcess.Process != nil {
		coreProcess.Process.Kill()
		coreProcess.Wait() // Reaps the zombie
		coreProcess = nil
	}
	return nil
}

// StartTest launches a temporary Xray core for testing.
// Returns port, cleanup function, or error.
func StartTest(installDir string, outboundJSON json.RawMessage) (int, func(), error) {
	// 1. Find free port
	port, err := getFreePort()
	if err != nil {
		return 0, nil, fmt.Errorf("no free port: %v", err)
	}

	// 2. Generate Config
	fullConfig, err := generateConfig(port, outboundJSON)
	if err != nil {
		return 0, nil, err
	}

	// 3. Write Temp Config
	// Use a unique name to avoid conflict with main config
	configDir := config.GetConfigDir(installDir)
	os.MkdirAll(configDir, 0755)

	tmpName := fmt.Sprintf("config_test_%d.json", port)
	configPath := filepath.Join(configDir, tmpName)
	if err := os.WriteFile(configPath, fullConfig, 0644); err != nil {
		return 0, nil, err
	}

	// 4. Run Xray
	binDir := config.GetBinDir(installDir)
	xrayPath := filepath.Join(binDir, "xray")
	if runtimeInfo() == "windows" {
		xrayPath += ".exe"
	}

	cmd := exec.Command(xrayPath, "-c", configPath)
	// No logs for test usually, or temp logs

	if err := cmd.Start(); err != nil {
		os.Remove(configPath)
		return 0, nil, fmt.Errorf("failed to start xray: %v", err)
	}

	// Cleanup Closure
	cleanup := func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		cmd.Wait()
		os.Remove(configPath)
	}

	time.Sleep(200 * time.Millisecond) // Wait for bind
	return port, cleanup, nil
}

// --- Helpers ---

func generateConfig(port int, outbound json.RawMessage) ([]byte, error) {
	var outboundObj interface{}
	if err := json.Unmarshal(outbound, &outboundObj); err != nil {
		return nil, fmt.Errorf("invalid outbound json: %v", err)
	}

	// Standard Template
	cfg := map[string]interface{}{
		"log": map[string]string{"loglevel": "warning"},
		"inbounds": []interface{}{
			map[string]interface{}{
				"port":     port,
				"protocol": "socks",
				"settings": map[string]interface{}{
					"auth": "noauth",
					"udp":  true,
				},
				"sniffing": map[string]interface{}{
					"enabled":      true,
					"destOverride": []string{"http", "tls"},
				},
			},
		},
		"dns": map[string]interface{}{
			"servers":       []string{"8.8.8.8", "1.1.1.1"},
			"queryStrategy": "UseIPv4",
		},
		"outbounds": []interface{}{
			outboundObj,
			map[string]interface{}{
				"protocol": "freedom",
				"tag":      "direct",
				"settings": map[string]interface{}{
					"domainStrategy": "UseIPv4",
				},
			},
		},
	}

	return json.MarshalIndent(cfg, "", "  ")
}

func getFreePort() (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}
	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func runtimeInfo() string {
	return runtime.GOOS
}
