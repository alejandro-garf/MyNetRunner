package com.mynetrunner.backend.util;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    // Refresh token lasts 7 days
    private static final long REFRESH_EXPIRATION = 7 * 24 * 60 * 60 * 1000L;

    // Generate access token for user
    public String generateToken(String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("type", "access");
        return createToken(claims, username, expiration);
    }

    // Generate refresh token for user
    public String generateRefreshToken(String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("type", "refresh");
        return createToken(claims, username, REFRESH_EXPIRATION);
    }

    // Create JWT token
    private String createToken(Map<String, Object> claims, String subject, Long expirationTime) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationTime);

        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    // Extract username from token
    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    // Extract expiration date from token
    public Date extractExpiration(String token) {
        return extractAllClaims(token).getExpiration();
    }

    // Extract token type (access or refresh)
    public String extractTokenType(String token) {
        return (String) extractAllClaims(token).get("type");
    }

    // Extract all claims from token
    private Claims extractAllClaims(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    // Check if token is expired
    public Boolean isTokenExpired(String token) {
        try {
            return extractExpiration(token).before(new Date());
        } catch (ExpiredJwtException e) {
            return true;
        }
    }

    // Validate token
    public Boolean validateToken(String token, String username) {
        try {
            final String extractedUsername = extractUsername(token);
            return (extractedUsername.equals(username) && !isTokenExpired(token));
        } catch (Exception e) {
            return false;
        }
    }

    // Validate refresh token specifically
    public Boolean validateRefreshToken(String token) {
        try {
            String type = extractTokenType(token);
            return "refresh".equals(type) && !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }
}