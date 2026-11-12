package main

import (
	"bytes"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/watchnet/collector/internal/config"
	"github.com/watchnet/collector/internal/discovery"
	"github.com/watchnet/collector/internal/events"
)

func main() {
	cfg := config.LoadConfig()
	log.Printf("[Main] WatchNet Collector Daemon starting up...")
	log.Printf("[Main] Config: Interface=%s, BackendURL=%s, RedisAddr=%s, Interval=%ds",
		cfg.Interface, cfg.BackendURL, cfg.RedisAddr, cfg.ScanIntervalSec)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	eventBuffer := make(chan *events.DeviceEvent, 1000)
	engine := discovery.NewEngine(cfg.Interface, eventBuffer)

	// Forwarder routine
	go func() {
		client := &http.Client{Timeout: 5 * time.Second}
		for {
			select {
			case <-ctx.Done():
				return
			case evt := <-eventBuffer:
				data, err := evt.ToJSON()
				if err != nil {
					log.Printf("[Forwarder] JSON serialization error: %v", err)
					continue
				}
				endpoint := cfg.BackendURL + "/api/v1/devices/events"
				resp, err := client.Post(endpoint, "application/json", bytes.NewBuffer(data))
				if err != nil {
					// Backend might be warming up or offline, log and continue
					log.Printf("[Forwarder] Warning: Failed to dispatch event to %s: %v", endpoint, err)
					continue
				}
				resp.Body.Close()
			}
		}
	}()

	// Start discovery engine
	go engine.Start(ctx, time.Duration(cfg.ScanIntervalSec)*time.Second)

	log.Println("[Main] Collector running. Press CTRL+C to terminate.")
	<-sigChan
	log.Println("[Main] Shutdown signal received, terminating collector...")
	engine.Stop()
	cancel()
	time.Sleep(500 * time.Millisecond)
	log.Println("[Main] Collector stopped cleanly.")
}
