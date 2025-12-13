package com.mynetrunner.backend.controller;

import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.service.WebSocketSessionManager;

@RestController
@RequestMapping("/api/users")
public class UserStatusController {

    @Autowired
    private WebSocketSessionManager sessionManager;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/{username}/status")
    public ResponseEntity<Map<String, Object>> getUserStatus(@PathVariable String username) {
        boolean online = sessionManager.isUserOnline(username);

        return ResponseEntity.ok(Map.of(
                "username", username,
                "online", online));
    }

    @GetMapping("/online")
    public ResponseEntity<Map<String, Object>> getOnlineUsers() {
        Set<String> onlineUsers = sessionManager.getOnlineUsers();

        return ResponseEntity.ok(Map.of(
                "count", onlineUsers.size(),
                "users", onlineUsers));
    }

    @GetMapping("/by-username/{username}")
    public ResponseEntity<?> getUserByUsername(@PathVariable String username) {
        return userRepository.findByUsername(username)
                .map(user -> ResponseEntity.ok(Map.of(
                        "id", user.getId(),
                        "username", user.getUsername())))
                .orElse(ResponseEntity.notFound().build());
    }
}