package com.mynetrunner.backend.dto.message;

import jakarta.validation.constraints.Size;

public class MessageRequest {

    private String senderUsername;

    private String recipientUsername;

    // Plain text content (used if not encrypted)
    @Size(max = 10000, message = "Message must be less than 10000 characters")
    private String content;

    // Encrypted content (base64 encoded ciphertext)
    private String encryptedContent;

    // Initialization vector for AES-GCM (base64 encoded)
    private String iv;

    // Flag to indicate if message is encrypted
    private Boolean isEncrypted = false;

    // Constructors
    public MessageRequest() {}

    public MessageRequest(String senderUsername, String recipientUsername, String content) {
        this.senderUsername = senderUsername;
        this.recipientUsername = recipientUsername;
        this.content = content;
        this.isEncrypted = false;
    }

    // Getters and Setters
    public String getSenderUsername() {
        return senderUsername;
    }

    public void setSenderUsername(String senderUsername) {
        this.senderUsername = senderUsername;
    }

    public String getRecipientUsername() {
        return recipientUsername;
    }

    public void setRecipientUsername(String recipientUsername) {
        this.recipientUsername = recipientUsername;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getEncryptedContent() {
        return encryptedContent;
    }

    public void setEncryptedContent(String encryptedContent) {
        this.encryptedContent = encryptedContent;
    }

    public String getIv() {
        return iv;
    }

    public void setIv(String iv) {
        this.iv = iv;
    }

    public Boolean getIsEncrypted() {
        return isEncrypted;
    }

    public void setIsEncrypted(Boolean isEncrypted) {
        this.isEncrypted = isEncrypted;
    }

    // Helper to get the actual content to store
    public String getEffectiveContent() {
        if (Boolean.TRUE.equals(isEncrypted) && encryptedContent != null) {
            return encryptedContent;
        }
        return content;
    }
}