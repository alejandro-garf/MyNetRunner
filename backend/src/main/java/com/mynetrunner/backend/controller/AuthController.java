package com.mynetrunner.backend.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mynetrunner.backend.dto.AuthResponse;
import com.mynetrunner.backend.dto.LoginRequest;
import com.mynetrunner.backend.dto.RegisterRequest;
import com.mynetrunner.backend.service.RateLimitService;
import com.mynetrunner.backend.service.TokenBlacklistService;
import com.mynetrunner.backend.service.UserService;
import com.mynetrunner.backend.util.JwtUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    @Autowired
    private RateLimitService rateLimitService;

    /**
     * Register a new user
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            AuthResponse authResponse = userService.register(request.getUsername(), request.getPassword());

            Map<String, Object> response = new HashMap<>();
            response.put("message", authResponse.getMessage());
            response.put("username", authResponse.getUsername());
            response.put("userId", authResponse.getUserId());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }
    }

    /**
     * Login user and return JWT tokens
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        try {
            AuthResponse authResponse = userService.login(request.getUsername(), request.getPassword());

            // Generate refresh token
            String refreshToken = jwtUtil.generateRefreshToken(request.getUsername());

            // Reset rate limit on successful login
            String clientIp = getClientIp(httpRequest);
            rateLimitService.resetLimit(clientIp, "login");

            Map<String, Object> response = new HashMap<>();
            response.put("message", authResponse.getMessage());
            response.put("token", authResponse.getToken());
            response.put("refreshToken", refreshToken);
            response.put("username", authResponse.getUsername());
            response.put("userId", authResponse.getUserId());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }
    }

    /**
     * Refresh access token using refresh token
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");

        if (refreshToken == null || refreshToken.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Refresh token is required"));
        }

        // Check if refresh token is blacklisted
        if (tokenBlacklistService.isBlacklisted(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Refresh token has been revoked"));
        }

        // Validate refresh token
        if (!jwtUtil.validateRefreshToken(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired refresh token"));
        }

        try {
            String username = jwtUtil.extractUsername(refreshToken);

            // Generate new access token
            String newAccessToken = jwtUtil.generateToken(username);

            Map<String, Object> response = new HashMap<>();
            response.put("token", newAccessToken);
            response.put("username", username);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Failed to refresh token"));
        }
    }

    /**
     * Logout user - blacklist current tokens
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody(required = false) Map<String, String> request,
            Authentication authentication) {

        // Blacklist access token
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7);
            tokenBlacklistService.blacklistToken(accessToken);
        }

        // Blacklist refresh token if provided
        if (request != null && request.containsKey("refreshToken")) {
            String refreshToken = request.get("refreshToken");
            tokenBlacklistService.blacklistToken(refreshToken);
        }

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    /**
     * Get client IP address (handles proxies)
     */
    private String getClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp;
        }

        return request.getRemoteAddr();
    }
}