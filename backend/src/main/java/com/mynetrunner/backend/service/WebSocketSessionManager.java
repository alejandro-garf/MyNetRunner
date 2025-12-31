package com.mynetrunner.backend.service;

import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class WebSocketSessionManager {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketSessionManager.class);
    private static final String USER_SESSION_PREFIX = "user:session:";
    private static final String ONLINE_USERS_KEY = "online:users";
    private static final long SESSION_TIMEOUT_HOURS = 24;

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    public void registerSession(String username, String sessionId) {
        // Store session ID for the user
        String key = USER_SESSION_PREFIX + username;
        redisTemplate.opsForValue().set(key, sessionId, SESSION_TIMEOUT_HOURS, TimeUnit.HOURS);

        // Add user to online users set
        redisTemplate.opsForSet().add(ONLINE_USERS_KEY, username);

        logger.debug("Registered WebSocket session for user: {} (session: {})", username, sessionId);
    }

    public void removeSession(String username) {
        // Remove session key
        String key = USER_SESSION_PREFIX + username;
        redisTemplate.delete(key);

        // Remove from online users set
        redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, username);

        logger.debug("Removed WebSocket session for user: {}", username);
    }

    public String getSessionId(String username) {
        String key = USER_SESSION_PREFIX + username;
        return redisTemplate.opsForValue().get(key);
    }

    public boolean isUserOnline(String username) {
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(ONLINE_USERS_KEY, username));
    }

    public Set<String> getOnlineUsers() {
        return redisTemplate.opsForSet().members(ONLINE_USERS_KEY);
    }
}