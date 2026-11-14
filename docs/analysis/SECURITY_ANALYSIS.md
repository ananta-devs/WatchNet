# WatchNet Security Analysis

**Document Version:** 1.0.0  
**Baseline Snapshot:** `D:\WatchNet-Reference-Snapshot`  
**Classification:** Security Vulnerability & Hardening Audit  
**Target:** WatchNet Security Baseline  

---

## 1. Upstream Security Flaws & Vulnerabilities

An in-depth review of the WatchNet upstream codebase revealed multiple critical architectural security weaknesses that must be remedied in WatchNet.

### 1.1 Command Injection Risks
- Upstream scripts execute CLI binaries (`arp-scan`, `fping`, `nmap`, `dig`) using raw shell string formatting (e.g. `os.system(f"dig {param}")`).
- Unsanitized device hostnames or user inputs passed into diagnostic tools present high risks of shell command injection.

### 1.2 Insecure Privilege Escalation
- The WatchNet Docker container runs the entire application stack (Nginx, PHP-FPM, Flask, Python scripts) as the `root` user or with broad Linux capabilities (`NET_ADMIN`, `NET_RAW`).
- Any vulnerability in the PHP frontend or Flask API grants an attacker full root privilege inside the container and unrestricted host network access.

### 1.3 Server-Side Request Forgery (SSRF)
- Integration plugins (UniFi, Pi-hole, AdGuard, Webhooks) connect to user-supplied URLs without IP range validation or anti-SSRF protections.
- Users can manipulate integrations to probe internal cloud metadata services (e.g. `169.254.169.254`) or unintended internal subnets.

### 1.4 Hardcoded & Cleartext Credentials
- Router administrative credentials, SSH keys, and notification API tokens are stored in cleartext within SQLite database columns and configuration JSON files.
- Lack of envelope encryption or secure secrets management exposes credentials to anyone with database read access.

---

## 2. WatchNet Security Defense Architecture

WatchNet enforces the following enterprise-grade security controls:
1. **Least-Privilege Isolation**:
   - The web and API processes run as a dedicated unprivileged user (`watchnet:watchnet`, UID 10001).
   - Only the isolated Go collector daemon (`watchnet-collector`) receives `CAP_NET_RAW`, operating in a separate container without web access.
2. **Strict Input Sanitization & Parameterization**:
   - Zero raw shell execution (`shell=False` enforced throughout).
   - Network discovery uses native Go raw socket libraries rather than shelling out to system binaries.
3. **Egress Filtering & SSRF Prevention**:
   - All outbound webhook and integration HTTP requests pass through an egress validation proxy that strictly blocks loopback and cloud metadata ranges (`169.254.0.0/16`, `127.0.0.0/8`, `::1`).
4. **Hardware-Backed Secrets Encryption**:
   - All router passwords, API keys, and notification tokens are encrypted at rest using AES-256-GCM authenticated encryption with keys derived via PBKDF2/Argon2id.
