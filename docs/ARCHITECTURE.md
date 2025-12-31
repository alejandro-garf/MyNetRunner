# System Architecture

## Table of Contents
- [Overview](#overview)
- [System Components](#system-components)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Technology Stack](#technology-stack)
- [Design Patterns](#design-patterns)
- [Performance Considerations](#performance-considerations)

---

## Overview

MyNetRunner follows a **modern three-tier architecture** with a React SPA frontend, Spring Boot REST/WebSocket backend, and PostgreSQL/Redis data layer. The system implements a **zero-knowledge architecture** where the server acts as a message relay without access to plaintext content.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
│                         (React + TypeScript)                     │
│                                                                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ UI        │  │ Crypto   │  │ WebSocket│  │  State Mgmt  │  │
│  │ Components│  │ (X3DH)   │  │ (STOMP)  │  │  (React)     │  │
│  └───────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│         │              │              │              │          │
│  ┌──────▼──────────────▼──────────────▼──────────────▼──────┐  │
│  │            IndexedDB (Client-Side Storage)                │  │
│  │        • Encryption Keys  • Session Secrets               │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS/WSS + HttpOnly Cookies
┌──────────────────────────────▼───────────────────────────────────┐
│                         APPLICATION LAYER                        │
│                        (Spring Boot REST API)                    │
│                                                                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Security  │  │ Business │  │ WebSocket│  │  Scheduled   │  │
│  │ Filters   │  │ Services │  │ Handlers │  │  Tasks       │  │
│  └───────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│         │              │              │              │          │
└─────────┼──────────────┼──────────────┼──────────────┼──────────┘
          │              │              │              │
┌─────────▼──────────────▼──────────────▼──────────────▼──────────┐
│                          DATA LAYER                              │
│                                                                  │
│  ┌────────────────────────┐        ┌─────────────────────────┐ │
│  │      PostgreSQL        │        │        Redis            │ │
│  │   (Persistent Data)    │        │     (Cache/Sessions)    │ │
│  │ • Users                │        │ • WebSocket Sessions    │ │
│  │ • Messages             │        │ • Rate Limit Counters   │ │
│  │ • Friendships          │        │ • Token Blacklist       │ │
│  │ • Groups               │        │ • Online User Set       │ │
│  │ • PreKey Bundles       │        │                         │ │
│  └────────────────────────┘        └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## System Components

### Frontend Components

#### 1. **UI Layer**
**Location**: `frontend/src/components/`

- **SignInPage.tsx** - Authentication UI
  - Form validation
  - Error handling
  - Encryption key setup orchestration

- **SignUpPage.tsx** - User registration
  - Username/password validation
  - Account creation flow

- **ChatPage.tsx** - Main messaging interface
  - Conversation list management
  - Message composition and display
  - Friend/group management
  - Real-time message updates

- **HomePage.tsx** - Landing page
  - Marketing content
  - Navigation to auth pages

#### 2. **Cryptography Module**
**Location**: `frontend/src/crypto/`

- **X3DH.ts** - Key agreement protocol
  - `performX3DHInitiator()` - Alice initiates key exchange
  - `performX3DHResponder()` - Bob responds to key exchange
  - `verifySignedPreKey()` - Signature verification

- **KeyGenerator.ts** - Key pair generation
  - Identity key pair (long-term)
  - Signed prekey (medium-term, signed by identity key)
  - One-time prekeys (single-use, for PFS)

- **SessionManager.ts** - Session lifecycle
  - `createInitiatorSession()` - Establish new session
  - `createResponderSession()` - Respond to session request
  - `getSharedSecret()` - Retrieve session key
  - `deleteSession()` - Clean up after conversation

- **MessageCrypto.ts** - Message encryption/decryption
  - `encryptMessage()` - AES-256-GCM encryption
  - `decryptMessage()` - AES-256-GCM decryption
  - IV generation for each message

- **KeyAPI.ts** - Server key management
  - Upload/download prekey bundles
  - Prekey replenishment

- **KeyReplenishment.ts** - Automatic key rotation
  - Monitors prekey count
  - Generates and uploads new keys when low

- **KeyStorage.ts** - IndexedDB persistence
  - Secure client-side key storage
  - Never sends private keys to server

#### 3. **WebSocket Client**
**Location**: `frontend/src/utils/websocket.ts`

- **ChatWebSocket class** - Real-time communication
  - SockJS fallback for environments without native WebSocket
  - STOMP protocol for pub/sub messaging
  - Automatic reconnection logic
  - Message encryption before sending
  - Message decryption on receipt

#### 4. **HTTP Client**
**Location**: `frontend/src/utils/api.ts`

- **Axios instance** with:
  - `withCredentials: true` for cookie-based auth
  - Base URL configuration
  - Cache-control headers for privacy

- **API modules**:
  - `authAPI` - Authentication endpoints
  - `userAPI` - User management
  - `friendsAPI` - Friend requests and relationships
  - `groupsAPI` - Group chat management
  - `messagesAPI` - Message retrieval

---

### Backend Components

#### 1. **Security Layer**
**Location**: `backend/src/main/java/com/mynetrunner/backend/`

##### Filters
- **JwtAuthenticationFilter** (`filter/`)
  - Extracts JWT from httpOnly cookie
  - Validates token signature and expiration
  - Checks token blacklist
  - Sets Spring Security context

- **RateLimitFilter** (`filter/`)
  - Redis-based rate limiting
  - Per-endpoint and per-IP limits
  - Returns 429 with Retry-After header

- **PrivacyFilter** (`config/`)
  - Masks IP addresses in logs
  - Privacy-preserving request logging

##### Security Configuration
- **SecurityConfig** (`config/`)
  - Endpoint authorization rules
  - CORS configuration with explicit headers
  - HttpOnly cookie settings
  - Stateless session management

- **UserInterceptor** (`config/`)
  - WebSocket handshake authentication
  - Validates JWT before WS upgrade

#### 2. **Business Logic Layer**

##### Services (`service/`)

- **UserService**
  - User registration with BCrypt hashing
  - Login with credential validation
  - JWT token generation (access + refresh)

- **MessageService**
  - Store encrypted messages temporarily
  - Delete on delivery (zero-knowledge)
  - Scheduled cleanup of expired messages
  - Offline message queuing

- **KeyService**
  - Prekey bundle upload/retrieval
  - One-time prekey management
  - Prekey deletion after use

- **FriendshipService**
  - Friend request workflow
  - Acceptance/rejection logic
  - Friend list retrieval

- **GroupService**
  - Group creation and management
  - Member addition/removal
  - Role-based permissions (owner, admin, member)

- **WebSocketSessionManager**
  - Redis-based session tracking
  - Online/offline user status
  - Session registration/removal

- **TokenBlacklistService**
  - Redis-based token revocation
  - Automatic expiration matching token TTL

- **RateLimitService**
  - Sliding window rate limiting
  - Redis counters with TTL

#### 3. **Data Access Layer**

##### Repositories (`repository/`)
All repositories extend `JpaRepository` for:
- CRUD operations
- Custom query methods with `@Query`
- Pagination support

- **UserRepository** - User accounts
- **MessageRepository** - Encrypted messages (temporary)
- **PreKeyBundleRepository** - Long-term prekeys
- **OneTimePreKeyRepository** - Single-use prekeys
- **FriendshipRepository** - Friend relationships
- **GroupRepository** - Group metadata
- **GroupMembershipRepository** - Group members

#### 4. **API Controllers** (`controller/`)

- **AuthController** - `/api/auth/*`
  - `POST /register` - Create account
  - `POST /login` - Authenticate user
  - `POST /logout` - Invalidate tokens
  - `POST /refresh` - Renew access token

- **MessageController** - `/api/messages/*`
  - `GET /pending` - Retrieve offline messages

- **KeyController** - `/api/keys/*`
  - `POST /bundle` - Upload prekey bundle
  - `GET /{userId}/bundle` - Fetch bundle for key exchange
  - `POST /one-time-prekeys` - Upload one-time keys

- **FriendController** - `/api/friends/*`
  - `POST /request/{username}` - Send friend request
  - `POST /accept/{id}` - Accept request
  - `POST /reject/{id}` - Reject request
  - `GET /` - List friends

- **GroupController** - `/api/groups/*`
  - `POST /` - Create group
  - `GET /` - List user's groups
  - `POST /{id}/members` - Add member
  - `DELETE /{id}/members/{userId}` - Remove member

- **UserStatusController** - `/api/users/*`
  - `GET /{username}/status` - Online/offline status
  - `GET /online` - List online users

- **WebSocketMessageController** - `/app/chat`
  - STOMP message handler
  - Relays encrypted messages via WebSocket

---

## Data Flow

### 1. User Registration Flow

```
┌─────────┐                                                  ┌─────────┐
│ Client  │                                                  │ Server  │
└────┬────┘                                                  └────┬────┘
     │                                                            │
     │ 1. Generate Identity Key Pair (client-side)               │
     │    IK_priv, IK_pub = generateKeyPair()                    │
     │                                                            │
     │ 2. Generate Signed PreKey                                 │
     │    SPK_priv, SPK_pub = generateKeyPair()                  │
     │    signature = sign(SPK_pub, IK_priv)                     │
     │                                                            │
     │ 3. Generate 100 One-Time PreKeys                          │
     │    OPK[] = generateOneTimePreKeys(100)                    │
     │                                                            │
     │ 4. POST /api/auth/register                                │
     ├──────────────────────────────────────────────────────────►│
     │    {username, password}                                   │
     │                                                            │
     │                                          5. Hash password │
     │                                             hash = BCrypt  │
     │                                                            │
     │                                          6. Store user    │
     │                                             INSERT users  │
     │                                                            │
     │◄──────────────────────────────────────────────────────────┤
     │    {message, username, userId}                            │
     │                                                            │
     │ 7. Upload PreKey Bundle                                   │
     ├──────────────────────────────────────────────────────────►│
     │    POST /api/keys/bundle                                  │
     │    {IK_pub, SPK_pub, signature}                           │
     │                                                            │
     │                                          8. Store bundle  │
     │                                             INSERT bundles │
     │                                                            │
     │ 9. Upload One-Time PreKeys                                │
     ├──────────────────────────────────────────────────────────►│
     │    POST /api/keys/one-time-prekeys                        │
     │    [{id, publicKey}, ...]                                 │
     │                                                            │
     │                                          10. Store OPKs   │
     │                                              INSERT keys  │
     │                                                            │
     │◄──────────────────────────────────────────────────────────┤
     │    {message: "Keys uploaded"}                             │
     │                                                            │
```

### 2. First Message (Key Exchange) Flow

```
Alice                        Server                        Bob
  │                            │                            │
  │ 1. GET /api/keys/bob/bundle                            │
  ├───────────────────────────►│                            │
  │                            │                            │
  │                            │ 2. SELECT FROM prekey_     │
  │                            │    bundles WHERE user_id   │
  │                            │    = bob                   │
  │                            │                            │
  │                            │ 3. SELECT one_time_prekey  │
  │                            │    LIMIT 1                 │
  │                            │                            │
  │                            │ 4. DELETE used OPK         │
  │                            │                            │
  │◄───────────────────────────┤                            │
  │ {IK_B, SPK_B, sig, OPK_B}  │                            │
  │                            │                            │
  │ 5. Verify signature        │                            │
  │    verify(sig, SPK_B, IK_B)│                            │
  │                            │                            │
  │ 6. Perform X3DH (initiator)│                            │
  │    SK = X3DH(IK_A, IK_B,   │                            │
  │              SPK_B, OPK_B) │                            │
  │                            │                            │
  │ 7. Encrypt message         │                            │
  │    ciphertext = AES-GCM    │                            │
  │    (plaintext, SK, IV)     │                            │
  │                            │                            │
  │ 8. WebSocket SEND /app/chat                            │
  ├───────────────────────────►│                            │
  │ {recipientId: bob,         │                            │
  │  encryptedContent,         │                            │
  │  iv,                       │                            │
  │  keyExchangeData: {        │                            │
  │    senderIK,               │                            │
  │    ephemeralKey,           │                            │
  │    usedOPKId               │                            │
  │  }}                        │                            │
  │                            │                            │
  │                            │ 9. Route to Bob's WS       │
  │                            ├───────────────────────────►│
  │                            │                            │
  │                            │  10. Perform X3DH (responder)
  │                            │      SK = X3DH_respond()   │
  │                            │                            │
  │                            │  11. Decrypt message       │
  │                            │      plaintext = AES-GCM   │
  │                            │      (ciphertext, SK, IV)  │
  │                            │                            │
```

### 3. Subsequent Messages Flow

```
Alice                        Server                        Bob
  │                            │                            │
  │ 1. Retrieve session SK     │                            │
  │    from IndexedDB          │                            │
  │                            │                            │
  │ 2. Encrypt with session SK │                            │
  │    ciphertext = AES-GCM    │                            │
  │                            │                            │
  │ 3. WebSocket SEND          │                            │
  ├───────────────────────────►│                            │
  │ {recipientId,              │                            │
  │  encryptedContent,         │                            │
  │  iv}                       │                            │
  │                            │                            │
  │                            │ 4. Relay (zero-knowledge)  │
  │                            ├───────────────────────────►│
  │                            │                            │
  │                            │  5. Retrieve session SK    │
  │                            │     from IndexedDB         │
  │                            │                            │
  │                            │  6. Decrypt with SK        │
  │                            │     plaintext = AES-GCM    │
  │                            │                            │
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friendships table
CREATE TABLE friendships (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    friend_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- PENDING, ACCEPTED, REJECTED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

-- Groups table
CREATE TABLE groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group memberships
CREATE TABLE group_memberships (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- OWNER, ADMIN, MEMBER
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- Messages (temporary storage, deleted on delivery)
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    recipient_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    encrypted_content TEXT NOT NULL, -- Base64-encoded encrypted data
    iv VARCHAR(255) NOT NULL, -- Initialization vector
    key_exchange_data TEXT, -- JSON for first messages
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    delivered BOOLEAN DEFAULT FALSE
);

-- PreKey bundles (long-term keys)
CREATE TABLE prekey_bundles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    identity_key TEXT NOT NULL, -- Base64-encoded public key
    signed_pre_key TEXT NOT NULL, -- Base64-encoded public key
    signed_pre_key_id INTEGER NOT NULL,
    signed_pre_key_signature TEXT NOT NULL, -- Base64-encoded signature
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One-time prekeys (single-use, deleted after fetch)
CREATE TABLE one_time_prekeys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL, -- Base64-encoded
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key_id)
);

-- Indexes for performance
CREATE INDEX idx_messages_recipient ON messages(recipient_id, delivered);
CREATE INDEX idx_messages_expires ON messages(expires_at);
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_group_memberships_user ON group_memberships(user_id);
CREATE INDEX idx_group_memberships_group ON group_memberships(group_id);
```

### Redis Data Structures

```
# WebSocket sessions
user:session:{username} → sessionId (TTL: 24 hours)

# Online users set
online:users → SET of usernames

# Rate limiting
ratelimit:login:{ip} → counter (TTL: 5 minutes)
ratelimit:register:{ip} → counter (TTL: 1 hour)
ratelimit:messages:{userId} → counter (TTL: 1 minute)

# Token blacklist
blacklist:token:{jti} → "revoked" (TTL: token expiration)
```

---

## Technology Stack

### Frontend Dependencies

```json
{
  "react": "^18.x",
  "typescript": "^5.x",
  "vite": "^5.x",
  "axios": "^1.x",
  "sockjs-client": "^1.x",
  "@stomp/stompjs": "^7.x",
  "tailwindcss": "^3.x",
  "lucide-react": "^0.x"
}
```

### Backend Dependencies (pom.xml)

```xml
<dependencies>
    <!-- Spring Boot -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-websocket</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>

    <!-- Database -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
    </dependency>

    <!-- JWT -->
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
    </dependency>

    <!-- Logging -->
    <dependency>
        <groupId>ch.qos.logback</groupId>
        <artifactId>logback-classic</artifactId>
    </dependency>
</dependencies>
```

---

## Design Patterns

### 1. **Repository Pattern**
- Abstracts data access logic
- JPA repositories for database operations
- Enables easy mocking for testing

### 2. **Service Layer Pattern**
- Business logic separated from controllers
- Transactional boundaries
- Reusable across different endpoints

### 3. **Filter Chain Pattern**
- Security filters process requests in order
- Each filter has single responsibility
- Easy to add/remove security layers

### 4. **Observer Pattern** (WebSocket)
- Clients subscribe to topics
- Server publishes messages to subscribers
- Decoupled message distribution

### 5. **Strategy Pattern** (Rate Limiting)
- Different rate limit strategies per endpoint
- Configurable limits and windows
- Extensible for new strategies

### 6. **Singleton Pattern**
- WebSocket connection (single instance per user)
- Axios instance (shared configuration)

---

## Performance Considerations

### 1. **Database Optimization**

- **Indexes**: Strategic indexes on foreign keys and query columns
- **Connection Pooling**: HikariCP for efficient connection management
- **Lazy Loading**: JPA relationships loaded on-demand
- **Batch Operations**: Bulk inserts for one-time prekeys

### 2. **Redis Caching**

- **Session Caching**: Avoid database lookups for online status
- **Rate Limit Counters**: In-memory for sub-millisecond checks
- **TTL Management**: Automatic expiration reduces memory usage

### 3. **Message Delivery**

- **WebSocket**: Persistent connection eliminates polling overhead
- **Immediate Deletion**: Messages deleted post-delivery (minimal storage)
- **Offline Queuing**: Max 100 messages per user prevents unbounded growth

### 4. **Key Management**

- **Client-Side Generation**: Offloads cryptographic operations from server
- **Prekey Pre-generation**: 100 keys generated at once, amortized cost
- **Automatic Replenishment**: Background task maintains key availability

### 5. **Frontend Optimization**

- **Vite**: Fast HMR and optimized production builds
- **Code Splitting**: Lazy load routes and components
- **IndexedDB**: Asynchronous, non-blocking key storage
- **React Memoization**: Prevent unnecessary re-renders

---

## Scalability Considerations

### Horizontal Scaling

```
                    ┌─────────────┐
                    │ Load        │
                    │ Balancer    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼────┐     ┌────▼────┐
    │ Backend │      │ Backend  │     │ Backend │
    │ Node 1  │      │ Node 2   │     │ Node 3  │
    └────┬────┘      └────┬─────┘     └────┬────┘
         │                │                 │
         └────────────────┼─────────────────┘
                          │
              ┌───────────┼──────────┐
              │           │          │
         ┌────▼────┐ ┌────▼────┐ ┌──▼──────┐
         │  Redis  │ │ Postgres│ │ Message │
         │ Cluster │ │ Primary │ │ Queue   │
         └─────────┘ └────┬────┘ └─────────┘
                          │
                     ┌────▼────┐
                     │ Postgres│
                     │ Replica │
                     └─────────┘
```

**Challenges & Solutions**:

- **WebSocket Sticky Sessions**: Load balancer must route user to same instance
  - Solution: Use Redis pub/sub for cross-instance message routing

- **Distributed Rate Limiting**: Redis-based counters work across instances
  - Already implemented ✓

- **Token Blacklist**: Redis shared across all instances
  - Already implemented ✓

---

**Last Updated**: December 30, 2024
**Version**: 1.0
**Status**: Production-Ready
