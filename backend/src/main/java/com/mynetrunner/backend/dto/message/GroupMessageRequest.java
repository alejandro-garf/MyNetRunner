package com.mynetrunner.backend.dto.message;

import jakarta.validation.constraints.NotNull;

public class GroupMessageRequest {

    @NotNull
    private Long groupId;

    private String senderUsername;

    private String content;
    private String encryptedContent;
    private String iv;
    private Boolean isEncrypted = false;

    // Key exchange fields
    private String senderIdentityKey;
    private String senderEphemeralKey;
    private Integer usedOneTimePreKeyId;

    private Integer ttlMinutes = 5;

    // Getters and Setters
    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public String getSenderUsername() { return senderUsername; }
    public void setSenderUsername(String senderUsername) { this.senderUsername = senderUsername; }

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
    public void setTtlMinutes(Integer ttlMinutes) { this.ttlMinutes = ttlMinutes; }
}