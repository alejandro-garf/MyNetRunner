package com.mynetrunner.backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mynetrunner.backend.dto.OneTimePreKeyUploadRequest;
import com.mynetrunner.backend.dto.PreKeyBundleResponse;
import com.mynetrunner.backend.dto.PreKeyBundleUploadRequest;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.service.KeyService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/keys")
public class KeyController {

    @Autowired
    private KeyService keyService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Upload prekey bundle (identity key + signed prekey)
     */
    @PostMapping("/bundle")
    public ResponseEntity<?> uploadPreKeyBundle(
            @Valid @RequestBody PreKeyBundleUploadRequest request,
            Authentication authentication) {

        Long userId = getUserIdFromAuth(authentication);
        keyService.storePreKeyBundle(userId, request);

        return ResponseEntity.ok(Map.of(
                "message", "PreKey bundle uploaded successfully"));
    }

    /**
     * Upload one-time prekeys
     */
    @PostMapping("/prekeys")
    public ResponseEntity<?> uploadOneTimePreKeys(
            @Valid @RequestBody OneTimePreKeyUploadRequest request,
            Authentication authentication) {

        Long userId = getUserIdFromAuth(authentication);
        keyService.storeOneTimePreKeys(userId, request);

        return ResponseEntity.ok(Map.of(
                "message", "One-time prekeys uploaded successfully",
                "count", request.getPreKeys().size()));
    }

    /**
     * Get another user's prekey bundle for establishing a session
     */
    @GetMapping("/{userId}/bundle")
    public ResponseEntity<PreKeyBundleResponse> getPreKeyBundle(@PathVariable Long userId) {
        PreKeyBundleResponse bundle = keyService.getPreKeyBundle(userId);
        return ResponseEntity.ok(bundle);
    }

    /**
     * Check if current user has registered encryption keys
     */
    @GetMapping("/status")
    public ResponseEntity<?> getKeyStatus(Authentication authentication) {
        Long userId = getUserIdFromAuth(authentication);
        boolean hasKeys = keyService.hasKeys(userId);
        long preKeyCount = keyService.getAvailablePreKeyCount(userId);

        return ResponseEntity.ok(Map.of(
                "hasKeys", hasKeys,
                "availablePreKeys", preKeyCount));
    }

    /**
     * Get count of available one-time prekeys
     */
    @GetMapping("/prekey-count")
    public ResponseEntity<?> getPreKeyCount(Authentication authentication) {
        Long userId = getUserIdFromAuth(authentication);
        long count = keyService.getAvailablePreKeyCount(userId);

        return ResponseEntity.ok(Map.of(
                "count", count,
                "needsRefill", count < 10));
    }

    /**
     * Helper to get user ID from authentication
     */
    private Long getUserIdFromAuth(Authentication authentication) {
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}