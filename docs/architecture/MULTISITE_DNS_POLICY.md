# Multi-Site Communication & DNS Policy Enforcement

**Document Version:** 1.0.0  

---

## 1. Multi-Site Distributed Communication Diagram

In multi-site deployments, remote edge collectors and satellite instances stream telemetry back to the centralized WatchNet control plane across untrusted WAN networks:

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     REMOTE SITE A (BRANCH)      │           │     REMOTE SITE B (CAMPUS)      │
│  - Edge Go Collector Daemon     │           │  - Edge Go Collector Daemon     │
│  - Local Observation Buffer     │           │  - Local Observation Buffer     │
└────────────────┬────────────────┘           └────────────────┬────────────────┘
                 │                                             │
                 │ Mutual TLS (mTLS)                           │ Mutual TLS (mTLS)
                 │ Encrypted HTTP/2 or WSS                     │ Encrypted HTTP/2 or WSS
                 ▼                                             ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        CENTRAL WATCHNET INGRESS CLUSTER                       │
│  - Load Balancer / Edge Proxy (Caddy / Nginx)                                 │
│  - mTLS Termination & Edge Node Cert Verification                            │
│  - Rate Limiting & Egress Filtering                                           │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Internal Secure Bus
                                       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT API & STORAGE TIER                        │
│  - Maps Site Agent ID to Tenant UUID                                          │
│  - Applies PostgreSQL Row-Level Security (RLS) Isolation                      │
│  - Publishes Site Events to Tenant Redis Channels                             │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DNS Filtering & Policy Enforcement Boundary Diagram

WatchNet interfaces with DNS sinkholes (Pi-hole, AdGuard Home) strictly via clean read-only analytics and policy sync APIs:

```
┌─────────────────────────┐                   ┌─────────────────────────┐
│       USER CLIENT       │                   │       USER CLIENT       │
└────────────┬────────────┘                   └────────────┬────────────┘
             │ Port 53 DNS Queries                         │ Port 53 DNS Queries
             ▼                                             ▼
┌───────────────────────────────────────────────────────────────────────┐
│               LOCAL DNS RESOLVER (Pi-hole / AdGuard Home)             │
│  - Enforces Blocklists & Domain Sinkholing                            │
│  - Answers Internal Domain Queries                                    │
│  - Logs Query Metrics & Block Statistics                              │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   │ Read-Only Polling via HTTPS REST API
                                   │ (Bounded Anti-SSRF Connector)
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│                          WATCHNET ADAPTER CORE                        │
│  - Parses Total Blocked Queries & Top Domains                         │
│  - Normalizes Client IP to Device MAC Mapping                         │
│  - STRICT INVARIANT: Visualized as DNS statistics, NEVER browser web   │
│    browsing history.                                                  │
└───────────────────────────────────────────────────────────────────────┘
```
