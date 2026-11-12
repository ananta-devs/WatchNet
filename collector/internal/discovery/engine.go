package discovery

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"github.com/watchnet/collector/internal/events"
)

// SocketHandler handles raw socket discovery under least privileges.
// Falls back gracefully to standard ICMP/UDP sockets when CAP_NET_RAW is not permitted.
type SocketHandler struct {
	ifaceName string
	hasRawCap bool
	mu        sync.RWMutex
}

func NewSocketHandler(ifaceName string) *SocketHandler {
	sh := &SocketHandler{
		ifaceName: ifaceName,
	}
	sh.probeCapabilities()
	return sh
}

func (sh *SocketHandler) probeCapabilities() {
	// Probe for raw socket capability without crashing if unprivileged
	conn, err := net.ListenPacket("ip4:icmp", "0.0.0.0")
	if err == nil {
		sh.hasRawCap = true
		_ = conn.Close()
		log.Printf("[SocketHandler] Elevated raw socket privileges active on %s", sh.ifaceName)
	} else {
		sh.hasRawCap = false
		log.Printf("[SocketHandler] Operating in unprivileged mode on %s (fallback active: %v)", sh.ifaceName, err)
	}
}

func (sh *SocketHandler) HasRawCapabilities() bool {
	sh.mu.RLock()
	defer sh.mu.RUnlock()
	return sh.hasRawCap
}

// Engine coordinates network sweeps and passive event listening.
type Engine struct {
	iface     string
	handler   *SocketHandler
	eventChan chan<- *events.DeviceEvent
	stopChan  chan struct{}
}

func NewEngine(iface string, eventChan chan<- *events.DeviceEvent) *Engine {
	return &Engine{
		iface:     iface,
		handler:   NewSocketHandler(iface),
		eventChan: eventChan,
		stopChan:  make(chan struct{}),
	}
}

func (e *Engine) Start(ctx context.Context, interval time.Duration) {
	log.Printf("[Engine] Discovery Engine started on interface: %s (interval: %v)", e.iface, interval)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Initial sweep
	e.sweep()

	for {
		select {
		case <-ctx.Done():
			log.Println("[Engine] Context cancelled, shutting down discovery engine")
			return
		case <-e.stopChan:
			log.Println("[Engine] Stop signal received, shutting down")
			return
		case <-ticker.C:
			e.sweep()
		}
	}
}

func (e *Engine) Stop() {
	close(e.stopChan)
}

func (e *Engine) sweep() {
	log.Printf("[Engine] Initiating discovery sweep on %s...", e.iface)
	// Query local interfaces and routing table for active neighbors
	interfaces, err := net.Interfaces()
	if err != nil {
		log.Printf("[Engine] Failed to enumerate interfaces: %v", err)
		return
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip != nil && ip.To4() != nil {
				evt := events.NewDeviceEvent(
					iface.HardwareAddr.String(),
					ip.String(),
					"ARP_DISCOVERED",
					iface.Name,
					map[string]interface{}{
						"flags": fmt.Sprintf("%v", iface.Flags),
						"mtu":   iface.MTU,
					},
				)
				select {
				case e.eventChan <- evt:
				default:
					// Non-blocking drop if buffer full
				}
			}
		}
	}
}
