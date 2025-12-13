package com.mynetrunner.backend.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.mynetrunner.backend.model.Message;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    // Direct messages - pending for a specific receiver
    List<Message> findByReceiverIdAndDeliveredFalseAndGroupIdIsNull(Long receiverId);

    // Group messages - pending for a specific receiver in a specific group
    List<Message> findByReceiverIdAndGroupIdAndDeliveredFalse(Long receiverId, Long groupId);

    // All pending messages for a receiver (direct + group)
    List<Message> findByReceiverIdAndDeliveredFalse(Long receiverId);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.expiresAt < :now")
    int deleteExpiredMessages(@Param("now") LocalDateTime now);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.senderId = :userId")
    void deleteBySenderId(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.receiverId = :userId")
    void deleteByReceiverId(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") Long groupId);
}