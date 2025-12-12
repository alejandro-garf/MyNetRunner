package com.mynetrunner.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mynetrunner.backend.dto.message.MessageResponse;
import com.mynetrunner.backend.model.Message;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.MessageRepository;
import com.mynetrunner.backend.repository.UserRepository;

@Service
public class MessageService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Send a message - stored only until delivered (max 5 minutes)
     */
    public Message sendMessage(Long senderId, Long receiverId, String content) {
        return sendMessage(senderId, receiverId, content, null, false);
    }

    public Message sendMessage(Long senderId, Long receiverId, String content, String iv, boolean isEncrypted) {
        userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        Message message = new Message();
        message.setSenderId(senderId);
        message.setReceiverId(receiverId);
        message.setContent(content);
        message.setIv(iv);
        message.setIsEncrypted(isEncrypted);
        message.setDelivered(false);

        return messageRepository.save(message);
    }

    /**
     * Get all pending (undelivered) messages for a user
     */
    public List<MessageResponse> getPendingMessages(Long userId) {
        List<Message> messages = messageRepository.findByReceiverIdAndDeliveredFalse(userId);

        return messages.stream()
                .map(message -> {
                    User sender = userRepository.findById(message.getSenderId())
                            .orElse(null);
                    String senderUsername = sender != null ? sender.getUsername() : "Unknown";
                    return convertToResponse(message, senderUsername);
                })
                .collect(Collectors.toList());
    }

    /**
     * Mark as delivered AND immediately delete - privacy focused
     */
    @Transactional
    public void markAsDelivered(Long messageId) {
        messageRepository.deleteById(messageId);
    }

    /**
     * Delete expired messages - runs every minute
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void deleteExpiredMessages() {
        int deleted = messageRepository.deleteExpiredMessages(LocalDateTime.now());
        if (deleted > 0) {
            System.out.println("Cleaned up " + deleted + " expired messages");
        }
    }

    /**
     * Delete ALL messages for a user (called on logout)
     */
    @Transactional
    public void deleteAllMessagesForUser(Long userId) {
        messageRepository.deleteBySenderId(userId);
        messageRepository.deleteByReceiverId(userId);
        System.out.println("Deleted all messages for user: " + userId);
    }

    private MessageResponse convertToResponse(Message message, String senderUsername) {
        if (Boolean.TRUE.equals(message.getIsEncrypted())) {
            return new MessageResponse(
                    message.getId(),
                    message.getSenderId(),
                    senderUsername,
                    message.getReceiverId(),
                    message.getContent(),
                    message.getIv(),
                    message.getTimestamp(),
                    message.getDelivered());
        } else {
            return new MessageResponse(
                    message.getId(),
                    message.getSenderId(),
                    senderUsername,
                    message.getReceiverId(),
                    message.getContent(),
                    message.getTimestamp(),
                    message.getDelivered());
        }
    }
}