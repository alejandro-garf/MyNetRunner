package com.mynetrunner.backend.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Utility class for handling HTTP request operations
 */
public class RequestUtil {

    private RequestUtil() {
        // Private constructor to prevent instantiation
    }

    /**
     * Extracts the client IP address from the request, considering proxy headers
     *
     * @param request the HTTP request
     * @return the client IP address
     */
    public static String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Extracts the user ID from the security context
     *
     * @return the user ID, or null if not authenticated
     */
    public static Long extractUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof String) {
            // In this implementation, the principal is the username
            // This is a placeholder - in production you'd fetch the user ID from the database
            // or include it in the authentication token
            return null;
        }
        return null;
    }

    /**
     * Extracts the username from the security context
     *
     * @return the username, or null if not authenticated
     */
    public static String extractUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof String) {
            return (String) authentication.getPrincipal();
        }
        return null;
    }
}
