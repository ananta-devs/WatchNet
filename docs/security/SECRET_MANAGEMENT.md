# WatchNet Secret Management

**Document Version:** 1.0.0  
**Encryption Standard:** AES-256-GCM / Argon2id Key Derivation  

---

## 1. Secrets Handling Policy

WatchNet enforces zero cleartext storage for sensitive credentials:
- Router administrative passwords, SSH private keys, SNMP community strings, and notification webhook URLs are encrypted before database insertion.
- The master encryption key is supplied via the `WATCHNET_SECRET_KEY` environment variable or retrieved from external vaults (HashiCorp Vault, AWS Secrets Manager).

---

## 2. Encryption Implementation Contract

```python
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class SecretVault:
    def __init__(self, master_key_bytes: bytes):
        if len(master_key_bytes) != 32:
            raise ValueError("Master key must be exactly 32 bytes (AES-256)")
        self.aesgcm = AESGCM(master_key_bytes)

    def encrypt_secret(self, plaintext: str) -> bytes:
        nonce = os.urandom(12)
        ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
        return nonce + ciphertext

    def decrypt_secret(self, payload: bytes) -> str:
        nonce = payload[:12]
        ciphertext = payload[12:]
        decrypted = self.aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode('utf-8')
```
