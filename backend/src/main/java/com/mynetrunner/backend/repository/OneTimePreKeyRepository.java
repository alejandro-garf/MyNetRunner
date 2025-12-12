package com.mynetrunner.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.mynetrunner.backend.model.OneTimePreKey;

@Repository
public interface OneTimePreKeyRepository extends JpaRepository<OneTimePreKey, Long> {
    
    Optional<OneTimePreKey> findFirstByUserIdAndUsedFalse(Long userId);
    
    List<OneTimePreKey> findAllByUserId(Long userId);
    
    long countByUserIdAndUsedFalse(Long userId);
}