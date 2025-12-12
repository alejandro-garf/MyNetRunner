package com.mynetrunner.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.mynetrunner.backend.model.Friendship;
import com.mynetrunner.backend.model.Friendship.Status;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    // Find friendship between two users (either direction)
    @Query("SELECT f FROM Friendship f WHERE " +
           "(f.requesterId = :userId1 AND f.addresseeId = :userId2) OR " +
           "(f.requesterId = :userId2 AND f.addresseeId = :userId1)")
    Optional<Friendship> findBetweenUsers(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    // Find all accepted friends for a user
    @Query("SELECT f FROM Friendship f WHERE " +
           "(f.requesterId = :userId OR f.addresseeId = :userId) AND f.status = :status")
    List<Friendship> findByUserIdAndStatus(@Param("userId") Long userId, @Param("status") Status status);

    // Find pending requests sent TO a user
    List<Friendship> findByAddresseeIdAndStatus(Long addresseeId, Status status);

    // Find pending requests sent BY a user
    List<Friendship> findByRequesterIdAndStatus(Long requesterId, Status status);

    // Check if two users are friends
    @Query("SELECT COUNT(f) > 0 FROM Friendship f WHERE " +
           "((f.requesterId = :userId1 AND f.addresseeId = :userId2) OR " +
           "(f.requesterId = :userId2 AND f.addresseeId = :userId1)) AND f.status = 'ACCEPTED'")
    boolean areFriends(@Param("userId1") Long userId1, @Param("userId2") Long userId2);
}