package events

import (
	"encoding/json"
	"testing"
)

func TestDeviceEventSerialization(t *testing.T) {
	evt := NewDeviceEvent("00:11:22:33:44:55", "192.168.1.50", "TEST_EVENT", "eth0", map[string]interface{}{"ping": 12})
	data, err := evt.ToJSON()
	if err != nil {
		t.Fatalf("Failed to serialize: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to deserialize: %v", err)
	}

	if parsed["device_mac"] != "00:11:22:33:44:55" {
		t.Errorf("MAC address mismatch")
	}
	if parsed["ipv4"] != "192.168.1.50" {
		t.Errorf("IPv4 mismatch")
	}
}
