# WatchNet Event Processing Architecture

**Document Version:** 1.0.0  
**Broker:** Redis 7 Streams  
**Processing Engine:** Asynchronous Python Event Workers  

---

## 1. Event Pipeline Lifecycle

Every network discovery sighting flows through an event-driven processing pipeline that handles deduplication, state transitions, and alert dispatching.

```
[ Raw Discovery Sighting ]
            |
            v
[ Redis Stream: stream:raw_sightings ]
            |
            v
[ WatchNet Ingestion Worker ]
            |-- 1. MAC Address Normalization & Lookup
            |-- 2. IP Address Conflict Detection
            |-- 3. Device Presence State Transition
            |
            +---> [ State: UNKNOWN -> NEW ]
            |          |-- Create Device Record
            |          |-- Dispatch New Device Alert (High Priority)
            |          \-- Enqueue Fingerprinting Task
            |
            +---> [ State: OFFLINE -> ONLINE ]
            |          |-- Close Previous Session (if open)
            |          |-- Open New Connection Session
            |          \-- Update dev_last_connection
            |
            \---> [ State: ONLINE -> OFFLINE ] (Heartbeat Timeout)
                       |-- Mark Session Disconnected
                       \-- Dispatch Disconnect Notification (if configured)
```

---

## 2. Session Correlation & Heartbeat Timeout

- **Continuous Heartbeat**: Collectors post periodic sightings for active devices.
- **Heartbeat Expiry Sweep**: An asynchronous worker checks active sessions every 60 seconds. Devices with no sightings past the configurable inactivity window (default: 180 seconds) are transitioned to `OFFLINE`, and their open `device_sessions` record is closed with a recorded `disconnected_at` timestamp.
