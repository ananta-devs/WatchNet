package discovery

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// NeighborEntry represents an active ARP/Neighbor cache entry
type NeighborEntry struct {
	IP        string `json:"ip"`
	MAC       string `json:"mac"`
	Interface string `json:"interface"`
	State     string `json:"state"` // REACHABLE, STALE, PERMANENT, etc.
}

// IPNeighReader reads system ARP / IP neighbor tables
type IPNeighReader struct{}

// NewIPNeighReader creates a reader instance
func NewIPNeighReader() *IPNeighReader {
	return &IPNeighReader{}
}

// ReadNeighbors retrieves entries from /proc/net/arp, ip neigh, or platform equivalent
func (r *IPNeighReader) ReadNeighbors() ([]NeighborEntry, error) {
	if runtime.GOOS == "linux" {
		// First try reading /proc/net/arp directly (fastest on Linux)
		entries, err := r.readProcNetARP()
		if err == nil && len(entries) > 0 {
			return entries, nil
		}
		// Fallback to `ip neigh show`
		return r.readIPNeighCmd()
	}

	// Windows or Darwin fallback
	return r.readPlatformARPCache()
}

// readProcNetARP parses /proc/net/arp
// Format:
// IP address       HW type     Flags       HW address            Mask     Device
// 192.168.1.1      0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0
func (r *IPNeighReader) readProcNetARP() ([]NeighborEntry, error) {
	file, err := os.Open("/proc/net/arp")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var entries []NeighborEntry
	scanner := bufio.NewScanner(file)
	isHeader := true

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if isHeader {
			isHeader = false
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 6 {
			ip := fields[0]
			hwType := fields[1]
			flags := fields[2]
			mac := strings.ToLower(fields[3])
			dev := fields[5]

			// Skip invalid MACs or zero MACs (00:00:00:00:00:00)
			if mac == "00:00:00:00:00:00" || flags == "0x0" {
				continue
			}
			if _, err := net.ParseMAC(mac); err == nil {
				entries = append(entries, NeighborEntry{
					IP:        ip,
					MAC:       mac,
					Interface: dev,
					State:     fmt.Sprintf("flags=%s,hw=%s", flags, hwType),
				})
			}
		}
	}
	return entries, scanner.Err()
}

// readIPNeighCmd parses output of `ip -4 neigh show`
// Example output:
// 192.168.1.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE
func (r *IPNeighReader) readIPNeighCmd() ([]NeighborEntry, error) {
	cmd := exec.Command("ip", "-4", "neigh", "show")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var entries []NeighborEntry
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.Contains(line, "FAILED") {
			continue
		}
		fields := strings.Fields(line)
		// Expected: <ip> dev <dev> lladdr <mac> <state>
		var ip, dev, mac, state string
		for i := 0; i < len(fields); i++ {
			if i == 0 {
				ip = fields[i]
			} else if fields[i] == "dev" && i+1 < len(fields) {
				dev = fields[i+1]
				i++
			} else if fields[i] == "lladdr" && i+1 < len(fields) {
				mac = strings.ToLower(fields[i+1])
				i++
			} else {
				state = fields[i]
			}
		}
		if ip != "" && mac != "" {
			if _, err := net.ParseMAC(mac); err == nil {
				entries = append(entries, NeighborEntry{
					IP:        ip,
					MAC:       mac,
					Interface: dev,
					State:     state,
				})
			}
		}
	}
	return entries, nil
}

// readPlatformARPCache executes `arp -a` for cross-platform compatibility (Windows, macOS)
func (r *IPNeighReader) readPlatformARPCache() ([]NeighborEntry, error) {
	cmd := exec.Command("arp", "-a")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var entries []NeighborEntry
	lines := strings.Split(string(out), "\n")
	currentIface := "default"

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Interface:") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				currentIface = parts[1]
			}
			continue
		}

		fields := strings.Fields(line)
		if len(fields) >= 2 {
			// Check if field[0] is an IP
			parsedIP := net.ParseIP(fields[0])
			if parsedIP != nil && parsedIP.To4() != nil {
				macCandidate := strings.ReplaceAll(fields[1], "-", ":")
				if hw, err := net.ParseMAC(macCandidate); err == nil && len(hw) == 6 {
					macStr := strings.ToLower(hw.String())
					if macStr != "00:00:00:00:00:00" && macStr != "ff:ff:ff:ff:ff:ff" {
						state := "dynamic"
						if len(fields) >= 3 {
							state = fields[2]
						}
						entries = append(entries, NeighborEntry{
							IP:        parsedIP.String(),
							MAC:       macStr,
							Interface: currentIface,
							State:     state,
						})
					}
				}
			}
		}
	}
	return entries, nil
}
