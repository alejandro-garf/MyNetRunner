package com.mynetrunner.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.mynetrunner.backend.dto.message.MessageRequest;
import com.mynetrunner.backend.dto.message.MessageResponse;
import com.mynetrunner.backend.exception.MessageDeliveryException;
import com.mynetrunner.backend.exception.UserNotFoundException;
import com.mynetrunner.backend.model.Message;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.service.MessageService;
import com.mynetrunner.backend.service.RateLimitService;
import com.mynetrunner.backend.service.WebSocketSessionManager;
import com.mynetrunner.backend.util.SanitizationUtil;

import jakarta.validation.Valid;

@Controller
public class WebSocketMessageController {

    private static final int MESSAGE_MAX_ATTEMPTS = 30;
    private static final int MESSAGE_WINDOW_SECONDS = 60;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageService messageService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WebSocketSessionManager sessionManager;

    @Autowired
    private RateLimitService rateLimitService;

    @Autowired
    private SanitizationUtil sanitizationUtil;

    @MessageMapping("/send")
    public void sendMessage(@Valid @Payload MessageRequest request) {
        try {
            System.out.println("=== RECEIVED MESSAGE REQUEST ===");
            System.out.println("From: " + request.getSenderUsername());
            System.out.println("To: " + request.getRecipientUsername());
            System.out.println("Encrypted: " + request.getIsEncrypted());
            System.out.println("Has key exchange: " + (request.getSenderIdentityKey() != null));

            // Check rate limit
            if (!rateLimitService.isAllowed(request.getSenderUsername(), "message", MESSAGE_MAX_ATTEMPTS, MESSAGE_WINDOW_SECONDS)) {
                System.err.println("Rate limit exceeded for user: " + request.getSenderUsername());
                messagingTemplate.convertAndSendToUser(
                    request.getSenderUsername(),
                    "/queue/errors",
                    new ErrorMessage("Rate limit exceeded. Please slow down.")
                );
                return;
            }

            User sender = userRepository.findByUsername(request.getSenderUsername())
                    .orElseThrow(() -> new UserNotFoundException("Sender not found: " + request.getSenderUsername()));

            User receiver = userRepository.findByUsername(request.getRecipientUsername())
                    .orElseThrow(() -> new UserNotFoundException("Recipient not found: " + request.getRecipientUsername()));

            String contentToStore;
            String iv = null;
            boolean isEncrypted = Boolean.TRUE.equals(request.getIsEncrypted());

            if (isEncrypted && request.getEncryptedContent() != null) {
                contentToStore = request.getEncryptedContent();
                iv = request.getIv();
                System.out.println("Storing encrypted message (server cannot read)");
            } else {
                contentToStore = sanitizationUtil.sanitize(request.getContent());
                if (sanitizationUtil.containsDangerousContent(request.getContent())) {
                    System.err.println("Dangerous content detected from user: " + request.getSenderUsername());
                    messagingTemplate.convertAndSendToUser(
                        request.getSenderUsername(),
                        "/queue/errors",
                        new ErrorMessage("Message contains invalid content.")
                    );
                    return;
                }
            }

            Message message = messageService.sendMessage(
                    sender.getId(),
                    receiver.getId(),
                    contentToStore,
                    iv,
                    isEncrypted);

            // Build response
            MessageResponse response = new MessageResponse();
            response.setId(message.getId());
            response.setSenderId(sender.getId());
            response.setSenderUsername(sender.getUsername());
            response.setReceiverId(receiver.getId());
            response.setTimestamp(message.getTimestamp());
            response.setDelivered(message.getDelivered());
            response.setIsEncrypted(isEncrypted);

            if (isEncrypted) {
                response.setEncryptedContent(message.getContent());
                response.setIv(message.getIv());
                // Pass through key exchange data
                response.setSenderIdentityKey(request.getSenderIdentityKey());
                response.setSenderEphemeralKey(request.getSenderEphemeralKey());
                response.setUsedOneTimePreKeyId(request.getUsedOneTimePreKeyId());
            } else {
                response.setContent(message.getContent());
            }

            System.out.println("=== SENDING MESSAGE TO RECIPIENT ===");

            messagingTemplate.convertAndSendToUser(
                    receiver.getUsername(),
                    "/queue/messages",
                    response);

            System.out.println("Message sent to user: " + receiver.getUsername());

            messageService.markAsDelivered(message.getId());

            System.out.println("=== MESSAGE PROCESSING COMPLETE ===");

        } catch (UserNotFoundException e) {
            System.err.println("User not found: " + e.getMessage());
            throw e;
        } catch (Exception e) {
            System.err.println("Failed to deliver message: " + e.getMessage());
            e.printStackTrace();
            throw new MessageDeliveryException("Failed to deliver message: " + e.getMessage());
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