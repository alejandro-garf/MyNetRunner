# MyNetRunner

<div align="center">

**A Privacy-First, End-to-End Encrypted Messaging Platform**

[![Java](https://img.shields.io/badge/Java-17-orange.svg)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-green.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#features) • [Architecture](#architecture) • [Security](#security) • [Setup](#setup) • [Documentation](#documentation)

</div>

---

## Overview

MyNetRunner is a **Signal-inspired**, privacy-focused messaging application implementing industrial-grade end-to-end encryption (E2EE) using the **X3DH key agreement protocol** and **AES-256-GCM encryption**. Built with a modern tech stack featuring Spring Boot and React, it demonstrates enterprise-level security practices including httpOnly cookie authentication, rate limiting, and zero-knowledge architecture.

### Key Highlights

- 🔐 **End-to-End Encryption** - X3DH key agreement + Double Ratchet algorithm
- 🍪 **Secure Authentication** - HttpOnly cookies prevent XSS token theft
- 🚫 **Zero-Knowledge Server** - Messages deleted immediately after delivery
- ⚡ **Real-Time Communication** - WebSocket (STOMP) for instant messaging
- 🛡️ **Enterprise Security** - Rate limiting, input sanitization, JWT blacklisting
- 📱 **Modern UI** - Cyberpunk-themed responsive interface with Tailwind CSS

---

## Features

### Core Functionality
- **Direct Messaging** - Private 1-on-1 conversations with E2EE
- **Group Chat** - Encrypted group messaging with role-based permissions
- **Friend System** - Send/accept friend requests before messaging
- **Online Presence** - Real-time user status indicators
- **Message TTL** - Automatic message expiration (1min - 24hrs)
- **Offline Message Queue** - Messages delivered when recipient comes online

### Security Features
- **X3DH Key Exchange** - Signal-protocol-based key agreement
- **Perfect Forward Secrecy** - Compromised keys don't decrypt past messages
- **One-Time Prekeys** - Fresh keys for each session establishment
- **HttpOnly Cookies** - Authentication tokens immune to XSS
- **Rate Limiting** - Protection against brute force and spam
- **Input Sanitization** - XSS and SQL injection prevention
- **Token Blacklisting** - Immediate session revocation on logout

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + TS)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Encryption  │  │   WebSocket  │  │   UI Layer   │         │
│  │   (X3DH)     │  │    (STOMP)   │  │  (Tailwind)  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘         │
│         │                  │                                     │
│  ┌──────▼──────────────────▼───────────────────────┐           │
│  │         IndexedDB (Keys & Sessions)             │           │
│  └─────────────────────────────────────────────────┘           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS + Cookies
┌──────────────────────────▼──────────────────────────────────────┐
│                   API GATEWAY (Spring Boot)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │     Auth     │  │     Rate     │  │   Security   │         │
│  │    Filter    │  │   Limiter    │  │    Filter    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│                     BUSINESS LOGIC                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Message    │  │    User      │  │     Key      │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└──────────────┬──────────────────────┬────────────────────────── ┘
               │                      │
        ┌──────▼──────┐      ┌───────▼────────┐
        │  PostgreSQL │      │     Redis      │
        │  (Metadata) │      │  (Sessions)    │
        └─────────────┘      └────────────────┘
```

### Data Flow

1. **Key Exchange** (First Contact)
   ```
   Alice → Server: Fetch Bob's PreKey Bundle
   Server → Alice: {identityKey, signedPreKey, oneTimePreKey}
   Alice: Perform X3DH → Generate Shared Secret
   Alice → Bob: Encrypted(message + keyExchangeData)
   Bob: Perform X3DH Response → Generate Same Shared Secret
   Bob: Decrypt message
   ```

2. **Subsequent Messages**
   ```
   Alice: Encrypt(message) using session's shared secret
   Alice → WebSocket → Server → WebSocket → Bob
   Server: Relay encrypted blob (zero-knowledge)
   Bob: Decrypt(message) using session's shared secret
   ```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for detailed system design.

---

## Security

MyNetRunner implements defense-in-depth with multiple security layers:

### Encryption Stack
- **X3DH Key Agreement** - Establishes shared secrets without real-time interaction
- **AES-256-GCM** - Authenticated encryption with associated data
- **HMAC-SHA256** - Message authentication codes
- **ECDH (Curve25519)** - Elliptic curve Diffie-Hellman for key exchange

### Authentication & Authorization
- **HttpOnly Cookies** - Tokens stored securely, inaccessible to JavaScript
- **JWT (HS256)** - Signed access tokens (24h) and refresh tokens (7d)
- **BCrypt** - Password hashing with adaptive cost factor
- **Token Blacklisting** - Redis-based revocation on logout

### Attack Mitigations
| Attack Vector | Mitigation |
|---------------|------------|
| XSS | HttpOnly cookies, input sanitization, CSP headers |
| CSRF | SameSite=Strict cookies, stateless JWT |
| SQL Injection | JPA parameterized queries |
| Brute Force | Rate limiting (5 login attempts / 5 min) |
| Replay Attacks | One-time prekeys, message TTL |
| MITM | TLS/HTTPS enforcement, certificate pinning (prod) |

See [`docs/SECURITY.md`](docs/SECURITY.md) for threat model and security analysis.

---

## Tech Stack

### Backend
- **Java 17** - Modern JVM with records and sealed classes
- **Spring Boot 3.x** - Enterprise framework
- **Spring Security** - Authentication and authorization
- **Spring WebSocket** - STOMP protocol for real-time messaging
- **PostgreSQL** - Relational database for metadata
- **Redis** - Session management and rate limiting
- **Maven** - Dependency management

### Frontend
- **React 18** - Component-based UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Axios** - HTTP client with interceptors
- **SockJS + STOMP** - WebSocket client
- **IndexedDB** - Client-side encrypted key storage

---

## Setup

### Prerequisites
- Java 17+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Maven 3.8+

### 1. Database Setup

```bash
# PostgreSQL
createdb mynetrunner
psql mynetrunner

# Redis
redis-server
```

### 2. Backend Configuration

```bash
cd backend
cp .env.example .env

# Edit .env with your database credentials
# Generate a secure JWT secret:
openssl rand -base64 64
```

**backend/.env**:
```properties
DATABASE_URL=jdbc:postgresql://localhost:5432/mynetrunner
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_64_char_secret_here
FRONTEND_URL=http://localhost:5173
```

```bash
# Run backend
./mvnw spring-boot:run
```

Backend runs on `http://localhost:8080`

### 3. Frontend Configuration

```bash
cd frontend
npm install
cp .env.example .env
```

**frontend/.env**:
```env
VITE_API_BASE_URL=http://localhost:8080
```

```bash
# Run frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

### 4. Access Application

Open `http://localhost:5173` and create an account!

---

## API Documentation

### Authentication Endpoints

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
```

### Messaging Endpoints

```http
GET  /api/messages/pending
POST /api/messages/send
```

### WebSocket

```
CONNECT /ws
SUBSCRIBE /topic/messages/{userId}
SEND /app/chat
```

See [`docs/API.md`](docs/API.md) for complete API documentation with examples.

---

## Deployment

### Production Checklist

- [ ] Generate strong JWT secret (64+ characters)
- [ ] Enable HTTPS/TLS (Let's Encrypt or cloud provider)
- [ ] Set `SPRING_PROFILES_ACTIVE=production`
- [ ] Configure production database with SSL
- [ ] Set up Redis password authentication
- [ ] Update CORS to production frontend URL only
- [ ] Enable rate limiting on all endpoints
- [ ] Set up database backups
- [ ] Configure logging and monitoring
- [ ] Review and test security headers

### Deployment Platforms

**Railway** (Recommended - Easiest)
1. Connect GitHub repository
2. Add PostgreSQL and Redis add-ons
3. Set environment variables from `.env.example`
4. Deploy automatically on git push

**Docker**
```bash
docker-compose up -d
```

See [`HOW-TO-RUN.md`](HOW-TO-RUN.md) for detailed deployment instructions.

---

## Project Structure

```
MyNetRunner/
├── backend/
│   └── src/main/java/com/mynetrunner/backend/
│       ├── config/          # Security, CORS, WebSocket config
│       ├── controller/      # REST API endpoints
│       ├── service/         # Business logic
│       ├── model/           # JPA entities
│       ├── repository/      # Database access
│       ├── filter/          # Security filters
│       ├── dto/             # Data transfer objects
│       ├── util/            # Utilities (JWT, sanitization)
│       └── exception/       # Custom exceptions
├── frontend/
│   └── src/
│       ├── components/      # React components
│       ├── crypto/          # X3DH, encryption logic
│       ├── utils/           # API client, WebSocket
│       └── types/           # TypeScript definitions
└── docs/
    ├── API.md               # API reference
    ├── ARCHITECTURE.md      # System design
    ├── ENCRYPTION.md        # Crypto implementation
    └── SECURITY.md          # Security model
```

---

## Documentation

- **[API Reference](docs/API.md)** - Complete endpoint documentation
- **[Architecture](docs/ARCHITECTURE.md)** - System design and data flows
- **[Security Model](docs/SECURITY.md)** - Threat analysis and mitigations
- **[Encryption](docs/ENCRYPTION.md)** - X3DH and E2EE implementation
- **[Deployment Guide](HOW-TO-RUN.md)** - Production deployment

---

## Contributing

This is a personal portfolio/educational project. Feel free to fork and experiment!

### Development Guidelines
- Follow existing code style (Prettier for TS, Google Java Style)
- Write meaningful commit messages
- Add tests for new features
- Update documentation for API changes

---

## License

MIT License - see LICENSE file for details.

---

## Acknowledgments

- **Signal Protocol** - Inspiration for E2EE architecture
- **Spring Boot** - Excellent framework and documentation
- **React** - Modern UI development

---

## Contact

**Project by**: Alejandro
**Purpose**: CPSC 449 Class Project / Personal Portfolio
**Built**: December 2024

---

<div align="center">

**⚡ Built with privacy and security in mind ⚡**

</div>
