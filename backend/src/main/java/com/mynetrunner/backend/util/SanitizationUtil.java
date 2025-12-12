package com.mynetrunner.backend.util;

import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

@Component
public class SanitizationUtil {

    /**
     * Sanitize text content to prevent XSS attacks
     * Escapes HTML special characters
     */
    public String sanitize(String input) {
        if (input == null) {
            return null;
        }
        
        // Escape HTML special characters
        String sanitized = HtmlUtils.htmlEscape(input);
        
        // Remove any potential script patterns that might slip through
        sanitized = sanitized.replaceAll("(?i)javascript:", "");
        sanitized = sanitized.replaceAll("(?i)data:", "");
        sanitized = sanitized.replaceAll("(?i)vbscript:", "");
        
        return sanitized.trim();
    }

    /**
     * Sanitize username - only allow alphanumeric and underscore
     */
    public String sanitizeUsername(String username) {
        if (username == null) {
            return null;
        }
        
        // Remove any character that isn't alphanumeric or underscore
        return username.replaceAll("[^a-zA-Z0-9_]", "").trim();
    }

    /**
     * Check if content contains potentially dangerous patterns
     */
    public boolean containsDangerousContent(String input) {
        if (input == null) {
            return false;
        }
        
        String lower = input.toLowerCase();
        return lower.contains("<script") ||
               lower.contains("javascript:") ||
               lower.contains("onerror=") ||
               lower.contains("onload=") ||
               lower.contains("onclick=") ||
               lower.contains("onmouseover=") ||
               lower.contains("data:text/html");
    }
}