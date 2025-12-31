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

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request, HttpServletResponse httpResponse) {
        try {
            AuthResponse authResponse = userService.register(request.getUsername(), request.getPassword());

            // Set tokens in httpOnly cookies for security
            setAuthCookies(httpResponse, authResponse.getToken(), authResponse.getRefreshToken());

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
     * Login user and set JWT tokens in httpOnly cookies
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        try {
            AuthResponse authResponse = userService.login(request.getUsername(), request.getPassword());

            // Reset rate limit on successful login
            String clientIp = getClientIp(httpRequest);
            rateLimitService.resetLimit(clientIp, "login");

            // Set tokens in httpOnly cookies for security
            setAuthCookies(httpResponse, authResponse.getToken(), authResponse.getRefreshToken());

            Map<String, Object> response = new HashMap<>();
            response.put("message", authResponse.getMessage());
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
     * Refresh access token using refresh token from httpOnly cookie
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String refreshToken = getTokenFromCookie(httpRequest, "refreshToken");

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

                // Update access token cookie
                Cookie accessTokenCookie = createCookie("token", newAccessToken, 24 * 60 * 60); // 24 hours
                httpResponse.addCookie(accessTokenCookie);

                return ResponseEntity.ok(Map.of("message", "Token refreshed successfully"));
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid refresh token"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Token refresh failed"));
        }
    }

    /**
     * Logout user - blacklist tokens, delete pending messages, and clear cookies
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String token = getTokenFromCookie(httpRequest, "token");
        String refreshToken = getTokenFromCookie(httpRequest, "refreshToken");

        // Get username before blacklisting
        String username = null;
        if (token != null) {
            try {
                username = jwtUtil.extractUsername(token);
            } catch (Exception e) {
                // Token might be expired, continue with logout
            }

            // Blacklist the access token
            tokenBlacklistService.blacklistToken(token);
        }

        // Blacklist refresh token if present
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

        // Clear auth cookies
        clearAuthCookies(httpResponse);

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    /**
     * Helper method to set authentication cookies
     */
    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        // Access token cookie (24 hours)
        Cookie accessTokenCookie = createCookie("token", accessToken, 24 * 60 * 60);
        response.addCookie(accessTokenCookie);

        // Refresh token cookie (7 days)
        Cookie refreshTokenCookie = createCookie("refreshToken", refreshToken, 7 * 24 * 60 * 60);
        response.addCookie(refreshTokenCookie);
    }

    /**
     * Helper method to create a secure httpOnly cookie
     */
    private Cookie createCookie(String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);  // Prevents XSS attacks
        cookie.setSecure(true);     // Only sent over HTTPS
        cookie.setPath("/");        // Available for entire app
        cookie.setMaxAge(maxAge);   // Expiration time in seconds
        cookie.setAttribute("SameSite", "Strict"); // CSRF protection
        return cookie;
    }

    /**
     * Helper method to extract token from cookie
     */
    private String getTokenFromCookie(HttpServletRequest request, String cookieName) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (cookieName.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /**
     * Helper method to clear authentication cookies
     */
    private void clearAuthCookies(HttpServletResponse response) {
        Cookie clearToken = new Cookie("token", null);
        clearToken.setHttpOnly(true);
        clearToken.setSecure(true);
        clearToken.setPath("/");
        clearToken.setMaxAge(0);
        response.addCookie(clearToken);

        Cookie clearRefreshToken = new Cookie("refreshToken", null);
        clearRefreshToken.setHttpOnly(true);
        clearRefreshToken.setSecure(true);
        clearRefreshToken.setPath("/");
        clearRefreshToken.setMaxAge(0);
        response.addCookie(clearRefreshToken);
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}