# MyNetRunner

A privacy-focused, end-to-end encrypted messaging platform built with security-first principles. Inspired by Signal's zero-knowledge architecture, MyNetRunner ensures that message content remains invisible to the server at all times.

> **Beta Notice**: This application is currently in beta. Features may change and security audits are ongoing.

**Live Demo**: [mynetrunner.com](https://www.mynetrunner.com)

---

## Security Architecture

### End-to-End Encryption

All messages are encrypted client-side before transmission. The server functions purely as a relay and cannot decrypt message content.

| Component | Implementation |
|-----------|----------------|
| Key Exchange | X3DH (Extended Triple Diffie-Hellman) |
| Message Encryption | AES-256-GCM |
| Key Derivation | HKDF-SHA256 |
| Elliptic Curves | ECDH/ECDSA P-256 |
| Password Storage | BCrypt |

### Zero-Knowledge Design

The server is intentionally limited in what it can access:

| Data | Server Access |
|------|---------------|
| Message content | No (encrypted client-side) |
| Private keys | No (stored in browser IndexedDB only) |
| Message length | No (padded to 4KB) |
| Timestamps | No (client-generated) |
| Usernames | Yes (required for routing) |
| Password hashes | Yes (BCrypt) |
| Public keys | Yes (for key exchange) |

### Message Lifecycle

Messages are designed to be ephemeral:

- **Online recipient**: Delivered via WebSocket, then immediately deleted from server
- **Offline recipient**: Stored encrypted on server, deleted after configurable TTL (1 min - 24 hours)
- **No message history**: Server does not maintain message logs

### Key Management

- Identity keys generated on first login using Web Crypto API
- Private keys stored exclusively in browser IndexedDB
- One-time prekeys provide forward secrecy
- All cryptographic material cleared on logout

---

## Technical Stack

### Backend
- **Framework**: Spring Boot 3 (Java 17)
- **Database**: PostgreSQL
- **Cache/Sessions**: Redis
- **Real-time**: WebSocket with STOMP
- **Authentication**: JWT with refresh tokens
- **Security**: Rate limiting, input sanitization, CORS protection

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Crypto**: Web Crypto API + libsignal
- **Key Storage**: IndexedDB
- **Styling**: Tailwind CSS

---

## Security Features

### Authentication & Session Management
- JWT-based authentication with token refresh
- Token blacklisting on logout
- Rate limiting on authentication endpoints (brute-force protection)
- Secure session management via Redis

### Input Validation & Sanitization
- Server-side input sanitization (XSS prevention)
- Username validation (alphanumeric, 3-50 characters)
- Password complexity requirements (minimum 8 characters)

### Transport Security
- HTTPS enforced in production
- WebSocket connections over WSS
- CORS configured for specific origins only

### Rate Limiting
- Authentication endpoints: Prevents credential stuffing
- Message sending: Prevents spam/abuse
- Counters stored in Redis with automatic expiry

---

## API Overview

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new account |
| `/api/auth/login` | POST | Authenticate and receive JWT |
| `/api/auth/logout` | POST | Invalidate token and clear pending messages |
| `/api/auth/refresh` | POST | Refresh access token |

### Key Exchange
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/keys/bundle` | POST | Upload prekey bundle |
| `/api/keys/{userId}/bundle` | GET | Retrieve user's public keys |
| `/api/keys/onetime` | POST | Upload one-time prekeys |
| `/api/keys/onetime/count` | GET | Check remaining prekey count |

### WebSocket
| Destination | Direction | Description |
|-------------|-----------|-------------|
| `/app/send` | Client -> Server | Send encrypted message |
| `/user/queue/messages` | Server -> Client | Receive messages |
| `/topic/presence` | Server -> Client | Online/offline updates |

---

## Local Development

### Prerequisites
- Java 17+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Backend
```bash
cd backend
./mvnw spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Configuration

**Backend** (`application.properties`):
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/mynetrunner
spring.datasource.username=your_username
spring.datasource.password=your_password
spring.data.redis.host=localhost
spring.data.redis.port=6379
jwt.secret=your-64-character-secret-key
app.cors.allowed-origins=http://localhost:5173
```

**Frontend** (`.env`):
```
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=http://localhost:8080/ws
```

---

## Privacy Recommendations

For enhanced privacy when using MyNetRunner:

1. **Use a VPN** - Masks your IP address from the server
2. **Set short message TTL** - Reduces window for undelivered message storage
3. **Use a pseudonymous username** - Avoid personally identifiable information
4. **Logout when finished** - Clears all local cryptographic material
5. **Use private browsing** - Prevents IndexedDB persistence across sessions

---

## Project Structure

```
mynetrunner/
├── backend/
│   └── src/main/java/com/mynetrunner/backend/
│       ├── config/        # Security, WebSocket, Redis configuration
│       ├── controller/    # REST and WebSocket endpoints
│       ├── dto/           # Request/Response objects
│       ├── model/         # JPA entities
│       ├── repository/    # Database access layer
│       ├── service/       # Business logic
│       └── util/          # JWT, sanitization utilities
│
└── frontend/
    └── src/
        ├── components/    # React components
        ├── crypto/        # Encryption modules (X3DH, AES, key management)
        ├── utils/         # API and WebSocket helpers
        └── types/         # TypeScript definitions
```

---

## Roadmap

- [ ] Group messaging with sender keys
- [ ] Typing indicators
- [ ] Read receipts (optional, privacy-respecting)
- [ ] File sharing with encryption
- [ ] Mobile applications
- [ ] Security audit by third party

---

## License

MIT License - See LICENSE for details.

---

## Author

**Alejandro Garcia** - Security-focused software engineer

Built as a demonstration of implementing secure, privacy-preserving communication systems.
