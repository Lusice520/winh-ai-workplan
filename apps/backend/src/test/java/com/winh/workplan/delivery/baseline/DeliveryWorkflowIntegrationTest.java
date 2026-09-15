package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.delivery.baseline.DeliveryCommands.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory.PublishedConfiguration;
import com.winh.workplan.delivery.configuration.ConfigurationDefinitions;
import com.winh.workplan.delivery.configuration.ConfigurationService;
import com.winh.workplan.handover.HandoverDirectory.PackageReference;
import com.winh.workplan.handover.HandoverService;
import com.winh.workplan.iam.account.*;
import com.winh.workplan.iam.authorization.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.organization.*;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.project.ProjectDirectory.ProjectContext;
import com.winh.workplan.project.ProjectService;
import com.winh.workplan.work.WorkDirectory.WorkReference;
import com.winh.workplan.work.WorkService;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

/** Domain integration uses real delivery storage/audit/idempotency; source domains and IAM decisions are fixtures. */
@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:deliverybaseline;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
@Transactional
class DeliveryWorkflowIntegrationTest {
    @Autowired DeliveryStore store;
    @Autowired DeliveryPreparationService preparation;
    @Autowired DeliveryResourceService resourceService;
    @Autowired DeliveryFindingService findingService;
    @Autowired DeliveryReviewService reviewService;
    @Autowired DeliveryTransferService transferService;
    @Autowired DeliveryScopeService scopeService;
    @Autowired OrganizationUnitRepository organizations;
    @Autowired UserAccountRepository accounts;
    @MockitoBean DefaultAuthorizationService authorization;
    @MockitoBean ProjectService projects;
    @MockitoBean HandoverService handover;
    @MockitoBean ConfigurationService configurations;
    @MockitoBean WorkService work;
    UUID projectId,templateId,policyId,sourceId,organizationId,stageId,packageId,milestoneId,itemId,resourceId,budgetId;
    SessionPrincipal manager,reviewer,approver,worker,committer,observer;
    final Map<UUID,Set<String>> permissions=new HashMap<>();
    final Map<UUID,WorkReference> workItems=new HashMap<>();
    Workspace current;
    DeliveryScopes.View scope;
    boolean sourceChanged,sourceRestricted;
    String mainStage;
    final LocalDate start=LocalDate.now().plusDays(2),end=start.plusDays(10);

    @BeforeEach void setup(){
        permissions.clear();workItems.clear();mainStage="PRESALES";sourceChanged=false;sourceRestricted=false;
        projectId=UUID.randomUUID();templateId=UUID.randomUUID();policyId=UUID.randomUUID();sourceId=UUID.randomUUID();
        var organization=organizations.saveAndFlush(new OrganizationUnit("验证·交付团队","DG2-"+UUID.randomUUID(),OrganizationUnitType.COMPANY,null,null,0,OrganizationUnitStatus.ENABLED));
        organizationId=organization.getId();
        manager=person(organization,"经理",Set.of("DG2_READ","DG2_EDIT","DG2_SUBMIT","DELIVERY_BUDGET_READ","DELIVERY_BUDGET_EDIT","WORK_EDIT","WORK_READ"));
        reviewer=person(organization,"会签",Set.of("DG2_READ","DG2_REVIEW","WORK_READ"));
        approver=person(organization,"批准",Set.of("DG2_READ","DG2_APPROVE","DELIVERY_BUDGET_READ","WORK_READ"));
        worker=person(organization,"专业负责人",Set.of("DG2_READ","DG2_EDIT","WORK_EDIT","WORK_READ"));
        committer=person(organization,"资源承诺人",Set.of("DG2_READ","DG2_RESOURCE_COMMIT","WORK_READ"));
        observer=person(organization,"独立验证成员",Set.of("DG2_READ","WORK_READ","WORK_REVIEW"));
        when(authorization.decide(any(),anyString(),any())).thenAnswer(i->{SessionPrincipal a=i.getArgument(0);String permission=i.getArgument(1);
            boolean allowed=permissions.getOrDefault(a.accountId(),Set.of()).contains(permission);return new AuthorizationDecision(allowed,allowed?"ALLOWED":"ACCESS_DENIED",List.of("本地测试权限"));});
        when(projects.participant(any(),any())).thenAnswer(i->permissions.containsKey(i.<UUID>getArgument(1)));
        when(projects.requireReadable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
        when(projects.requireWritable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
        doAnswer(i->{mainStage="DELIVERY";return null;}).when(projects).activateDelivery(any(),any(),any());
        when(handover.requireCurrentPackage(any(),any())).thenAnswer(i->{
            if(sourceRestricted)throw new DomainException(HttpStatus.FORBIDDEN,"SOURCE_RESTRICTED","当前来源受限");
            return new PackageReference(sourceChanged?UUID.randomUUID():sourceId,projectId,manager.accountId(),"HG-TEST","test-handover-hash","CONTRACT","SYSTEM_INTEGRATION");});
        var template=new ConfigurationDefinitions.Template(List.of("SYSTEM_INTEGRATION"),List.of(new ConfigurationDefinitions.Stage("DELIVERY","交付实施","REQUIRED",null,"项目责任人",
            List.of(),List.of(),List.of("交付验收"),List.of("实施复核"),List.of("实施成果"),"满足验收条件")));
        var policy=new ConfigurationDefinitions.Policy(List.of("SYSTEM_INTEGRATION"),BigDecimal.ZERO,new BigDecimal("10000"),List.of("MEDIUM"),
            List.of(new ConfigurationDefinitions.Reviewer(reviewer.accountId(),"TECHNICAL")),approver.accountId(),"仅作合成授权规则验证");
        when(configurations.requireSelectable(any(),eq(projectId),eq(templateId),eq("STAGE_TEMPLATE"))).thenReturn(new PublishedConfiguration(templateId,UUID.randomUUID(),1,"验证模板","STAGE_TEMPLATE",template,null,"template-hash"));
        when(configurations.requireSelectable(any(),eq(projectId),eq(policyId),eq("REVIEW_POLICY"))).thenReturn(new PublishedConfiguration(policyId,UUID.randomUUID(),1,"验证规则","REVIEW_POLICY",null,policy,"policy-hash"));
        when(work.registerDeliveryPackage(any(),eq(projectId),any(),anyString(),anyString(),any(),any(),any())).thenAnswer(i->{
            UUID id=i.getArgument(2);if(id==null)id=UUID.randomUUID();var old=workItems.get(id);
            var ref=new WorkReference(id,projectId,"WORK_PACKAGE",i.getArgument(3),"OPEN",false,old==null?0:old.version()+1,
                old==null?null:old.sourceRequirementId(),old==null?"DELIVERY":old.creationSource(),i.getArgument(5),i.getArgument(6),i.getArgument(7),"PREPARING",0);workItems.put(id,ref);return ref;});
        when(work.require(any(),eq(projectId),any())).thenAnswer(i->{UUID id=i.getArgument(2);if(!workItems.containsKey(id))throw BusinessRules.missing();return workItems.get(id);});
        doAnswer(i->{List<UUID> ids=i.getArgument(1);String state=i.getArgument(2);int version=i.getArgument(3);for(UUID id:ids){var w=workItems.get(id);
            workItems.put(id,new WorkReference(w.id(),projectId,w.kind(),w.title(),w.status(),"BASELINED".equals(state),w.version()+1,w.sourceRequirementId(),w.creationSource(),w.ownerId(),w.verifierId(),w.dueDate(),state,version));}return null;
        }).when(work).setDeliveryState(any(),anyList(),anyString(),anyInt());
        when(work.approveDeliveryPackage(eq(projectId),any(),any(),anyString(),anyString(),any(),any(),any(),any(),anyInt())).thenAnswer(i->{
            UUID id=i.getArgument(1);var old=workItems.get(id);var w=new WorkReference(id,projectId,"WORK_PACKAGE",i.getArgument(3),"OPEN",true,old==null?0:old.version()+1,
                old==null?null:old.sourceRequirementId(),old==null?"DELIVERY":old.creationSource(),i.getArgument(5),i.getArgument(6),i.getArgument(7),"BASELINED",i.getArgument(9));workItems.put(id,w);return w;
        });
    }
    @Test void twoRoundsFreezeSameObjectsAndApprovalCreatesImmutableV1BeforeDirectBudgetRevision(){
        completePreparation();assertThat(current.checks()).hasSize(9).allMatch(c->"PASS".equals(c.status()));
        var submit=new Submit(UUID.randomUUID(),current.preparation().version(),"验证·提交第一轮");
        current=reviewService.submit(manager,projectId,submit);UUID firstRound=current.rounds().getFirst().id();String firstHash=current.rounds().getFirst().snapshotHash();
        assertThat(reviewService.submit(manager,projectId,submit).rounds()).hasSize(1);
        var stage=object(stageId);assertThatThrownBy(()->preparation.save(manager,projectId,stageId,new SaveObject(UUID.randomUUID(),current.preparation().version(),stage.version(),null,stage.content(),"评审时修改",null,null)))
            .isInstanceOf(DomainException.class).hasMessageContaining("正在评审");
        current=reviewService.review(reviewer,projectId,firstRound,decision("RETURNED","请补充依据"));
        assertThat(current.preparation().status()).isEqualTo("RETURNED");
        current=store.workspace(manager,projectId);current=reviewService.submit(manager,projectId,new Submit(UUID.randomUUID(),current.preparation().version(),"验证·第二轮复核"));
        UUID secondRound=current.rounds().getFirst().id();
        assertThatThrownBy(()->reviewService.decide(approver,projectId,secondRound,decision("APPROVED","过早批准"))).isInstanceOf(DomainException.class).hasMessageContaining("必要会签");
        permissions.get(manager.accountId()).add("DG2_APPROVE");
        assertThatThrownBy(()->reviewService.decide(manager,projectId,secondRound,decision("APPROVED","自批"))).isInstanceOf(DomainException.class).hasMessageContaining("准备者");
        current=reviewService.review(reviewer,projectId,secondRound,decision("AGREED","本专业同意"));
        sourceChanged=true;
        assertThatThrownBy(()->reviewService.decide(approver,projectId,secondRound,decision("APPROVED","源已变化"))).isInstanceOf(DomainException.class).hasMessageContaining("移交包");
        sourceChanged=false;permissions.get(approver.accountId()).remove("DELIVERY_BUDGET_READ");
        assertThatThrownBy(()->reviewService.decide(approver,projectId,secondRound,decision("APPROVED","预算权限撤销"))).isInstanceOf(DomainException.class);
        permissions.get(approver.accountId()).add("DELIVERY_BUDGET_READ");
        current=reviewService.decide(approver,projectId,secondRound,decision("APPROVED","验证·独立批准"));
        assertThat(current.project().mainStage()).isEqualTo("DELIVERY");assertThat(current.preparation().baselineVersion()).isEqualTo(1);
        assertThat(current.objects()).extracting(ObjectFact::id).contains(stageId,packageId,itemId,milestoneId,budgetId);
        assertThat(current.rounds().get(1).snapshotHash()).isEqualTo(firstHash);
        var baseline=current.baselines().getFirst();String frozen=store.codec.write(store.baselineSnapshot(manager,projectId,baseline.id()));
        var old=object(budgetId);var budget=old.content().budget();var nextLines=new ArrayList<>(budget.lines());nextLines.add(new BudgetLine("风险准备","OTHER",new BigDecimal("10.00"),stageId,packageId,null,null,"说明"));
        var next=new Content(null,null,null,null,null,new Budget("FULL",budget.scope(),List.of(),null,null,null,null,nextLines));
        current=preparation.save(manager,projectId,budgetId,new SaveObject(UUID.randomUUID(),current.preparation().version(),old.version(),null,next,"验证·直接修订","保持工作范围","明确预算依据"));
        assertThat(current.preparation().baselineVersion()).isEqualTo(2);assertThat(current.baselines()).hasSize(2);
        assertThat(store.codec.write(store.baselineSnapshot(manager,projectId,baseline.id()))).isEqualTo(frozen);
        assertThat(workItems.get(packageId).status()).isEqualTo("OPEN");
    }
    @Test void restrictedProjectionOmitsBudgetAndRuleAmountsIncludingHistoryAndSnapshots(){
        completePreparation();current=reviewService.submit(manager,projectId,new Submit(UUID.randomUUID(),current.preparation().version(),"完整评审"));
        UUID roundId=current.rounds().getFirst().id();
        String view=store.codec.write(store.workspace(observer,projectId));String frozen=store.codec.write(store.reviewSnapshot(observer,projectId,roundId));
        assertThat(view).doesNotContain("\"amount\"","minimumBudget","maximumBudget","人员投入依据");
        var visiblePreparation=store.workspace(observer,projectId).preparation();
        assertThat(visiblePreparation.reviewAssignments()).hasSize(1);
        assertThat(visiblePreparation.finalApproverId()).isEqualTo(approver.accountId());
        assertThat(frozen).doesNotContain("\"amount\"","minimumBudget","maximumBudget","人员投入依据");
        assertThat(store.revisionHistory(observer,projectId,budgetId)).isEmpty();
        assertThat(store.codec.write(store.revisionHistory(observer,projectId,current.preparation().id()))).doesNotContain("minimumBudget","maximumBudget");
        sourceRestricted=true;assertThat(store.workspace(manager,projectId).checks()).anyMatch(c->"HANDOVER".equals(c.code())&&"RESTRICTED".equals(c.status()));
        assertThatThrownBy(()->store.codec.command(new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(Map.of("finding",Map.of("blocking",false))),SaveFinding.class))
            .isInstanceOf(DomainException.class).hasMessageContaining("未知字段");
    }
    @Test void resourceOverlapsRequireExplicitResolutionAndNewAllocationsInvalidateOldResolution(){
        completePreparation();var c=store.require(projectId);var other=new DeliveryCase();other.projectId=UUID.randomUUID();other.managerId=c.managerId;
        other.preparedBy=c.preparedBy;other.headerJson=c.headerJson;other.handoverPackageId=c.handoverPackageId;other.handoverJson=c.handoverJson;store.cases.saveAndFlush(other);
        var overlap=new DeliveryResource();overlap.caseId=other.id;overlap.projectId=other.projectId;
        overlap.workPackageId=packageId;overlap.personId=worker.accountId();overlap.committerId=committer.accountId();overlap.startsOn=start;overlap.endsOn=end;overlap.dailyHours=new BigDecimal("6");
        overlap.requestJson=store.codec.write(new ResourceRequest(packageId,worker.accountId(),committer.accountId(),start,end,overlap.dailyHours,"其他项目的资源"));
        overlap.status="COMMITTED";overlap.preparedBy=manager.accountId();overlap.committedBy=committer.accountId();overlap.committedAt=Instant.now();
        overlap.commitmentJson=store.codec.write(new Commitment(new BigDecimal("8"),"原承诺",null,null));store.resources.saveAndFlush(overlap);
        current=store.workspace(manager,projectId);
        assertThat(current.checks()).anyMatch(check->"TEAM".equals(check.code())&&"BLOCKED".equals(check.status()));
        assertThatThrownBy(()->resourceService.commit(committer,projectId,resourceId,commit("COMMITTED",null,null))).isInstanceOf(DomainException.class).hasMessageContaining("超过可用容量");
        current=resourceService.commit(committer,projectId,resourceId,commit("CONFLICT","资源冲突","部门协调"));
        current=resourceService.commit(committer,projectId,resourceId,commit("RESOLVED","经协调分段安排并保留影响","由部门责任人跟踪"));
        assertThat(store.workspace(manager,projectId).checks()).anyMatch(check->"TEAM".equals(check.code())&&"PASS".equals(check.status()));
        overlap.dailyHours=new BigDecimal("7");overlap.touch();store.resources.saveAndFlush(overlap);
        assertThat(store.workspace(manager,projectId).checks()).anyMatch(check->"TEAM".equals(check.code())&&"BLOCKED".equals(check.status()));
    }
    @Test void blockingFindingCannotCloseWithoutOwnerEvidenceAndIndependentVerification(){
        completePreparation();var body=new Finding("法律开工条件","GAP","LEGAL","HIGH",worker.accountId(),reviewer.accountId(),end,"提供有效依据","本次开工范围",manager.accountId(),"升级项目经理");
        current=findingService.save(manager,projectId,null,new SaveFinding(UUID.randomUUID(),current.preparation().version(),null,body,"验证·登记阻断项"));
        var f=current.findings().getFirst();assertThat(f.blocking()).isTrue();
        assertThatThrownBy(()->findingService.resolve(reviewer,projectId,f.id(),new ResolveFinding(UUID.randomUUID(),current.preparation().version(),f.version(),"VERIFY","无证据验证")))
            .isInstanceOf(DomainException.class).hasMessageContaining("先由责任人");
        current=findingService.resolve(worker,projectId,f.id(),new ResolveFinding(UUID.randomUUID(),current.preparation().version(),f.version(),"SUBMIT_EVIDENCE","验证·已提供有效开工依据"));
        var waiting=current.findings().getFirst();
        permissions.get(worker.accountId()).add("DG2_REVIEW"); // Even a dual-role owner cannot verify their own evidence.
        assertThatThrownBy(()->findingService.resolve(worker,projectId,f.id(),new ResolveFinding(UUID.randomUUID(),current.preparation().version(),waiting.version(),"VERIFY","自验")))
            .isInstanceOf(DomainException.class).hasMessageContaining("独立验证人");
        current=findingService.resolve(reviewer,projectId,f.id(),new ResolveFinding(UUID.randomUUID(),current.preparation().version(),waiting.version(),"VERIFY","验证·独立核实依据完整"));
        assertThat(current.findings().getFirst().status()).isEqualTo("CLOSED");
        assertThat(store.revisionHistory(manager,projectId,f.id())).hasSize(3);
    }
    @Test void acceptedTransferResignsResourcesAndPreservesApprovedSnapshotsAndOriginalWorkIdentity(){
        approvePreparation();configureTransferFixtures();
        UUID baseline=current.baselines().getFirst().id();String original=store.codec.write(store.baselineSnapshot(manager,projectId,baseline));
        var preview=transferService.preview(manager,projectId,worker.accountId(),committer.accountId());
        assertThat(preview.mapping().objects()).hasSize(2);assertThat(preview.mapping().related()).hasSize(1);
        var transfer=transferService.create(manager,projectId,new DeliveryTransfers.Create(UUID.randomUUID(),current.preparation().version(),worker.accountId(),committer.accountId(),preview.hash(),List.of(),List.of("PROJECT_CONTRIBUTOR"),"验证·专业责任与资源统一交接"));
        var wrongAccept=new DeliveryTransfers.Decide(UUID.randomUUID(),transfer.version(),"ACCEPT","冒名接收");
        assertThatThrownBy(()->transferService.decide(manager,projectId,transfer.id(),wrongAccept)).hasMessageContaining("新责任人");
        var accepted=transferService.decide(committer,projectId,transfer.id(),new DeliveryTransfers.Decide(UUID.randomUUID(),transfer.version(),"ACCEPT","验证·已逐项确认接收"));
        assertThatThrownBy(()->transferService.decide(manager,projectId,transfer.id(),new DeliveryTransfers.Decide(UUID.randomUUID(),accepted.version(),"APPLY","过早生效"))).hasMessageContaining("未重新签认");
        assertThat(store.workspace(manager,projectId).preparation().header().technicalLeadId()).isEqualTo(worker.accountId());
        assertThat(transferService.overlaps(committer,projectId,transfer.id(),resourceId).peakHours()).isEqualByComparingTo("4");
        var signed=transferService.sign(committer,projectId,transfer.id(),new DeliveryTransfers.Sign(UUID.randomUUID(),accepted.version(),resourceId,"COMMITTED",new Commitment(new BigDecimal("8"),"验证·接任投入已确认",null,null)));
        var apply=new DeliveryTransfers.Decide(UUID.randomUUID(),signed.version(),"APPLY","验证·统一生效");
        var applied=transferService.decide(manager,projectId,transfer.id(),apply);
        assertThat(applied.status()).isEqualTo("APPLIED");assertThat(applied.effectiveAt()).isNotNull();
        assertThat(transferService.decide(manager,projectId,transfer.id(),apply).effectiveAt()).isEqualTo(applied.effectiveAt());
        current=store.workspace(manager,projectId);assertThat(current.preparation().header().technicalLeadId()).isEqualTo(committer.accountId());
        assertThat(current.resources().getFirst().request().personId()).isEqualTo(committer.accountId());
        assertThat(workItems.get(packageId).ownerId()).isEqualTo(committer.accountId());assertThat(workItems.get(packageId).status()).isEqualTo("OPEN");
        assertThat(workItems.get(packageId).deliveryBaselineVersion()).isEqualTo(1);
        assertThat(store.codec.write(store.baselineSnapshot(manager,projectId,baseline))).isEqualTo(original);
        verify(projects).applyRoleChanges(eq(manager),eq(projectId),argThat(changes->changes.getLast().roleCodes().isEmpty()),anyString());
    }
    @Test void newUnsettledFindingInvalidatesAcceptedTransferWithoutChangingCurrentResponsibilities(){
        approvePreparation();configureTransferFixtures();
        var preview=transferService.preview(manager,projectId,worker.accountId(),committer.accountId());
        var t=transferService.create(manager,projectId,new DeliveryTransfers.Create(UUID.randomUUID(),current.preparation().version(),worker.accountId(),committer.accountId(),preview.hash(),List.of("PROJECT_CONTRIBUTOR"),List.of("PROJECT_CONTRIBUTOR"),"验证·发起交接"));
        var accepted=transferService.decide(committer,projectId,t.id(),new DeliveryTransfers.Decide(UUID.randomUUID(),t.version(),"ACCEPT","验证·接收"));
        current=store.workspace(manager,projectId);
        current=findingService.save(manager,projectId,null,new SaveFinding(UUID.randomUUID(),current.preparation().version(),null,
            new Finding("验证·新出现的未结事项","GAP","DETAIL","LOW",worker.accountId(),observer.accountId(),end,"完成核查","文档",manager.accountId(),"项目经理"),"验证·新增未结职责"));
        assertThatThrownBy(()->transferService.decide(manager,projectId,t.id(),new DeliveryTransfers.Decide(UUID.randomUUID(),accepted.version(),"APPLY","旧交接不得生效"))).hasMessageContaining("已变化");
        assertThat(store.workspace(manager,projectId).preparation().header().technicalLeadId()).isEqualTo(worker.accountId());
        assertThat(transferService.decide(manager,projectId,t.id(),new DeliveryTransfers.Decide(UUID.randomUUID(),accepted.version(),"CANCEL","验证·补齐预览后重发")).status()).isEqualTo("CANCELLED");
    }
    @Test void transferCannotMakePackageOwnerTheirOwnVerifier(){
        approvePreparation();configureTransferFixtures();
        assertThatThrownBy(()->transferService.preview(manager,projectId,worker.accountId(),observer.accountId())).hasMessageContaining("不同的负责人和验证人");
    }
    @Test void singlePackageScopeChangeCannotAssignAnOwnerWithoutCurrentExecutionRights(){
        approvePreparation();var o=object(packageId);var w=o.content().workPackage();
        current=preparation.save(manager,projectId,packageId,new SaveObject(UUID.randomUUID(),current.preparation().version(),o.version(),null,
            new Content(null,null,null,new WorkPackage(w.title(),w.scope(),w.deliverables(),w.acceptanceCriteria(),reviewer.accountId(),w.verifierId(),w.stageId(),w.startsOn(),w.endsOn(),w.resourceNotes(),w.itemIds(),w.milestoneIds()),null,null),
            "验证·拟调整负责人","验证·责任影响","验证·重新核对实际执行权"));
        var change=current.changes().getFirst();
        assertThat(store.workspace(observer,projectId).changes().getFirst().impact()).isNull();
        assertThat(store.revisionHistory(observer,projectId,packageId)).allMatch(r->r.reason()==null&&r.impact()==null&&r.basis()==null);
        permissions.get(approver.accountId()).remove("DELIVERY_BUDGET_READ");
        assertThatThrownBy(()->reviewService.decideChange(approver,projectId,change.id(),new DecideChange(UUID.randomUUID(),current.preparation().version(),change.version(),"APPROVED","验证·预算阅读权失效不得批准"))).hasMessageContaining("权限不足");
        permissions.get(approver.accountId()).add("DELIVERY_BUDGET_READ");
        assertThatThrownBy(()->reviewService.decideChange(approver,projectId,change.id(),new DecideChange(UUID.randomUUID(),current.preparation().version(),change.version(),"APPROVED","验证·无执行权不得形成有效责任"))).hasMessageContaining("执行权限");
    }
    @Test void groupedScopeAddsLinkedOriginalIdsOnlyAfterIndependentApprovalAndRetainsCompletedWork(){
        approvePreparation();String v1=store.baselineSnapshot(manager,projectId,current.baselines().getFirst().id()).toString();
        var done=workItems.get(packageId);workItems.put(packageId,new WorkReference(done.id(),projectId,done.kind(),done.title(),"DONE",true,done.version()+1,done.sourceRequirementId(),done.creationSource(),done.ownerId(),done.verifierId(),done.dueDate(),"BASELINED",1));
        when(work.completedPackageIds(projectId)).thenReturn(Set.of(packageId));
        createScope();UUID added=completeScope(null);
        assertThat(store.objects.existsById(added)).isFalse();assertThat(workItems).doesNotContainKey(added);
        assertThat(store.workspace(manager,projectId).preparation().baselineVersion()).isEqualTo(1);
        assertThat(scope.problems()).isEmpty();scopeAction("SUBMIT",manager);UUID round=scope.rounds().getFirst().id();
        assertThat(scope.events()).anyMatch(e->e.action().equals("SUBMIT")&&e.note().equals("验证·SUBMIT"));
        String frozen=scopeService.snapshot(manager,projectId,scope.change().id(),round).toString();
        var wp=scope.candidate().objects().stream().filter(o->o.id().equals(added)).findFirst().orElseThrow();
        assertThatThrownBy(()->scopeService.saveObject(manager,projectId,scope.change().id(),added,new SaveObject(UUID.randomUUID(),scope.change().version(),wp.version(),null,wp.content(),"冻结拒写",null,null))).hasMessageContaining("已提交");
        assertThat(scopeService.detail(observer,projectId,scope.change().id()).candidate().objects()).noneMatch(o->"BUDGET".equals(o.kind()));
        assertThat(scopeService.snapshot(observer,projectId,scope.change().id(),round).impact()).isNull();
        assertThat(scopeService.detail(observer,projectId,scope.change().id()).events()).allMatch(e->e.note()==null);
        permissions.get(manager.accountId()).add("DG2_APPROVE");
        assertThatThrownBy(()->scopeService.action(manager,projectId,scope.change().id(),new DeliveryScopes.Action(UUID.randomUUID(),scope.change().version(),"APPROVE","自批",null,null))).hasMessageContaining("独立");
        var command=new DeliveryScopes.Action(UUID.randomUUID(),scope.change().version(),"APPROVE","验证·独立确认新增范围",null,null);
        scope=scopeService.action(approver,projectId,scope.change().id(),command);
        assertThat(scopeService.action(approver,projectId,scope.change().id(),command).rounds().getFirst().baselineVersion()).isEqualTo(2);
        current=store.workspace(manager,projectId);assertThat(current.preparation().baselineVersion()).isEqualTo(2);
        assertThat(workItems.get(added).deliveryState()).isEqualTo("BASELINED");assertThat(workItems.get(added).id()).isEqualTo(added);
        assertThat(workItems.get(packageId).status()).isEqualTo("DONE");assertThat(workItems.get(packageId).deliveryBaselineVersion()).isEqualTo(1);
        assertThat(store.baselineSnapshot(manager,projectId,current.baselines().getLast().id()).toString()).isEqualTo(v1);
        assertThat(scopeService.snapshot(manager,projectId,scope.change().id(),round).toString()).isEqualTo(frozen);
    }
    @Test void scopeReturnKeepsRoundAndRechecksCurrentRecipientPermissionsBeforeApproval(){
        approvePreparation();createScope();UUID original=UUID.randomUUID(),requirement=UUID.randomUUID();
        workItems.put(original,new WorkReference(original,projectId,"WORK_PACKAGE","验证·原需求派生包","OPEN",false,0,requirement,"REQUIREMENT",worker.accountId(),observer.accountId(),end,"NONE",0));
        UUID added=completeScope(original);assertThat(added).isEqualTo(original);
        assertThat(workItems.get(original).deliveryState()).isEqualTo("NONE");scopeAction("SUBMIT",manager);UUID first=scope.rounds().getFirst().id();
        String frozen=scopeService.snapshot(manager,projectId,scope.change().id(),first).toString();
        permissions.get(worker.accountId()).remove("WORK_EDIT");
        assertThatThrownBy(()->scopeService.action(approver,projectId,scope.change().id(),new DeliveryScopes.Action(UUID.randomUUID(),scope.change().version(),"APPROVE","权限失效不可批准",null,null))).hasMessageContaining("执行权限");
        assertThat(store.objects.existsById(added)).isFalse();scopeAction("RETURN",approver);permissions.get(worker.accountId()).add("WORK_EDIT");
        scopeAction("SUBMIT",manager);assertThat(scope.rounds()).hasSize(2);scopeAction("APPROVE",approver);
        assertThat(workItems.get(original).sourceRequirementId()).isEqualTo(requirement);
        assertThat(scopeService.snapshot(manager,projectId,scope.change().id(),first).toString()).isEqualTo(frozen);
    }
    @Test void scopeRebaseRequiresExplicitlyDiscardingConflictingEditsAndCapacityCountsWholeCandidate(){
        approvePreparation();createScope();UUID added=completeScope(null);
        var request=new ResourceRequest(added,worker.accountId(),committer.accountId(),start,end,new BigDecimal("4"),"验证·额外并行投入");
        scope=scopeService.saveResource(manager,projectId,scope.change().id(),null,new DeliveryScopes.ResourceSave(UUID.randomUUID(),scope.change().version(),null,request,false,"验证·整组重叠"));
        var resource=scope.draft().resources().getLast().proposed();
        assertThatThrownBy(()->scopeService.signResource(committer,projectId,scope.change().id(),resource.id(),new CommitResource(UUID.randomUUID(),scope.change().version(),resource.version(),"COMMITTED",new Commitment(new BigDecimal("8"),"验证·容量不足",null,null),"验证·签认"))).hasMessageContaining("并行投入");
        scope=scopeService.action(manager,projectId,scope.change().id(),new DeliveryScopes.Action(UUID.randomUUID(),scope.change().version(),"REVERT_RESOURCE","验证·取消额外资源",null,resource.id()));
        current=store.workspace(manager,projectId);var b=object(budgetId);var content=b.content().budget();
        current=preparation.save(manager,projectId,budgetId,new SaveObject(UUID.randomUUID(),current.preparation().version(),b.version(),null,new Content(null,null,null,null,null,
            new Budget(content.mode(),"验证·并发已生效预算",content.authorizedStageIds(),content.authorizedCap(),content.expiresOn(),content.nextCompletionOn(),content.remainingScope(),content.lines())),"验证·直接修订","验证·影响","验证·依据"));
        assertThat(scopeService.detail(manager,projectId,scope.change().id()).change().stale()).isTrue();
        assertThatThrownBy(()->scopeService.action(manager,projectId,scope.change().id(),new DeliveryScopes.Action(UUID.randomUUID(),scope.change().version(),"REBASE","验证·不能覆盖预算",null,null))).hasMessageContaining("并发冲突");
        scope=scopeService.action(manager,projectId,scope.change().id(),new DeliveryScopes.Action(UUID.randomUUID(),scope.change().version(),"REVERT_OBJECT","验证·撤回旧预算差异",budgetId,null));scopeAction("REBASE",manager);
        assertThat(scope.change().stale()).isFalse();assertThat(scope.change().baseBaselineVersion()).isEqualTo(2);
        assertThat(scope.candidate().objects()).anyMatch(o->o.id().equals(added));assertThat(scope.problems()).isNotEmpty();
        scopeAction("CANCEL",manager);assertThat(store.objects.existsById(added)).isFalse();
    }
    private void createScope(){scope=scopeService.create(manager,projectId,new DeliveryScopes.Metadata(UUID.randomUUID(),current.preparation().version(),"验证·补充交付范围","验证·增加人员预算 300 元","验证·范围确认记录",null));}
    private void scopeAction(String action,SessionPrincipal actor){scope=scopeService.action(actor,projectId,scope.change().id(),new DeliveryScopes.Action(UUID.randomUUID(),scope.change().version(),action,"验证·"+action,null,null));}
    private UUID scopeSave(UUID id,Content content,UUID existing){
        var before=new HashSet<>(scope.candidate().objects().stream().map(ObjectFact::id).toList());var o=id==null?null:scope.candidate().objects().stream().filter(x->x.id().equals(id)).findFirst().orElseThrow();
        scope=scopeService.saveObject(manager,projectId,scope.change().id(),id,new SaveObject(UUID.randomUUID(),scope.change().version(),o==null?null:o.version(),existing,content,"验证·补齐拟范围",null,null));
        return id!=null?id:scope.candidate().objects().stream().filter(x->!before.contains(x.id())).findFirst().orElseThrow().id();
    }
    private UUID completeScope(UUID existing){
        UUID wp=scopeSave(null,new Content(null,null,null,new WorkPackage("验证·补充资料包","范围确认","补充资料","资料核验",worker.accountId(),observer.accountId(),stageId,start,end,"部门投入",List.of(),List.of(milestoneId)),null,null),existing);
        UUID item=scopeSave(null,new Content(null,null,new Item("验证·补充资料","DELIVERABLE","规定格式",BigDecimal.ONE,"份","资料核验",stageId,wp,milestoneId,false,null),null,null,null),null);
        scopeSave(wp,new Content(null,null,null,new WorkPackage("验证·补充资料包","范围确认","补充资料","资料核验",worker.accountId(),observer.accountId(),stageId,start,end,"部门投入",List.of(item),List.of(milestoneId)),null,null),null);
        scopeSave(null,new Content(null,null,null,null,new Plan("验证·资料编制计划","WORK_PACKAGE",stageId,wp,start,end,start,end,List.of(),"按部门投入"),null),null);
        scope=scopeService.saveResource(manager,projectId,scope.change().id(),null,new DeliveryScopes.ResourceSave(UUID.randomUUID(),scope.change().version(),null,new ResourceRequest(wp,worker.accountId(),committer.accountId(),start,end,new BigDecimal("4"),"资料编制"),false,"验证·拟投入"));
        var r=scope.draft().resources().getFirst().proposed();scope=scopeService.signResource(committer,projectId,scope.change().id(),r.id(),new CommitResource(UUID.randomUUID(),scope.change().version(),r.version(),"COMMITTED",new Commitment(new BigDecimal("8"),"验证·部门可用投入",null,null),"验证·拟签认"));
        scope=scopeService.detail(manager,projectId,scope.change().id());
        var budget=scope.candidate().objects().stream().filter(o->o.id().equals(budgetId)).findFirst().orElseThrow().content().budget();var lines=new ArrayList<>(budget.lines());
        lines.add(new BudgetLine("验证·补充资料人工","PERSONNEL",new BigDecimal("300"),stageId,wp,r.id(),null,"验证·增量投入"));
        scopeSave(budgetId,new Content(null,null,null,null,null,new Budget("FULL","包括补充资料",List.of(),null,null,null,null,lines)),null);return wp;
    }
    private void approvePreparation(){
        completePreparation();current=reviewService.submit(manager,projectId,new Submit(UUID.randomUUID(),current.preparation().version(),"验证·提交完整基线"));
        UUID round=current.rounds().getFirst().id();current=reviewService.review(reviewer,projectId,round,decision("AGREED","验证·专业会签"));
        current=reviewService.decide(approver,projectId,round,decision("APPROVED","验证·独立批准"));
    }
    private void configureTransferFixtures(){
        permissions.get(manager.accountId()).addAll(List.of("PROJECT_MEMBER_MANAGE","REQUIREMENT_READ"));
        permissions.get(committer.accountId()).addAll(List.of("DG2_EDIT","WORK_EDIT","REQUIREMENT_READ"));
        when(projects.memberRoles(any(),eq(projectId),any())).thenAnswer(i->new com.winh.workplan.project.ProjectDirectory.MemberRoles(i.getArgument(2),1,List.of("PROJECT_CONTRIBUTOR"),false));
        when(work.responsibilityDomain()).thenReturn("WORK");
        when(work.responsibilities(any(),eq(projectId),any(),any())).thenAnswer(i->workItems.values().stream().filter(w->w.ownerId().equals(i.getArgument(2)))
            .sorted(Comparator.comparing(WorkReference::id)).map(w->new com.winh.workplan.project.ProjectResponsibilityContributor.Responsibility("WORK",w.id(),w.version(),w.title(),List.of("处理负责人"))).toList());
        doAnswer(i->{UUID to=i.getArgument(3);for(var w:new ArrayList<>(workItems.values()))if(w.ownerId().equals(i.getArgument(2)))
            workItems.put(w.id(),new WorkReference(w.id(),w.projectId(),w.kind(),w.title(),w.status(),w.approved(),w.version()+1,w.sourceRequirementId(),w.creationSource(),to,w.verifierId(),w.dueDate(),w.deliveryState(),w.deliveryBaselineVersion()));return null;
        }).when(work).transferResponsibilities(any(),eq(projectId),any(),any(),anyList(),anyString());
    }
    private void completePreparation(){
        current=preparation.initialize(manager,projectId,new Initialize(UUID.randomUUID(),new Header(manager.accountId(),worker.accountId(),"SYSTEM_INTEGRATION","MEDIUM","范围已接收","验收已明确","按移交关键日期","无未登记移交遗留")));
        current=preparation.select(manager,projectId,new SelectConfiguration(UUID.randomUUID(),current.preparation().version(),"STAGE_TEMPLATE",templateId,"验证·选择模板"));
        current=preparation.select(manager,projectId,new SelectConfiguration(UUID.randomUUID(),current.preparation().version(),"REVIEW_POLICY",policyId,"验证·选择规则"));
        stageId=current.objects().getFirst().id();var st=object(stageId);
        save(stageId,Content.of(new Stage("DELIVERY","交付实施",true,null,null,worker.accountId(),start,end,List.of(),List.of(),true,List.of("实施复核"),List.of("成果"),"满足验收条件")));
        packageId=save(null,new Content(null,null,null,new WorkPackage("验证工作包","明确范围","实施成果","验收标准",worker.accountId(),observer.accountId(),stageId,start,end,"专业人员计划",List.of(),List.of()),null,null));
        milestoneId=save(null,new Content(null,new Milestone("交付验收","ACCEPTANCE",end,manager.accountId(),stageId,null,"来自已接收 DG-01","成果通过验收"),null,null,null,null));
        itemId=save(null,new Content(null,null,new Item("控制设备","EQUIPMENT","已确认规格",BigDecimal.ONE,"台","整体验收",stageId,packageId,milestoneId,true,"需采购控制设备"),null,null,null));
        save(packageId,new Content(null,null,null,new WorkPackage("验证工作包","明确范围","实施成果","验收标准",worker.accountId(),observer.accountId(),stageId,start,end,"专业人员计划",List.of(itemId),List.of(milestoneId)),null,null));
        save(null,new Content(null,null,null,null,new Plan("主计划","MASTER",stageId,null,start,end,start,end,List.of(),"资源按申请确认"),null));
        save(null,new Content(null,null,null,null,new Plan("工作包计划","WORK_PACKAGE",stageId,packageId,start,end,start,end,List.of(),"资源按申请确认"),null));
        current=resourceService.save(manager,projectId,null,new SaveResource(UUID.randomUUID(),current.preparation().version(),null,new ResourceRequest(packageId,worker.accountId(),committer.accountId(),start,end,new BigDecimal("4"),"实施投入"),"验证·申请资源"));
        resourceId=current.resources().getFirst().id();current=resourceService.commit(committer,projectId,resourceId,commit("COMMITTED",null,null));current=store.workspace(manager,projectId);
        budgetId=save(null,new Content(null,null,null,null,null,new Budget("FULL","完整交付范围",List.of(),null,null,null,null,List.of(
            new BudgetLine("人员投入","PERSONNEL",new BigDecimal("300.00"),stageId,packageId,resourceId,null,"人员投入依据"),
            new BudgetLine("采购设备","PROCUREMENT",new BigDecimal("100.00"),stageId,packageId,null,itemId,"采购估算依据")))));
    }
    private UUID save(UUID id,Content content){
        var before=new HashSet<>(current.objects().stream().map(ObjectFact::id).toList());var previous=id==null?null:object(id);
        current=preparation.save(manager,projectId,id,new SaveObject(UUID.randomUUID(),current.preparation().version(),previous==null?null:previous.version(),null,content,"验证·维护草案",null,null));
        return id!=null?id:current.objects().stream().filter(o->!before.contains(o.id())).findFirst().orElseThrow().id();
    }
    private ObjectFact object(UUID id){return current.objects().stream().filter(o->o.id().equals(id)).findFirst().orElseThrow();}
    private Decision decision(String decision,String comment){var r=current.rounds().getFirst();return new Decision(UUID.randomUUID(),current.preparation().version(),r.version(),decision,comment);}
    private CommitResource commit(String decision,String impact,String escalation){var r=current.resources().stream().filter(x->x.id().equals(resourceId)).findFirst().orElseThrow();
        return new CommitResource(UUID.randomUUID(),current.preparation().version(),r.version(),decision,new Commitment(new BigDecimal("8"),"验证·部门签认",impact,escalation),"验证·签认资源");}
    private SessionPrincipal person(OrganizationUnit organization,String label,Set<String> grants){
        String login="dg2-"+UUID.randomUUID();var a=accounts.saveAndFlush(new UserAccount(login,login,"验证·"+label,null,null,null,organization,"unused-in-service-test",false,false));
        permissions.put(a.getId(),new HashSet<>(grants));return new SessionPrincipal(a.getId(),login,a.getDisplayName(),false,false,UUID.randomUUID());
    }
    private ProjectContext context(SessionPrincipal actor,UUID id,String permission){
        if(!projectId.equals(id))throw BusinessRules.missing();if(!permissions.getOrDefault(actor.accountId(),Set.of()).contains(permission))
            throw new DomainException(HttpStatus.FORBIDDEN,"ACCESS_DENIED","验证·权限不足");
        return new ProjectContext(id,"PRJ-TEST","验证项目",manager.accountId(),manager.accountId(),"ACTIVE",mainStage,
            new ResourceContext(manager.accountId(),organizationId,id,id.toString(),true,true,true,true),UUID.randomUUID(),UUID.randomUUID(),"验证客户");
    }
}
