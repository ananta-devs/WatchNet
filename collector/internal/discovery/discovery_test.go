package discovery

import (
	"bytes"
	"net"
	"strings"
	"testing"
	"time"
)

func TestARPSerialization(t *testing.T) {
	srcMAC, _ := net.ParseMAC("00:11:22:33:44:55")
	dstMAC, _ := net.ParseMAC("ff:ff:ff:ff:ff:ff")
	srcIP := net.ParseIP("192.168.1.10")
	dstIP := net.ParseIP("192.168.1.254")

	pkt, err := BuildARPPacket(ARPOpRequest, srcMAC, srcIP, dstMAC, dstIP)
	if err != nil {
		t.Fatalf("Failed to build ARP packet: %v", err)
	}

	if len(pkt) != 28 {
		t.Errorf("Expected ARP packet size 28, got %d", len(pkt))
	}

	parsed, err := ParseARPPacket(pkt)
	if err != nil {
		t.Fatalf("Failed to parse ARP packet: %v", err)
	}

	if parsed.Operation != ARPOpRequest {
		t.Errorf("Expected operation %d, got %d", ARPOpRequest, parsed.Operation)
	}
	if parsed.HardwareType != ARPHrdEthernet {
		t.Errorf("Expected hardware type %d, got %d", ARPHrdEthernet, parsed.HardwareType)
	}
	if parsed.ProtocolType != ARPProtoIPv4 {
		t.Errorf("Expected protocol type %d, got %d", ARPProtoIPv4, parsed.ProtocolType)
	}
	if !bytes.Equal(parsed.SenderMAC[:], srcMAC) {
		t.Errorf("Sender MAC mismatch: expected %s, got %s", srcMAC, net.HardwareAddr(parsed.SenderMAC[:]))
	}
	if !bytes.Equal(parsed.SenderIP[:], srcIP.To4()) {
		t.Errorf("Sender IP mismatch: expected %s, got %s", srcIP, net.IP(parsed.SenderIP[:]))
	}
}

func TestDHCPLeaseParsingDnsmasq(t *testing.T) {
	sampleLeases := `
# Dnsmasq leases
1700000000 11:22:33:44:55:66 192.168.1.120 my-laptop 01:11:22:33:44:55:66
1700000010 aa:bb:cc:dd:ee:ff 192.168.1.121 smart-tv *
`
	parser := NewDHCPLeaseParser()
	leases, err := parser.ParseDnsmasq(strings.NewReader(sampleLeases))
	if err != nil {
		t.Fatalf("Failed to parse dnsmasq leases: %v", err)
	}

	if len(leases) != 2 {
		t.Fatalf("Expected 2 leases, got %d", len(leases))
	}

	if leases[0].IP != "192.168.1.120" || leases[0].MAC != "11:22:33:44:55:66" || leases[0].Hostname != "my-laptop" {
		t.Errorf("Unexpected first lease data: %+v", leases[0])
	}

	if leases[1].IP != "192.168.1.121" || leases[1].Hostname != "smart-tv" || leases[1].ClientID != "" {
		t.Errorf("Unexpected second lease data: %+v", leases[1])
	}
}

func TestDHCPLeaseParsingISC(t *testing.T) {
	sampleISC := `
lease 192.168.1.55 {
  starts 4 2026/04/09 08:00:00;
  ends 4 2026/04/09 10:00:00;
  hardware ethernet 02:42:ac:11:00:02;
  client-hostname "printer-canon";
}
`
	parser := NewDHCPLeaseParser()
	leases, err := parser.ParseISCDHCP(strings.NewReader(sampleISC))
	if err != nil {
		t.Fatalf("Failed to parse ISC DHCP leases: %v", err)
	}
	if len(leases) != 1 {
		t.Fatalf("Expected 1 lease, got %d", len(leases))
	}
	if leases[0].IP != "192.168.1.55" || leases[0].Hostname != "printer-canon" || leases[0].MAC != "02:42:ac:11:00:02" {
		t.Errorf("Unexpected lease values: %+v", leases[0])
	}
}

func TestICMPProberInitialization(t *testing.T) {
	prober := NewICMPProber(500*time.Millisecond, 10, 2)
	if prober.Timeout != 500*time.Millisecond {
		t.Errorf("Expected timeout 500ms, got %v", prober.Timeout)
	}
	if prober.Concurrency != 10 {
		t.Errorf("Expected concurrency 10, got %d", prober.Concurrency)
	}
	if prober.Count != 2 {
		t.Errorf("Expected count 2, got %d", prober.Count)
	}
}
