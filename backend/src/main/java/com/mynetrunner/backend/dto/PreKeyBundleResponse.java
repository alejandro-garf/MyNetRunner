package com.mynetrunner.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PreKeyBundleResponse {

    private Long userId;
    private String username;
    private String identityKey;
    private String signedPreKey;
    private Integer signedPreKeyId;
    private String signedPreKeySignature;
    
    // One-time prekey (may be null if none available)
    private Integer oneTimePreKeyId;
    private String oneTimePreKey;
}