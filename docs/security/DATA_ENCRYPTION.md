# WatchNet Data Encryption Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Cryptographic Standards:** NIST SP 800-38D (AES-GCM), RFC 8446 (TLS 1.3), RFC 8032 (Ed25519)  
**Applicability:** In-Transit Encryption, Column-Level Encryption, Secret Storage  

---

## 1. Architectural Scope & Encryption Boundaries

WatchNet implements end-to-end cryptographic protection across the full application data lifecycle:
1. **Data in Transit (Egress / Ingress / Inter-Service):** Strict TLS 1.3 encryption across all network boundaries.
2. **Data at Rest (Column-Level Encryption):** Hardware and API secrets (router passwords, SNMP keys, notification tokens) are encrypted before insertion into PostgreSQL.
3. **Internal Inter-Process Communication:** Redis message streams and collector-to-API channels utilize authenticated tokens and encrypted channels.

```mermaid
flowchart LR
    A[Browser / Client] -->|TLS 1.3 (HTTPS)| B[Caddy Reverse Proxy]
    B -->|mTLS / Secure UNIX Socket| C[FastAPI Core]
    C -->|AES-256-GCM Envelope Encryption| D[(PostgreSQL)]
    E[Go Collector] -->|mTLS + Bearer Token| C
```

---

## 2. Data in Transit Standards

- **External HTTPS / WSS:**
  - TLS 1.3 enforced by default; TLS 1.2 permitted with high-strength cipher suites (`TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384`, `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`).
  - Strict Transport Security (HSTS) header: `max-age=31536000; includeSubDomains`.
- **Inter-Service & Database:**
  - PostgreSQL connections require `sslmode=verify-full` in multi-host production setups with validated CA certs.
  - Collector-to-backend communications use HTTPS with mutual TLS (mTLS) client certificate verification.

---

## 3. Data at Rest & Column-Level Encryption (CLE)

Sensitive credentials must never be written as plaintext strings to disk or database tables.

### 3.1 Envelope Encryption Scheme:
- **Master Encryption Key (MEK):** Provided via environment variable `WATCHNET_SECRET_KEY` or an external KMS (HashiCorp Vault / AWS KMS).
- **Algorithm:** Authenticated AES-256-GCM with a unique 96-bit random IV (Initialization Vector) per record.
- **Encrypted Payload Format:**
  `enc:v1:<base64_encoded_12_byte_iv>:<base64_encoded_ciphertext_and_tag>`

### 3.2 Tables Subject to Column-Level Encryption:
- `integration_instances.credentials` (API keys, router passwords, SNMP secrets)
- `notification_channels.target_url` (Contains embedded bot tokens and webhook secrets)
- `users.totp_secret` (Two-Factor Authentication seeds)
- `remote_collectors.token_hash`

---

## 4. Key Management & Rotation Procedures

1. **Key Versioning:** Encryption prefixes (`enc:v1:...`) enable seamless key rotation without requiring full database downtime.
2. **Rotation Routine:** A CLI command `watchnet-admin crypto rotate-keys --old-key <key1> --new-key <key2>` loads all encrypted fields, decrypts them with Key 1, re-encrypts with Key 2, and commits the transaction atomically.
3. **Zero Plaintext Logging:** Logging formatters filter out and mask all keys, headers containing `Authorization`, and payloads matching regex `enc:v[0-9]:.*`.
