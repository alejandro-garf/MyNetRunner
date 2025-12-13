package com.mynetrunner.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.mynetrunner.backend.model.PreKeyBundle;

@Repository
public interface PreKeyBundleRepository extends JpaRepository<PreKeyBundle, Long> {
    
    Optional<PreKeyBundle> findByUserId(Long userId);
    
    boolean existsByUserId(Long userId);
}