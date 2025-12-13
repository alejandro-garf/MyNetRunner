# MyNetRunner Project Checklist

## 📋 Backend Tasks (Alejandro)

### Phase 1: Core Infrastructure ✅ COMPLETE

#### Project Setup ✅
- [x] Initialize Spring Boot project with dependencies
- [x] Set up PostgreSQL database (local instance)
- [x] Set up Redis (local instance)
- [x] Configure application.properties for database connections
- [x] Create basic project structure (controllers, services, repositories, models)

#### User Authentication System ✅
- [x] Create User entity/model (id, username, password hash, created_at)
- [x] Create UserRepository (JPA)
- [x] Implement UserService (registration, login logic)
- [x] Implement password hashing (BCrypt)
- [x] Create AuthController with endpoints:
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
- [x] Implement JWT token generation
- [x] Test authentication endpoints with Postman/curl

#### Privacy-Focused Messaging System ✅
- [x] Create Message entity (id, senderId, receiverId, content, timestamp, delivered, expiresAt)
- [x] Create MessageRepository with auto-expiration queries
- [x] Create MessageService with immediate deletion after delivery
- [x] Configure WebSocket with STOMP for real-time delivery
- [x] Create WebSocket configuration class
- [x] Implement WebSocketMessageController
  - Endpoint: `/app/chat` - Send messages
  - Subscription: `/topic/messages/{userId}` - Receive messages
- [x] Create scheduled job for purging expired messages (daily at 3 AM)
- [x] Test WebSocket connection with HTML test client

#### API Documentation ✅
- [x] Document all REST endpoints
- [x] Include request/response examples for frontend team
- [x] Document error codes and responses
- [x] Share base URL and WebSocket endpoint URLs

#### Input Validation & Error Handling ✅
- [x] Add username validation (3-50 characters, alphanumeric)
- [x] Add password requirements (minimum 8 chars, complexity rules)
- [x] Implement proper error messages for validation failures
- [x] Add HTTP status codes (200, 201, 400, 401, 404, 500)
- [x] Create custom exception handlers (@ControllerAdvice)

#### CORS Configuration ✅
- [x] Configure CORS in SecurityConfig
- [x] Allow frontend origin (localhost:3000)
- [x] Configure allowed methods (GET, POST, PUT, DELETE, OPTIONS)
- [x] Configure allowed headers
- [x] Test CORS with frontend connection

#### Redis Integration ✅
- [x] Create RedisConfig with RedisTemplate bean
- [x] Update WebSocketSessionManager to use Redis
- [x] Store active WebSocket sessions in Redis
- [x] Track user online/offline status
- [x] Create `GET /api/users/{username}/status` endpoint
- [x] Create `GET /api/users/online` endpoint
- [x] Broadcast presence updates via `/topic/presence`
- [x] Fix disconnect event listener (session-to-username mapping)

---

### Phase 2: Security Hardening ⬜ TODO

#### JWT Authentication Improvements
- [x] Add JWT filter to validate tokens on protected endpoints
- [x] Implement token refresh mechanism
- [x] Add token blacklist for logout (store in Redis)
- [x] Secure WebSocket connections with JWT validation

#### Rate Limiting
- [x] Implement rate limiting for auth endpoints (prevent brute force)
- [x] Add rate limiting for message sending
- [x] Store rate limit counters in Redis

#### Input Sanitization
- [x] Sanitize message content (prevent XSS)
- [x] Add additional validation for all user inputs

---

### Phase 3: End-to-End Encryption ⬜ FUTURE

#### Signal Protocol Implementation
- [x] Research Signal Protocol / libsignal library
- [x] Implement key pair generation (client-side)
- [x] Create key exchange endpoints:
  - `POST /api/keys/bundle` - Upload prekey bundle
  - `GET /api/keys/{userId}/bundle` - Get user's prekey bundle
- [x] Store public keys on server (private keys stay on client)
- [x] Server only relays encrypted blobs (zero-knowledge)
- [x] Implement Double Ratchet algorithm for forward secrecy

---

### Phase 4: Additional Features ⬜ FUTURE

#### Group Messaging
- [ ] Create Group entity (id, name, createdBy, createdAt)
- [ ] Create GroupMembership entity
- [ ] Create GroupRepository and GroupService
- [ ] Implement group CRUD endpoints
- [ ] Implement group message routing via WebSocket
- [ ] Sender keys for efficient group E2E encryption

---

## 🎨 Frontend Tasks (Jane)

### Phase 1: Core UI ✅ COMPLETE
- [x] Project setup (Vite + React + TypeScript)
- [x] Sign up page
- [x] Sign in page
- [x] Chat page with real-time messaging
- [x] WebSocket integration with STOMP
- [x] API integration (auth, messaging)

### Phase 2: Polish ⬜ TODO
- [x] User presence indicators (online/offline dots)
- [x] Error handling and loading states
- [x] Responsive design 
- [x] Message timestamps and formatting

### Phase 3: Future ⬜ FUTURE
- [x] E2E encryption UI (key management)
- [ ] Group chat UI
- [ ] Typing indicators
- [ ] Read receipts UI
- [ ] File upload UI

---

## 🚀 Deployment Plan

### Step 1: Environment Configuration

#### Create Production Environment Files

**Backend: `application-prod.properties`**
```properties
# Server
server.port=8080
spring.application.name=mynetrunner

# PostgreSQL (use environment variables)
spring.datasource.url=${DATABASE_URL}
spring.datasource.username=${DATABASE_USER}
spring.datasource.password=${DATABASE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false

# Redis
spring.data.redis.host=${REDIS_HOST}
spring.data.redis.port=${REDIS_PORT}
spring.data.redis.password=${REDIS_PASSWORD}

# JWT (use strong secret in production)
jwt.secret=${JWT_SECRET}
jwt.expiration=86400000

# CORS (update with production frontend URL)
app.cors.allowed-origins=${FRONTEND_URL}
```

#### Environment Variables Needed
```
DATABASE_URL=jdbc:postgresql://host:5432/mynetrunner
DATABASE_USER=mynetrunner_user
DATABASE_PASSWORD=<strong-password>
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
JWT_SECRET=<64-char-random-string>
FRONTEND_URL=https://mynetrunner.com
```

---

### Step 2: Dockerize the Application

#### Backend Dockerfile
```dockerfile
# backend/Dockerfile
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=prod"]
```

#### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml (Full Stack)
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mynetrunner
      POSTGRES_USER: mynetrunner_user
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: jdbc:postgresql://postgres:5432/mynetrunner
      DATABASE_USER: mynetrunner_user
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

---

### Step 3: CI/CD Pipeline (GitHub Actions)

#### `.github/workflows/deploy.yml`
```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      
      - name: Run backend tests
        working-directory: ./backend
        run: ./mvnw test
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run frontend tests
        working-directory: ./frontend
        run: |
          npm ci
          npm test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ghcr.io/${{ github.repository }}/backend:latest
      
      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ghcr.io/${{ github.repository }}/frontend:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/mynetrunner
            docker compose pull
            docker compose up -d
```

---

### Step 4: Deployment Options

#### Option A: Railway (Easiest)
1. Connect GitHub repo to Railway
2. Add PostgreSQL and Redis services
3. Set environment variables
4. Deploy backend and frontend as separate services
5. Railway handles SSL and domains

#### Option B: DigitalOcean App Platform
1. Create App from GitHub repo
2. Add managed PostgreSQL and Redis
3. Configure environment variables
4. Auto-deploys on push to main

#### Option C: VPS (Full Control)
1. Provision Ubuntu VPS (DigitalOcean, Linode, etc.)
2. Install Docker and Docker Compose
3. Clone repo and configure `.env`
4. Run `docker compose up -d`
5. Set up Nginx reverse proxy with SSL (Certbot)
6. Configure firewall (ufw)

---

### Step 5: Pre-Deployment Checklist

#### Security
- [ ] Generate strong JWT secret (64+ characters)
- [ ] Set strong database password
- [ ] Set Redis password
- [ ] Update CORS to production frontend URL only
- [ ] Enable HTTPS (SSL certificate)
- [ ] Set `spring.jpa.hibernate.ddl-auto=validate` (not update)
- [ ] Remove all `System.out.println` debug statements
- [ ] Review and restrict security endpoints

#### Database
- [ ] Run migrations on production database
- [ ] Set up database backups
- [ ] Test database connection from backend

#### Monitoring
- [ ] Set up application logging (e.g., Logback to file)
- [ ] Configure health check endpoint monitoring
- [ ] Set up error alerting (optional: Sentry, Datadog)

#### DNS
- [ ] Point domain to server IP
- [ ] Configure SSL certificate
- [ ] Set up www redirect if needed

---

### Step 6: Post-Deployment Verification

```bash
# Test health endpoint
curl https://api.mynetrunner.com/api/health

# Test registration
curl -X POST https://api.mynetrunner.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123!"}'

# Test login
curl -X POST https://api.mynetrunner.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123!"}'

# Test user status
curl https://api.mynetrunner.com/api/users/testuser/status

# Test WebSocket (use browser console or wscat)
# Connect to wss://api.mynetrunner.com/ws
```

---

## 📅 Timeline Suggestion

| Week | Tasks |
|------|-------|
| **Done** | Phase 1 Backend Complete ✅ |
| **This Week** | Merge Redis PR, Frontend polish, Integration testing |
| **Next Week** | Security hardening, Dockerize, CI/CD setup |
| **Week 3** | Deploy to staging, Test, Fix bugs |
| **Week 4** | Production deployment, Demo prep |

---

## 🔒 Privacy Implementation Summary

MyNetRunner follows Signal's zero-knowledge architecture:

1. **Messages deleted immediately** after WebSocket delivery
2. **Undelivered messages expire** after 30 days
3. **No message history** stored on server
4. **Minimal user data** - only username and hashed password
5. **Future: E2E encryption** - server only relays encrypted blobs

---

*Last Updated: December 11, 2025*
