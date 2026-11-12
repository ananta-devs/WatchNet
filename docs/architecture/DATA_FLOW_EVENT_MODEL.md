# Network Collection Data-Flow & Event Model

**Document Version:** 1.0.0  

---

## 1. Network Discovery Pipeline

The WatchNet network collection pipeline is architected to guarantee real-time detection, zero lost events, and continuous discovery without locking application databases:

```
[Local Subnet / VLANs]
       │
       ▼ (Raw ARP / ICMP / mDNS frames)
┌──────────────────────────────────────────────────┐
│             WATCHNET COLLECTOR (Go)              │
│  - Raw Socket Sniffer / Prober                   │
│  - IP/MAC Normalization                          │
│  - Sliding Observation Buffer                    │
└──────────────────────┬───────────────────────────┘
                       │ HTTPS POST (Batch Observation Payload)
                       ▼
┌──────────────────────────────────────────────────┐
│              CORE API BACKEND (FastAPI)          │
│  - Collector Token Authentication                │
│  - Anti-Tamper & Egress Checks                   │
│  - Ingest Queue Dispatch                         │
└──────────────────────┬───────────────────────────┘
                       │ Enqueue Job
                       ▼
┌──────────────────────────────────────────────────┐
│             CELERY INGESTION WORKER              │
│  1. Match MAC against Device Registry (RLS scope)│
│  2. Vendor Resolution (Cached IEEE OUI)          │
│  3. IP Change & Session Transition Detector      │
│  4. Update Presence Ledger & Intervals           │
└──────────────┬───────────────────┬───────────────┘
               │                   │
               │ State Changes     │ Write Records
               ▼                   ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│        REDIS 7 PUB/SUB    │  │       POSTGRESQL 16       │
│  - Channel: `events:live` │  │  - `devices`              │
│  - Channel: `presence`    │  │  - `sessions`             │
└──────────────┬────────────┘  │  - `events`               │
               │               │  - `raw_observations`     │
               ▼               └───────────────────────────┘
┌───────────────────────────┐
│   CONNECTED WEB BROWSERS  │
│  - Live Topology Update   │
│  - Realtime Toast Alert   │
└───────────────────────────┘
```

---

## 2. Event Model & State Transitions

Network discovery events follow strict finite-state machine (FSM) semantics:

1. **`DEVICE_DISCOVERED`**: First time a MAC address is observed on the network.
   - Triggers `newdev` workflow rules.
   - Enqueues active fingerprinting and reverse DNS queries.
2. **`DEVICE_CONNECTED`**: Device transitions from offline to online.
   - Creates a new entry in `sessions` table.
   - Emits SSE connection notification to dashboard.
3. **`DEVICE_DISCONNECTED`**: Device missed consecutive scan intervals exceeding the grace threshold.
   - Closes the active session interval (`sesDateTimeDisconnection`).
   - Computes total session duration.
4. **`IP_CHANGED`**: An existing device MAC announces a new IP address.
   - Logs an IP transition audit event.
   - Updates `devices.dev_ip`.
5. **`ROGUE_DEVICE_ALERT`**: An unknown device appears on a restricted network segment.
   - Dispatches emergency alert to configured notification publishers (Telegram, Email, Webhook).
