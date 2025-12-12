package com.mynetrunner.backend.service;

import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class RateLimitService {

    private static final String RATE_LIMIT_PREFIX = "ratelimit:";

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    /**
     * Check if action is allowed and increment counter
     * @param key Unique identifier (e.g., IP address, username)
     * @param action Action type (e.g., "login", "register", "message")
     * @param maxAttempts Maximum attempts allowed in window
     * @param windowSeconds Time window in seconds
     * @return true if allowed, false if rate limited
     */
    public boolean isAllowed(String key, String action, int maxAttempts, int windowSeconds) {
        String redisKey = RATE_LIMIT_PREFIX + action + ":" + key;
        
        String currentCount = redisTemplate.opsForValue().get(redisKey);
        
        if (currentCount == null) {
            // First attempt - set counter with expiration
            redisTemplate.opsForValue().set(redisKey, "1", windowSeconds, TimeUnit.SECONDS);
            return true;
        }
        
        int count = Integer.parseInt(currentCount);
        
        if (count >= maxAttempts) {
            return false;
        }
        
        // Increment counter
        redisTemplate.opsForValue().increment(redisKey);
        return true;
    }

    /**
     * Get remaining attempts
     */
    public int getRemainingAttempts(String key, String action, int maxAttempts) {
        String redisKey = RATE_LIMIT_PREFIX + action + ":" + key;
        String currentCount = redisTemplate.opsForValue().get(redisKey);
        
        if (currentCount == null) {
            return maxAttempts;
        }
        
        return Math.max(0, maxAttempts - Integer.parseInt(currentCount));
    }

    /**
     * Get seconds until rate limit resets
     */
    public long getSecondsUntilReset(String key, String action) {
        String redisKey = RATE_LIMIT_PREFIX + action + ":" + key;
        Long ttl = redisTemplate.getExpire(redisKey, TimeUnit.SECONDS);
        return ttl != null && ttl > 0 ? ttl : 0;
    }

    /**
     * Reset rate limit for a key (e.g., after successful login)
     */
    public void resetLimit(String key, String action) {
        String redisKey = RATE_LIMIT_PREFIX + action + ":" + key;
        redisTemplate.delete(redisKey);
    }
}