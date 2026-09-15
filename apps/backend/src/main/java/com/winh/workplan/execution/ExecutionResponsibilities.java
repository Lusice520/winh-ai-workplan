package com.winh.workplan.execution;
import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.project.ProjectDirectory;
import com.winh.workplan.project.ProjectResponsibilityContributor;
import java.util.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class ExecutionResponsibilities implements ProjectResponsibilityContributor {
    private final ExecutionStore s;
    ExecutionResponsibilities(ExecutionStore s){this.s=s;}
    @Override public String responsibilityDomain(){return "EXECUTION";}
    @Override public List<Responsibility> responsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId){
        // A project may have no execution yet: do not make existing pre-delivery member handoffs depend on P3 permissions.
        var itemRows=s.items.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().filter(e->"PENDING".equals(e.status)&&fromId.equals(e.verifierId)).toList();
        var milestoneRows=s.milestones.findAllByProjectId(projectId).stream().filter(e->"PENDING".equals(e.status)&&fromId.equals(e.verifierId)).toList();
        if(itemRows.isEmpty()&&milestoneRows.isEmpty())return List.of();
        var c=s.read(actor,projectId);var result=new ArrayList<Responsibility>();
        for(var e:itemRows){var ref=s.object(c,e.itemId,"ITEM");independent(toId,e.submittedBy,s.owner(c,ref));result.add(new Responsibility("EXECUTION",e.id,e.version,ref.content().title()+" · 分批验收",List.of("清单指定验证人")));}
        for(var e:milestoneRows){var ref=s.object(c,e.milestoneId,"MILESTONE");independent(toId,e.submittedBy,s.owner(c,ref));result.add(new Responsibility("EXECUTION",e.id,e.version,ref.content().title()+" · 实际验证",List.of("里程碑指定验证人")));}
        return result.stream().sorted(Comparator.comparing(Responsibility::objectId)).toList();
    }
    private void independent(UUID next,UUID submitter,UUID owner){if(next.equals(submitter)||next.equals(owner))throw conflict("接任人不能同时成为当前执行记录的处理人或验证人。");}
    @Override @Transactional public void transferResponsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId,List<Responsibility> expected,String reason){
        if(expected.isEmpty())return;var c=s.write(actor,projectId,"DELIVERY_EXECUTION_MANAGE");s.manager(actor,c);
        if(!responsibilities(actor,projectId,fromId,toId).equals(expected))throw conflict("待验证的执行责任已变化，请重新预览交接。");
        for(var responsibility:expected){
            if(responsibility.roles().contains("清单指定验证人")){
                var e=s.items.findById(responsibility.objectId()).orElseThrow(BusinessRules::missing);var ref=s.object(c,e.itemId,"ITEM");var before=s.itemSnapshot(e);
                e.verifierId=toId;e.touch();s.items.flush();s.record(c,ref,"ITEM_VERIFY_TRANSFER",reason,ExecutionRules.today(),actor.accountId(),before,s.itemSnapshot(e));
            }else{
                var e=s.milestones.findById(responsibility.objectId()).orElseThrow(BusinessRules::missing);var ref=s.object(c,e.milestoneId,"MILESTONE");var before=s.milestoneSnapshot(e);
                e.verifierId=toId;e.touch();s.milestones.flush();s.record(c,ref,"MILESTONE_VERIFY_TRANSFER",reason,ExecutionRules.today(),actor.accountId(),before,s.milestoneSnapshot(e));
            }
        }
    }
    @Override public void validateRecipient(UUID projectId,UUID toId,List<Responsibility> responsibilities){
        if(responsibilities.isEmpty())return;
        var person=s.access.account(toId);var actor=new SessionPrincipal(toId,person.loginName(),person.displayName(),false,false,new UUID(0,0));
        var c=s.read(actor,projectId);s.access.require(actor,"DELIVERY_EXECUTION_REVIEW",c.project().authorization());
        for(var responsibility:responsibilities){
            if(responsibility.roles().contains("清单指定验证人")){var e=s.items.findById(responsibility.objectId()).orElseThrow();s.checkReviewer(c,toId,e.submittedBy,s.owner(c,s.object(c,e.itemId,"ITEM")));}
            else {var e=s.milestones.findById(responsibility.objectId()).orElseThrow();s.checkReviewer(c,toId,e.submittedBy,s.owner(c,s.object(c,e.milestoneId,"MILESTONE")));}
        }
    }
    @EventListener public void beforeRemoval(ProjectDirectory.MemberRemovalRequested event){
        boolean pending=s.items.findAllByProjectIdOrderByCreatedAtDesc(event.projectId()).stream().anyMatch(e->"PENDING".equals(e.status)&&event.accountId().equals(e.verifierId))
            ||s.milestones.findAllByProjectId(event.projectId()).stream().anyMatch(e->"PENDING".equals(e.status)&&event.accountId().equals(e.verifierId));
        if(pending)throw conflict("该成员仍有待验证的清单或里程碑，请先完成执行责任交接。");
    }
}
