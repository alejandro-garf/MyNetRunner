package com.mynetrunner.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MessageCleanupScheduler {

    private static final Logger logger = LoggerFactory.getLogger(MessageCleanupScheduler.class);

    @Autowired
    private MessageService messageService;
    
    /**
     * Runs every day at 3 AM to clean up expired messages
     * Cron format: second, minute, hour, day, month, weekday
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void cleanupExpiredMessages() {
        logger.info("Running scheduled cleanup of expired messages...");
        messageService.deleteExpiredMessages();
        logger.info("Expired messages cleanup completed.");
    }
}