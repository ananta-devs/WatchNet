package discovery

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

// DHCPLease represents an active lease parsed from DHCP server storage
type DHCPLease struct {
	IP        string    `json:"ip"`
	MAC       string    `json:"mac"`
	Hostname  string    `json:"hostname"`
	ClientID  string    `json:"client_id,omitempty"`
	ExpiresAt time.Time `json:"expires_at"`
	ServerType string   `json:"server_type"` // "dnsmasq", "isc-dhcp", "kea"
}

// DHCPLeaseParser handles parsing various lease file formats
type DHCPLeaseParser struct{}

func NewDHCPLeaseParser() *DHCPLeaseParser {
	return &DHCPLeaseParser{}
}

// ParseDnsmasq parses standard dnsmasq leases file
// Format:
// <epoch_expiry> <mac> <ip> <hostname> <client_id>
// Example:
// 1698765432 00:11:22:33:44:55 192.168.1.50 laptop-1 01:00:11:22:33:44:55
func (p *DHCPLeaseParser) ParseDnsmasq(r io.Reader) ([]DHCPLease, error) {
	var leases []DHCPLease
	scanner := bufio.NewScanner(r)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}

		expirySec, _ := strconv.ParseInt(parts[0], 10, 64)
		mac := strings.ToLower(parts[1])
		ip := parts[2]

		hostname := "*"
		if len(parts) >= 4 && parts[3] != "*" {
			hostname = parts[3]
		}
		clientID := ""
		if len(parts) >= 5 && parts[4] != "*" {
			clientID = parts[4]
		}

		// Validation
		if _, err := net.ParseMAC(mac); err != nil {
			continue
		}
		if parsedIP := net.ParseIP(ip); parsedIP == nil {
			continue
		}

		leases = append(leases, DHCPLease{
			IP:         ip,
			MAC:        mac,
			Hostname:   hostname,
			ClientID:   clientID,
			ExpiresAt:  time.Unix(expirySec, 0).UTC(),
			ServerType: "dnsmasq",
		})
	}
	return leases, scanner.Err()
}

// ParseISCDHCP parses standard ISC-DHCP-Server lease file (dhcpd.leases)
// Format:
// lease 192.168.1.150 {
//   starts 4 2026/04/09 08:00:00;
//   ends 4 2026/04/09 10:00:00;
//   hardware ethernet 00:11:22:33:44:55;
//   client-hostname "printer-office";
// }
func (p *DHCPLeaseParser) ParseISCDHCP(r io.Reader) ([]DHCPLease, error) {
	var leases []DHCPLease
	scanner := bufio.NewScanner(r)

	var currentIP string
	var currentMAC string
	var currentHost string
	var endsTime time.Time
	inLease := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "lease ") && strings.HasSuffix(line, "{") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				currentIP = parts[1]
				currentMAC = ""
				currentHost = ""
				endsTime = time.Time{}
				inLease = true
			}
			continue
		}
		if inLease {
			if strings.HasPrefix(line, "}") {
				if currentIP != "" && currentMAC != "" {
					leases = append(leases, DHCPLease{
						IP:         currentIP,
						MAC:        currentMAC,
						Hostname:   currentHost,
						ExpiresAt:  endsTime,
						ServerType: "isc-dhcp",
					})
				}
				inLease = false
				continue
			}

			if strings.HasPrefix(line, "hardware ethernet ") {
				val := strings.TrimSuffix(strings.TrimPrefix(line, "hardware ethernet "), ";")
				val = strings.TrimSpace(val)
				if _, err := net.ParseMAC(val); err == nil {
					currentMAC = strings.ToLower(val)
				}
			} else if strings.HasPrefix(line, "client-hostname ") {
				val := strings.TrimSuffix(strings.TrimPrefix(line, "client-hostname "), ";")
				val = strings.Trim(strings.TrimSpace(val), `"`)
				currentHost = val
			} else if strings.HasPrefix(line, "ends ") {
				// Format: ends <weekday> <YYYY/MM/DD> <HH:MM:SS>;
				val := strings.TrimSuffix(strings.TrimPrefix(line, "ends "), ";")
				parts := strings.Fields(val)
				if len(parts) >= 3 {
					tStr := parts[1] + " " + parts[2]
					t, err := time.Parse("2006/01/02 15:04:05", tStr)
					if err == nil {
						endsTime = t
					}
				}
			}
		}
	}
	return leases, scanner.Err()
}

// KeaLeaseFormat for parsing Kea DHCP4 lease JSON storage files
type KeaLeaseItem struct {
	Address string `json:"address"`
	HwAddr  string `json:"hw-address"`
	Host    string `json:"hostname"`
	ValidLifetime int64 `json:"valid-lft"`
	Expire int64  `json:"expire"`
}

type KeaLeaseFile struct {
	Leases []KeaLeaseItem `json:"leases"`
}

// ParseKeaJSON parses Kea DHCP4 JSON/CSV lease dumps
func (p *DHCPLeaseParser) ParseKeaJSON(r io.Reader) ([]DHCPLease, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}

	// Try JSON array or envelope
	var envelope KeaLeaseFile
	var items []KeaLeaseItem
	if err := json.Unmarshal(data, &envelope); err == nil && len(envelope.Leases) > 0 {
		items = envelope.Leases
	} else if err := json.Unmarshal(data, &items); err != nil {
		// Try CSV parsing for kea-leases4.csv
		return p.parseKeaCSV(string(data))
	}

	var leases []DHCPLease
	for _, item := range items {
		if _, err := net.ParseMAC(item.HwAddr); err == nil {
			leases = append(leases, DHCPLease{
				IP:         item.Address,
				MAC:        strings.ToLower(item.HwAddr),
				Hostname:   item.Host,
				ExpiresAt:  time.Unix(item.Expire, 0).UTC(),
				ServerType: "kea",
			})
		}
	}
	return leases, nil
}

func (p *DHCPLeaseParser) parseKeaCSV(content string) ([]DHCPLease, error) {
	var leases []DHCPLease
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if i == 0 || line == "" {
			// Skip header
			continue
		}
		cols := strings.Split(line, ",")
		if len(cols) >= 5 {
			// Typical Kea CSV: address,hwaddr,client_id,valid_lifetime,expire,subnet_id,fqdn_fwd,...
			addr := cols[0]
			hw := cols[1]
			exp, _ := strconv.ParseInt(cols[4], 10, 64)
			if _, err := net.ParseMAC(hw); err == nil {
				leases = append(leases, DHCPLease{
					IP:         addr,
					MAC:        strings.ToLower(hw),
					Hostname:   "",
					ExpiresAt:  time.Unix(exp, 0).UTC(),
					ServerType: "kea",
				})
			}
		}
	}
	return leases, nil
}

// ParseFile auto-detects and parses DHCP lease file at path
func (p *DHCPLeaseParser) ParseFile(filePath string) ([]DHCPLease, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	lower := strings.ToLower(filePath)
	if strings.Contains(lower, "dnsmasq") {
		return p.ParseDnsmasq(f)
	} else if strings.Contains(lower, "dhcpd") {
		return p.ParseISCDHCP(f)
	} else if strings.Contains(lower, "kea") {
		return p.ParseKeaJSON(f)
	}

	// Try dnsmasq first
	leases, err := p.ParseDnsmasq(f)
	if err == nil && len(leases) > 0 {
		return leases, nil
	}

	_, _ = f.Seek(0, 0)
	leases, err = p.ParseISCDHCP(f)
	if err == nil && len(leases) > 0 {
		return leases, nil
	}

	return nil, fmt.Errorf("unable to detect lease file format for %s", filePath)
}
