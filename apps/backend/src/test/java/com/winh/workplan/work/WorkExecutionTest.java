package com.winh.workplan.work;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.winh.workplan.business.*;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.IdempotencyService.IdempotencyReservation;
import com.winh.workplan.project.ProjectDirectory;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WorkExecutionTest {
    final WorkItemRepository repository=mock(WorkItemRepository.class);
    final ProjectDirectory projects=mock(ProjectDirectory.class);
    final BusinessAccess access=mock(BusinessAccess.class);
    final BusinessHistory history=mock(BusinessHistory.class);
    final WorkService service=new WorkService(repository,projects,access,history,mock(org.springframework.context.ApplicationEventPublisher.class),mock(DeliveryTaskProfileRepository.class));
    final SessionPrincipal owner=actor(),verifier=actor(),manager=actor();
    ProjectWorkItem item;
    @BeforeEach void setup(){
        item=new ProjectWorkItem();item.projectId=UUID.randomUUID();item.kind="WORK_PACKAGE";item.creationSource="DELIVERY";
        item.title="验证·原位执行工作包";item.description="实施并提交可验证的成果";
        item.ownerAccountId=owner.accountId();item.verifierAccountId=verifier.accountId();item.createdBy=manager.accountId();
        item.deliveryState="BASELINED";item.deliveryBaselineVersion=3;
        when(repository.findById(item.id)).thenReturn(Optional.of(item));
        var project=mock(ProjectDirectory.ProjectContext.class);
        when(project.authorization()).thenReturn(ResourceContext.empty());when(project.status()).thenReturn("ACTIVE");
        when(projects.requireReadable(any(),eq(item.projectId),anyString())).thenReturn(project);
        when(projects.requireWritable(any(),eq(item.projectId),anyString())).thenReturn(project);
        when(projects.participant(eq(item.projectId),any())).thenReturn(true);
        when(access.allows(any(),anyString(),any())).thenReturn(true);
        when(access.reserve(any(),anyString(),any(),any())).thenReturn(mock(IdempotencyReservation.class));
        when(history.list(any())).thenReturn(List.of());
    }
    @Test void sameApprovedPackageNeedsActualOwnerThenDesignatedIndependentVerifier(){
        var before=service.detail(owner,item.id);
        assertThat(before.creationSource()).isEqualTo("DELIVERY");assertThat(before.sourceRequirementId()).isNull();
        assertThat(before.deliveryBaselineVersion()).isEqualTo(3);assertThat(before.allowedActions()).containsExactly("COMPLETE");
        assertThat(service.detail(manager,item.id).allowedActions()).isEmpty();
        assertThatThrownBy(()->transition(manager,"COMPLETE")).hasMessageContaining("实际负责人");
        assertThat(item.status).isEqualTo("OPEN");
        var pending=transition(owner,"COMPLETE");assertThat(pending.status()).isEqualTo("PENDING_VERIFICATION");
        assertThat(pending.allowedActions()).isEmpty();
        assertThatThrownBy(()->transition(owner,"VERIFY")).hasMessageContaining("指定验证人");
        assertThat(service.detail(verifier,item.id).allowedActions()).containsExactly("VERIFY","RETURN");
        assertThat(transition(verifier,"VERIFY").status()).isEqualTo("DONE");
        assertThat(item.id).isEqualTo(before.id());assertThat(item.deliveryBaselineVersion).isEqualTo(3);
    }
    @Test void frozenAndRetiredPackagesHaveNoExecutionCommandAndOrdinaryTasksRemainAvailable(){
        for(String state:List.of("PREPARING","IN_REVIEW","RETIRED")){
            item.deliveryState=state;assertThat(service.detail(owner,item.id).allowedActions()).isEmpty();
            assertThatThrownBy(()->transition(owner,"COMPLETE")).hasMessageContaining("DG-02");assertThat(item.status).isEqualTo("OPEN");
        }
        item.kind="TASK";item.deliveryState="NOT_REQUIRED";
        assertThat(transition(owner,"COMPLETE").status()).isEqualTo("PENDING_VERIFICATION");
    }
    @Test void submittedExecutionCannotBeRetiredAndRetiredUnfinishedScopeDoesNotPreventMemberRemoval(){
        transition(owner,"COMPLETE");
        assertThatThrownBy(()->service.setDeliveryState(item.projectId,List.of(item.id),"RETIRED",4)).hasMessageContaining("执行结果");
        item.status="OPEN";service.setDeliveryState(item.projectId,List.of(item.id),"RETIRED",4);
        when(repository.findAllByProjectIdOrderByUpdatedAtDesc(item.projectId)).thenReturn(List.of(item));
        assertThatCode(()->service.checkRemoval(new ProjectDirectory.MemberRemovalRequested(item.projectId,owner.accountId()))).doesNotThrowAnyException();
    }
    private WorkService.WorkView transition(SessionPrincipal actor,String action){return service.transition(actor,item.id,new WorkService.Transition(UUID.randomUUID(),item.version,action,"验证·证据与结论"));}
    private static SessionPrincipal actor(){return new SessionPrincipal(UUID.randomUUID(),"test","验证·责任人",false,false,UUID.randomUUID());}
}
