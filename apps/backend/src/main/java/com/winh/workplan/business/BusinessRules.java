package com.winh.workplan.business;

import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.iam.shared.PageResponse;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;

public final class BusinessRules {
    private BusinessRules() {}

    public static DomainException invalid(String field, String message) {
        return new DomainException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message,
            List.of(new ApiProblem.FieldProblem(field, message)));
    }
    public static DomainException conflict(String message) {
        return new DomainException(HttpStatus.CONFLICT, "BUSINESS_STATE_CONFLICT", message);
    }
    public static DomainException missing() {
        return new DomainException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "记录不存在或不在可访问范围内。");
    }
    public static void version(BusinessRecord record, Long expected) {
        if (expected == null) throw invalid("version", "缺少记录版本，请重新打开记录。");
        if (record.version != expected) throw new DomainException(HttpStatus.CONFLICT,
            "VERSION_CONFLICT", "记录已被更新，请加载最新内容后重新提交。");
    }
    public static String required(String value, String field, int max) {
        String text = optional(value, field, max);
        if (text == null) throw invalid(field, "请填写此项。");
        return text;
    }
    public static String optional(String value, String field, int max) {
        if (value == null || value.isBlank()) return null;
        if (value.trim().length() > max) throw invalid(field, "内容不能超过 " + max + " 字。");
        return value.trim();
    }
    public static String choice(String value, String field, String... values) {
        if (value == null || !Set.of(values).contains(value)) throw invalid(field, "请选择有效选项。");
        return value;
    }
    public static BigDecimal amount(BigDecimal value, String field) {
        if (value == null || value.signum() < 0 || value.scale() > 2
                || value.compareTo(new BigDecimal("999999999999.99")) > 0)
            throw invalid(field, "请填写非负数字，最多两位小数。");
        return value;
    }
    public static String normalized(String text) {
        return text == null ? "" : Normalizer.normalize(text, Normalizer.Form.NFKC)
            .replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }
    public static boolean matches(String query, String... values) {
        String q = normalized(query);
        return q.isEmpty() || java.util.Arrays.stream(values).anyMatch(v -> normalized(v).contains(q));
    }
    public static <T> PageResponse<T> page(List<T> visible, int page, int pageSize) {
        if (page < 1 || !Set.of(10, 20, 50).contains(pageSize)) throw invalid("page", "分页参数不合法。");
        long start = Math.min((long)(page - 1) * pageSize, visible.size());
        int end = (int)Math.min(start + pageSize, visible.size());
        return new PageResponse<>(visible.subList((int)start, end), page, pageSize, visible.size());
    }
}
