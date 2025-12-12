# E2E Encryption Implementation Checklist (Option A-Lite)

## Overview

**Goal:** Implement end-to-end encryption where the server never sees plaintext messages.

**Approach:**
- X3DH (Extended Triple Diffie-Hellman) for key exchange using libsignal
- AES-256-GCM for message encryption (simplified, no Double Ratchet)
- Server stores only public keys and encrypted message blobs

---

## Phase 1: Backend Key Storage

### Database Changes
- [x] Create `PreKeyBundle` entity
  - `id` (Long, primary key)
  - `userId` (Long, foreign key to User)
  - `identityKey` (String, base64 encoded public key)
  - `signedPreKey` (String, base64 encoded)
  - `signedPreKeyId` (Integer)
  - `signedPreKeySignature` (String, base64 encoded)
  - `createdAt` (Timestamp)
  - `updatedAt` (Timestamp)

- [x] Create `OneTimePreKey` entity
  - `id` (Long, primary key)
  - `userId` (Long, foreign key to User)
  - `keyId` (Integer)
  - `publicKey` (String, base64 encoded)
  - `used` (Boolean, default false)

### Repository Layer
- [x] Create `PreKeyBundleRepository`
  - `findByUserId(Long userId)`
  - `existsByUserId(Long userId)`

- [x] Create `OneTimePreKeyRepository`
  - `findFirstByUserIdAndUsedFalse(Long userId)`
  - `findAllByUserId(Long userId)`
  - `countByUserIdAndUsedFalse(Long userId)`

### Service Layer
- [x] Create `KeyService`
  - `storePreKeyBundle(userId, bundle)` — save identity + signed prekey
  - `storeOneTimePreKeys(userId, prekeys)` — batch save one-time prekeys
  - `getPreKeyBundle(userId)` — fetch bundle for key exchange
  - `consumeOneTimePreKey(userId)` — mark one-time prekey as used
  - `getAvailablePreKeyCount(userId)` — check remaining one-time prekeys

### API Endpoints
- [x] Create `KeyController`
  - `POST /api/keys/bundle` — upload prekey bundle (authenticated)
  - `POST /api/keys/prekeys` — upload one-time prekeys (authenticated)
  - `GET /api/keys/{userId}/bundle` — fetch user's prekey bundle for key exchange
  - `GET /api/keys/status` — check if current user has registered keys
  - `GET /api/keys/prekey-count` — get count of remaining one-time prekeys

### Security Configuration
- [x] Add key endpoints to `SecurityConfig`
  - `/api/keys/**` — require authentication

### Testing
- [x] Test bundle upload
- [x] Test bundle retrieval
- [x] Test one-time prekey consumption

---

## Phase 2: Frontend Key Generation

### Install Dependencies
- [x] Install libsignal library
  ```bash
  npm install @priva/libsignal-protocol-typescript
  ```
  (or alternative: `@nicktomlin/libsignal-protocol-javascript`)

### Key Storage (IndexedDB)
- [x] Create `crypto/KeyStorage.ts`
  - `storeIdentityKeyPair(keyPair)` — save private identity key locally
  - `getIdentityKeyPair()` — retrieve identity key
  - `storeSignedPreKey(keyId, keyPair)` — save signed prekey locally
  - `storeOneTimePreKey(keyId, keyPair)` — save one-time prekey locally
  - `getPreKey(keyId)` — retrieve prekey by ID
  - `clearAllKeys()` — for logout

### Key Generation
- [x] Create `crypto/KeyGenerator.ts`
  - `generateIdentityKeyPair()` — create long-term identity key
  - `generateSignedPreKey(identityKey, keyId)` — create signed prekey
  - `generateOneTimePreKeys(startId, count)` — batch create one-time prekeys
  - `generateRegistrationBundle()` — create full bundle for server upload

### API Integration
- [x] Create `crypto/KeyAPI.ts`
  - `uploadPreKeyBundle(bundle)` — POST to `/api/keys/bundle`
  - `uploadOneTimePreKeys(prekeys)` — POST to `/api/keys/prekeys`
  - `fetchPreKeyBundle(userId)` — GET from `/api/keys/{userId}/bundle`
  - `checkKeyStatus()` — GET from `/api/keys/status`

### Registration Flow
- [x] Update registration/login flow
  - After successful login, check if keys exist
  - If no keys, generate and upload bundle
  - Store private keys in IndexedDB

### Testing
- [x] Test key generation
- [x] Test IndexedDB storage
- [x] Test bundle upload to server

---

## Phase 3: Key Exchange (X3DH)

### Session Management
- [x] Create `crypto/SessionManager.ts`
  - `hasSession(userId)` — check if session exists
  - `createSession(userId, preKeyBundle)` — X3DH handshake
  - `getSession(userId)` — retrieve existing session
  - `storeSession(userId, session)` — save session
  - `deleteSession(userId)` — remove session

### X3DH Implementation
- [x] Create `crypto/X3DH.ts`
  - `performKeyExchange(theirBundle, ourIdentity)` — derive shared secret
  - Uses: our identity key + their identity key + their signed prekey + their one-time prekey
  - Returns: shared secret (32 bytes)

### Session Storage
- [x] Store session data in IndexedDB
  - `userId` — who the session is with
  - `sharedSecret` — derived from X3DH (used for AES encryption)
  - `createdAt` — when session was established

### Testing
- [ ] Test X3DH key exchange between two users
- [ ] Verify both users derive the same shared secret

---

## Phase 4: Message Encryption

### Encryption Utilities
- [x] Create `crypto/MessageCrypto.ts`
  - `encryptMessage(plaintext, sharedSecret)` — AES-256-GCM encrypt
    - Generate random 12-byte IV
    - Encrypt with AES-256-GCM
    - Return: `{ iv, ciphertext }` (both base64 encoded)
  - `decryptMessage(encrypted, sharedSecret)` — AES-256-GCM decrypt
    - Decode IV and ciphertext from base64
    - Decrypt with AES-256-GCM
    - Return: plaintext string

### Update WebSocket Message Flow
- [x] Update `websocket.ts`
  - Before sending: encrypt message content
  - After receiving: decrypt message content

### Update Message Types
- [x] Update `MessageRequest` to include
  - `encryptedContent` (String, base64)
  - `iv` (String, base64)
  - `isEncrypted` (Boolean)

- [x] Update `MessageResponse` similarly

### Backend Changes
- [x] Update `Message` entity
  - Add `iv` field (String)
  - Add `isEncrypted` field (Boolean)
  - Rename/keep `content` for encrypted content

- [x] Update `MessageService`
  - Store encrypted content as-is (server never decrypts)

### Testing
- [x] Test encrypt/decrypt locally
- [x] Test sending encrypted message via WebSocket
- [x] Test receiving and decrypting message

---

## Phase 5: Integration & UI

### Chat Page Updates
- [ ] On conversation start
  - Check if session exists with recipient
  - If not, fetch their prekey bundle
  - Perform X3DH, create session

- [ ] Show encryption status indicator
  - Lock icon for encrypted messages
  - Warning if encryption not available

### Error Handling
- [ ] Handle missing prekey bundles
- [ ] Handle decryption failures
- [ ] Handle key regeneration prompts

### Key Management UI (Optional)
- [ ] Show key fingerprint for verification
- [ ] Option to regenerate keys
- [ ] Warning when one-time prekeys are low

---

## Phase 6: Testing & Verification

### Functional Tests
- [ ] User A registers → keys uploaded
- [ ] User B registers → keys uploaded
- [ ] User A sends message to User B
  - Session created via X3DH
  - Message encrypted client-side
  - Server receives encrypted blob
  - User B decrypts successfully

### Security Verification
- [ ] Verify server logs show only encrypted content
- [ ] Verify database stores only encrypted messages
- [ ] Verify different sessions produce different ciphertexts

### Edge Cases
- [ ] Test offline user messaging
- [ ] Test page refresh (keys persist in IndexedDB)
- [ ] Test logout (keys cleared properly)
- [ ] Test multiple devices (out of scope for now)

---

## File Structure

```
backend/
├── model/
│   ├── PreKeyBundle.java          # New
│   └── OneTimePreKey.java         # New
├── repository/
│   ├── PreKeyBundleRepository.java    # New
│   └── OneTimePreKeyRepository.java   # New
├── service/
│   └── KeyService.java            # New
├── controller/
│   └── KeyController.java         # New
└── dto/
    ├── PreKeyBundleDTO.java       # New
    └── OneTimePreKeyDTO.java      # New

frontend/
├── crypto/
│   ├── KeyStorage.ts              # New - IndexedDB storage
│   ├── KeyGenerator.ts            # New - Key generation
│   ├── KeyAPI.ts                  # New - Server communication
│   ├── SessionManager.ts          # New - Session handling
│   ├── X3DH.ts                    # New - Key exchange
│   └── MessageCrypto.ts           # New - AES encryption
├── utils/
│   ├── websocket.ts               # Update - encrypt/decrypt
│   └── api.ts                     # Update - key endpoints
└── components/
    └── ChatPage.tsx               # Update - session init
```

---

## Estimated Time

| Phase | Hours |
|-------|-------|
| Phase 1: Backend Key Storage | 2-3 |
| Phase 2: Frontend Key Generation | 2-3 |
| Phase 3: Key Exchange (X3DH) | 2-3 |
| Phase 4: Message Encryption | 2-3 |
| Phase 5: Integration & UI | 1-2 |
| Phase 6: Testing | 1-2 |
| **Total** | **10-16** |

---

## Notes

- Private keys NEVER leave the client device
- Server only stores public keys
- Server only sees encrypted message blobs
- Forward secrecy is per-session (not per-message like full Signal)
- One device per user (multi-device is out of scope)

---

*Last Updated: December 11, 2025*