package com.mynetrunner.backend.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mynetrunner.backend.dto.AuthResponse;
import com.mynetrunner.backend.dto.LoginRequest;
import com.mynetrunner.backend.dto.RegisterRequest;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.service.MessageService;
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

    @Autowired
    private MessageService messageService;

    @Autowired
    private UserRepository userRepository;

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
     * Login user and return JWT token
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        try {
            AuthResponse authResponse = userService.login(request.getUsername(), request.getPassword());

            // Reset rate limit on successful login
            String clientIp = getClientIp(httpRequest);
            rateLimitService.resetLimit(clientIp, "login");

            Map<String, Object> response = new HashMap<>();
            response.put("message", authResponse.getMessage());
            response.put("token", authResponse.getToken());
            response.put("refreshToken", authResponse.getRefreshToken());
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
     * Refresh access token
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");

        if (refreshToken == null || refreshToken.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Refresh token required"));
        }

        // Check if token is blacklisted
        if (tokenBlacklistService.isBlacklisted(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Token has been revoked"));
        }

        try {
            // Validate it's a refresh token
            if (!jwtUtil.isRefreshToken(refreshToken)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid refresh token"));
            }

            String username = jwtUtil.extractUsername(refreshToken);

            if (username != null && jwtUtil.validateToken(refreshToken)) {
                String newAccessToken = jwtUtil.generateToken(username);
                return ResponseEntity.ok(Map.of("token", newAccessToken));
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid refresh token"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Token refresh failed"));
        }
    }

    /**
     * Logout user - blacklist tokens and delete pending messages
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody Map<String, String> request, HttpServletRequest httpRequest) {
        String authHeader = httpRequest.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            // Get username before blacklisting
            String username = null;
            try {
                username = jwtUtil.extractUsername(token);
            } catch (Exception e) {
                // Token might be expired, continue with logout
            }

            // Blacklist the access token
            tokenBlacklistService.blacklistToken(token);

            // Blacklist refresh token if provided
            String refreshToken = request.get("refreshToken");
            if (refreshToken != null && !refreshToken.isEmpty()) {
                tokenBlacklistService.blacklistToken(refreshToken);
            }

            // Delete any pending messages for this user (privacy)
            if (username != null) {
                User user = userRepository.findByUsername(username).orElse(null);
                if (user != null) {
                    messageService.deleteAllMessagesForUser(user.getId());
                }
            }

            return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
        }

        return ResponseEntity.badRequest().body(Map.of("error", "No token provided"));
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}