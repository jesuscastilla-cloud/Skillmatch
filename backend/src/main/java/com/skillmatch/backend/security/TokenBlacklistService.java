package com.skillmatch.backend.security;

import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

@Service
public class TokenBlacklistService {

    private final ConcurrentHashMap<String, Long> blacklist = new ConcurrentHashMap<>();

    public void blacklist(String token, long expiryMillis) {
        blacklist.put(token, expiryMillis);
    }

    public boolean isBlacklisted(String token) {
        long now = System.currentTimeMillis();
        blacklist.entrySet().removeIf(entry -> entry.getValue() < now);
        return blacklist.containsKey(token);
    }
}
