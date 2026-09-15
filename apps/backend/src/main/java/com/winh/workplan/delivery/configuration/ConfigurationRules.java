package com.winh.workplan.delivery.configuration;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.configuration.ConfigurationDefinitions.*;

import java.math.BigDecimal;
import java.util.*;

/** Structural validation is independent of account lookup and publication authorization. */
final class ConfigurationRules {
    private ConfigurationRules() {}
    static final Set<String> PROJECT_TYPES = Set.of("SYSTEM_INTEGRATION", "TECHNICAL_SERVICE", "EQUIPMENT");

    static Definition normalize(String kind, Template template, Policy policy) {
        if ("STAGE_TEMPLATE".equals(kind)) {
            if (policy != null) throw invalid("policy", "阶段模板不能包含评审规则。");
            if (template == null) template = new Template(List.of(), List.of());
            var types = choices(template.projectTypes(), "template.projectTypes", PROJECT_TYPES, 3);
            var stages = new ArrayList<Stage>();
            for (Stage stage : list(template.stages(), "template.stages", 30)) {
                String code = required(stage.code(), "stages.code", 40);
                if (!code.matches("[A-Z][A-Z0-9_]{0,39}"))
                    throw invalid("stages.code", "阶段代码需以大写字母开头，仅使用大写字母、数字和下划线。");
                stages.add(new Stage(code, required(stage.name(), "stages.name", 80),
                    choice(stage.applicability(), "stages.applicability", "REQUIRED", "OPTIONAL", "CONDITIONAL"),
                    optional(stage.condition(), "stages.condition", 2000), optional(stage.ownerRoleHint(), "stages.ownerRoleHint", 160),
                    strings(stage.predecessorCodes(), "stages.predecessorCodes", 30, 40),
                    strings(stage.parallelCodes(), "stages.parallelCodes", 30, 40),
                    strings(stage.milestones(), "stages.milestones", 30, 300),
                    strings(stage.actions(), "stages.actions", 30, 300),
                    strings(stage.deliverables(), "stages.deliverables", 30, 300),
                    optional(stage.completionCriteria(), "stages.completionCriteria", 2000)));
            }
            return new Definition(new Template(types, List.copyOf(stages)), null);
        }
        if (!"REVIEW_POLICY".equals(kind)) throw invalid("kind", "请选择阶段模板或 DG-02 评审规则。");
        if (template != null) throw invalid("template", "评审规则不能包含阶段模板。");
        if (policy == null) policy = new Policy(List.of(), BigDecimal.ZERO, null, List.of(), List.of(), null, null);
        var reviewers = new ArrayList<Reviewer>();
        for (Reviewer reviewer : list(policy.reviewers(), "policy.reviewers", 12)) {
            if (reviewer.accountId() == null) throw invalid("reviewers.accountId", "请选择会签人。");
            reviewers.add(new Reviewer(reviewer.accountId(), choice(reviewer.scope(), "reviewers.scope",
                "TECHNICAL", "COMMERCIAL", "FINANCIAL", "SAFETY", "QUALITY")));
        }
        return new Definition(null, new Policy(choices(policy.projectTypes(), "policy.projectTypes", PROJECT_TYPES, 3),
            amount(policy.minimumBudget() == null ? BigDecimal.ZERO : policy.minimumBudget(), "policy.minimumBudget"),
            policy.maximumBudget() == null ? null : amount(policy.maximumBudget(), "policy.maximumBudget"),
            choices(policy.riskLevels(), "policy.riskLevels", Set.of("LOW", "MEDIUM", "HIGH"), 3),
            List.copyOf(reviewers), policy.finalApproverId(), optional(policy.authorityBasis(), "policy.authorityBasis", 4000)));
    }

    static List<Problem> problems(Definition definition) {
        var errors = new ArrayList<Problem>();
        if (definition.template() != null) templateProblems(definition.template(), errors);
        else policyProblems(definition.policy(), errors);
        return List.copyOf(errors);
    }

    private static void templateProblems(Template template, List<Problem> errors) {
        if (template.projectTypes().isEmpty()) errors.add(new Problem("projectTypes", "至少选择一个适用项目类型。"));
        if (template.stages().isEmpty()) errors.add(new Problem("stages", "至少定义一个阶段。"));
        var stages = new LinkedHashMap<String, Stage>();
        for (Stage stage : template.stages()) {
            if (stages.putIfAbsent(stage.code(), stage) != null)
                errors.add(new Problem("stages.code", "阶段代码重复：" + stage.code()));
            if (stage.ownerRoleHint() == null || stage.completionCriteria() == null
                    || stage.milestones().isEmpty() || stage.actions().isEmpty() || stage.deliverables().isEmpty())
                errors.add(new Problem(stage.code(), stage.name() + "：请补齐责任角色、里程碑、动作、成果与完成条件。"));
            if ("CONDITIONAL".equals(stage.applicability()) && stage.condition() == null)
                errors.add(new Problem(stage.code(), stage.name() + "：条件阶段需填写适用条件。"));
        }
        for (Stage stage : stages.values()) {
            for (String reference : stage.predecessorCodes()) {
                if (!stages.containsKey(reference) || reference.equals(stage.code()))
                    errors.add(new Problem(stage.code(), stage.name() + "：前置阶段引用无效。"));
            }
            for (String reference : stage.parallelCodes()) {
                if (!stages.containsKey(reference) || reference.equals(stage.code()))
                    errors.add(new Problem(stage.code(), stage.name() + "：并行阶段引用无效。"));
                else if (reaches(stage.code(), reference, stages, new HashSet<>())
                        || reaches(reference, stage.code(), stages, new HashSet<>()))
                    errors.add(new Problem(stage.code(), stage.name() + "：并行与前置顺序存在冲突。"));
            }
            if (stage.predecessorCodes().stream().anyMatch(p -> reaches(p, stage.code(), stages, new HashSet<>())))
                errors.add(new Problem(stage.code(), stage.name() + "：前置关系存在循环。"));
        }
    }

    private static boolean reaches(String from, String target, Map<String, Stage> stages, Set<String> visited) {
        if (from.equals(target)) return true;
        if (!visited.add(from) || !stages.containsKey(from)) return false;
        return stages.get(from).predecessorCodes().stream().anyMatch(p -> reaches(p, target, stages, visited));
    }

    private static void policyProblems(Policy policy, List<Problem> errors) {
        if (policy.projectTypes().isEmpty()) errors.add(new Problem("projectTypes", "至少选择一个适用项目类型。"));
        if (policy.riskLevels().isEmpty()) errors.add(new Problem("riskLevels", "至少选择一个适用风险级别。"));
        if (policy.maximumBudget() != null && policy.maximumBudget().compareTo(policy.minimumBudget()) < 0)
            errors.add(new Problem("maximumBudget", "最高金额不能低于最低金额。"));
        if (policy.reviewers().isEmpty()) errors.add(new Problem("reviewers", "至少配置一名必要会签人。"));
        if (policy.finalApproverId() == null) errors.add(new Problem("finalApproverId", "请选择最终批准人。"));
        if (policy.authorityBasis() == null) errors.add(new Problem("authorityBasis", "请说明公司授权与适用依据。"));
        var accounts = new HashSet<UUID>();
        for (Reviewer reviewer : policy.reviewers()) {
            if (!accounts.add(reviewer.accountId())) errors.add(new Problem("reviewers", "同一人员不能重复配置为必要会签人。"));
            if (reviewer.accountId().equals(policy.finalApproverId()))
                errors.add(new Problem("finalApproverId", "最终批准人与必要会签人须分别配置。"));
        }
    }

    static boolean matches(Policy policy, String projectType, BigDecimal budget, String risk) {
        return policy.projectTypes().contains(projectType) && policy.riskLevels().contains(risk)
            && budget != null && budget.compareTo(policy.minimumBudget()) >= 0
            && (policy.maximumBudget() == null || budget.compareTo(policy.maximumBudget()) <= 0);
    }

    private static List<String> choices(List<String> values, String field, Set<String> choices, int max) {
        var result = strings(values, field, max, 40);
        if (!choices.containsAll(result)) throw invalid(field, "请选择已注册的选项。");
        return result;
    }
    private static List<String> strings(List<String> values, String field, int count, int length) {
        var result = list(values, field, count).stream().map(v -> required(v, field, length)).toList();
        if (new HashSet<>(result).size() != result.size()) throw invalid(field, "列表中不能包含重复项。");
        return result;
    }
    private static <T> List<T> list(List<T> values, String field, int count) {
        if (values == null) return List.of();
        if (values.size() > count || values.stream().anyMatch(Objects::isNull))
            throw invalid(field, "列表最多 " + count + " 项，且不能包含空项。");
        return values;
    }
}
