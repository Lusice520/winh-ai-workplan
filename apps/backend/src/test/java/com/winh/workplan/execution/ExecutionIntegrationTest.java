package com.winh.workplan.execution;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.*;
import com.winh.workplan.delivery.baseline.DeliveryContent.*;
import com.winh.workplan.files.FileService;
import com.winh.workplan.iam.account.*;
import com.winh.workplan.iam.authorization.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.organization.*;
import com.winh.workplan.project.ProjectService;
import com.winh.workplan.project.ProjectDirectory.ProjectContext;
import com.winh.workplan.work.WorkService;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Real execution transactions, audit, quantities and idempotency; source scope/IAM are explicit fixtures. */
@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:execution;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class ExecutionIntegrationTest {
    @Autowired ExecutionStore s;
    @Autowired StageExecutionService stages;
    @Autowired ItemExecutionService items;
    @Autowired MilestoneExecutionService milestones;
    @Autowired ExecutionQueryService query;
    @Autowired ExecutionGuards guards;
    @Autowired ExecutionResponsibilities responsibilities;
    @Autowired OrganizationUnitRepository organizations;
    @Autowired UserAccountRepository accounts;
    @MockitoBean ProjectService projects;
    @MockitoBean WorkService work;
    @MockitoBean ApprovedDeliveryDirectory delivery;
    @MockitoBean DefaultAuthorizationService authorization;
    @MockitoBean FileService files;
    final LocalDate today=ExecutionRules.today();
    UUID projectId,stageId,itemId,milestoneId,workId,orgId;
    SessionPrincipal manager,owner,verifier;
    List<ObjectReference> objects;
    Map<UUID,Set<String>> grants=new HashMap<>();
    String projectStatus;
    @BeforeEach void setup(){
        projectId=UUID.randomUUID();stageId=UUID.randomUUID();itemId=UUID.randomUUID();milestoneId=UUID.randomUUID();workId=UUID.randomUUID();projectStatus="ACTIVE";grants.clear();
        var org=organizations.saveAndFlush(new OrganizationUnit("验证·执行团队","EX-"+UUID.randomUUID(),OrganizationUnitType.COMPANY,null,null,0,OrganizationUnitStatus.ENABLED));orgId=org.getId();
        manager=person(org,"经理");owner=person(org,"负责人");verifier=person(org,"验证人");
        when(authorization.decide(any(),anyString(),any())).thenAnswer(i->{SessionPrincipal a=i.getArgument(0);return new AuthorizationDecision(grants.getOrDefault(a.accountId(),Set.of()).contains(i.getArgument(1)),"TEST",List.of());});
        when(projects.participant(eq(projectId),any())).thenAnswer(i->grants.containsKey(i.getArgument(1)));
        when(projects.requireReadable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
        when(projects.requireWritable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
        objects=new ArrayList<>(List.of(
            ref(stageId,"STAGE",Content.of(new Stage("SITE","现场实施",true,null,null,owner.accountId(),today.minusDays(8),today.plusDays(2),List.of(),List.of(),true,List.of("复核"),List.of("安装报告"),"全部独立验收"))),
            ref(workId,"WORK_PACKAGE",new Content(null,null,null,new WorkPackage("安装包","6 台设备","安装报告","独立核验",owner.accountId(),verifier.accountId(),stageId,today.minusDays(8),today.plusDays(2),"",List.of(itemId),List.of(milestoneId)),null,null)),
            ref(itemId,"ITEM",new Content(null,null,new Item("控制柜","EQUIPMENT","A1",new BigDecimal("6"),"台","逐台验收",stageId,workId,milestoneId,true,""),null,null,null)),
            ref(milestoneId,"MILESTONE",new Content(null,new Milestone("设备验收","ACCEPTANCE",today,owner.accountId(),stageId,null,"批准范围","逐台独立核验"),null,null,null,null))));
        when(delivery.require(any(),eq(projectId))).thenAnswer(i->new Scope(projectId,manager.accountId(),1,List.copyOf(objects)));
        when(work.completedPackageIds(projectId)).thenReturn(Set.of(workId));
    }
    private SessionPrincipal person(OrganizationUnit org,String label){
        String login="execution-"+UUID.randomUUID();var account=accounts.saveAndFlush(new UserAccount(login,login,"验证·"+label,null,null,null,org,"unused-test",false,false));
        grants.put(account.getId(),new HashSet<>(Set.of("DG2_READ","DELIVERY_EXECUTION_READ","DELIVERY_EXECUTION_EDIT","DELIVERY_EXECUTION_REVIEW","DELIVERY_EXECUTION_MANAGE")));
        return new SessionPrincipal(account.getId(),login,account.getDisplayName(),false,false,UUID.randomUUID());
    }
    private ProjectContext context(SessionPrincipal actor,UUID id,String permission){
        if(!projectId.equals(id)||!grants.getOrDefault(actor.accountId(),Set.of()).contains(permission))throw BusinessRules.missing();
        return new ProjectContext(projectId,"EX-TEST","验证·执行项目",manager.accountId(),manager.accountId(),projectStatus,"DELIVERY",new ResourceContext(manager.accountId(),orgId,projectId,projectId.toString(),true,true,true,true),UUID.randomUUID(),UUID.randomUUID(),"验证客户");
    }
    private ObjectReference ref(UUID id,String kind,Content content){return new ObjectReference(id,0,kind,content,false,1);}
    private void start(){stages.transition(manager,projectId,stageId,new ExecutionCommands.StageCommand(UUID.randomUUID(),-1L,0L,"START",today.minusDays(5),"验证·开始实施",null));
        items.profile(manager,projectId,itemId,new ExecutionCommands.ProfileCommand(UUID.randomUUID(),-1L,0L,true,true,"验证品牌","A1","验证供应商","验证·明确到货安装"));}
    @Test void partialQuantitiesIndependentMilestoneAndStageCompletionStaySeparate(){
        start();record("RECEIVED","4",today.minusDays(4));record("RECEIVED","2",today.minusDays(3));record("INSTALLED","4",today.minusDays(2));
        var accepted=record("ACCEPTED","2",today.minusDays(1));decision(accepted,"VERIFY");var pending=record("ACCEPTED","1",today);
        assertThat(detail().item().totals().accepted()).isEqualByComparingTo("2");assertThat(detail().item().totals().pending()).isEqualByComparingTo("1");
        int before=detail().events().size();assertThatThrownBy(()->record("ACCEPTED","2",today)).hasMessageContaining("数量");assertThat(detail().events()).hasSize(before);
        decision(pending,"RETURN");var next=record("ACCEPTED","2",today);decision(next,"VERIFY");
        assertThatThrownBy(()->milestones.submit(owner,projectId,milestoneId,new ExecutionCommands.MilestoneCommand(UUID.randomUUID(),-1L,0L,today,"验证·申请完成",List.of(),verifier.accountId()))).hasMessageContaining("未全部验收");
        record("INSTALLED","2",today);decision(record("ACCEPTED","2",today),"VERIFY");
        var command=new ExecutionCommands.MilestoneCommand(UUID.randomUUID(),-1L,0L,today,"验证·逐台通过",List.of(),verifier.accountId());
        milestones.submit(owner,projectId,milestoneId,command);milestones.submit(owner,projectId,milestoneId,command);
        var milestone=query.workspace(verifier,projectId).milestones().getFirst();
        assertThatThrownBy(()->milestones.decide(owner,projectId,milestoneId,new ExecutionCommands.Decision(UUID.randomUUID(),milestone.version(),0L,"VERIFY","验证·自己核验"))).hasMessageContaining("指定");
        milestones.decide(verifier,projectId,milestoneId,new ExecutionCommands.Decision(UUID.randomUUID(),milestone.version(),0L,"VERIFY","验证·独立通过"));
        var stage=query.workspace(manager,projectId).stages().getFirst();
        assertThatThrownBy(()->stages.transition(owner,projectId,stageId,new ExecutionCommands.StageCommand(UUID.randomUUID(),stage.version(),0L,"COMPLETE",today,"验证·完成",null))).hasMessageContaining("项目经理");
        stages.transition(manager,projectId,stageId,new ExecutionCommands.StageCommand(UUID.randomUUID(),stage.version(),0L,"COMPLETE",today,"验证·阶段条件全部满足",null));
        assertThat(query.workspace(owner,projectId).stages().getFirst().status()).isEqualTo("COMPLETED");
        assertThat(detail().item().totals().accepted()).isEqualByComparingTo("6");
        assertThatThrownBy(()->decision(accepted,"REVERSE")).hasMessageContaining("重开");
        var source=objects.get(2).content().item();
        objects.set(2,new ObjectReference(itemId,1,"ITEM",new Content(null,null,new Item(source.title(),source.category(),"A2",source.quantity(),source.unit(),"追加现场复核",stageId,workId,milestoneId,true,""),null,null,null),false,2));
        var changed=query.workspace(manager,projectId);
        assertThat(changed.milestones().getFirst().status()).isEqualTo("NEEDS_REVIEW");
        assertThat(changed.stages().getFirst().status()).isEqualTo("NEEDS_REVIEW");
        assertThat(changed.stages().getFirst().completedOn()).isEqualTo(today);
        verify(work,never()).setDeliveryState(any(),any(),any(),anyInt());
    }
    @Test void milestoneRoundsRetainExactFilesAndApplyCurrentVisibilityToHistory(){
        start();record("RECEIVED","6",today);record("INSTALLED","6",today);decision(record("ACCEPTED","6",today),"VERIFY");
        UUID first=UUID.randomUUID(),second=UUID.randomUUID(),document=UUID.randomUUID();
        when(files.reference(any(),eq(projectId),eq(first))).thenReturn(new com.winh.workplan.files.FileDirectory.VersionReference(document,first,projectId,"验证·原始报告","report.pdf",1,"DELIVERABLE","PUBLISHED",false,0,"test"));
        when(files.reference(any(),eq(projectId),eq(second))).thenReturn(new com.winh.workplan.files.FileDirectory.VersionReference(document,second,projectId,"验证·补充报告","report.pdf",2,"DELIVERABLE","PUBLISHED",true,0,"test"));
        milestones.submit(owner,projectId,milestoneId,new ExecutionCommands.MilestoneCommand(UUID.randomUUID(),-1L,0L,today,"验证·第一轮",List.of(first),verifier.accountId()));
        var submitted=query.workspace(verifier,projectId).milestones().getFirst();
        milestones.decide(verifier,projectId,milestoneId,new ExecutionCommands.Decision(UUID.randomUUID(),submitted.version(),0L,"RETURN","验证·补充依据"));
        var returned=query.workspace(owner,projectId).milestones().getFirst();
        milestones.submit(owner,projectId,milestoneId,new ExecutionCommands.MilestoneCommand(UUID.randomUUID(),returned.version(),0L,today,"验证·第二轮",List.of(second),verifier.accountId()));
        var firstHistory=query.history(owner,projectId,milestoneId).stream().filter(e->"验证·第一轮".equals(e.note())).findFirst().orElseThrow();
        assertThat(firstHistory.afterFiles().files()).extracting(f->f.versionId()).containsExactly(first);
        assertThat(query.workspace(owner,projectId).milestones().getFirst().files()).extracting(f->f.versionId()).containsExactly(second);
        when(files.reference(eq(owner),eq(projectId),eq(first))).thenThrow(BusinessRules.missing());
        var restricted=query.history(owner,projectId,milestoneId).stream().filter(e->e.id().equals(firstHistory.id())).findFirst().orElseThrow();
        assertThat(restricted.afterFiles().files()).isEmpty();assertThat(restricted.afterFiles().restricted()).isEqualTo(1);
        assertThat(restricted.afterJson()).doesNotContain(first.toString(),"原始报告");
        assertThat(s.events.findById(firstHistory.id()).orElseThrow().afterJson).contains(first.toString());
    }
    @Test void chronologyAndReversePreserveOriginalFactsAndRollbackRejectedWrites(){
        start();var received=record("RECEIVED","6",today.minusDays(3));
        assertThatThrownBy(()->record("INSTALLED","2",today.minusDays(4))).hasMessageContaining("数量顺序");
        var installed=record("INSTALLED","4",today.minusDays(2));var accepted=record("ACCEPTED","2",today.minusDays(1));decision(accepted,"VERIFY");
        var original=detail();var receipt=original.events().stream().filter(e->e.id().equals(received)).findFirst().orElseThrow();
        assertThatThrownBy(()->items.decide(owner,projectId,received,new ExecutionCommands.Decision(UUID.randomUUID(),receipt.version(),0L,"REVERSE","验证·更正到货"))).hasMessageContaining("数量");
        assertThat(detail().events()).hasSameSizeAs(original.events());assertThat(detail().item().totals().received()).isEqualByComparingTo("6");
        decision(accepted,"REVERSE");
        var installation=detail().events().stream().filter(e->e.id().equals(installed)).findFirst().orElseThrow();
        var input=new ExecutionCommands.Decision(UUID.randomUUID(),installation.version(),0L,"REVERSE","验证·错误安装记录冲回");
        items.decide(owner,projectId,installed,input);items.decide(owner,projectId,installed,input);
        assertThat(detail().item().totals().installed()).isEqualByComparingTo("0");
        assertThat(detail().events().stream().filter(e->installed.equals(e.reversalOfId()))).hasSize(1);
        assertThat(detail().events().stream().filter(e->e.id().equals(installed)).findFirst().orElseThrow().quantity()).isEqualByComparingTo("4");
    }
    @Test void rangeChangePreservesOldAcceptanceAndRequiresExplicitRevalidation(){
        start();record("RECEIVED","6",today.minusDays(3));record("INSTALLED","6",today.minusDays(2));
        var accepted=record("ACCEPTED","2",today.minusDays(1));decision(accepted,"VERIFY");var pending=record("ACCEPTED","1",today);
        var old=objects.get(2);var source=old.content().item();
        var smaller=new Item(source.title(),source.category(),source.specification(),new BigDecimal("5"),source.unit(),source.acceptanceScope(),stageId,workId,milestoneId,true,"");
        var change=new ObjectReference(itemId,1,"ITEM",new Content(null,null,smaller,null,null,null),false,2);
        assertThatThrownBy(()->guards.afterBaseline(new BaselineApplied(projectId,List.of(change),2,manager.accountId()))).hasMessageContaining("数量");
        var modified=new Item(source.title(),source.category(),"A2",source.quantity(),source.unit(),"追加调试复核",stageId,workId,milestoneId,true,"");
        objects.set(2,new ObjectReference(itemId,1,"ITEM",new Content(null,null,modified,null,null,null),false,2));
        assertThat(detail().item().totals().accepted()).isEqualByComparingTo("0");assertThat(detail().item().totals().needsReview()).isEqualByComparingTo("2");
        var pendingRow=query.itemDetail(verifier,projectId,itemId).events().stream().filter(e->e.id().equals(pending)).findFirst().orElseThrow();
        assertThat(pendingRow.allowedActions()).containsExactly("RETURN");
        assertThatThrownBy(()->items.decide(verifier,projectId,pending,new ExecutionCommands.Decision(UUID.randomUUID(),pendingRow.version(),1L,"VERIFY","验证·试图沿用旧标准"))).hasMessageContaining("范围已变化");
        assertThat(detail().events().stream().filter(e->e.id().equals(accepted)).findFirst().orElseThrow().baselineVersion()).isEqualTo(1);
    }
    @Test void actualPermissionsPauseAndSourceFilesAreCheckedAtCommandTime(){
        start();projectStatus="PAUSED";assertThatThrownBy(()->record("RECEIVED","1",today)).hasMessageContaining("恢复项目");projectStatus="ACTIVE";
        var stage=query.workspace(manager,projectId).stages().getFirst();
        stages.transition(manager,projectId,stageId,new ExecutionCommands.StageCommand(UUID.randomUUID(),stage.version(),0L,"PAUSE",today,"验证·暂停现场",null));
        assertThatThrownBy(()->record("RECEIVED","1",today)).hasMessageContaining("阶段");
        assertThatThrownBy(()->query.workspace(owner,UUID.randomUUID())).isInstanceOf(com.winh.workplan.iam.shared.DomainException.class);
        var paused=query.workspace(manager,projectId).stages().getFirst();stages.transition(manager,projectId,stageId,new ExecutionCommands.StageCommand(UUID.randomUUID(),paused.version(),0L,"RESUME",today,"验证·恢复现场",null));
        record("RECEIVED","2",today);record("INSTALLED","2",today);var acceptance=record("ACCEPTED","1",today);
        grants.get(verifier.accountId()).remove("DELIVERY_EXECUTION_REVIEW");assertThatThrownBy(()->decision(acceptance,"VERIFY")).isInstanceOf(com.winh.workplan.iam.shared.DomainException.class);
        assertThat(detail().item().totals().pending()).isEqualByComparingTo("1");
        UUID file=UUID.randomUUID();when(files.requirePublished(eq(owner),eq(projectId),eq(file),isNull())).thenThrow(BusinessRules.conflict("资料版本已失效"));
        assertThatThrownBy(()->items.record(owner,projectId,itemId,new ExecutionCommands.ItemCommand(UUID.randomUUID(),detail().item().profile().version(),0L,"RECEIVED",BigDecimal.ONE,today,"验证·关联资料",List.of(file),null))).hasMessageContaining("版本已失效");
    }
    @Test void pendingVerificationHandoffPreservesSubmitterAndRequiresEffectiveIndependentRecipient(){
        start();record("RECEIVED","2",today);record("INSTALLED","2",today);var pending=record("ACCEPTED","1",today);
        assertThatThrownBy(()->responsibilities.beforeRemoval(new com.winh.workplan.project.ProjectDirectory.MemberRemovalRequested(projectId,verifier.accountId()))).hasMessageContaining("交接");
        assertThatThrownBy(()->responsibilities.responsibilities(manager,projectId,verifier.accountId(),owner.accountId())).hasMessageContaining("接任人");
        var recipient=person(organizations.findById(orgId).orElseThrow(),"接任验证人");
        var preview=responsibilities.responsibilities(manager,projectId,verifier.accountId(),recipient.accountId());
        assertThat(preview).hasSize(1);
        grants.get(recipient.accountId()).remove("DELIVERY_EXECUTION_REVIEW");
        assertThatThrownBy(()->responsibilities.validateRecipient(projectId,recipient.accountId(),preview)).isInstanceOf(com.winh.workplan.iam.shared.DomainException.class);
        grants.get(recipient.accountId()).add("DELIVERY_EXECUTION_REVIEW");
        responsibilities.validateRecipient(projectId,recipient.accountId(),preview);
        responsibilities.transferResponsibilities(manager,projectId,verifier.accountId(),recipient.accountId(),preview,"验证·指定核验职责正式交接");
        var row=query.itemDetail(recipient,projectId,itemId).events().stream().filter(e->e.id().equals(pending)).findFirst().orElseThrow();
        assertThat(row.submittedBy()).isEqualTo(owner.accountId());assertThat(row.verifierId()).isEqualTo(recipient.accountId());
        assertThat(row.allowedActions()).contains("VERIFY");assertThat(query.workspace(verifier,projectId).reviewQueue()).isEmpty();
        assertThatThrownBy(()->responsibilities.transferResponsibilities(manager,projectId,verifier.accountId(),recipient.accountId(),preview,"验证·陈旧交接不得重复" )).hasMessageContaining("重新预览");
        responsibilities.beforeRemoval(new com.winh.workplan.project.ProjectDirectory.MemberRemovalRequested(projectId,verifier.accountId()));
        items.decide(recipient,projectId,pending,new ExecutionCommands.Decision(UUID.randomUUID(),row.version(),0L,"VERIFY","验证·接任后独立核验"));
        assertThat(detail().item().totals().accepted()).isEqualByComparingTo("1");
    }
    private ExecutionViews.ItemDetail detail(){return query.itemDetail(owner,projectId,itemId);}
    private UUID record(String kind,String qty,LocalDate on){return items.record(owner,projectId,itemId,new ExecutionCommands.ItemCommand(UUID.randomUUID(),detail().item().profile().version(),0L,kind,new BigDecimal(qty),on,"验证·实际证据",List.of(),"ACCEPTED".equals(kind)?verifier.accountId():null));}
    private void decision(UUID id,String action){var row=detail().events().stream().filter(e->e.id().equals(id)).findFirst().orElseThrow();items.decide(verifier,projectId,id,new ExecutionCommands.Decision(UUID.randomUUID(),row.version(),0L,action,"验证·独立核验说明"));}
}
