package com.winh.workplan.handover;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
class ReviewSnapshot {
    private final ObjectMapper mapper;
    ReviewSnapshot(ObjectMapper mapper) { this.mapper = mapper; }
    String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException("无法建立评审快照。", e); }
    }
    String hash(Object value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json(value).getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    <T> T read(String value, Class<T> type) {
        try { return mapper.readValue(value, type); }
        catch (JsonProcessingException e) { throw new IllegalStateException("无法读取评审快照。", e); }
    }
}
