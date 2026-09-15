package com.winh.workplan.work;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.*;
import com.winh.workplan.delivery.baseline.DeliveryContent.*;
import com.winh.workplan.files.FileService;
import com.winh.workplan.files.FileDirectory.VersionReference;
import com.winh.workplan.iam.account.*;
import com.winh.workplan.iam.authorization.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.organization.*;
import com.winh.workplan.project.ProjectService;
import com.winh.workplan.project.ProjectDirectory.ProjectContext;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Real Work/tasks/execution transactions; approved scope and identity grants are explicit synthetic fixtures. */
@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:deliverytasks;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class DeliveryTaskIntegrationTest {
    @Autowired DeliveryTaskStore s;
    @Autowired DeliveryTaskService tasks;
    @Autowired DeliveryTaskQuery query;
    @Autowired DeliveryTaskGuards guards;
    @Autowired WorkService work;
    @Autowired OrganizationUnitRepository organizations;
    @Autowired UserAccountRepository accounts;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ProjectService projects;
    @MockitoBean ApprovedDeliveryDirectory delivery;
    @MockitoBean DefaultAuthorizationService authorization;
    @MockitoBean FileService files;
    final LocalDate today=DeliveryTaskStore.today();
    UUID projectId,parentId,stageId,itemId,orgId;
    SessionPrincipal manager,owner,verifier;
    List<ObjectReference> objects;
    Map<UUID,Set<String>> grants=new HashMap<>();
    String projectStatus;
    @BeforeEach void setup(){
        projectId=UUID.randomUUID();stageId=UUID.randomUUID();itemId=UUID.randomUUID();projectStatus="ACTIVE";grants.clear();
        var org=organizations.saveAndFlush(new OrganizationUnit("验证·任务团队","TK-"+UUID.randomUUID(),OrganizationUnitType.COMPANY,null,null,0,OrganizationUnitStatus.ENABLED));orgId=org.getId();
        manager=person("经理");owner=person("成员");verifier=person("验证人");
        when(authorization.decide(any(),anyString(),any())).thenAnswer(i->{SessionPrincipal a=i.getArgument(0);return new AuthorizationDecision(grants.getOrDefault(a.accountId(),Set.of()).contains(i.getArgument(1)),"TEST",List.of());});
        when(projects.participant(eq(projectId),any())).thenAnswer(i->grants.containsKey(i.getArgument(1)));
        when(projects.requireReadable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
        when(projects.requireWritable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
        var parent=new ProjectWorkItem();parent.projectId=projectId;parent.kind="WORK_PACKAGE";parent.creationSource="DELIVERY";parent.title="验证·集成工作包";parent.description="验证·集成范围";
        parent.ownerAccountId=manager.accountId();parent.verifierAccountId=verifier.accountId();parent.createdBy=manager.accountId();parent.dueDate=today.plusDays(20);parent.deliveryState="BASELINED";parent.deliveryBaselineVersion=1;
        parentId=s.work.saveAndFlush(parent).id;
        objects=new ArrayList<>(List.of(
            new ObjectReference(stageId,0,"STAGE",Content.of(new Stage("INTEGRATION","验证·集成阶段",true,null,null,manager.accountId(),today.minusDays(5),today.plusDays(20),List.of(),List.of(),true,List.of("集成"),List.of("报告"),"独立确认")),false,1),
            new ObjectReference(parentId,0,"WORK_PACKAGE",new Content(null,null,null,new WorkPackage(parent.title,parent.description,"验证·接口报告","验证·原验收标准",manager.accountId(),verifier.accountId(),stageId,today.minusDays(5),today.plusDays(20),"明确资源",List.of(itemId),List.of()),null,null),false,1),
            new ObjectReference(itemId,0,"ITEM",new Content(null,null,new Item("验证·控制柜","EQUIPMENT","A1",new BigDecimal("8"),"台","逐台验收",stageId,parentId,null,true,""),null,null,null),false,1)));
        when(delivery.require(any(),eq(projectId))).thenAnswer(i->new Scope(projectId,manager.accountId(),objects.get(1).baselineVersion(),List.copyOf(objects)));
        jdbc.update("INSERT INTO execution_stage(id,version,created_at,updated_at,project_id,stage_id,status,progress,started_on,scope_hash,object_version,baseline_version) VALUES (?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?,'IN_PROGRESS',0,?,'fixture',0,1)",UUID.randomUUID(),projectId,stageId,today.minusDays(3));
    }
    private SessionPrincipal person(String label){
        var org=organizations.findById(orgId).orElseThrow();String login="task-"+UUID.randomUUID();var a=accounts.saveAndFlush(new UserAccount(login,login,"验证·"+label,null,null,null,org,"unused-test",false,false));
        grants.put(a.getId(),new HashSet<>(Set.of("WORK_READ","WORK_EDIT","WORK_REVIEW","DG2_READ","DELIVERY_EXECUTION_READ")));
        return new SessionPrincipal(a.getId(),login,a.getDisplayName(),false,false,UUID.randomUUID());
    }
    private ProjectContext context(SessionPrincipal actor,UUID id,String permission){
        if(!projectId.equals(id)||!grants.getOrDefault(actor.accountId(),Set.of()).contains(permission))throw BusinessRules.missing();
        if("CLOSED".equals(projectStatus)&&!permission.endsWith("READ"))throw BusinessRules.conflict("项目已关闭");
        return new ProjectContext(projectId,"TASK-TEST","验证·任务项目",manager.accountId(),manager.accountId(),projectStatus,"DELIVERY",new ResourceContext(manager.accountId(),orgId,projectId,projectId.toString(),true,true,true,true),UUID.randomUUID(),UUID.randomUUID(),"验证客户");
    }
    private DeliveryTaskCommands.Plan plan(UUID existing,Long source,Long version,Long workVersion){
        return new DeliveryTaskCommands.Plan(UUID.randomUUID(),objects.get(1).version(),existing,source,version,workVersion,"验证·接口核对","验证·核对本包控制柜接口和点表","验证·逐项核对并独立确认",
            owner.accountId(),verifier.accountId(),today,today.plusDays(2),new BigDecimal("1.5"),List.of(itemId),"验证·明确本包任务安排");
    }
    private UUID create(){return tasks.create(manager,projectId,parentId,plan(null,null,null,null));}
    private DeliveryTaskViews.Detail detail(UUID id){return query.detail(manager,projectId,id);}
    private DeliveryTaskCommands.Action action(UUID id,String action,String note,List<UUID> files){var t=detail(id).task();return new DeliveryTaskCommands.Action(UUID.randomUUID(),t.version(),t.workVersion(),action,note,today,65,files);}
    private void act(SessionPrincipal actor,UUID id,String action){tasks.act(actor,projectId,id,action(id,action,"验证·"+action+"依据",List.of()));}

    @Test void createsAndAdoptsOriginalTasksWithoutChangingSourceIdentityOrDuplicatingReplays(){
        var input=plan(null,null,null,null);var id=tasks.create(manager,projectId,parentId,input);assertThat(tasks.create(manager,projectId,parentId,input)).isEqualTo(id);
        assertThat(query.workspace(manager,projectId,parentId).tasks()).hasSize(1);
        assertThat(work.detail(manager,id).taskWorkPackageId()).isEqualTo(parentId);assertThat(work.detail(manager,id).sourceRequirementId()).isNull();
        UUID requirement=UUID.randomUUID();var source=work.create(manager,projectId,requirement,"TASK","验证·原需求任务","验证·原始描述",owner.accountId(),verifier.accountId(),today.plusDays(1));
        var adopt=plan(source.id(),source.version(),null,null);assertThat(tasks.create(manager,projectId,parentId,adopt)).isEqualTo(source.id());
        var adopted=work.detail(manager,source.id());assertThat(adopted.creationSource()).isEqualTo("REQUIREMENT");assertThat(adopted.sourceRequirementId()).isEqualTo(requirement);
        assertThat(detail(source.id()).history().getFirst().before().json()).contains("验证·原始描述");
        assertThatThrownBy(()->tasks.create(manager,projectId,parentId,plan(source.id(),adopted.version(),null,null))).hasMessageContaining("接纳");
        assertThatThrownBy(()->query.detail(manager,UUID.randomUUID(),id)).isInstanceOf(com.winh.workplan.iam.shared.DomainException.class);
        assertThatThrownBy(()->tasks.create(owner,projectId,parentId,plan(null,null,null,null))).hasMessageContaining("工作包负责人");
    }
    @Test void requiresIndependentResultsAndRetainsBothFileRoundsWithCurrentVisibility(){
        var id=create();var first=UUID.randomUUID();var second=UUID.randomUUID();var doc=UUID.randomUUID();
        when(files.reference(any(),eq(projectId),eq(first))).thenReturn(new VersionReference(doc,first,projectId,"验证·接口报告","report.pdf",1,"INTERNAL","PUBLISHED",false,10,"hash"));
        when(files.reference(any(),eq(projectId),eq(second))).thenReturn(new VersionReference(doc,second,projectId,"验证·接口报告","report.pdf",2,"INTERNAL","PUBLISHED",true,12,"hash2"));
        act(owner,id,"PROGRESS");var command=action(id,"COMPLETE","验证·第一轮成果",List.of(first));tasks.act(owner,projectId,id,command);tasks.act(owner,projectId,id,command);
        assertThat(detail(id).history()).hasSize(3);assertThat(detail(id).task().progress()).isEqualTo(100);assertThat(detail(id).task().status()).isEqualTo("PENDING_VERIFICATION");
        assertThatThrownBy(()->act(owner,id,"VERIFY")).hasMessageContaining("其他验证人");
        assertThatThrownBy(()->work.transition(owner,id,new WorkService.Transition(UUID.randomUUID(),detail(id).task().workVersion(),"VERIFY","验证·绕过新入口"))).hasMessageContaining("任务执行入口");
        assertThat(work.detail(manager,parentId).allowedActions()).doesNotContain("COMPLETE");
        assertThatThrownBy(()->work.transition(manager,parentId,new WorkService.Transition(UUID.randomUUID(),work.detail(manager,parentId).version(),"COMPLETE","验证·父包不得提前完成"))).hasMessageContaining("未完成或需复核");
        act(verifier,id,"RETURN");tasks.act(owner,projectId,id,action(id,"COMPLETE","验证·第二轮成果",List.of(second)));act(verifier,id,"VERIFY");
        assertThat(detail(id).task().status()).isEqualTo("DONE");assertThat(work.detail(manager,parentId).status()).isEqualTo("OPEN");
        assertThat(work.detail(manager,parentId).allowedActions()).contains("COMPLETE");
        var old=detail(id).history().stream().filter(e->"验证·第一轮成果".equals(e.note())).findFirst().orElseThrow();assertThat(old.after().files().files()).extracting(VersionReference::versionId).containsExactly(first);
        when(files.reference(eq(manager),eq(projectId),eq(first))).thenThrow(BusinessRules.missing());
        var hidden=detail(id).history().stream().filter(e->e.id().equals(old.id())).findFirst().orElseThrow();
        assertThat(hidden.after().files().restricted()).isEqualTo(1);assertThat(hidden.after().json()).doesNotContain(first.toString());assertThat(s.events.findById(old.id()).orElseThrow().afterJson).contains(first.toString());
    }
    @Test void validatesDaysDatesVersionsAndStageStateWithoutLeavingFailedEvents(){
        var id=create();var input=plan(null,null,detail(id).task().version(),detail(id).task().workVersion());
        var bad=new DeliveryTaskCommands.Plan(input.requestId(),input.parentVersion(),null,null,input.version(),input.workVersion(),input.title(),input.description(),input.acceptanceCriteria(),input.ownerId(),input.verifierId(),input.startsOn(),input.dueDate(),new BigDecimal("0.25"),input.itemIds(),input.reason());
        assertThatThrownBy(()->tasks.edit(manager,projectId,id,bad)).hasMessageContaining("0.5");
        var t=detail(id).task();var early=new DeliveryTaskCommands.Action(UUID.randomUUID(),t.version(),t.workVersion(),"PROGRESS","验证·日期不合法",today.minusDays(4),50,List.of());
        assertThatThrownBy(()->tasks.act(owner,projectId,id,early)).hasMessageContaining("阶段实际开始");
        var future=new DeliveryTaskCommands.Action(UUID.randomUUID(),t.version(),t.workVersion(),"PROGRESS","验证·未来日期",today.plusDays(1),50,List.of());assertThatThrownBy(()->tasks.act(owner,projectId,id,future)).hasMessageContaining("今天");
        var stale=action(id,"PROGRESS","验证·陈旧表单",List.of());act(owner,id,"PROGRESS");assertThatThrownBy(()->tasks.act(owner,projectId,id,stale)).hasMessageContaining("记录已被更新");
        projectStatus="PAUSED";assertThatThrownBy(()->act(owner,id,"COMPLETE")).hasMessageContaining("恢复项目");projectStatus="ACTIVE";
        jdbc.update("UPDATE execution_stage SET status='PAUSED' WHERE stage_id=?",stageId);assertThatThrownBy(()->act(owner,id,"PROGRESS")).hasMessageContaining("原阶段");
        assertThat(detail(id).history()).hasSize(2);assertThat(detail(id).task().progress()).isEqualTo(65);
    }
    @Test void changedScopeNeedsExplicitReviewWhileOldCompletionRemainsAndParentCompletionBlocksFurtherEdits(){
        var id=create();act(owner,id,"COMPLETE");act(verifier,id,"VERIFY");
        var old=objects.get(1);var p=old.content().workPackage();
        objects.set(1,new ObjectReference(parentId,1,"WORK_PACKAGE",new Content(null,null,null,new WorkPackage(p.title(),p.scope(),p.deliverables(),"验证·新增逐项验证要求",p.ownerId(),p.verifierId(),p.stageId(),p.startsOn(),p.endsOn(),p.resourceNotes(),p.itemIds(),p.milestoneIds()),null,null),false,2));
        assertThat(detail(id).task().needsReview()).isTrue();assertThat(detail(id).task().status()).isEqualTo("DONE");assertThat(detail(id).task().actualCompletedOn()).isEqualTo(today);
        assertThat(work.require(manager,projectId,id).status()).isEqualTo("NEEDS_REVIEW");
        assertThat(work.detail(manager,parentId).allowedActions()).doesNotContain("COMPLETE");
        act(manager,id,"REOPEN");assertThat(detail(id).task().needsReview()).isTrue();
        var t=detail(id).task();tasks.edit(manager,projectId,id,plan(null,null,t.version(),t.workVersion()));assertThat(detail(id).task().needsReview()).isFalse();
        act(owner,id,"COMPLETE");act(verifier,id,"VERIFY");
        work.transition(manager,parentId,new WorkService.Transition(UUID.randomUUID(),work.detail(manager,parentId).version(),"COMPLETE","验证·原包独立提交"));
        assertThatThrownBy(()->act(manager,id,"REOPEN")).hasMessageContaining("原工作包");assertThatThrownBy(()->create()).hasMessageContaining("原工作包");
        assertThat(detail(id).history().stream().filter(e->"VERIFY".equals(e.action()))).hasSize(2);
    }
    @Test void cancellationHandoffRevocationAndBaselineGuardsKeepOwnershipAndHistory(){
        var id=create();act(owner,id,"COMPLETE");var next=person("接任验证人");
        assertThatThrownBy(()->work.checkRemoval(new com.winh.workplan.project.ProjectDirectory.MemberRemovalRequested(projectId,verifier.accountId()))).hasMessageContaining("交接");
        assertThatThrownBy(()->work.responsibilities(manager,projectId,verifier.accountId(),owner.accountId())).hasMessageContaining("不独立");
        var preview=work.responsibilities(manager,projectId,verifier.accountId(),next.accountId());
        grants.get(next.accountId()).remove("WORK_REVIEW");assertThatThrownBy(()->work.validateRecipient(projectId,next.accountId(),preview)).isInstanceOf(com.winh.workplan.iam.shared.DomainException.class);grants.get(next.accountId()).add("WORK_REVIEW");
        work.validateRecipient(projectId,next.accountId(),preview);work.transferResponsibilities(manager,projectId,verifier.accountId(),next.accountId(),preview,"验证·正式交接核验职责");
        assertThat(detail(id).submittedBy()).isEqualTo(owner.accountId());assertThat(detail(id).task().verifierId()).isEqualTo(next.accountId());
        assertThat(detail(id).history().getFirst().before().json()).contains(verifier.accountId().toString());
        assertThatThrownBy(()->act(verifier,id,"VERIFY")).hasMessageContaining("其他验证人");
        grants.get(next.accountId()).remove("WORK_REVIEW");assertThatThrownBy(()->act(next,id,"VERIFY")).isInstanceOf(com.winh.workplan.iam.shared.DomainException.class);grants.get(next.accountId()).add("WORK_REVIEW");
        act(next,id,"RETURN");act(manager,id,"CANCEL");assertThat(work.responsibilities(manager,projectId,owner.accountId(),manager.accountId())).isEmpty();
        var archived=new ObjectReference(parentId,1,"WORK_PACKAGE",objects.get(1).content(),true,2);guards.baseline(new BaselineApplied(projectId,List.of(archived),2,manager.accountId()));
        act(manager,id,"REOPEN");assertThatThrownBy(()->guards.baseline(new BaselineApplied(projectId,List.of(archived),2,manager.accountId()))).hasMessageContaining("未取消");
    }
    @Test void rejectsFractionalProgressInvalidFileAndStalePendingApprovalAndCanReadRetiredHistory() throws Exception {
        assertThatThrownBy(()->s.mapper.readValue("{\"progress\":1.5}",DeliveryTaskCommands.Action.class)).hasMessageContaining("整数");
        var id=create();UUID unavailable=UUID.randomUUID();when(files.requirePublished(eq(owner),eq(projectId),eq(unavailable),isNull())).thenThrow(BusinessRules.conflict("验证·文件版本已失效"));
        assertThatThrownBy(()->tasks.act(owner,projectId,id,action(id,"COMPLETE","验证·无效资料",List.of(unavailable)))).hasMessageContaining("文件版本已失效");
        assertThat(detail(id).history()).hasSize(1);assertThat(detail(id).task().actualStartedOn()).isNull();
        act(owner,id,"COMPLETE");var old=objects.get(2);var item=old.content().item();
        objects.set(2,new ObjectReference(itemId,1,"ITEM",new Content(null,null,new Item(item.title(),item.category(),"A2",item.quantity(),item.unit(),"验证·新清单验收",stageId,parentId,null,true,""),null,null,null),false,2));
        assertThat(query.detail(verifier,projectId,id).task().allowedActions()).containsExactly("RETURN");
        assertThatThrownBy(()->act(verifier,id,"VERIFY")).hasMessageContaining("父范围已变化");
        act(verifier,id,"RETURN");act(manager,id,"CANCEL");
        objects.set(0,new ObjectReference(stageId,1,"STAGE",objects.getFirst().content(),true,2));
        objects.set(1,new ObjectReference(parentId,1,"WORK_PACKAGE",objects.get(1).content(),true,2));
        assertThat(detail(id).stage().status()).isEqualTo("RETIRED");assertThat(detail(id).history()).hasSize(4);assertThat(detail(id).task().allowedActions()).isEmpty();
    }
}
