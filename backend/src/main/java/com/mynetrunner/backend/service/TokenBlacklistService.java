package com.mynetrunner.backend.service;

import java.util.Date;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.mynetrunner.backend.util.JwtUtil;

@Service
public class TokenBlacklistService {

    private static final String BLACKLIST_PREFIX = "token:blacklist:";

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Blacklist a token until its expiration time
     */
    public void blacklistToken(String token) {
        try {
            Date expiration = jwtUtil.extractExpiration(token);
            long ttlMillis = expiration.getTime() - System.currentTimeMillis();
            
            if (ttlMillis > 0) {
                String key = BLACKLIST_PREFIX + token;
                redisTemplate.opsForValue().set(key, "blacklisted", ttlMillis, TimeUnit.MILLISECONDS);
            }
        } catch (Exception e) {
            // Token is invalid or expired - no need to blacklist
        }
    }

    /**
     * Check if a token is blacklisted
     */
    public boolean isBlacklisted(String token) {
        String key = BLACKLIST_PREFIX + token;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }
}