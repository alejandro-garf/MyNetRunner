package com.mynetrunner.backend.dto.message;

import java.time.LocalDateTime;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class MessageResponse {
    private Long id;
    private Long senderId;
    private String senderUsername;
    private Long receiverId;
    private String content;
    private String encryptedContent;
    private String iv;
    private Boolean isEncrypted;
    private LocalDateTime timestamp;
    private Boolean delivered;

    // Constructor for unencrypted messages
    public MessageResponse(Long id, Long senderId, String senderUsername, Long receiverId,
                          String content, LocalDateTime timestamp, Boolean delivered) {
        this.id = id;
        this.senderId = senderId;
        this.senderUsername = senderUsername;
        this.receiverId = receiverId;
        this.content = content;
        this.isEncrypted = false;
        this.timestamp = timestamp;
        this.delivered = delivered;
    }

    // Constructor for encrypted messages
    public MessageResponse(Long id, Long senderId, String senderUsername, Long receiverId,
                          String encryptedContent, String iv, LocalDateTime timestamp, Boolean delivered) {
        this.id = id;
        this.senderId = senderId;
        this.senderUsername = senderUsername;
        this.receiverId = receiverId;
        this.encryptedContent = encryptedContent;
        this.iv = iv;
        this.isEncrypted = true;
        this.timestamp = timestamp;
        this.delivered = delivered;
    }
}