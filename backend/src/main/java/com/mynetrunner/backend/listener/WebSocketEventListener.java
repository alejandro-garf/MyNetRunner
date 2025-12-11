package com.mynetrunner.backend.listener;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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

    // Local cache to map sessionId -> username (needed for disconnect)
    private final Map<String, String> sessionUserMap = new ConcurrentHashMap<>();

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String username = headerAccessor.getFirstNativeHeader("username");

        if (username != null && sessionId != null) {
            // Store in local map for disconnect lookup
            sessionUserMap.put(sessionId, username);
            
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

        // Lookup username from local cache
        String username = sessionUserMap.remove(sessionId);

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
            "timestamp", System.currentTimeMillis()
        );
        
        // Broadcast to all subscribers on /topic/presence
        messagingTemplate.convertAndSend("/topic/presence", presenceUpdate);
    }
}