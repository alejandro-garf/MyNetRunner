package com.mynetrunner.backend.listener;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.mynetrunner.backend.service.WebSocketSessionManager;

@Component
public class WebSocketEventListener {

    @Autowired
    private WebSocketSessionManager sessionManager;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        // Get username from principal (set by UserInterceptor after JWT validation)
        if (headerAccessor.getUser() != null) {
            String username = headerAccessor.getUser().getName();
            
            // Register in Redis
            sessionManager.registerSession(username, sessionId);

            // Broadcast presence update
            broadcastPresenceUpdate(username, true);

            System.out.println("WebSocket connected: " + username + " with session " + sessionId);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        // Get username from principal
        String username = null;
        if (headerAccessor.getUser() != null) {
            username = headerAccessor.getUser().getName();
        }
        
        // Fallback: try session attributes
        if (username == null) {
            Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
            if (sessionAttrs != null) {
                username = (String) sessionAttrs.get("username");
            }
        }

        if (username != null) {
            sessionManager.removeSession(username);

            // Broadcast presence update
            broadcastPresenceUpdate(username, false);

            System.out.println("WebSocket disconnected: " + username);
        }
    }

    private void broadcastPresenceUpdate(String username, boolean online) {
        Map<String, Object> presenceUpdate = Map.of(
                "username", username,
                "online", online,
                "timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/presence", presenceUpdate);
    }
}