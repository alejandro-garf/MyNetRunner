package com.mynetrunner.backend.dto.message;

import jakarta.validation.constraints.Size;

public class MessageRequest {

    private String senderUsername;
    private String recipientUsername;

    @Size(max = 10000, message = "Message must be less than 10000 characters")
    private String content;

    private String encryptedContent;
    private String iv;
    private Boolean isEncrypted = false;

    // Key exchange fields (for first message in a session)
    private String senderIdentityKey;
    private String senderEphemeralKey;
    private Integer usedOneTimePreKeyId;

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

    public String getEffectiveContent() {
        if (Boolean.TRUE.equals(isEncrypted) && encryptedContent != null) {
            return encryptedContent;
        }
        return content;
    }
}