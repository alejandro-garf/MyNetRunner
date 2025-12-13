package com.mynetrunner.backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.service.FriendshipService;
import com.mynetrunner.backend.util.JwtUtil;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Send a friend request
     */
    @PostMapping("/request/{username}")
    public ResponseEntity<?> sendFriendRequest(@PathVariable String username, HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            friendshipService.sendFriendRequest(userId, username);
            return ResponseEntity.ok(Map.of("message", "Friend request sent"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Accept a friend request
     */
    @PostMapping("/accept/{friendshipId}")
    public ResponseEntity<?> acceptFriendRequest(@PathVariable Long friendshipId, HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            friendshipService.acceptFriendRequest(friendshipId, userId);
            return ResponseEntity.ok(Map.of("message", "Friend request accepted"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Reject a friend request
     */
    @PostMapping("/reject/{friendshipId}")
    public ResponseEntity<?> rejectFriendRequest(@PathVariable Long friendshipId, HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            friendshipService.rejectFriendRequest(friendshipId, userId);
            return ResponseEntity.ok(Map.of("message", "Friend request rejected"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Remove a friend
     */
    @DeleteMapping("/{friendshipId}")
    public ResponseEntity<?> removeFriend(@PathVariable Long friendshipId, HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            friendshipService.removeFriend(friendshipId, userId);
            return ResponseEntity.ok(Map.of("message", "Friend removed"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get all friends
     */
    @GetMapping
    public ResponseEntity<?> getFriends(HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            List<User> friends = friendshipService.getFriends(userId);
            
            List<Map<String, Object>> friendList = friends.stream()
                .map(f -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", f.getId());
                    map.put("username", f.getUsername());
                    return map;
                })
                .collect(Collectors.toList());
            
            return ResponseEntity.ok(Map.of("friends", friendList));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get pending friend requests (received)
     */
    @GetMapping("/requests")
    public ResponseEntity<?> getPendingRequests(HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            var requests = friendshipService.getPendingRequests(userId);
            return ResponseEntity.ok(Map.of("requests", requests));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get sent friend requests
     */
    @GetMapping("/requests/sent")
    public ResponseEntity<?> getSentRequests(HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            var requests = friendshipService.getSentRequests(userId);
            return ResponseEntity.ok(Map.of("requests", requests));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Check if user is friends with another user
     */
    @GetMapping("/check/{username}")
    public ResponseEntity<?> checkFriendship(@PathVariable String username, HttpServletRequest request) {
        try {
            Long userId = extractUserId(request);
            User other = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            boolean areFriends = friendshipService.areFriends(userId, other.getId());
            return ResponseEntity.ok(Map.of("areFriends", areFriends));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Long extractUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("Not authenticated");
        }
        String token = authHeader.substring(7);
        String username = jwtUtil.extractUsername(token);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}