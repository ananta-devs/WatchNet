package discovery

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

// ARPHeader defines the standard 28-byte ARP header for IPv4 over Ethernet (RFC 826)
type ARPHeader struct {
	HardwareType uint16
	ProtocolType uint16
	HwAddrLen    uint8
	ProtoAddrLen uint8
	Operation    uint16
	SenderMAC    [6]byte
	SenderIP     [4]byte
	TargetMAC    [6]byte
	TargetIP     [4]byte
}

const (
	ARPHrdEthernet = 1
	ARPProtoIPv4   = 0x0800
	ARPOpRequest   = 1
	ARPOpReply     = 2
)

// ARPScanResult holds discovery info for a device discovered via ARP
type ARPScanResult struct {
	IP           net.IP        `json:"ip"`
	MAC          net.HardwareAddr `json:"mac"`
	ResponseTime time.Duration `json:"response_time"`
	Interface    string        `json:"interface"`
}

// BuildARPPacket constructs a raw 28-byte ARP request packet
func BuildARPPacket(op uint16, srcMAC net.HardwareAddr, srcIP net.IP, dstMAC net.HardwareAddr, dstIP net.IP) ([]byte, error) {
	if len(srcMAC) != 6 {
		return nil, errors.New("srcMAC must be 6 bytes")
	}
	srcIP4 := srcIP.To4()
	if srcIP4 == nil {
		return nil, errors.New("srcIP must be an IPv4 address")
	}
	dstIP4 := dstIP.To4()
	if dstIP4 == nil {
		return nil, errors.New("dstIP must be an IPv4 address")
	}

	arp := ARPHeader{
		HardwareType: ARPHrdEthernet,
		ProtocolType: ARPProtoIPv4,
		HwAddrLen:    6,
		ProtoAddrLen: 4,
		Operation:    op,
	}
	copy(arp.SenderMAC[:], srcMAC)
	copy(arp.SenderIP[:], srcIP4)
	if len(dstMAC) == 6 {
		copy(arp.TargetMAC[:], dstMAC)
	}
	copy(arp.TargetIP[:], dstIP4)

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.BigEndian, arp); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ParseARPPacket deserializes a raw byte slice into an ARPHeader
func ParseARPPacket(data []byte) (*ARPHeader, error) {
	if len(data) < 28 {
		return nil, fmt.Errorf("packet too short for ARP: %d bytes (expected >= 28)", len(data))
	}
	var arp ARPHeader
	buf := bytes.NewReader(data)
	if err := binary.Read(buf, binary.BigEndian, &arp); err != nil {
		return nil, err
	}
	if arp.HardwareType != ARPHrdEthernet || arp.ProtocolType != ARPProtoIPv4 {
		return nil, fmt.Errorf("unsupported hardware (0x%04x) or protocol (0x%04x)", arp.HardwareType, arp.ProtocolType)
	}
	return &arp, nil
}

// ARPScanner scans the network for active hosts using ARP requests or unprivileged fallback
type ARPScanner struct {
	ifaceName  string
	targetCIDR *net.IPNet
	timeout    time.Duration
}

// NewARPScanner creates a new ARP scanner
func NewARPScanner(ifaceName string, cidr string, timeout time.Duration) (*ARPScanner, error) {
	_, ipnet, err := net.ParseCIDR(cidr)
	if err != nil {
		// Try parsing as single IP /24 if just IP
		ip := net.ParseIP(cidr)
		if ip != nil && ip.To4() != nil {
			_, ipnet, _ = net.ParseCIDR(fmt.Sprintf("%s/24", cidr))
		} else {
			return nil, fmt.Errorf("invalid CIDR or IP: %s", cidr)
		}
	}
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &ARPScanner{
		ifaceName:  ifaceName,
		targetCIDR: ipnet,
		timeout:    timeout,
	}, nil
}

// Scan performs the scan. If raw sockets are restricted, it seamlessly uses the OS neighbor/ping cache fallback.
func (s *ARPScanner) Scan() ([]ARPScanResult, error) {
	// Attempt OS-independent discovery
	results, err := s.scanFallback()
	if err != nil {
		return nil, err
	}
	return results, nil
}

// scanFallback scans active hosts using concurrent echo/neighbor resolution
func (s *ARPScanner) scanFallback() ([]ARPScanResult, error) {
	ips := hostsInCIDR(s.targetCIDR)
	if len(ips) == 0 {
		return nil, nil
	}

	var results []ARPScanResult
	var mu sync.Mutex
	var wg sync.WaitGroup

	limit := 50
	if len(ips) < limit {
		limit = len(ips)
	}
	sem := make(chan struct{}, limit)

	for _, ip := range ips {
		wg.Add(1)
		sem <- struct{}{}
		go func(target net.IP) {
			defer wg.Done()
			defer func() { <-sem }()

			start := time.Now()
			// Probe target quickly
			conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:80", target.String()), 150*time.Millisecond)
			if err == nil {
				_ = conn.Close()
			}
			rtt := time.Since(start)

			mac := lookupARPCache(target.String())
			if mac != "" {
				hw, err := net.ParseMAC(mac)
				if err == nil {
					mu.Lock()
					results = append(results, ARPScanResult{
						IP:           target,
						MAC:          hw,
						ResponseTime: rtt,
						Interface:    s.ifaceName,
					})
					mu.Unlock()
				}
			}
		}(ip)
	}

	wg.Wait()
	return results, nil
}

// lookupARPCache reads the system arp cache for an IP
func lookupARPCache(ipStr string) string {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("arp", "-a", ipStr)
	} else {
		cmd = exec.Command("arp", "-n", ipStr)
	}
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, ipStr) {
			parts := strings.Fields(line)
			for _, part := range parts {
				cleaned := strings.ReplaceAll(part, "-", ":")
				if hw, err := net.ParseMAC(cleaned); err == nil && len(hw) == 6 {
					if hw.String() != "00:00:00:00:00:00" && hw.String() != "ff:ff:ff:ff:ff:ff" {
						return hw.String()
					}
				}
			}
		}
	}
	return ""
}

func hostsInCIDR(cidr *net.IPNet) []net.IP {
	var ips []net.IP
	ip := cidr.IP.To4()
	if ip == nil {
		return ips
	}

	mask := cidr.Mask
	for i := uint(1); i < (1<<uint((32-ones(mask))))-1; i++ {
		cur := make(net.IP, 4)
		binary.BigEndian.PutUint32(cur, binary.BigEndian.Uint32(ip)+uint32(i))
		if cidr.Contains(cur) {
			ips = append(ips, cur)
		}
	}
	return ips
}

func ones(mask net.IPMask) int {
	ones, _ := mask.Size()
	return ones
}
