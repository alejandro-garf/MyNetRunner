package com.mynetrunner.backend.dto.message;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class MessageRequest {

    @NotBlank(message = "Sender username is required")
    private String senderUsername;

    @NotBlank(message = "Recipient username is required")
    private String recipientUsername;

    @Size(max = 10000, message = "Message must be less than 10000 characters")
    private String content;

    @Size(max = 50000, message = "Encrypted content exceeds maximum size")
    private String encryptedContent;

    private String iv;

    @NotNull(message = "Encryption flag is required")
    private Boolean isEncrypted = false;

    // Key exchange fields (for first message in a session)
    private String senderIdentityKey;
    private String senderEphemeralKey;
    private Integer usedOneTimePreKeyId;

    // Custom TTL in minutes (default 5)
    private Integer ttlMinutes = 5;

    public MessageRequest() {}

    // Getters and Setters
    public String getSenderUsername() { return senderUsername; }
    public void setSenderUsername(String senderUsername) { this.senderUsername = senderUsername; }

    public String getRecipientUsername() { return recipientUsername; }
    public void setRecipientUsername(String recipientUsername) { this.recipientUsername = recipientUsername; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getEncryptedContent() { return encryptedContent; }
    public void setEncryptedContent(String encryptedContent) { this.encryptedContent = encryptedContent; }

    public String getIv() { return iv; }
    public void setIv(String iv) { this.iv = iv; }

    public Boolean getIsEncrypted() { return isEncrypted; }
    public void setIsEncrypted(Boolean isEncrypted) { this.isEncrypted = isEncrypted; }

    public String getSenderIdentityKey() { return senderIdentityKey; }
    public void setSenderIdentityKey(String senderIdentityKey) { this.senderIdentityKey = senderIdentityKey; }

    public String getSenderEphemeralKey() { return senderEphemeralKey; }
    public void setSenderEphemeralKey(String senderEphemeralKey) { this.senderEphemeralKey = senderEphemeralKey; }

    public Integer getUsedOneTimePreKeyId() { return usedOneTimePreKeyId; }
    public void setUsedOneTimePreKeyId(Integer usedOneTimePreKeyId) { this.usedOneTimePreKeyId = usedOneTimePreKeyId; }

    public Integer getTtlMinutes() { return ttlMinutes; }
    public void setTtlMinutes(Integer ttlMinutes) { 
        // Clamp between 1 and 1440 (1 day max)
        if (ttlMinutes == null || ttlMinutes < 1) {
            this.ttlMinutes = 5;
        } else if (ttlMinutes > 1440) {
            this.ttlMinutes = 1440;
        } else {
            this.ttlMinutes = ttlMinutes;
        }
    }

    public String getEffectiveContent() {
        if (Boolean.TRUE.equals(isEncrypted) && encryptedContent != null) {
            return encryptedContent;
        }
        return content;
    }
}