package com.mynetrunner.backend.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mynetrunner.backend.model.Friendship;
import com.mynetrunner.backend.model.Friendship.Status;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.FriendshipRepository;
import com.mynetrunner.backend.repository.UserRepository;

@Service
public class FriendshipService {

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Send a friend request
     */
    @Transactional
    public Friendship sendFriendRequest(Long requesterId, String addresseeUsername) {
        User addressee = userRepository.findByUsername(addresseeUsername)
                .orElseThrow(() -> new RuntimeException("User not found: " + addresseeUsername));

        if (requesterId.equals(addressee.getId())) {
            throw new RuntimeException("Cannot send friend request to yourself");
        }

        // Check if friendship already exists
        var existing = friendshipRepository.findBetweenUsers(requesterId, addressee.getId());
        if (existing.isPresent()) {
            Friendship f = existing.get();
            if (f.getStatus() == Status.ACCEPTED) {
                throw new RuntimeException("Already friends");
            } else if (f.getStatus() == Status.PENDING) {
                throw new RuntimeException("Friend request already pending");
            } else if (f.getStatus() == Status.BLOCKED) {
                throw new RuntimeException("Cannot send request to this user");
            }
        }

        Friendship friendship = new Friendship();
        friendship.setRequesterId(requesterId);
        friendship.setAddresseeId(addressee.getId());
        friendship.setStatus(Status.PENDING);

        return friendshipRepository.save(friendship);
    }

    /**
     * Accept a friend request
     */
    @Transactional
    public Friendship acceptFriendRequest(Long friendshipId, Long userId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        if (!friendship.getAddresseeId().equals(userId)) {
            throw new RuntimeException("Not authorized to accept this request");
        }

        if (friendship.getStatus() != Status.PENDING) {
            throw new RuntimeException("Request is no longer pending");
        }

        friendship.setStatus(Status.ACCEPTED);
        friendship.setUpdatedAt(LocalDateTime.now());

        return friendshipRepository.save(friendship);
    }

    /**
     * Reject a friend request
     */
    @Transactional
    public void rejectFriendRequest(Long friendshipId, Long userId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        if (!friendship.getAddresseeId().equals(userId)) {
            throw new RuntimeException("Not authorized to reject this request");
        }

        friendshipRepository.delete(friendship);
    }

    /**
     * Remove a friend
     */
    @Transactional
    public void removeFriend(Long friendshipId, Long userId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new RuntimeException("Friendship not found"));

        if (!friendship.getRequesterId().equals(userId) && !friendship.getAddresseeId().equals(userId)) {
            throw new RuntimeException("Not authorized to remove this friendship");
        }

        friendshipRepository.delete(friendship);
    }

    /**
     * Get all friends for a user
     */
    public List<User> getFriends(Long userId) {
        List<Friendship> friendships = friendshipRepository.findByUserIdAndStatus(userId, Status.ACCEPTED);
        List<User> friends = new ArrayList<>();

        for (Friendship f : friendships) {
            Long friendId = f.getRequesterId().equals(userId) ? f.getAddresseeId() : f.getRequesterId();
            userRepository.findById(friendId).ifPresent(friends::add);
        }

        return friends;
    }

    /**
     * Get pending friend requests (received)
     */
    public List<FriendRequestDTO> getPendingRequests(Long userId) {
        List<Friendship> pending = friendshipRepository.findByAddresseeIdAndStatus(userId, Status.PENDING);
        List<FriendRequestDTO> requests = new ArrayList<>();

        for (Friendship f : pending) {
            User requester = userRepository.findById(f.getRequesterId()).orElse(null);
            if (requester != null) {
                requests.add(new FriendRequestDTO(f.getId(), requester.getId(), requester.getUsername(), f.getCreatedAt()));
            }
        }

        return requests;
    }

    /**
     * Get sent friend requests (pending)
     */
    public List<FriendRequestDTO> getSentRequests(Long userId) {
        List<Friendship> sent = friendshipRepository.findByRequesterIdAndStatus(userId, Status.PENDING);
        List<FriendRequestDTO> requests = new ArrayList<>();

        for (Friendship f : sent) {
            User addressee = userRepository.findById(f.getAddresseeId()).orElse(null);
            if (addressee != null) {
                requests.add(new FriendRequestDTO(f.getId(), addressee.getId(), addressee.getUsername(), f.getCreatedAt()));
            }
        }

        return requests;
    }

    /**
     * Check if two users are friends
     */
    public boolean areFriends(Long userId1, Long userId2) {
        return friendshipRepository.areFriends(userId1, userId2);
    }

    /**
     * DTO for friend requests
     */
    public static class FriendRequestDTO {
        private Long friendshipId;
        private Long userId;
        private String username;
        private LocalDateTime createdAt;

        public FriendRequestDTO(Long friendshipId, Long userId, String username, LocalDateTime createdAt) {
            this.friendshipId = friendshipId;
            this.userId = userId;
            this.username = username;
            this.createdAt = createdAt;
        }

        public Long getFriendshipId() { return friendshipId; }
        public Long getUserId() { return userId; }
        public String getUsername() { return username; }
        public LocalDateTime getCreatedAt() { return createdAt; }
    }
}