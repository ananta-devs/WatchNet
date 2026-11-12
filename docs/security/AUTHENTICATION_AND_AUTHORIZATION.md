# WatchNet Authentication and Authorization

**Document Version:** 1.0.0  
**Auth Standard:** OAuth2 / JWT (JSON Web Tokens) with Argon2id Hashing  

---

## 1. Authentication Flow

WatchNet implements secure token-based authentication for both interactive browser users and programmatic API integrations:

```
[ Client Browser / CLI ]                    [ WatchNet API ]                 [ PostgreSQL ]
           |                                       |                               |
           |-- 1. POST /api/v1/auth/token -------->|                               |
           |      {username, password, [totp]}     |-- 2. Query User & Hash ------>|
           |                                       |<-- User Record & Salt --------|
           |                                       |-- 3. Verify Argon2id Hash     |
           |                                       |-- 4. Generate Access & Refresh|
           |<-- 200 OK (JWT Access & HttpOnly Ck)--|                               |
           |                                       |                               |
           |-- 5. Request with Bearer Token ------>|                               |
           |      Authorization: Bearer <JWT>      |-- 6. Validate Signature & Exp |
           |                                       |-- 7. Extract Tenant & Roles   |
           |<-- 200 OK (Authorized Response) ------|                               |
```

### 1.1 Password Security
- Passwords are hashed using **Argon2id** (memory cost: 64MB, time cost: 3 iterations, parallelism: 4 threads).
- Multi-Factor Authentication (MFA) supported via standard TOTP (Time-based One-Time Password / RFC 6238).

### 1.2 Token Lifecycle
- **Access Token**: Short-lived JWT (15 minutes), signed using HMAC-SHA256 or asymmetric Ed25519.
- **Refresh Token**: Long-lived secure token (7 days), stored in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie.
