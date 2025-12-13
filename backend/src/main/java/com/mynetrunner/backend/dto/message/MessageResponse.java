package com.mynetrunner.backend.dto.message;

import java.time.LocalDateTime;

public class MessageResponse {

    private Long id;
    private Long senderId;
    private String senderUsername;
    private Long receiverId;
    private String content;
    private String encryptedContent;
    private String iv;
    private LocalDateTime timestamp;
    private Boolean delivered;
    private Boolean isEncrypted;

    // Key exchange fields
    private String senderIdentityKey;
    private String senderEphemeralKey;
    private Integer usedOneTimePreKeyId;

    // Group fields
    private Long groupId;
    private String groupName;

    // Constructors
    public MessageResponse() {}

    public MessageResponse(Long id, Long senderId, String senderUsername, Long receiverId,
                          String content, LocalDateTime timestamp, Boolean delivered) {
        this.id = id;
        this.senderId = senderId;
        this.senderUsername = senderUsername;
        this.receiverId = receiverId;
        this.content = content;
        this.timestamp = timestamp;
        this.delivered = delivered;
        this.isEncrypted = false;
    }

    public MessageResponse(Long id, Long senderId, String senderUsername, Long receiverId,
                          String content, String iv, LocalDateTime timestamp, Boolean delivered) {
        this.id = id;
        this.senderId = senderId;
        this.senderUsername = senderUsername;
        this.receiverId = receiverId;
        this.encryptedContent = content;
        this.iv = iv;
        this.timestamp = timestamp;
        this.delivered = delivered;
        this.isEncrypted = true;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getSenderUsername() { return senderUsername; }
    public void setSenderUsername(String senderUsername) { this.senderUsername = senderUsername; }

    public Long getReceiverId() { return receiverId; }
    public void setReceiverId(Long receiverId) { this.receiverId = receiverId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getEncryptedContent() { return encryptedContent; }
    public void setEncryptedContent(String encryptedContent) { this.encryptedContent = encryptedContent; }

    public String getIv() { return iv; }
    public void setIv(String iv) { this.iv = iv; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public Boolean getDelivered() { return delivered; }
    public void setDelivered(Boolean delivered) { this.delivered = delivered; }

    public Boolean getIsEncrypted() { return isEncrypted; }
    public void setIsEncrypted(Boolean isEncrypted) { this.isEncrypted = isEncrypted; }

    public String getSenderIdentityKey() { return senderIdentityKey; }
    public void setSenderIdentityKey(String senderIdentityKey) { this.senderIdentityKey = senderIdentityKey; }

    public String getSenderEphemeralKey() { return senderEphemeralKey; }
    public void setSenderEphemeralKey(String senderEphemeralKey) { this.senderEphemeralKey = senderEphemeralKey; }

    public Integer getUsedOneTimePreKeyId() { return usedOneTimePreKeyId; }
    public void setUsedOneTimePreKeyId(Integer usedOneTimePreKeyId) { this.usedOneTimePreKeyId = usedOneTimePreKeyId; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
}