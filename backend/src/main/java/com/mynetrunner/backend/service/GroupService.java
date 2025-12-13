package com.mynetrunner.backend.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mynetrunner.backend.model.Group;
import com.mynetrunner.backend.model.GroupMembership;
import com.mynetrunner.backend.model.GroupMembership.Role;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.GroupMembershipRepository;
import com.mynetrunner.backend.repository.GroupRepository;
import com.mynetrunner.backend.repository.UserRepository;

@Service
public class GroupService {

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMembershipRepository membershipRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Create a new group
     */
    @Transactional
    public Group createGroup(String name, Long creatorId) {
        if (name == null || name.trim().isEmpty()) {
            throw new RuntimeException("Group name cannot be empty");
        }

        if (name.length() > 100) {
            throw new RuntimeException("Group name too long (max 100 characters)");
        }

        Group group = new Group();
        group.setName(name.trim());
        group.setCreatedBy(creatorId);
        group = groupRepository.save(group);

        // Add creator as owner
        GroupMembership membership = new GroupMembership();
        membership.setGroupId(group.getId());
        membership.setUserId(creatorId);
        membership.setRole(Role.OWNER);
        membershipRepository.save(membership);

        return group;
    }

    /**
     * Get group by ID
     */
    public Group getGroup(Long groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found"));
    }

    /**
     * Get all groups for a user
     */
    public List<GroupDTO> getUserGroups(Long userId) {
        List<Group> groups = groupRepository.findGroupsByUserId(userId);
        List<GroupDTO> result = new ArrayList<>();

        for (Group group : groups) {
            int memberCount = membershipRepository.countByGroupId(group.getId());
            GroupMembership membership = membershipRepository.findByGroupIdAndUserId(group.getId(), userId).orElse(null);
            Role role = membership != null ? membership.getRole() : null;
            result.add(new GroupDTO(group.getId(), group.getName(), group.getCreatedBy(), memberCount, role));
        }

        return result;
    }

    /**
     * Add member to group
     */
    @Transactional
    public void addMember(Long groupId, Long userId, Long requesterId) {
        Group group = getGroup(groupId);

        // Check if requester has permission
        GroupMembership requesterMembership = membershipRepository.findByGroupIdAndUserId(groupId, requesterId)
                .orElseThrow(() -> new RuntimeException("You are not a member of this group"));

        if (requesterMembership.getRole() != Role.OWNER && requesterMembership.getRole() != Role.ADMIN) {
            throw new RuntimeException("Only owners and admins can add members");
        }

        // Check if user exists
        userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if already a member
        if (membershipRepository.existsByGroupIdAndUserId(groupId, userId)) {
            throw new RuntimeException("User is already a member");
        }

        GroupMembership membership = new GroupMembership();
        membership.setGroupId(groupId);
        membership.setUserId(userId);
        membership.setRole(Role.MEMBER);
        membershipRepository.save(membership);
    }

    /**
     * Add member by username
     */
    @Transactional
    public void addMemberByUsername(Long groupId, String username, Long requesterId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
        addMember(groupId, user.getId(), requesterId);
    }

    /**
     * Remove member from group
     */
    @Transactional
    public void removeMember(Long groupId, Long userId, Long requesterId) {
        Group group = getGroup(groupId);

        // Owner cannot be removed
        if (group.getCreatedBy().equals(userId)) {
            throw new RuntimeException("Cannot remove the group owner");
        }

        // Check if requester has permission (owner, admin, or self)
        if (!requesterId.equals(userId)) {
            GroupMembership requesterMembership = membershipRepository.findByGroupIdAndUserId(groupId, requesterId)
                    .orElseThrow(() -> new RuntimeException("You are not a member of this group"));

            if (requesterMembership.getRole() != Role.OWNER && requesterMembership.getRole() != Role.ADMIN) {
                throw new RuntimeException("Only owners and admins can remove members");
            }
        }

        membershipRepository.deleteByGroupIdAndUserId(groupId, userId);
    }

    /**
     * Leave group
     */
    @Transactional
    public void leaveGroup(Long groupId, Long userId) {
        Group group = getGroup(groupId);

        if (group.getCreatedBy().equals(userId)) {
            throw new RuntimeException("Owner cannot leave. Transfer ownership or delete the group.");
        }

        membershipRepository.deleteByGroupIdAndUserId(groupId, userId);
    }

    /**
     * Delete group (owner only)
     */
    @Transactional
    public void deleteGroup(Long groupId, Long requesterId) {
        Group group = getGroup(groupId);

        if (!group.getCreatedBy().equals(requesterId)) {
            throw new RuntimeException("Only the owner can delete the group");
        }

        membershipRepository.deleteByGroupId(groupId);
        groupRepository.delete(group);
    }

    /**
     * Get group members
     */
    public List<MemberDTO> getGroupMembers(Long groupId, Long requesterId) {
        // Check if requester is a member
        if (!membershipRepository.existsByGroupIdAndUserId(groupId, requesterId)) {
            throw new RuntimeException("You are not a member of this group");
        }

        List<GroupMembership> memberships = membershipRepository.findByGroupId(groupId);
        List<MemberDTO> members = new ArrayList<>();

        for (GroupMembership m : memberships) {
            User user = userRepository.findById(m.getUserId()).orElse(null);
            if (user != null) {
                members.add(new MemberDTO(user.getId(), user.getUsername(), m.getRole(), m.getJoinedAt()));
            }
        }

        return members;
    }

    /**
     * Check if user is member of group
     */
    public boolean isMember(Long groupId, Long userId) {
        return membershipRepository.existsByGroupIdAndUserId(groupId, userId);
    }

    /**
     * Get member IDs for a group (for message routing)
     */
    public List<Long> getGroupMemberIds(Long groupId) {
        List<GroupMembership> memberships = membershipRepository.findByGroupId(groupId);
        List<Long> ids = new ArrayList<>();
        for (GroupMembership m : memberships) {
            ids.add(m.getUserId());
        }
        return ids;
    }

    // DTOs
    public static class GroupDTO {
        private Long id;
        private String name;
        private Long createdBy;
        private int memberCount;
        private Role myRole;

        public GroupDTO(Long id, String name, Long createdBy, int memberCount, Role myRole) {
            this.id = id;
            this.name = name;
            this.createdBy = createdBy;
            this.memberCount = memberCount;
            this.myRole = myRole;
        }

        public Long getId() { return id; }
        public String getName() { return name; }
        public Long getCreatedBy() { return createdBy; }
        public int getMemberCount() { return memberCount; }
        public Role getMyRole() { return myRole; }
    }

    public static class MemberDTO {
        private Long id;
        private String username;
        private Role role;
        private java.time.LocalDateTime joinedAt;

        public MemberDTO(Long id, String username, Role role, java.time.LocalDateTime joinedAt) {
            this.id = id;
            this.username = username;
            this.role = role;
            this.joinedAt = joinedAt;
        }

        public Long getId() { return id; }
        public String getUsername() { return username; }
        public Role getRole() { return role; }
        public java.time.LocalDateTime getJoinedAt() { return joinedAt; }
    }
}