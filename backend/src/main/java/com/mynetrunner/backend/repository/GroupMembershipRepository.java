package com.mynetrunner.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.mynetrunner.backend.model.GroupMembership;

@Repository
public interface GroupMembershipRepository extends JpaRepository<GroupMembership, Long> {

    List<GroupMembership> findByGroupId(Long groupId);

    List<GroupMembership> findByUserId(Long userId);

    Optional<GroupMembership> findByGroupIdAndUserId(Long groupId, Long userId);

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    @Modifying
    @Query("DELETE FROM GroupMembership gm WHERE gm.groupId = :groupId AND gm.userId = :userId")
    void deleteByGroupIdAndUserId(@Param("groupId") Long groupId, @Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM GroupMembership gm WHERE gm.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") Long groupId);

    @Query("SELECT COUNT(gm) FROM GroupMembership gm WHERE gm.groupId = :groupId")
    int countByGroupId(@Param("groupId") Long groupId);
}