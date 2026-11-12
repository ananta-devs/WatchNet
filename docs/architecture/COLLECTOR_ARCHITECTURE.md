# WatchNet Collector Architecture

**Document Version:** 1.0.0  
**Binary:** `watchnet-collector`  
**Language:** Go 1.22+ / `gopacket` / `pcap` / Raw Sockets  

---

## 1. Collector Design Principles

1. **Least Privilege (`CAP_NET_RAW` only)**: The collector runs in an isolated container without root privileges, containing only the specific Linux capability required for raw packet inspection.
2. **Asynchronous Non-Blocking Discovery**: Leverages Go goroutines and channels to handle high-frequency packet capture without packet loss.
3. **Decoupled Architecture**: Communicates with the core backend via Redis streams or HTTPS/mTLS ingestion endpoints; collector failures do not disrupt the web UI or API.

---

## 2. Discovery Modules & Worker Routines

```
                       +-----------------------------+
                       |      Network Interface      |
                       |       (eth0 / wlan0)        |
                       +--------------+--------------+
                                      |
         +----------------------------+----------------------------+
         | (pcap listener)            | (raw socket sweep)         | (netlink socket)
+--------v-------------+     +--------v-------------+     +--------v-------------+
|    ARP & Broadcast   |     |      ICMP Ping       |     |  Linux Netlink RT    |
|    Packet Sniffer    |     |     Echo Worker      |     |   Neighbor Monitor   |
+--------+-------------+     +--------+-------------+     +--------+-------------+
         |                            |                            |
         +----------------------------+----------------------------+
                                      | (Go observation channel)
                       +--------------v--------------+
                       |     Batch Aggregator &      |
                       |     Deduplication Buffer    |
                       +--------------+--------------+
                                      |
                       +--------------v--------------+
                       |    Stream Ingestion Client  |
                       |   (Redis Streams / HTTP)    |
                       +-----------------------------+
```

### 2.1 Packet Capture Engines
- **ARP Engine**: Periodically injects ARP requests across local CIDRs and captures unsolicited ARP broadcasts to detect newly attached hosts instantaneously.
- **ICMP Engine**: Lightweight concurrent ICMP echo probes providing reachability confirmation and Round-Trip Time (RTT) latency measurements.
- **Netlink Monitor**: Subscribes to Linux kernel `RTM_NEWNEIGH` and `RTM_DELNEIGH` multicast groups for zero-latency kernel neighbor table events.
- **mDNS / SSDP Listener**: Passive listener capturing Zeroconf announcements to auto-resolve device models, printer names, and media servers.
