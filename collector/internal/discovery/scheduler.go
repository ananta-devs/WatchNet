package discovery

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/watchnet/collector/internal/events"
)

// ModuleConfig configures individual discovery modules
type ModuleConfig struct {
	EnableARP       bool          `json:"enable_arp"`
	EnableICMP      bool          `json:"enable_icmp"`
	EnableIPNeigh   bool          `json:"enable_ipneigh"`
	EnableDHCPLease bool          `json:"enable_dhcp_lease"`
	DHCPLeasePath   string        `json:"dhcp_lease_path"`
	EnableSNMP      bool          `json:"enable_snmp"`
	SNMPTargets     []string      `json:"snmp_targets"`
	SNMPCommunity   string        `json:"snmp_community"`
	ScanInterval    time.Duration `json:"scan_interval"`
	SubnetCIDR      string        `json:"subnet_cidr"`
	Interface       string        `json:"interface"`
}

// Scheduler orchestrates sweeps across all discovery workers
type Scheduler struct {
	config    ModuleConfig
	eventChan chan<- *events.DeviceEvent
	prober    *ICMPProber
	arpScan   *ARPScanner
	neigh     *IPNeighReader
	dhcp      *DHCPLeaseParser
	snmp      *SNMPDiscoveryWorker
	mu        sync.RWMutex
	running   bool
	stopChan  chan struct{}
}

// NewScheduler constructs the discovery sweep scheduler
func NewScheduler(cfg ModuleConfig, eventChan chan<- *events.DeviceEvent) (*Scheduler, error) {
	if cfg.ScanInterval <= 0 {
		cfg.ScanInterval = 60 * time.Second
	}
	if cfg.SubnetCIDR == "" {
		cfg.SubnetCIDR = "192.168.1.0/24"
	}
	arpScan, _ := NewARPScanner(cfg.Interface, cfg.SubnetCIDR, 2*time.Second)

	return &Scheduler{
		config:    cfg,
		eventChan: eventChan,
		prober:    NewICMPProber(1500*time.Millisecond, 40, 1),
		arpScan:   arpScan,
		neigh:     NewIPNeighReader(),
		dhcp:      NewDHCPLeaseParser(),
		snmp:      NewSNMPDiscoveryWorker(cfg.SNMPCommunity, 161, 2*time.Second),
		stopChan:  make(chan struct{}),
	}, nil
}

// Start begins the scheduled sweeps
func (s *Scheduler) Start(ctx context.Context) {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.mu.Unlock()

	log.Printf("[Scheduler] Starting discovery scheduler (interval: %v)", s.config.ScanInterval)
	ticker := time.NewTicker(s.config.ScanInterval)
	defer ticker.Stop()

	// Initial sweep
	s.RunSweep(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Println("[Scheduler] Context cancelled, shutting down scheduler")
			return
		case <-s.stopChan:
			log.Println("[Scheduler] Stop signal received")
			return
		case <-ticker.C:
			s.RunSweep(ctx)
		}
	}
}

// Stop terminates the scheduler
func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopChan)
		s.running = false
	}
}

// RunSweep executes all enabled discovery workers concurrently
func (s *Scheduler) RunSweep(ctx context.Context) {
	log.Printf("[Scheduler] Executing discovery sweep...")
	var wg sync.WaitGroup

	// 1. IP Neighbor Cache
	if s.config.EnableIPNeigh {
		wg.Add(1)
		go func() {
			defer wg.Done()
			entries, err := s.neigh.ReadNeighbors()
			if err != nil {
				log.Printf("[Scheduler] IPNeigh read error: %v", err)
				return
			}
			for _, entry := range entries {
				s.emitEvent(entry.MAC, entry.IP, "IPNEIGH_DISCOVERED", entry.Interface, map[string]interface{}{
					"state": entry.State,
				})
			}
		}()
	}

	// 2. DHCP Leases
	if s.config.EnableDHCPLease && s.config.DHCPLeasePath != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			leases, err := s.dhcp.ParseFile(s.config.DHCPLeasePath)
			if err != nil {
				log.Printf("[Scheduler] DHCP leases error: %v", err)
				return
			}
			for _, l := range leases {
				s.emitEvent(l.MAC, l.IP, "DHCP_LEASE_DISCOVERED", s.config.Interface, map[string]interface{}{
					"hostname":   l.Hostname,
					"server":     l.ServerType,
					"expires_at": l.ExpiresAt.Format(time.RFC3339),
				})
			}
		}()
	}

	// 3. ARP Scanner
	if s.config.EnableARP && s.arpScan != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results, err := s.arpScan.Scan()
			if err != nil {
				log.Printf("[Scheduler] ARP scan error: %v", err)
				return
			}
			for _, r := range results {
				s.emitEvent(r.MAC.String(), r.IP.String(), "ARP_DISCOVERED", r.Interface, map[string]interface{}{
					"rtt_ms": float64(r.ResponseTime.Microseconds()) / 1000.0,
				})
			}
		}()
	}

	// 4. SNMP Discovery
	if s.config.EnableSNMP && len(s.config.SNMPTargets) > 0 {
		for _, target := range s.config.SNMPTargets {
			wg.Add(1)
			go func(t string) {
				defer wg.Done()
				mappings, err := s.snmp.WalkDevice(t)
				if err != nil {
					log.Printf("[Scheduler] SNMP walk on %s error: %v", t, err)
					return
				}
				for _, m := range mappings {
					s.emitEvent(m.MAC, m.IP, "SNMP_DISCOVERED", s.config.Interface, map[string]interface{}{
						"source_gateway": m.TargetHost,
						"port_index":     m.PortIndex,
						"table":          m.TableType,
					})
				}
			}(target)
		}
	}

	wg.Wait()
	log.Printf("[Scheduler] Discovery sweep complete.")
}

func (s *Scheduler) emitEvent(mac, ip, evtType, iface string, meta map[string]interface{}) {
	if mac == "" || mac == "00:00:00:00:00:00" {
		return
	}
	evt := events.NewDeviceEvent(mac, ip, evtType, iface, meta)
	select {
	case s.eventChan <- evt:
	default:
		// Queue full, drop
	}
}
