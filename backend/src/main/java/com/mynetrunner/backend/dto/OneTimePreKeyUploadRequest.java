package com.mynetrunner.backend.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OneTimePreKeyUploadRequest {

    @NotEmpty(message = "At least one prekey is required")
    private List<OneTimePreKeyDTO> preKeys;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OneTimePreKeyDTO {
        private Integer keyId;
        private String publicKey;
    }
}