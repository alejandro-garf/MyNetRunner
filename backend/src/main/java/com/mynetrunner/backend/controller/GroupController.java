package com.mynetrunner.backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mynetrunner.backend.model.Group;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.service.GroupService;
import com.mynetrunner.backend.util.JwtUtil;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    @Autowired
    private GroupService groupService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Create a new group
     */
    @PostMapping
    public ResponseEntity<?> createGroup(@RequestBody Map<String, String> request, HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);
            String name = request.get("name");

            Group group = groupService.createGroup(name, userId);

            return ResponseEntity.ok(Map.of(
                "message", "Group created",
                "groupId", group.getId(),
                "name", group.getName()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get my groups
     */
    @GetMapping
    public ResponseEntity<?> getMyGroups(HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);
            var groups = groupService.getUserGroups(userId);
            return ResponseEntity.ok(Map.of("groups", groups));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get group details
     */
    @GetMapping("/{groupId}")
    public ResponseEntity<?> getGroup(@PathVariable Long groupId, HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);

            if (!groupService.isMember(groupId, userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not a member of this group"));
            }

            Group group = groupService.getGroup(groupId);
            var members = groupService.getGroupMembers(groupId, userId);

            return ResponseEntity.ok(Map.of(
                "id", group.getId(),
                "name", group.getName(),
                "createdBy", group.getCreatedBy(),
                "members", members
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get group members
     */
    @GetMapping("/{groupId}/members")
    public ResponseEntity<?> getGroupMembers(@PathVariable Long groupId, HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);
            var members = groupService.getGroupMembers(groupId, userId);
            return ResponseEntity.ok(Map.of("members", members));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Add member to group
     */
    @PostMapping("/{groupId}/members")
    public ResponseEntity<?> addMember(
            @PathVariable Long groupId,
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);
            String username = request.get("username");

            groupService.addMemberByUsername(groupId, username, userId);

            return ResponseEntity.ok(Map.of("message", "Member added"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Remove member from group
     */
    @DeleteMapping("/{groupId}/members/{memberId}")
    public ResponseEntity<?> removeMember(
            @PathVariable Long groupId,
            @PathVariable Long memberId,
            HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);
            groupService.removeMember(groupId, memberId, userId);
            return ResponseEntity.ok(Map.of("message", "Member removed"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Leave group
     */
    @PostMapping("/{groupId}/leave")
    public ResponseEntity<?> leaveGroup(@PathVariable Long groupId, HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);
            groupService.leaveGroup(groupId, userId);
            return ResponseEntity.ok(Map.of("message", "Left group"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Delete group
     */
    @DeleteMapping("/{groupId}")
    public ResponseEntity<?> deleteGroup(@PathVariable Long groupId, HttpServletRequest httpRequest) {
        try {
            Long userId = extractUserId(httpRequest);
            groupService.deleteGroup(groupId, userId);
            return ResponseEntity.ok(Map.of("message", "Group deleted"));
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