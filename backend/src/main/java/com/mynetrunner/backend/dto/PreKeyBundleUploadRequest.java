package com.mynetrunner.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PreKeyBundleUploadRequest {

    @NotBlank(message = "Identity key is required")
    private String identityKey;

    @NotBlank(message = "Signed prekey is required")
    private String signedPreKey;

    @NotNull(message = "Signed prekey ID is required")
    private Integer signedPreKeyId;

    @NotBlank(message = "Signed prekey signature is required")
    private String signedPreKeySignature;
}