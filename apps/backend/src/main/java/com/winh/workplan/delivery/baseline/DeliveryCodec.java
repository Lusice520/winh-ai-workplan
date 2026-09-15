package com.winh.workplan.delivery.baseline;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;
import com.winh.workplan.business.BusinessRules;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
class DeliveryCodec {
    private final ObjectMapper mapper;
    DeliveryCodec(ObjectMapper mapper) { this.mapper = mapper; }
    <T> T command(JsonNode node, Class<T> type) {
        try {
            if (node == null || !node.isObject()) throw BusinessRules.invalid("request", "请提交完整表单。");
            if (node.toString().getBytes(StandardCharsets.UTF_8).length > 262144)
                throw BusinessRules.invalid("request", "单次表单超过 256 KiB，请拆分维护。");
            return mapper.readerFor(type).with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .with(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES).readValue(node);
        } catch (java.io.IOException e) {
            throw BusinessRules.invalid("request", "表单包含未知字段或字段类型错误。");
        }
    }
    String write(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    <T> T read(String value, Class<T> type) {
        try { return mapper.readValue(value, type); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Invalid persisted delivery content", e); }
    }
    String hash(Object value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(write(value).getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
