package com.mynetrunner.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mynetrunner.backend.dto.message.MessageResponse;
import com.mynetrunner.backend.model.Group;
import com.mynetrunner.backend.model.Message;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.GroupRepository;
import com.mynetrunner.backend.repository.MessageRepository;
import com.mynetrunner.backend.repository.UserRepository;

@Service
public class MessageService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GroupRepository groupRepository;

    /**
     * Send a direct message with default TTL (5 minutes)
     */
    public Message sendMessage(Long senderId, Long receiverId, String content) {
        return sendMessage(senderId, receiverId, content, null, false, 5);
    }

    /**
     * Send a direct message with custom TTL
     */
    public Message sendMessage(Long senderId, Long receiverId, String content, String iv, boolean isEncrypted) {
        return sendMessage(senderId, receiverId, content, iv, isEncrypted, 5);
    }

    /**
     * Send a direct message with all options
     */
    public Message sendMessage(Long senderId, Long receiverId, String content, String iv, boolean isEncrypted, int ttlMinutes) {
        userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        Message message = new Message();
        message.setSenderId(senderId);
        message.setReceiverId(receiverId);
        message.setGroupId(null);
        message.setContent(content);
        message.setIv(iv);
        message.setIsEncrypted(isEncrypted);
        message.setDelivered(false);
        message.setExpiresAt(LocalDateTime.now().plusMinutes(ttlMinutes));

        return messageRepository.save(message);
    }

    /**
     * Send a group message (stores one copy per recipient)
     */
    public void sendGroupMessage(Long senderId, Long groupId, List<Long> recipientIds, String content, String iv, boolean isEncrypted, int ttlMinutes) {
        userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(ttlMinutes);

        for (Long receiverId : recipientIds) {
            if (receiverId.equals(senderId)) {
                continue; // Don't store message for sender
            }

            Message message = new Message();
            message.setSenderId(senderId);
            message.setReceiverId(receiverId);
            message.setGroupId(groupId);
            message.setContent(content);
            message.setIv(iv);
            message.setIsEncrypted(isEncrypted);
            message.setDelivered(false);
            message.setExpiresAt(expiresAt);

            messageRepository.save(message);
        }
    }

    /**
     * Get all pending (undelivered) direct messages for a user
     */
    public List<MessageResponse> getPendingMessages(Long userId) {
        List<Message> messages = messageRepository.findByReceiverIdAndDeliveredFalseAndGroupIdIsNull(userId);

        return messages.stream()
                .map(message -> {
                    User sender = userRepository.findById(message.getSenderId()).orElse(null);
                    String senderUsername = sender != null ? sender.getUsername() : "Unknown";
                    return convertToResponse(message, senderUsername, null);
                })
                .collect(Collectors.toList());
    }

    /**
     * Get all pending (undelivered) messages for a user (direct + group)
     */
    public List<MessageResponse> getAllPendingMessages(Long userId) {
        List<Message> messages = messageRepository.findByReceiverIdAndDeliveredFalse(userId);

        return messages.stream()
                .map(message -> {
                    User sender = userRepository.findById(message.getSenderId()).orElse(null);
                    String senderUsername = sender != null ? sender.getUsername() : "Unknown";
                    String groupName = null;
                    if (message.getGroupId() != null) {
                        Group group = groupRepository.findById(message.getGroupId()).orElse(null);
                        groupName = group != null ? group.getName() : null;
                    }
                    return convertToResponse(message, senderUsername, groupName);
                })
                .collect(Collectors.toList());
    }

    /**
     * Mark as delivered AND immediately delete
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
    }

    /**
     * Delete all messages for a group (called when group is deleted)
     */
    @Transactional
    public void deleteAllMessagesForGroup(Long groupId) {
        messageRepository.deleteByGroupId(groupId);
    }

    private MessageResponse convertToResponse(Message message, String senderUsername, String groupName) {
        MessageResponse response;
        if (Boolean.TRUE.equals(message.getIsEncrypted())) {
            response = new MessageResponse(
                    message.getId(),
                    message.getSenderId(),
                    senderUsername,
                    message.getReceiverId(),
                    message.getContent(),
                    message.getIv(),
                    message.getTimestamp(),
                    message.getDelivered());
        } else {
            response = new MessageResponse(
                    message.getId(),
                    message.getSenderId(),
                    senderUsername,
                    message.getReceiverId(),
                    message.getContent(),
                    message.getTimestamp(),
                    message.getDelivered());
        }
        response.setGroupId(message.getGroupId());
        response.setGroupName(groupName);
        return response;
    }
}