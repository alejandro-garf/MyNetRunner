# MyNetRunner 🔒

A privacy-focused, end-to-end encrypted messaging application inspired by Signal's zero-knowledge architecture.

Built for CPSC 449 - Fall 2025

## 🌟 Features

### Security & Privacy
- **End-to-End Encryption** - Messages encrypted using AES-256-GCM
- **X3DH Key Exchange** - Signal Protocol-based key exchange for perfect forward secrecy
- **Zero Server Knowledge** - Server cannot read message content
- **Auto-Delete Messages** - Customizable TTL (1 min to 24 hours)
- **Message Padding** - All messages padded to 4KB to hide content length
- **No Server Logs** - Message metadata is not logged
- **Client-Side Timestamps** - Server doesn't track when messages are sent
- **Keys Cleared on Logout** - No encryption data persists after session ends

### Core Features
- Real-time messaging via WebSockets
- Friend system with request/accept flow
- JWT authentication with refresh tokens
- Rate limiting to prevent abuse
- Responsive design for mobile and desktop

### User Experience
- Security modal on first visit explaining privacy features
- Persistent VPN recommendation banner
- Configurable message expiration time
- Friends panel for easy messaging
- Visual encryption indicators (lock icons)
- Connection status display

## 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ React + TS   │  │ Web Crypto   │  │ IndexedDB            │  │
│  │ UI Layer     │  │ AES-256-GCM  │  │ Private Keys Storage │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Encrypted Messages Only
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Spring Boot  │  │ PostgreSQL   │  │ Redis                │  │
│  │ REST + WS    │  │ Users + Keys │  │ Sessions + Rate Limit│  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Security Model

### What the Server Knows
| Data | Server Access |
|------|---------------|
| Usernames | ✅ Yes (for routing) |
| Password hashes | ✅ Yes (BCrypt) |
| Public keys | ✅ Yes (for key exchange) |
| Friend relationships | ✅ Yes |
| Who messages whom | ⚠️ Temporarily (deleted after delivery) |
| Message content | ❌ No (encrypted) |
| Private keys | ❌ No (client-side only) |
| Message timestamps | ❌ No (client-generated) |
| Message length | ❌ No (padded to 4KB) |

### What the Server Stores Permanently
- User accounts (username + hashed password)
- Public encryption keys (for E2E setup)
- Friend relationships
- **Nothing else** - messages are deleted immediately after delivery

### Message Lifecycle
| Scenario | What Happens |
|----------|--------------|
| Recipient **online** | Message delivered via WebSocket → **Deleted immediately** |
| Recipient **offline** | Message waits on server (encrypted) → **Deleted after TTL expires** |

## 🚀 Quick Start

### Prerequisites
- Java 17+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Backend Setup
```bash
cd backend

# Configure database
cp src/main/resources/application.properties.example src/main/resources/application.properties
# Edit application.properties with your database credentials

# Run
./mvnw spring-boot:run
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

### Default URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- WebSocket: ws://localhost:8080/ws

## 📁 Project Structure
```
mynetrunner/
├── backend/
│   ├── src/main/java/com/mynetrunner/backend/
│   │   ├── config/          # Security, WebSocket, Redis, Scheduling config
│   │   ├── controller/      # REST + WebSocket endpoints
│   │   │   ├── AuthController.java
│   │   │   ├── FriendController.java
│   │   │   ├── KeyController.java
│   │   │   ├── UserStatusController.java
│   │   │   └── WebSocketMessageController.java
│   │   ├── dto/             # Request/Response objects
│   │   ├── model/           # JPA entities
│   │   │   ├── User.java
│   │   │   ├── Message.java
│   │   │   ├── Friendship.java
│   │   │   ├── PreKeyBundle.java
│   │   │   └── OneTimePreKey.java
│   │   ├── repository/      # Database access
│   │   ├── service/         # Business logic
│   │   │   ├── UserService.java
│   │   │   ├── MessageService.java
│   │   │   ├── FriendshipService.java
│   │   │   ├── KeyService.java
│   │   │   ├── RateLimitService.java
│   │   │   └── TokenBlacklistService.java
│   │   └── util/            # JWT, sanitization utilities
│   └── pom.xml
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── ChatPage.tsx
│   │   │   ├── SignInPage.tsx
│   │   │   ├── SignUpPage.tsx
│   │   │   └── HomePage.tsx
│   │   ├── crypto/          # Encryption modules
│   │   │   ├── KeyStorage.ts      # IndexedDB for private keys
│   │   │   ├── KeyGenerator.ts    # Web Crypto key generation
│   │   │   ├── KeyAPI.ts          # Server communication
│   │   │   ├── X3DH.ts            # Key exchange protocol
│   │   │   ├── SessionManager.ts  # Encrypted sessions
│   │   │   ├── MessageCrypto.ts   # AES-256-GCM + padding
│   │   │   └── KeyReplenishment.ts
│   │   ├── utils/           # API, WebSocket helpers
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   └── types/           # TypeScript definitions
│   └── package.json
│
└── README.md
```

## 🔒 Encryption Details

### Key Exchange (X3DH)
1. Each user generates identity key pair on first login
2. Public keys uploaded to server
3. When starting conversation, sender performs X3DH with recipient's public keys
4. Shared secret derived via HKDF
5. One-time prekeys consumed for forward secrecy

### Message Encryption
1. Plaintext padded to 4KB (hides message length)
2. Random 12-byte IV generated
3. Encrypted with AES-256-GCM using shared secret
4. Only encrypted blob sent to server

### Key Storage
- Private keys stored in browser IndexedDB
- Keys cleared on logout
- Never transmitted to server

### Algorithms Used
| Purpose | Algorithm |
|---------|-----------|
| Key pairs | ECDH P-256 (Elliptic Curve) |
| Key exchange | X3DH (Signal Protocol) |
| Message encryption | AES-256-GCM |
| Key derivation | HKDF-SHA256 |
| Signatures | ECDSA P-256 |
| Password hashing | BCrypt |

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| POST | `/api/auth/logout` | Logout, blacklist token, delete pending messages |
| POST | `/api/auth/refresh` | Refresh access token |

### Friends
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/friends` | Get friends list |
| GET | `/api/friends/requests` | Get pending friend requests |
| POST | `/api/friends/request/{username}` | Send friend request |
| POST | `/api/friends/accept/{id}` | Accept request |
| POST | `/api/friends/reject/{id}` | Reject request |
| DELETE | `/api/friends/{id}` | Remove friend |
| GET | `/api/friends/check/{username}` | Check if friends |

### Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys/bundle` | Upload prekey bundle |
| GET | `/api/keys/{userId}/bundle` | Get user's public keys |
| POST | `/api/keys/onetime` | Upload one-time prekeys |
| GET | `/api/keys/onetime/count` | Get remaining prekey count |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/{username}/status` | Get online status |
| GET | `/api/users/online` | Get all online users |
| GET | `/api/users/by-username/{username}` | Get user by username |

### WebSocket
| Destination | Description |
|-------------|-------------|
| `/app/send` | Send encrypted message |
| `/user/queue/messages` | Receive messages |
| `/user/queue/errors` | Receive errors |
| `/topic/presence` | Presence updates |

## 🛡️ Privacy Recommendations

For maximum privacy, we recommend:

1. **Use a trusted VPN** - Hides your IP address from the server
2. **Use Tor Browser** - For additional anonymity layer
3. **Set short message TTL** - Messages auto-delete faster if undelivered
4. **Logout when done** - Clears all local encryption keys
5. **Use unique username** - Don't use your real name or identifying info
6. **Clear browser data** - Periodically clear IndexedDB if concerned

## 🔧 Configuration

### Backend (application.properties)
```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/mynetrunner
spring.datasource.username=your_username
spring.datasource.password=your_password

# Redis
spring.data.redis.host=localhost
spring.data.redis.port=6379

# JWT
jwt.secret=your-64-character-secret-key-here
jwt.expiration=86400000

# CORS
app.cors.allowed-origins=http://localhost:5173
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:8080
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
./mvnw test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Manual Testing Checklist
- [ ] Register new user
- [ ] Login with correct/incorrect credentials
- [ ] Logout clears keys
- [ ] Send encrypted message
- [ ] Receive and decrypt message
- [ ] Friend request flow
- [ ] Message TTL works
- [ ] Rate limiting triggers

## 🚢 Deployment

See the deployment section in the project checklist for:
- Docker configuration
- docker-compose.yml
- CI/CD with GitHub Actions
- Production environment setup

## 📄 License

MIT License - See LICENSE file for details.

## 👥 Team

- **Alejandro** - Backend Lead
- **Jane** - Frontend Lead  
- **Lawrence** - Testing & Full-Stack Support

---

*Built with ❤️ for CPSC 449 - Fall 2025*