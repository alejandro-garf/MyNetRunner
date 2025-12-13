package com.mynetrunner.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.mynetrunner.backend.model.Group;

@Repository
public interface GroupRepository extends JpaRepository<Group, Long> {

    List<Group> findByCreatedBy(Long userId);

    @Query("SELECT g FROM Group g JOIN GroupMembership gm ON g.id = gm.groupId WHERE gm.userId = :userId")
    List<Group> findGroupsByUserId(@Param("userId") Long userId);
}