package com.winh.workplan.delivery.configuration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;
import com.winh.workplan.business.BusinessRules;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
class ConfigurationCodec {
    private final ObjectMapper mapper;
    ConfigurationCodec(ObjectMapper mapper) { this.mapper = mapper; }

    <T> T command(JsonNode node, Class<T> type) {
        try {
            if (node == null || !node.isObject()) throw BusinessRules.invalid("request", "请提交配置对象。");
            return mapper.readerFor(type).with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(node);
        } catch (java.io.IOException e) {
            throw BusinessRules.invalid("request", "配置包含未知字段或字段类型错误，请检查表单。");
        }
    }
    String write(Object value) {
        try {
            String result = mapper.writeValueAsString(value);
            if (result.getBytes(StandardCharsets.UTF_8).length > 131072)
                throw BusinessRules.invalid("definition", "单个配置版本内容超过 128 KiB，请精简后保存。");
            return result;
        } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    ConfigurationDefinitions.Definition read(String value) {
        try { return mapper.readValue(value, ConfigurationDefinitions.Definition.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Invalid persisted delivery configuration", e); }
    }
    String hash(Object value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(write(value).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
