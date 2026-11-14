# Security Policy

WatchNet takes the security of network monitoring and home/enterprise infrastructure with utmost seriousness. Because WatchNet interacts with raw network sockets, routers, DNS servers, and sensitive family browsing metadata, robust security practices are foundational.

---

## 1. Supported Versions

Security updates and patches are actively maintained for the following versions:

| Version | Supported | Security Maintenance Status |
| :--- | :--- | :--- |
| `1.0.x-dev` | Yes | Active Development / High Priority |
| `< 1.0` | No | Experimental Builds |

---

## 2. Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

### Reporting Procedure
If you discover a security vulnerability in WatchNet:
1. Email your findings directly to `security@watchnet.local` (or file a confidential GitHub Security Advisory).
2. Include detailed technical reproduction steps, proof of concept (PoC), affected versions, and potential impact.
3. Our security team will acknowledge receipt of the report within **24 hours** and provide a detailed mitigation assessment within **72 hours**.

### Scope of Security Boundaries
- **Network Scanning Engine**: The network collector requires elevated raw socket capabilities (`CAP_NET_RAW`). Any escape from least-privilege collector daemon to root host execution is considered a Critical severity issue.
- **Parental Controls & Privacy**: Accidental leakage of DNS query histories across household profiles or unauthorized bypass of router blocks is considered High severity.
- **Injection Flaws**: Unlike legacy upstream (which permitted arbitrary client-side SQL execution via `/dbquery/*`), WatchNet strictly rejects all raw SQL execution from API clients. Any SQL injection or command injection vulnerability is considered Critical.
- **Authentication**: JWT authentication with Argon2id password hashing and HttpOnly, Secure, SameSite cookies is enforced. Any session fixation or credential leak is Critical.
