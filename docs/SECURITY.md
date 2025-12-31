# Security Model

## Table of Contents
- [Security Overview](#security-overview)
- [Threat Model](#threat-model)
- [Encryption Architecture](#encryption-architecture)
- [Authentication Security](#authentication-security)
- [Attack Mitigations](#attack-mitigations)
- [Security Best Practices](#security-best-practices)
- [Security Audit Log](#security-audit-log)

---

## Security Overview

MyNetRunner implements a **defense-in-depth** security strategy with multiple layers of protection. The application is designed with a **zero-knowledge architecture** where the server cannot decrypt user messages.

### Security Principles

1. **End-to-End Encryption** - Messages encrypted on sender's device, decrypted only on recipient's device
2. **Perfect Forward Secrecy** - Compromised keys cannot decrypt past messages
3. **Zero-Knowledge Server** - Server cannot read message content
4. **HttpOnly Cookies** - Authentication tokens immune to XSS attacks
5. **Rate Limiting** - Protection against brute force and spam
6. **Input Sanitization** - Defense against injection attacks
7. **Least Privilege** - Minimal permissions and data retention

---

## Threat Model

### Assets to Protect

| Asset | Sensitivity | Protection |
|-------|-------------|------------|
| Message Content | **CRITICAL** | E2EE, AES-256-GCM, server never sees plaintext |
| Private Keys | **CRITICAL** | Client-side only, stored in IndexedDB, never transmitted |
| Session Tokens | **HIGH** | HttpOnly cookies, short expiration, blacklisting |
| Passwords | **HIGH** | BCrypt hashing, never stored plaintext, rate-limited |
| User Metadata | **MEDIUM** | Access control, sanitization, minimal retention |

### Threat Actors

1. **External Attacker** (No access)
   - Attempts: Network eavesdropping, credential stuffing, API abuse
   - Mitigations: TLS, rate limiting, input validation

2. **Compromised Server** (Infrastructure access)
   - Attempts: Read database, access Redis, view logs
   - Mitigations: E2EE (cannot decrypt messages), minimal metadata storage

3. **Malicious User** (Authenticated access)
   - Attempts: Spam, abuse, data exfiltration
   - Mitigations: Rate limiting, access controls, audit logging

### Attack Scenarios & Mitigations

#### 1. XSS (Cross-Site Scripting)

**Attack**: Injecting malicious JavaScript to steal authentication tokens

**Mitigations**:
- ✅ **HttpOnly Cookies** - Tokens inaccessible to JavaScript
- ✅ **Input Sanitization** - HTML escaping on all user inputs
- ✅ **CSP Headers** - Content Security Policy restrictions
- ✅ **No `dangerouslySetInnerHTML`** - React JSX escaping by default

**Risk Level**: ❌ **MITIGATED** (High confidence)

#### 2. CSRF (Cross-Site Request Forgery)

**Attack**: Forcing authenticated user to perform unwanted actions

**Mitigations**:
- ✅ **SameSite=Strict** - Cookies not sent on cross-origin requests
- ✅ **Stateless JWT** - No session state to manipulate
- ✅ **CORS** - Strict origin checking

**Risk Level**: ❌ **MITIGATED** (High confidence)

#### 3. SQL Injection

**Attack**: Injecting malicious SQL to access/modify database

**Mitigations**:
- ✅ **JPA with Parameterized Queries** - All queries use `@Param` binding
- ✅ **Input Validation** - Type checking and sanitization
- ✅ **Least Privilege** - Database user has minimal permissions

**Risk Level**: ❌ **MITIGATED** (High confidence)

#### 4. Brute Force Authentication

**Attack**: Automated password guessing

**Mitigations**:
- ✅ **Rate Limiting** - 5 attempts per 5 minutes per IP
- ✅ **BCrypt** - Slow hashing algorithm (adaptive cost factor)
- ✅ **Account Lockout** - Temporary lockout after failed attempts
- ✅ **Generic Error Messages** - No user enumeration

**Risk Level**: ⚠️ **PARTIALLY MITIGATED** (Account enumeration possible via registration endpoint)

**Recommendation**: Implement CAPTCHA for registration

#### 5. Man-in-the-Middle (MITM)

**Attack**: Intercepting network traffic to steal data

**Mitigations**:
- ✅ **TLS/HTTPS Enforcement** - All traffic encrypted in transit
- ✅ **E2EE** - Even MITM attacker cannot decrypt messages
- ⚠️ **Certificate Pinning** - Not implemented (production recommended)

**Risk Level**: ⚠️ **PARTIALLY MITIGATED**

**Recommendation**: Implement certificate pinning in production

#### 6. Replay Attacks

**Attack**: Replaying captured authentication tokens or messages

**Mitigations**:
- ✅ **One-Time Prekeys** - Fresh keys for each session
- ✅ **Message TTL** - Messages expire automatically
- ✅ **Token Expiration** - Access tokens valid for 24 hours only
- ✅ **Token Blacklisting** - Immediate revocation on logout

**Risk Level**: ❌ **MITIGATED** (Medium confidence)

#### 7. Denial of Service (DoS)

**Attack**: Overwhelming server resources

**Mitigations**:
- ✅ **Rate Limiting** - Per-endpoint and per-IP limits
- ✅ **Message Queue Limits** - Max 100 pending messages per user
- ✅ **WebSocket Connection Limits** - One connection per user
- ⚠️ **DDoS Protection** - Not implemented (use cloud provider)

**Risk Level**: ⚠️ **PARTIALLY MITIGATED**

**Recommendation**: Use Cloudflare or AWS Shield for DDoS protection

#### 8. Cryptographic Attacks

**Attack**: Breaking encryption through cryptanalysis or key compromise

**Mitigations**:
- ✅ **Industry-Standard Algorithms** - AES-256-GCM, ECDH Curve25519
- ✅ **Perfect Forward Secrecy** - Compromised keys don't decrypt past messages
- ✅ **One-Time Prekeys** - Fresh key material for each session
- ✅ **Secure Random Generation** - `window.crypto.getRandomValues()`

**Risk Level**: ❌ **MITIGATED** (High confidence)

---

## Encryption Architecture

### Key Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                   IDENTITY KEY PAIR                     │
│     (Long-term, signs other keys, stored in IndexedDB)  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────┐    ┌─────────▼────────┐
│ SIGNED PREKEY    │    │  ONE-TIME PREKEYS│
│ (Medium-term,    │    │  (Single-use,    │
│  rotated weekly) │    │   deleted after  │
│                  │    │   key exchange)  │
└────────┬─────────┘    └─────────┬────────┘
         │                        │
         └────────┬───────────────┘
                  │
          ┌───────▼────────┐
          │ SESSION SECRET │
          │ (Per-contact,  │
          │  derived via   │
          │   X3DH)        │
          └────────────────┘
```

### X3DH Key Agreement Protocol

**Initial Contact Flow**:

```
Alice                                                Bob
  │                                                  │
  ├─[1] GET /api/keys/bob/bundle ───────────────────►│
  │                                                  │
  │◄────[2] {IK_B, SPK_B, sig(SPK_B), OPK_B} ───────┤
  │                                                  │
  │ [3] X3DH Key Derivation:                        │
  │     DH1 = ECDH(IK_A, SPK_B)                     │
  │     DH2 = ECDH(EK_A, IK_B)                      │
  │     DH3 = ECDH(EK_A, SPK_B)                     │
  │     DH4 = ECDH(EK_A, OPK_B)                     │
  │     SK = KDF(DH1 || DH2 || DH3 || DH4)          │
  │                                                  │
  ├─[4] Encrypted Message + Key Exchange Data ──────►│
  │     {ciphertext, IV, IK_A, EK_A, OPK_ID}        │
  │                                                  │
  │                                                  │ [5] X3DH Response:
  │                                                  │     DH1 = ECDH(SPK_B, IK_A)
  │                                                  │     DH2 = ECDH(IK_B, EK_A)
  │                                                  │     DH3 = ECDH(SPK_B, EK_A)
  │                                                  │     DH4 = ECDH(OPK_B, EK_A)
  │                                                  │     SK = KDF(DH1 || DH2 || DH3 || DH4)
  │                                                  │
  │                                                  │ [6] Decrypt Message
  │                                                  │
```

**Subsequent Messages**:
- Use derived session secret (SK) for AES-256-GCM encryption
- No additional key exchange required
- Perfect forward secrecy maintained

### Encryption Algorithms

| Purpose | Algorithm | Key Size | Notes |
|---------|-----------|----------|-------|
| Key Agreement | ECDH (Curve25519) | 256-bit | X3DH protocol |
| Symmetric Encryption | AES-GCM | 256-bit | Authenticated encryption |
| Key Derivation | HKDF-SHA256 | 256-bit | Extract-and-expand |
| Signatures | Ed25519 | 256-bit | Prekey signature verification |
| Random Generation | WebCrypto API | N/A | `crypto.getRandomValues()` |

---

## Authentication Security

### HttpOnly Cookie Architecture

**Why HttpOnly Cookies?**

Traditional localStorage JWT storage is vulnerable to XSS attacks. HttpOnly cookies provide:

1. **XSS Protection** - JavaScript cannot access cookies
2. **Automatic Transmission** - Browser handles cookie sending
3. **Secure Flag** - HTTPS-only transmission
4. **SameSite Protection** - CSRF mitigation

**Implementation**:

```java
Cookie accessTokenCookie = new Cookie("token", jwt);
accessTokenCookie.setHttpOnly(true);   // XSS protection
accessTokenCookie.setSecure(true);     // HTTPS only
accessTokenCookie.setSameSite("Strict"); // CSRF protection
accessTokenCookie.setPath("/");
accessTokenCookie.setMaxAge(86400);    // 24 hours
```

### Token Lifecycle

```
Registration/Login
      │
      ▼
┌─────────────────┐
│ Access Token    │ (24 hours, httpOnly cookie)
│ Refresh Token   │ (7 days, httpOnly cookie)
└────────┬────────┘
         │
         ▼
   [User Activity]
         │
         ├──► Access Token Expired?
         │         │
         │         ├─YES─► Use Refresh Token
         │         │         │
         │         │         ├─Valid─► New Access Token
         │         │         │
         │         │         └─Invalid─► Re-Login Required
         │         │
         │         └─NO──► Continue
         │
         ▼
   [Logout Requested]
         │
         ▼
┌─────────────────┐
│ Blacklist Tokens│ (Redis, TTL = token expiry)
│ Clear Cookies   │
└─────────────────┘
```

### Rate Limiting Strategy

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| POST /api/auth/login | 5 attempts | 5 minutes | Per IP |
| POST /api/auth/register | 3 attempts | 1 hour | Per IP |
| WebSocket /app/chat | 30 messages | 1 minute | Per user |
| All API endpoints | 100 requests | 1 minute | Per IP |

**Implementation**: Redis-based with sliding window algorithm

---

## Attack Mitigations

### Defense-in-Depth Layers

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Network Security                          │
│ • TLS/HTTPS encryption                              │
│ • Cloudflare DDoS protection (production)           │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 2: Application Gateway                       │
│ • CORS enforcement                                  │
│ • Rate limiting                                     │
│ • Input size limits                                 │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 3: Authentication & Authorization            │
│ • JWT validation                                    │
│ • Token blacklisting                                │
│ • HttpOnly cookies                                  │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 4: Input Validation                          │
│ • Type checking (@Valid annotations)                │
│ • HTML sanitization                                 │
│ • SQL injection prevention (JPA)                    │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 5: Business Logic                            │
│ • Access control checks                             │
│ • Data minimization                                 │
│ • Audit logging                                     │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│ Layer 6: Data Protection                           │
│ • E2EE for messages                                 │
│ • BCrypt for passwords                              │
│ • Minimal data retention                            │
└─────────────────────────────────────────────────────┘
```

---

## Security Best Practices

### For Deployment

1. **Generate Strong Secrets**
   ```bash
   # JWT Secret (64+ characters)
   openssl rand -base64 64

   # Database Password (32+ characters)
   openssl rand -base64 32
   ```

2. **Enable HTTPS**
   - Use Let's Encrypt for free SSL certificates
   - Set `cookie.setSecure(true)` in production
   - Enable HSTS headers

3. **Configure Security Headers**
   ```
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   X-XSS-Protection: 1; mode=block
   Content-Security-Policy: default-src 'self'
   ```

4. **Database Security**
   - Use separate database user with minimal privileges
   - Enable SSL for database connections
   - Regular backups with encryption
   - Keep PostgreSQL updated

5. **Redis Security**
   - Set strong password (`requirepass`)
   - Bind to localhost or use firewall
   - Disable dangerous commands (`FLUSHALL`, `CONFIG`)

### For Development

1. **Never Commit Secrets**
   - Use `.env.example` for templates
   - Add `.env` to `.gitignore`
   - Use environment variables for all secrets

2. **Keep Dependencies Updated**
   ```bash
   # Backend
   mvn versions:display-dependency-updates

   # Frontend
   npm audit fix
   ```

3. **Code Review Checklist**
   - [ ] No hardcoded credentials
   - [ ] Input validation on all endpoints
   - [ ] Proper error handling (no stack traces to client)
   - [ ] Authorization checks on protected resources
   - [ ] Logging doesn't include sensitive data

---

## Security Audit Log

### 2024-12-30: Major Security Upgrade

✅ **Implemented HttpOnly Cookie Authentication**
- Migrated from localStorage JWT to httpOnly cookies
- Eliminated XSS token theft vulnerability
- Added SameSite=Strict for CSRF protection

✅ **Enhanced Logging**
- Replaced System.out.println with SLF4J
- Removed all console.log statements from frontend
- Implemented proper log levels (DEBUG, INFO, ERROR)

✅ **Code Cleanup**
- Removed dead code and debug artifacts
- Fixed TypeScript type safety issues
- Consolidated duplicate utility methods

### Known Limitations

⚠️ **User Enumeration** - Registration endpoint reveals if username exists
- **Risk**: Low (common in many applications)
- **Mitigation**: Consider adding CAPTCHA

⚠️ **No Certificate Pinning** - Mobile clients should implement
- **Risk**: Medium (MITM attacks)
- **Mitigation**: Implement in production mobile apps

⚠️ **WebCrypto API** - Requires modern browsers
- **Risk**: Low (most users have modern browsers)
- **Mitigation**: Display warning for unsupported browsers

---

## Responsible Disclosure

If you discover a security vulnerability in MyNetRunner, please:

1. **DO NOT** open a public GitHub issue
2. Email security details to: [your-email]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

Response time: 48 hours for acknowledgment, 7 days for fix

---

## References

- [Signal Protocol Documentation](https://signal.org/docs/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Crypto API Spec](https://www.w3.org/TR/WebCryptoAPI/)
- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)

---

**Last Updated**: December 30, 2024
**Security Review**: Completed
**Next Review**: Before production deployment
