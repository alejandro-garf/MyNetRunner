package com.mynetrunner.backend.dto;

public class AuthResponse {
    private String token;
    private String refreshToken;
    private String username;
    private Long userId;
    private String message;

    // Full constructor
    public AuthResponse(String token, String refreshToken, String username, Long userId, String message) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.username = username;
        this.userId = userId;
        this.message = message;
    }

    // Constructor without refresh token
    public AuthResponse(String token, String username, Long userId, String message) {
        this.token = token;
        this.refreshToken = null;
        this.username = username;
        this.userId = userId;
        this.message = message;
    }

    // Getters and setters
    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}