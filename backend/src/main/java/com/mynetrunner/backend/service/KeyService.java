package com.mynetrunner.backend.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mynetrunner.backend.dto.OneTimePreKeyUploadRequest;
import com.mynetrunner.backend.dto.PreKeyBundleResponse;
import com.mynetrunner.backend.dto.PreKeyBundleUploadRequest;
import com.mynetrunner.backend.exception.UserNotFoundException;
import com.mynetrunner.backend.model.OneTimePreKey;
import com.mynetrunner.backend.model.PreKeyBundle;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.OneTimePreKeyRepository;
import com.mynetrunner.backend.repository.PreKeyBundleRepository;
import com.mynetrunner.backend.repository.UserRepository;

@Service
public class KeyService {

    @Autowired
    private PreKeyBundleRepository preKeyBundleRepository;

    @Autowired
    private OneTimePreKeyRepository oneTimePreKeyRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Store or update a user's prekey bundle
     */
    @Transactional
    public void storePreKeyBundle(Long userId, PreKeyBundleUploadRequest request) {
        // Verify user exists
        userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        // Check if bundle already exists
        Optional<PreKeyBundle> existing = preKeyBundleRepository.findByUserId(userId);

        PreKeyBundle bundle;
        if (existing.isPresent()) {
            // Update existing bundle
            bundle = existing.get();
        } else {
            // Create new bundle
            bundle = new PreKeyBundle();
            bundle.setUserId(userId);
        }

        bundle.setIdentityKey(request.getIdentityKey());
        bundle.setSignedPreKey(request.getSignedPreKey());
        bundle.setSignedPreKeyId(request.getSignedPreKeyId());
        bundle.setSignedPreKeySignature(request.getSignedPreKeySignature());

        preKeyBundleRepository.save(bundle);
    }

    /**
     * Store one-time prekeys for a user
     */
    @Transactional
    public void storeOneTimePreKeys(Long userId, OneTimePreKeyUploadRequest request) {
        // Verify user exists
        userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        for (OneTimePreKeyUploadRequest.OneTimePreKeyDTO dto : request.getPreKeys()) {
            OneTimePreKey preKey = new OneTimePreKey();
            preKey.setUserId(userId);
            preKey.setKeyId(dto.getKeyId());
            preKey.setPublicKey(dto.getPublicKey());
            preKey.setUsed(false);
            oneTimePreKeyRepository.save(preKey);
        }
    }

    /**
     * Get a user's prekey bundle for key exchange
     * Consumes one one-time prekey if available
     */
    @Transactional
    public PreKeyBundleResponse getPreKeyBundle(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        PreKeyBundle bundle = preKeyBundleRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User has not registered encryption keys"));

        PreKeyBundleResponse response = new PreKeyBundleResponse();
        response.setUserId(userId);
        response.setUsername(user.getUsername());
        response.setIdentityKey(bundle.getIdentityKey());
        response.setSignedPreKey(bundle.getSignedPreKey());
        response.setSignedPreKeyId(bundle.getSignedPreKeyId());
        response.setSignedPreKeySignature(bundle.getSignedPreKeySignature());

        // Try to get and consume a one-time prekey
        Optional<OneTimePreKey> oneTimePreKey = oneTimePreKeyRepository.findFirstByUserIdAndUsedFalse(userId);
        if (oneTimePreKey.isPresent()) {
            OneTimePreKey otpk = oneTimePreKey.get();
            response.setOneTimePreKeyId(otpk.getKeyId());
            response.setOneTimePreKey(otpk.getPublicKey());

            // Mark as used
            otpk.setUsed(true);
            oneTimePreKeyRepository.save(otpk);
        }

        return response;
    }

    /**
     * Check if user has registered encryption keys
     */
    public boolean hasKeys(Long userId) {
        return preKeyBundleRepository.existsByUserId(userId);
    }

    /**
     * Get count of available one-time prekeys
     */
    public long getAvailablePreKeyCount(Long userId) {
        return oneTimePreKeyRepository.countByUserIdAndUsedFalse(userId);
    }
}