package com.mynetrunner.backend.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.mynetrunner.backend.dto.AuthResponse;
import com.mynetrunner.backend.exception.InvalidCredentialsException;
import com.mynetrunner.backend.exception.UserAlreadyExistsException;
import com.mynetrunner.backend.model.User;
import com.mynetrunner.backend.repository.UserRepository;
import com.mynetrunner.backend.util.JwtUtil;
import com.mynetrunner.backend.util.SanitizationUtil;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private SanitizationUtil sanitizationUtil;

    private BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthResponse register(String username, String password) {
        // Sanitize username
        String sanitizedUsername = sanitizationUtil.sanitizeUsername(username);
        
        // Validate sanitized username matches original (no dangerous chars removed)
        if (!sanitizedUsername.equals(username.trim())) {
            throw new IllegalArgumentException("Username contains invalid characters. Only letters, numbers, and underscores are allowed.");
        }

        // Check if user already exists
        if (userRepository.findByUsername(sanitizedUsername).isPresent()) {
            throw new UserAlreadyExistsException("Username '" + sanitizedUsername + "' is already taken");
        }

        // Create new user
        String hashedPassword = passwordEncoder.encode(password);
        User user = new User();
        user.setUsername(sanitizedUsername);
        user.setPasswordHash(hashedPassword);
        User savedUser = userRepository.save(user);

        // Generate JWT token
        String token = jwtUtil.generateToken(sanitizedUsername);
        return new AuthResponse(token, sanitizedUsername, savedUser.getId(), "User registered successfully");
    }

    public AuthResponse login(String username, String password) {
        // Sanitize username for lookup
        String sanitizedUsername = sanitizationUtil.sanitizeUsername(username);
        
        // Find user
        User user = userRepository.findByUsername(sanitizedUsername)
            .orElseThrow(() -> new InvalidCredentialsException("Invalid username or password"));

        // Verify password
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid username or password");
        }

        // Generate JWT token
        String token = jwtUtil.generateToken(sanitizedUsername);
        return new AuthResponse(token, sanitizedUsername, user.getId(), "Login successful");
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }
}