package discovery

import (
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/gosnmp/gosnmp"
)

// SNMPMapping represents an IP-to-MAC-to-Port mapping retrieved via SNMP
type SNMPMapping struct {
	TargetHost string `json:"target_host"`
	IP         string `json:"ip"`
	MAC        string `json:"mac"`
	PortIndex  int    `json:"port_index"`
	TableType  string `json:"table_type"` // "ipNetToMedia" or "dot1dTpFdb"
}

// SNMPDiscoveryWorker queries network switches and routers via SNMP
type SNMPDiscoveryWorker struct {
	Community string
	Port      uint16
	Timeout   time.Duration
	Retries   int
	Version   gosnmp.SnmpVersion
}

// NewSNMPDiscoveryWorker initializes a new worker
func NewSNMPDiscoveryWorker(community string, port uint16, timeout time.Duration) *SNMPDiscoveryWorker {
	if community == "" {
		community = "public"
	}
	if port == 0 {
		port = 161
	}
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &SNMPDiscoveryWorker{
		Community: community,
		Port:      port,
		Timeout:   timeout,
		Retries:   1,
		Version:   gosnmp.Version2c,
	}
}

// WalkDevice performs discovery on an SNMP-enabled gateway, switch, or router
func (w *SNMPDiscoveryWorker) WalkDevice(targetIP string) ([]SNMPMapping, error) {
	snmp := &gosnmp.GoSNMP{
		Target:    targetIP,
		Port:      w.Port,
		Community: w.Community,
		Version:   w.Version,
		Timeout:   w.Timeout,
		Retries:   w.Retries,
	}

	err := snmp.Connect()
	if err != nil {
		return nil, fmt.Errorf("snmp connect to %s failed: %w", targetIP, err)
	}
	defer snmp.Conn.Close()

	var mappings []SNMPMapping

	// 1. Walk ipNetToMediaPhysAddress (.1.3.6.1.2.1.4.22.1.2) - ARP Table on routers/switches
	const oidIPNetToMediaPhysAddress = ".1.3.6.1.2.1.4.22.1.2"
	_ = snmp.Walk(oidIPNetToMediaPhysAddress, func(pdu gosnmp.SnmpPDU) error {
		// OID format: .1.3.6.1.2.1.4.22.1.2.<ifIndex>.<ip1>.<ip2>.<ip3>.<ip4>
		parts := strings.Split(strings.TrimPrefix(pdu.Name, oidIPNetToMediaPhysAddress+"."), ".")
		if len(parts) >= 5 {
			ip := strings.Join(parts[1:5], ".")
			var macStr string
			switch val := pdu.Value.(type) {
			case []byte:
				macStr = net.HardwareAddr(val).String()
			case string:
				macStr = net.HardwareAddr([]byte(val)).String()
			}
			if macStr != "" && macStr != "00:00:00:00:00:00" {
				mappings = append(mappings, SNMPMapping{
					TargetHost: targetIP,
					IP:         ip,
					MAC:        macStr,
					TableType:  "ipNetToMedia",
				})
			}
		}
		return nil
	})

	// 2. Walk dot1dTpFdbPort (.1.3.6.1.2.1.17.4.3.1.2) - Switch Bridge Forwarding Database
	const oidDot1dTpFdbPort = ".1.3.6.1.2.1.17.4.3.1.2"
	_ = snmp.Walk(oidDot1dTpFdbPort, func(pdu gosnmp.SnmpPDU) error {
		// OID format: .1.3.6.1.2.1.17.4.3.1.2.<mac1>.<mac2>.<mac3>.<mac4>.<mac5>.<mac6>
		parts := strings.Split(strings.TrimPrefix(pdu.Name, oidDot1dTpFdbPort+"."), ".")
		if len(parts) >= 6 {
			var b []byte
			for i := 0; i < 6; i++ {
				var bVal byte
				fmt.Sscanf(parts[i], "%d", &bVal)
				b = append(b, bVal)
			}
			hw := net.HardwareAddr(b).String()
			portIndex := gosnmp.ToBigInt(pdu.Value).Int64()
			if hw != "00:00:00:00:00:00" {
				mappings = append(mappings, SNMPMapping{
					TargetHost: targetIP,
					MAC:        hw,
					PortIndex:  int(portIndex),
					TableType:  "dot1dTpFdb",
				})
			}
		}
		return nil
	})

	return mappings, nil
}
