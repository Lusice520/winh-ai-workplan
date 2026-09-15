package com.winh.workplan.delivery.configuration;

import static com.winh.workplan.delivery.configuration.ConfigurationCommands.*;
import static com.winh.workplan.delivery.configuration.ConfigurationRulesTest.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.winh.workplan.iam.account.*;
import com.winh.workplan.iam.authorization.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.organization.*;
import com.winh.workplan.iam.shared.DomainException;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:deliveryconfig;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
@Transactional
class ConfigurationServiceIntegrationTest {
    @Autowired ConfigurationService service;
    @Autowired OrganizationUnitRepository organizations;
    @Autowired UserAccountRepository accounts;
    @MockitoBean DefaultAuthorizationService authorization;
    SessionPrincipal editor;
    SessionPrincipal authority;
    UUID reviewer;
    UUID finalApprover;

    @BeforeEach void setup() {
        var organization = organizations.saveAndFlush(new OrganizationUnit("验证·交付配置", "CONFIG-" + UUID.randomUUID(),
            OrganizationUnitType.COMPANY, null, null, 0, OrganizationUnitStatus.ENABLED));
        editor = person(organization); authority = person(organization); reviewer = person(organization).accountId(); finalApprover = person(organization).accountId();
        when(authorization.decide(any(), anyString(), any())).thenAnswer(invocation -> {
            SessionPrincipal actor = invocation.getArgument(0); String permission = invocation.getArgument(1);
            boolean allowed = actor.accountId().equals(editor.accountId())
                ? Set.of("DELIVERY_CONFIG_READ", "DELIVERY_TEMPLATE_MANAGE", "DELIVERY_POLICY_MANAGE").contains(permission)
                : actor.accountId().equals(authority.accountId()) && Set.of("DELIVERY_CONFIG_READ", "DELIVERY_POLICY_PUBLISH").contains(permission);
            return new AuthorizationDecision(allowed, allowed ? "ALLOWED" : "ACCESS_DENIED", List.of("验证权限"));
        });
    }
    private SessionPrincipal person(OrganizationUnit organization) {
        String name = "config-" + UUID.randomUUID();
        var account = accounts.saveAndFlush(new UserAccount(name, name, "验证·配置参与人", null, null, null, organization,
            "unused-in-service-test", false, false));
        return new SessionPrincipal(account.getId(), name, "验证·配置参与人", false, false, UUID.randomUUID());
    }
    private ConfigurationViews.Detail templateDraft() {
        return service.create(editor, new Create(UUID.randomUUID(), "STAGE_TEMPLATE", "验证·阶段模板", "本地结构验证",
            template(stage("DESIGN", List.of(), List.of())), null));
    }
    @Test void publishedEditionCannotBeEditedAndNextVersionPreservesItsIdentityAndHash() {
        var draft = templateDraft(); UUID id = draft.configuration().id();
        var publish = new Transition(UUID.randomUUID(), draft.configuration().version(), "验证·发布");
        var first = service.publish(editor, id, publish);
        assertThat(service.publish(editor, id, publish).configuration().id()).isEqualTo(id);
        assertThatThrownBy(() -> service.update(editor, id, new Update(UUID.randomUUID(), first.configuration().version(),
            "覆盖已发布", "不允许", first.template(), null))).isInstanceOf(DomainException.class).hasMessageContaining("不可修改");
        var next = service.nextVersion(editor, id, new Transition(UUID.randomUUID(), first.configuration().version(), "验证·第二版"));
        assertThat(next.configuration().id()).isNotEqualTo(id);
        assertThat(next.configuration().seriesId()).isEqualTo(first.configuration().seriesId());
        assertThat(next.configuration().edition()).isEqualTo(2);
        var old = service.detail(editor, id);
        assertThat(old.template()).isEqualTo(first.template());
        assertThat(old.snapshotHash()).isEqualTo(first.snapshotHash()).hasSize(64);
    }
    @Test void policyDraftEditorCannotPublishButExplicitAuthorityCan() {
        var draft = service.create(editor, new Create(UUID.randomUUID(), "REVIEW_POLICY", "验证·评审规则", "公司授权样例",
            null, policy(reviewer, finalApprover)));
        assertThat(draft.allowedActions()).doesNotContain("PUBLISH");
        assertThatThrownBy(() -> service.publish(editor, draft.configuration().id(),
            new Transition(UUID.randomUUID(), draft.configuration().version(), "不能靠配置权发布")))
            .isInstanceOf(DomainException.class).hasMessageContaining("权限");
        var published = service.publish(authority, draft.configuration().id(), new Transition(UUID.randomUUID(), draft.configuration().version(), "验证·明确授权发布"));
        assertThat(published.configuration().status()).isEqualTo("PUBLISHED");
        assertThat(published.policy().finalApproverId()).isEqualTo(finalApprover);
    }
    @Test void sameRequestCannotChangeBodyAndStaleUpdatesDoNotOverwrite() {
        UUID request = UUID.randomUUID();
        var create = new Create(request, "STAGE_TEMPLATE", "验证·幂等", "原始请求", template(stage("A", List.of(), List.of())), null);
        var first = service.create(editor, create);
        assertThat(service.create(editor, create).configuration().id()).isEqualTo(first.configuration().id());
        assertThatThrownBy(() -> service.create(editor, new Create(request, "STAGE_TEMPLATE", "不同正文", "原始请求", create.template(), null)))
            .isInstanceOf(DomainException.class).hasMessageContaining("幂等键");
        var revised = service.update(editor, first.configuration().id(), new Update(UUID.randomUUID(), first.configuration().version(), "修订名称", "理由", first.template(), null));
        assertThatThrownBy(() -> service.update(editor, first.configuration().id(), new Update(UUID.randomUUID(), first.configuration().version(), "旧版本覆盖", "理由", first.template(), null)))
            .isInstanceOf(DomainException.class).hasMessageContaining("已被更新");
        assertThat(revised.configuration().name()).isEqualTo("修订名称");
    }
    @Test void retirementPreservesPublishedDefinitionAndHistory() {
        var draft = templateDraft(); var pub = service.publish(editor, draft.configuration().id(),
            new Transition(UUID.randomUUID(), draft.configuration().version(), "验证·发布"));
        var retired = service.retire(editor, pub.configuration().id(), new Transition(UUID.randomUUID(), pub.configuration().version(), "验证·停止新引用"));
        assertThat(retired.configuration().status()).isEqualTo("RETIRED");
        assertThat(retired.snapshotHash()).isEqualTo(pub.snapshotHash());
        assertThat(retired.template()).isEqualTo(pub.template());
        assertThat(retired.history()).anyMatch(e -> e.action().equals("DELIVERY_CONFIGURATION_RETIRED"));
        assertThat(retired.allowedActions()).doesNotContain("EDIT", "PUBLISH");
    }
}
