package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime/debug"
	"time"
	"v2rayng-extension/internal/config"
	"v2rayng-extension/internal/messaging"
	"v2rayng-extension/internal/xray"
)

func main() {
	// --- Emergency Logging Setup ---
	// We use TempDir to avoid any permission/path issues during initial startup
	tempLog := filepath.Join(os.TempDir(), "homa_host_debug.log")
	f, err := os.OpenFile(tempLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		defer f.Close()
		// Multi-writer to write to both temp and eventually app log if possible?
		// For now just temp to be safe.
		log.SetOutput(f)
	}

	log.Printf("\n\n=== HOST STARTED (%s) ===\n", os.Args)
	pwd, _ := os.Getwd()
	log.Printf("CWD: %s\n", pwd)
	log.Printf("Exe: %s\n", os.Args[0])

	// Capture Panics
	defer func() {
		if r := recover(); r != nil {
			log.Printf("CRITICAL PANIC: %v\nStack: %s", r, debug.Stack())
		}
	}()

	// 1. Setup App Logging
	installDir, err := config.GetInstallDir()
	if err != nil {
		log.Printf("Error getting install dir: %v", err)
	} else {
		log.Printf("Install Dir Resolved: %s", installDir)
		// We can try to switch logging to the main file, but keep temp for valid bootstrap
	}

	// 2. Native Messaging Loop
	log.Println("Starting Message Loop...")

	// Ensure we don't block
	for {
		msg, err := messaging.ReadMessage()
		if err != nil {
			if err == io.EOF {
				log.Println("Stdin closed (Browser exited). Exiting.")
			} else {
				log.Printf("Read Error: %v. Exiting.", err)
			}
			xray.Stop()
			return
		}

		log.Printf("RX: %s (ID: %s)\n", msg.Cmd, msg.Id)

		resp := &messaging.Message{
			Id:  msg.Id,
			Cmd: msg.Cmd,
		}

		switch msg.Cmd {
		case "PING":
			resp.Status = "pong"
			resp.Data = "pong"
			log.Println("Replying PONG")

		case "TEST":
			log.Println("Processing TEST...")
			// Validation
			if msg.Config == nil {
				resp.Status = "error"
				resp.Error = "Config is missing"
			} else {
				// Handle Async Test
				// We launch a goroutine so we don't block other messages (like STOP)
				// But wait, the protocol is synchronous per message usually unless we use ID.
				// Our NativeHost JS handles async correlation via ID.
				// So we can block OR spawn. Spawning is safer.

				go func(m *messaging.Message) {
					// We need to send a NEW message with the result, referencing the ID.
					// But our main loop sends 'resp' at the end.
					// We must NOT send 'resp' for this case in the main loop if we go async.
					// Refactor: We can just do it synchronously for simplicity for now,
					// or return "pending" and send "TEST_CAKKBACK"?
					// Native JS expects the response to THIS request ID.

					// Let's do it synchronously for now to ensure reliability,
					// unless timeout allows. 10s timeout in JS.
					// Real ping takes 1-3s. It is fine to block main loop for 2s.

					port, cleanup, err := xray.StartTest(installDir, m.Config)
					if err != nil {
						reply := &messaging.Message{Id: m.Id, Cmd: m.Cmd, Status: "error", Error: err.Error()}
						messaging.WriteMessage(reply)
						return
					}
					defer cleanup()

					// Proxy Client
					proxyUrl, _ := url.Parse(fmt.Sprintf("socks5://127.0.0.1:%d", port))
					client := &http.Client{
						Transport: &http.Transport{Proxy: http.ProxyURL(proxyUrl)},
						Timeout:   5 * time.Second,
					}

					start := time.Now()
					r, err := client.Get("http://www.gstatic.com/generate_204")
					if err != nil {
						reply := &messaging.Message{Id: m.Id, Cmd: m.Cmd, Status: "error", Error: err.Error()}
						messaging.WriteMessage(reply)
						return
					}
					r.Body.Close()

					latency := time.Since(start).Milliseconds()
					if r.StatusCode == 204 || r.StatusCode == 200 {
						reply := &messaging.Message{Id: m.Id, Cmd: m.Cmd, Status: "ok", Data: latency}
						messaging.WriteMessage(reply)
					} else {
						reply := &messaging.Message{Id: m.Id, Cmd: m.Cmd, Status: "error", Error: fmt.Sprintf("HTTP %d", r.StatusCode)}
						messaging.WriteMessage(reply)
					}
				}(msg)

				// We SKIP sending the default response at loop end by hacking or creating a flow control?
				// The main loop writes `resp` at the bottom.
				// We should modify the loop structure or just `continue`.
				continue
			}

		case "START":
			log.Println("Processing START...")
			// Validation
			if msg.Config == nil {
				resp.Status = "error"
				resp.Error = "Config is missing"
			} else {
				port, err := xray.Start(installDir, msg.Config)
				if err != nil {
					log.Printf("Xray Start Error: %v\n", err)
					resp.Status = "error"
					resp.Error = err.Error()
				} else {
					log.Printf("Xray Started on port: %d\n", port)
					resp.Status = "ok"
					resp.Port = port
				}
			}

		case "STOP":
			log.Println("Processing STOP...")
			err := xray.Stop()
			if err != nil {
				resp.Status = "error"
				resp.Error = err.Error()
			} else {
				resp.Status = "ok"
			}

		default:
			log.Printf("Unknown Command: %s\n", msg.Cmd)
			resp.Status = "error"
			resp.Error = "unknown_command"
		}

		// Send Response
		log.Printf("TX: %s - %s\n", resp.Cmd, resp.Status)
		if err := messaging.WriteMessage(resp); err != nil {
			log.Printf("Write Error: %v. Exiting.\n", err)
			return
		}
	}
}
