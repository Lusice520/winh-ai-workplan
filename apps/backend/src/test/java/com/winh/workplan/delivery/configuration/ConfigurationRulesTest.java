package com.winh.workplan.delivery.configuration;

import static com.winh.workplan.delivery.configuration.ConfigurationDefinitions.*;
import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.iam.shared.DomainException;

class ConfigurationRulesTest {
    static Stage stage(String code, List<String> predecessors, List<String> parallel) {
        return new Stage(code, "验证·" + code, "REQUIRED", null, "阶段负责人", predecessors, parallel,
            List.of("专业里程碑"), List.of("专业复核"), List.of("成果文件"), "成果由指定人员确认。");
    }
    static Template template(Stage... stages) { return new Template(List.of("SYSTEM_INTEGRATION"), List.of(stages)); }
    static Policy policy(UUID reviewer, UUID approver) {
        return new Policy(List.of("SYSTEM_INTEGRATION"), BigDecimal.ZERO, new BigDecimal("480000.00"),
            List.of("LOW", "MEDIUM"), List.of(new Reviewer(reviewer, "TECHNICAL")), approver, "验证·明确公司授权依据");
    }
    @Test void transitiveCyclesAndParallelContradictionsArePublicationBlockers() {
        var invalid = ConfigurationRules.normalize("STAGE_TEMPLATE", template(
            stage("A", List.of("C"), List.of()), stage("B", List.of("A"), List.of()),
            stage("C", List.of("B"), List.of("A"))), null);
        assertThat(ConfigurationRules.problems(invalid)).anyMatch(p -> p.message().contains("循环"))
            .anyMatch(p -> p.message().contains("并行与前置"));
        var valid = ConfigurationRules.normalize("STAGE_TEMPLATE", template(
            stage("A", List.of(), List.of("B")), stage("B", List.of(), List.of("A")),
            stage("C", List.of("A", "B"), List.of())), null);
        assertThat(ConfigurationRules.problems(valid)).isEmpty();
    }
    @Test void missingApplicabilityConditionsAndDuplicateCodesCannotPublish() {
        Stage conditional = new Stage("A", "条件阶段", "CONDITIONAL", null, "负责人", List.of(), List.of(), List.of(), List.of(), List.of(), null);
        var d = ConfigurationRules.normalize("STAGE_TEMPLATE", template(conditional, stage("A", List.of(), List.of())), null);
        assertThat(ConfigurationRules.problems(d)).anyMatch(p -> p.message().contains("条件阶段"))
            .anyMatch(p -> p.message().contains("代码重复"));
    }
    @Test void policyKeepsIndependentSignersAndExactInclusiveAmountBounds() {
        UUID reviewer = UUID.randomUUID();
        assertThat(ConfigurationRules.problems(ConfigurationRules.normalize("REVIEW_POLICY", null, policy(reviewer, reviewer))))
            .anyMatch(p -> p.field().equals("finalApproverId"));
        var policy = policy(reviewer, UUID.randomUUID());
        assertThat(ConfigurationRules.matches(policy, "SYSTEM_INTEGRATION", new BigDecimal("480000.00"), "MEDIUM")).isTrue();
        assertThat(ConfigurationRules.matches(policy, "SYSTEM_INTEGRATION", new BigDecimal("480000.01"), "MEDIUM")).isFalse();
        assertThat(ConfigurationRules.matches(policy, "EQUIPMENT", new BigDecimal("1"), "MEDIUM")).isFalse();
        assertThat(ConfigurationRules.matches(policy, "SYSTEM_INTEGRATION", new BigDecimal("1"), "HIGH")).isFalse();
    }
    @Test void malformedAndUnknownNestedPropertiesFailWithoutRevealingPayload() throws Exception {
        var codec = new ConfigurationCodec(new ObjectMapper());
        var body = new ObjectMapper().readTree("{\"kind\":\"REVIEW_POLICY\",\"policy\":{\"autoApprove\":true}}");
        assertThatThrownBy(() -> codec.command(body, ConfigurationCommands.Create.class))
            .isInstanceOf(DomainException.class).hasMessageContaining("未知字段");
        assertThatThrownBy(() -> ConfigurationRules.normalize("REVIEW_POLICY", null,
            new Policy(List.of("SYSTEM_INTEGRATION"), new BigDecimal("0.001"), null, List.of(), List.of(), null, null)))
            .isInstanceOf(DomainException.class);
    }
}
