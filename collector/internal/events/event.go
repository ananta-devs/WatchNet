package events

import (
	"encoding/json"
	"time"
)

type DeviceEvent struct {
	DeviceMAC string                 `json:"device_mac"`
	IPv4      string                 `json:"ipv4,omitempty"`
	IPv6      string                 `json:"ipv6,omitempty"`
	Vendor    string                 `json:"vendor,omitempty"`
	Interface string                 `json:"interface"`
	EventType string                 `json:"event_type"` // e.g. "DEVICE_ONLINE", "DEVICE_OFFLINE", "ARP_DISCOVERED"
	Payload   map[string]interface{} `json:"payload,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

func NewDeviceEvent(mac, ipv4, eventType, iface string, payload map[string]interface{}) *DeviceEvent {
	return &DeviceEvent{
		DeviceMAC: mac,
		IPv4:      ipv4,
		EventType: eventType,
		Interface: iface,
		Payload:   payload,
		Timestamp: time.Now().UTC(),
	}
}

func (e *DeviceEvent) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}
