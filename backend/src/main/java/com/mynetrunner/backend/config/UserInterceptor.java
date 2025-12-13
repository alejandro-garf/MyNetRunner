package com.mynetrunner.backend.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import com.mynetrunner.backend.service.TokenBlacklistService;
import com.mynetrunner.backend.util.JwtUtil;

import java.security.Principal;

@Component
public class UserInterceptor implements ChannelInterceptor {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Get token from header (client sends as "Authorization: Bearer <token>")
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                System.err.println("WebSocket connection rejected: Missing or invalid Authorization header");
                throw new IllegalArgumentException("Missing or invalid Authorization header");
            }

            String token = authHeader.substring(7);

            // Check if token is blacklisted
            if (tokenBlacklistService.isBlacklisted(token)) {
                System.err.println("WebSocket connection rejected: Token is blacklisted");
                throw new IllegalArgumentException("Token has been revoked");
            }

            try {
                // Extract username from token
                String username = jwtUtil.extractUsername(token);

                // Validate token
                if (!jwtUtil.validateToken(token, username)) {
                    System.err.println("WebSocket connection rejected: Invalid token");
                    throw new IllegalArgumentException("Invalid or expired token");
                }

                // Set the authenticated user principal
                Principal principal = new Principal() {
                    @Override
                    public String getName() {
                        return username;
                    }
                };
                accessor.setUser(principal);
                
                // Store username in session attributes for disconnect handling
                accessor.getSessionAttributes().put("username", username);

                System.out.println("WebSocket authenticated for user: " + username);

            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                System.err.println("WebSocket connection rejected: Token validation failed - " + e.getMessage());
                throw new IllegalArgumentException("Token validation failed");
            }
        }

        return message;
    }
}