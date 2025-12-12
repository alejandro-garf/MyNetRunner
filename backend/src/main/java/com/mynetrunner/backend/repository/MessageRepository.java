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
}