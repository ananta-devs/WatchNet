# WatchNet Security Architecture

**Document Version:** 1.0.0  
**Classification:** Enterprise Security Specification  
**Status:** Canonical Baseline  

---

## 1. Security Architecture Principles

WatchNet is engineered from the ground up to prevent the architectural vulnerabilities common in legacy network monitoring tools:
1. **Defense-in-Depth**: Multi-layered defense spanning kernel capability restriction, container isolation, network perimeter guards, and application-level authorization.
2. **Principle of Least Privilege**: Each component runs under the minimal privileges necessary to perform its specific duty.
3. **Zero Raw Shell Invocations**: All network discovery and diagnostic tools execute via native language networking libraries or strictly parameterized subprocess APIs (`shell=False`).
4. **Anti-SSRF by Default**: Outbound HTTP requests from webhooks and router adapters pass through an egress validation filter blocking private, loopback, and link-local destinations.
5. **Authenticated Endpoints & Strong Cryptography**: All administrative actions require JWT Bearer authentication or cryptographically strong API keys. Passwords and secrets are hashed with Argon2id and encrypted with AES-256-GCM.

---

## 2. Component Security Boundaries

```
[ Untrusted External Network / Internet ]
                   |
     [ Firewall / Ingress Gateway ]
                   |
         +---------+---------+
         | (HTTP/S : 3000)   | (HTTP/S : 8000)
+--------v--------+ +--------v--------+
|   Next.js UI    | |   FastAPI Core   |
| (UID: 10001,    | | (UID: 10001,    |
|  Unprivileged)  | |  Unprivileged)  |
+-----------------+ +--------+--------+
                             |
             +---------------+---------------+
             | (Internal Redis Socket)       | (Internal PG Socket)
    +--------v--------+             +--------v--------+
    |     Redis 7     |             |  PostgreSQL 16  |
    | (Password Auth) |             | (TLS + RLS)     |
    +--------^--------+             +-----------------+
             |
    +--------+--------+
    | Go Collector    |
    | (Isolated Pod,  |
    |  CAP_NET_RAW)   |
    +-----------------+
```
