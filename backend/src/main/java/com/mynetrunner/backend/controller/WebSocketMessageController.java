package com.mynetrunner.backend.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Controller;

import com.mynetrunner.backend.dto.message.GroupMessageRequest;
import com.mynetrunner.backend.dto.message.MessageRequest;
import com.mynetrunner.backend.dto.message.MessageResponse;
import com.mynetrunner.backend.exception.MessageDeliveryException;
import com.mynetrunner.backend.exception.UserNotFoundException;
import com.mynetrunner.backend.model.Group;
import com.mynetrunner.backend.model.Message;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.service.FriendshipService;
import com.mynetrunner.backend.service.GroupService;
import com.mynetrunner.backend.service.MessageService;
import com.mynetrunner.backend.service.RateLimitService;
import com.mynetrunner.backend.util.SanitizationUtil;

import jakarta.validation.Valid;

@Controller
public class WebSocketMessageController {

    private static final int MESSAGE_MAX_ATTEMPTS = 30;
    private static final int MESSAGE_WINDOW_SECONDS = 60;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private SimpUserRegistry userRegistry;

    @Autowired
    private MessageService messageService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RateLimitService rateLimitService;

    @Autowired
    private SanitizationUtil sanitizationUtil;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private GroupService groupService;

    @MessageMapping("/send")
    public void sendMessage(@Valid @Payload MessageRequest request) {
        try {
            if (!rateLimitService.isAllowed(request.getSenderUsername(), "message", MESSAGE_MAX_ATTEMPTS, MESSAGE_WINDOW_SECONDS)) {
                messagingTemplate.convertAndSendToUser(
                        request.getSenderUsername(),
                        "/queue/errors",
                        new ErrorMessage("Rate limit exceeded. Please slow down."));
                return;
            }

            User sender = userRepository.findByUsername(request.getSenderUsername())
                    .orElseThrow(() -> new UserNotFoundException("Sender not found"));

            User receiver = userRepository.findByUsername(request.getRecipientUsername())
                    .orElseThrow(() -> new UserNotFoundException("Recipient not found"));

            String contentToStore;
            String iv = null;
            boolean isEncrypted = Boolean.TRUE.equals(request.getIsEncrypted());

            if (isEncrypted && request.getEncryptedContent() != null) {
                contentToStore = request.getEncryptedContent();
                iv = request.getIv();
            } else {
                contentToStore = sanitizationUtil.sanitize(request.getContent());
                if (sanitizationUtil.containsDangerousContent(request.getContent())) {
                    messagingTemplate.convertAndSendToUser(
                            request.getSenderUsername(),
                            "/queue/errors",
                            new ErrorMessage("Message contains invalid content."));
                    return;
                }
            }

            int ttlMinutes = request.getTtlMinutes() != null ? request.getTtlMinutes() : 5;

            Message message = messageService.sendMessage(
                    sender.getId(),
                    receiver.getId(),
                    contentToStore,
                    iv,
                    isEncrypted,
                    ttlMinutes);

            MessageResponse response = new MessageResponse();
            response.setId(message.getId());
            response.setSenderId(sender.getId());
            response.setSenderUsername(sender.getUsername());
            response.setReceiverId(receiver.getId());
            response.setDelivered(message.getDelivered());
            response.setIsEncrypted(isEncrypted);

            if (isEncrypted) {
                response.setEncryptedContent(message.getContent());
                response.setIv(message.getIv());
                response.setSenderIdentityKey(request.getSenderIdentityKey());
                response.setSenderEphemeralKey(request.getSenderEphemeralKey());
                response.setUsedOneTimePreKeyId(request.getUsedOneTimePreKeyId());
                response.setTimestamp(null);
            } else {
                response.setContent(message.getContent());
                response.setTimestamp(message.getTimestamp());
            }

            messagingTemplate.convertAndSendToUser(
                    receiver.getUsername(),
                    "/queue/messages",
                    response);

            messageService.markAsDelivered(message.getId());

        } catch (UserNotFoundException e) {
            throw e;
        } catch (Exception e) {
            throw new MessageDeliveryException("Failed to deliver message");
        }
    }

    @MessageMapping("/send-group")
    public void sendGroupMessage(@Valid @Payload GroupMessageRequest request) {
        try {
            if (!rateLimitService.isAllowed(request.getSenderUsername(), "message", MESSAGE_MAX_ATTEMPTS, MESSAGE_WINDOW_SECONDS)) {
                messagingTemplate.convertAndSendToUser(
                        request.getSenderUsername(),
                        "/queue/errors",
                        new ErrorMessage("Rate limit exceeded. Please slow down."));
                return;
            }

            User sender = userRepository.findByUsername(request.getSenderUsername())
                    .orElseThrow(() -> new UserNotFoundException("Sender not found"));

            // Verify sender is member of group
            if (!groupService.isMember(request.getGroupId(), sender.getId())) {
                messagingTemplate.convertAndSendToUser(
                        request.getSenderUsername(),
                        "/queue/errors",
                        new ErrorMessage("You are not a member of this group."));
                return;
            }

            Group group = groupService.getGroup(request.getGroupId());
            List<Long> memberIds = groupService.getGroupMemberIds(request.getGroupId());

            String contentToStore;
            String iv = null;
            boolean isEncrypted = Boolean.TRUE.equals(request.getIsEncrypted());

            if (isEncrypted && request.getEncryptedContent() != null) {
                contentToStore = request.getEncryptedContent();
                iv = request.getIv();
            } else {
                contentToStore = sanitizationUtil.sanitize(request.getContent());
                if (sanitizationUtil.containsDangerousContent(request.getContent())) {
                    messagingTemplate.convertAndSendToUser(
                            request.getSenderUsername(),
                            "/queue/errors",
                            new ErrorMessage("Message contains invalid content."));
                    return;
                }
            }

            int ttlMinutes = request.getTtlMinutes() != null ? request.getTtlMinutes() : 5;

            // Store messages for all members (for offline delivery)
            messageService.sendGroupMessage(
                    sender.getId(),
                    request.getGroupId(),
                    memberIds,
                    contentToStore,
                    iv,
                    isEncrypted,
                    ttlMinutes);

            // Send to online members immediately
            for (Long memberId : memberIds) {
                if (memberId.equals(sender.getId())) {
                    continue; // Don't send to self
                }

                User member = userRepository.findById(memberId).orElse(null);
                if (member == null) continue;

                // Check if user is online
                boolean isOnline = userRegistry.getUser(member.getUsername()) != null;

                if (isOnline) {
                    MessageResponse response = new MessageResponse();
                    response.setId(System.currentTimeMillis());
                    response.setSenderId(sender.getId());
                    response.setSenderUsername(sender.getUsername());
                    response.setReceiverId(memberId);
                    response.setDelivered(true);
                    response.setIsEncrypted(isEncrypted);
                    response.setGroupId(request.getGroupId());
                    response.setGroupName(group.getName());

                    if (isEncrypted) {
                        response.setEncryptedContent(contentToStore);
                        response.setIv(iv);
                        response.setSenderIdentityKey(request.getSenderIdentityKey());
                        response.setSenderEphemeralKey(request.getSenderEphemeralKey());
                        response.setUsedOneTimePreKeyId(request.getUsedOneTimePreKeyId());
                        response.setTimestamp(null);
                    } else {
                        response.setContent(contentToStore);
                        response.setTimestamp(java.time.LocalDateTime.now());
                    }

                    messagingTemplate.convertAndSendToUser(
                            member.getUsername(),
                            "/queue/messages",
                            response);
                }
                // If offline, message stays in DB until they come online
            }

        } catch (Exception e) {
            throw new MessageDeliveryException("Failed to deliver group message: " + e.getMessage());
        }
    }

    private static class ErrorMessage {
        private final String error;
        private final long timestamp;

        public ErrorMessage(String error) {
            this.error = error;
            this.timestamp = System.currentTimeMillis();
        }

        public String getError() { return error; }
        public long getTimestamp() { return timestamp; }
    }
}