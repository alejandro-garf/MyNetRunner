package com.mynetrunner.backend.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long senderId;

    @Column(nullable = false)
    private Long receiverId;

    // Stores either plaintext or encrypted content (base64)
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    // IV for AES-GCM decryption (base64), null if not encrypted
    @Column(columnDefinition = "TEXT")
    private String iv;

    // Flag indicating if content is encrypted
    @Column(nullable = false)
    private Boolean isEncrypted = false;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private Boolean delivered = false;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
        expiresAt = LocalDateTime.now().plusDays(30);
    }
}