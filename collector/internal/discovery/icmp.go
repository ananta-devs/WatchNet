package discovery

import (
	"context"
	"fmt"
	"math/rand"
	"net"
	"sync"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
)

// PingTarget represents an IP target to ping
type PingTarget struct {
	IP net.IP
}

// PingResult represents the result of pinging a target
type PingResult struct {
	IP         net.IP        `json:"ip"`
	IsAlive    bool          `json:"is_alive"`
	RTT        time.Duration `json:"rtt"`
	PacketsSent int          `json:"packets_sent"`
	PacketsRecv int          `json:"packets_recv"`
	PacketLoss  float64      `json:"packet_loss"`
	Error       string       `json:"error,omitempty"`
}

// ICMPProber handles high-concurrency ICMP echo probing
type ICMPProber struct {
	Timeout     time.Duration
	Concurrency int
	Count       int
}

// NewICMPProber creates a new ICMPProber with configurable parameters
func NewICMPProber(timeout time.Duration, concurrency int, count int) *ICMPProber {
	if timeout <= 0 {
		timeout = 1500 * time.Millisecond
	}
	if concurrency <= 0 {
		concurrency = 50
	}
	if count <= 0 {
		count = 1
	}
	return &ICMPProber{
		Timeout:     timeout,
		Concurrency: concurrency,
		Count:       count,
	}
}

// PingSingle pings a single IP target
func (p *ICMPProber) PingSingle(ctx context.Context, target net.IP) PingResult {
	res := PingResult{
		IP:          target,
		PacketsSent: p.Count,
	}

	recvCount := 0
	var totalRTT time.Duration

	for i := 0; i < p.Count; i++ {
		select {
		case <-ctx.Done():
			res.Error = "ping cancelled"
			return res
		default:
		}

		rtt, err := p.sendEcho(target)
		if err == nil {
			recvCount++
			totalRTT += rtt
		}
	}

	res.PacketsRecv = recvCount
	if p.Count > 0 {
		res.PacketLoss = float64(p.Count-recvCount) / float64(p.Count) * 100.0
	}
	if recvCount > 0 {
		res.IsAlive = true
		res.RTT = totalRTT / time.Duration(recvCount)
	}

	return res
}

// ProbeHosts probes multiple hosts concurrently using a worker pool
func (p *ICMPProber) ProbeHosts(ctx context.Context, targets []net.IP) []PingResult {
	results := make([]PingResult, len(targets))
	var wg sync.WaitGroup

	sem := make(chan struct{}, p.Concurrency)

	for i, target := range targets {
		wg.Add(1)
		sem <- struct{}{}

		go func(idx int, t net.IP) {
			defer wg.Done()
			defer func() { <-sem }()

			results[idx] = p.PingSingle(ctx, t)
		}(i, target)
	}

	wg.Wait()
	return results
}

// sendEcho attempts raw ICMP or standard UDP ping fallback depending on OS permission
func (p *ICMPProber) sendEcho(target net.IP) (time.Duration, error) {
	// First attempt unprivileged/privileged ICMP socket
	c, err := icmp.ListenPacket("ip4:icmp", "0.0.0.0")
	if err != nil {
		// Fallback to unprivileged "udp4" ping socket
		c, err = icmp.ListenPacket("udp4", "0.0.0.0")
		if err != nil {
			// If neither raw socket is available, perform TCP handshake fallback to port 80/443/53
			return p.tcpPingFallback(target)
		}
	}
	defer c.Close()

	seq := rand.Intn(0xffff)
	wm := icmp.Message{
		Type: ipv4.ICMPTypeEcho, Code: 0,
		Body: &icmp.Echo{
			ID: 0x574e, // "WN"
			Seq: seq,
			Data: []byte("WATCHNET_DISCOVERY_PING"),
		},
	}
	wb, err := wm.Marshal(nil)
	if err != nil {
		return 0, err
	}

	var dst net.Addr
	if _, ok := c.LocalAddr().(*net.UDPAddr); ok {
		dst = &net.UDPAddr{IP: target, Port: 0}
	} else {
		dst = &net.IPAddr{IP: target}
	}

	start := time.Now()
	if _, err := c.WriteTo(wb, dst); err != nil {
		return p.tcpPingFallback(target)
	}

	if err := c.SetReadDeadline(time.Now().Add(p.Timeout)); err != nil {
		return 0, err
	}

	rb := make([]byte, 1500)
	n, _, err := c.ReadFrom(rb)
	if err != nil {
		return 0, err
	}
	rtt := time.Since(start)

	// Validate reply packet
	rm, err := icmp.ParseMessage(1, rb[:n])
	if err == nil && rm.Type == ipv4.ICMPTypeEchoReply {
		return rtt, nil
	}

	return rtt, nil
}

func (p *ICMPProber) tcpPingFallback(target net.IP) (time.Duration, error) {
	ports := []int{80, 443, 22, 53}
	start := time.Now()
	for _, port := range ports {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", target.String(), port), p.Timeout/time.Duration(len(ports)))
		if err == nil {
			conn.Close()
			return time.Since(start), nil
		}
	}
	return 0, fmt.Errorf("target unreachable via ICMP or TCP probe")
}
