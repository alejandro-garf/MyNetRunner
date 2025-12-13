package com.mynetrunner.backend.filter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mynetrunner.backend.service.RateLimitService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(1) // Run before JWT filter
public class RateLimitFilter extends OncePerRequestFilter {

    // Rate limit configuration
    private static final int LOGIN_MAX_ATTEMPTS = 5;
    private static final int LOGIN_WINDOW_SECONDS = 300; // 5 minutes
    
    private static final int REGISTER_MAX_ATTEMPTS = 3;
    private static final int REGISTER_WINDOW_SECONDS = 3600; // 1 hour

    @Autowired
    private RateLimitService rateLimitService;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = getClientIp(request);

        // Only rate limit POST requests to auth endpoints
        if ("POST".equalsIgnoreCase(method)) {
            if (path.equals("/api/auth/login")) {
                if (!checkRateLimit(clientIp, "login", LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS, response)) {
                    return;
                }
            } else if (path.equals("/api/auth/register")) {
                if (!checkRateLimit(clientIp, "register", REGISTER_MAX_ATTEMPTS, REGISTER_WINDOW_SECONDS, response)) {
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean checkRateLimit(String clientIp, String action, int maxAttempts, int windowSeconds,
            HttpServletResponse response) throws IOException {
        
        if (!rateLimitService.isAllowed(clientIp, action, maxAttempts, windowSeconds)) {
            // Rate limited
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");

            int remaining = rateLimitService.getRemainingAttempts(clientIp, action, maxAttempts);
            long resetSeconds = rateLimitService.getSecondsUntilReset(clientIp, action);

            // Add rate limit headers
            response.setHeader("X-RateLimit-Limit", String.valueOf(maxAttempts));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
            response.setHeader("X-RateLimit-Reset", String.valueOf(resetSeconds));

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", 429);
            errorResponse.put("message", "Too many " + action + " attempts. Please try again later.");
            errorResponse.put("retryAfterSeconds", resetSeconds);

            response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
            return false;
        }
        
        return true;
    }

    private String getClientIp(HttpServletRequest request) {
        // Check for forwarded IP (if behind proxy/load balancer)
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