package com.winh.workplan.work;

import static com.winh.workplan.work.DeliveryTaskViews.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class DeliveryTaskQuery {
    private final DeliveryTaskStore s;
    DeliveryTaskQuery(DeliveryTaskStore s){this.s=s;}
    Workspace workspace(SessionPrincipal actor,UUID projectId,UUID parentId){
        var c=s.context(actor,projectId,parentId,null);boolean create=canPlan(actor,c);
        var profiles=s.profiles.findAllByProjectIdAndWorkPackageIdOrderByUpdatedAtDesc(projectId,parentId);
        return new Workspace(projectId,c.project().name(),c.ref(),c.parent().status,c.stage(),s.items(c),
            profiles.stream().map(p->row(actor,c,s.task(projectId,p.id),p)).toList(),
            create?s.work.findAllByProjectIdOrderByUpdatedAtDesc(projectId).stream().filter(w->"TASK".equals(w.kind)&&"OPEN".equals(w.status)&&!s.profiles.existsById(w.id))
                .map(w->new WorkDirectory.WorkReference(w.id,w.projectId,w.kind,w.title,w.status,false,w.version,w.sourceRequirementId,w.creationSource,w.ownerAccountId,w.verifierAccountId,w.dueDate,w.deliveryState,w.deliveryBaselineVersion)).toList():List.of(),
            profiles.isEmpty()?List.of():s.events.findTop20ByProjectIdAndTaskIdInOrderByCreatedAtDesc(projectId,profiles.stream().map(p->p.id).toList()).stream().map(e->event(actor,e)).toList(),
            create?List.of("CREATE","ADOPT"):List.of());
    }
    Detail detail(SessionPrincipal actor,UUID projectId,UUID id){
        var p=s.profile(projectId,id);var c=s.context(actor,projectId,p.workPackageId,null);var w=s.task(projectId,id);
        return new Detail(projectId,c.project().name(),c.ref(),c.parent().status,c.stage(),row(actor,c,w,p),w.description,p.acceptanceCriteria,s.ids(p.itemIdsJson),s.items(c),
            w.evidence,w.completedBy,s.access.name(w.completedBy),w.verifiedBy,s.access.name(w.verifiedBy),w.verifiedAt,p.baselineVersion,s.visibleFiles(actor,projectId,p.filesJson),
            s.events.findAllByProjectIdAndTaskIdOrderByCreatedAtDesc(projectId,id).stream().map(e->event(actor,e)).toList());
    }
    private Event event(SessionPrincipal actor,DeliveryTaskEvent e){return new Event(e.id,e.taskId,e.action,e.note,e.actorId,s.access.name(e.actorId),e.createdAt,s.visibleSnapshot(actor,e.projectId,e.beforeJson),s.visibleSnapshot(actor,e.projectId,e.afterJson));}
    private boolean open(DeliveryTaskStore.Context c){return !c.ref().archived()&&"OPEN".equals(c.parent().status)&&"BASELINED".equals(c.parent().deliveryState);}
    private boolean canPlan(SessionPrincipal actor,DeliveryTaskStore.Context c){return open(c)&&"ACTIVE".equals(c.project().status())&&s.projects.participant(c.project().id(),actor.accountId())&&s.planner(actor,c)&&s.access.allows(actor,"WORK_EDIT",c.project().authorization());}
    private Row row(SessionPrincipal actor,DeliveryTaskStore.Context c,ProjectWorkItem w,DeliveryTaskProfile p){
        boolean stale=!"CANCELLED".equals(w.status)&&s.needsReview(c,w,p);var actions=new ArrayList<String>();
        if(open(c)&&!"CLOSED".equals(c.project().status())&&s.projects.participant(c.project().id(),actor.accountId())){
            if(canPlan(actor,c)){
                if("OPEN".equals(w.status))actions.addAll(List.of("EDIT","CANCEL"));
                if(Set.of("DONE","CANCELLED").contains(w.status))actions.add("REOPEN");
            }
            if("OPEN".equals(w.status)&&!stale&&"ACTIVE".equals(c.project().status())&&"IN_PROGRESS".equals(c.stage().status())&&actor.accountId().equals(w.ownerAccountId)&&s.access.allows(actor,"WORK_EDIT",c.project().authorization()))actions.addAll(List.of("PROGRESS","COMPLETE"));
            if("PENDING_VERIFICATION".equals(w.status)&&actor.accountId().equals(w.verifierAccountId)&&!actor.accountId().equals(w.ownerAccountId)&&!actor.accountId().equals(w.completedBy)&&s.access.allows(actor,"WORK_REVIEW",c.project().authorization())){
                if(!stale)actions.add("VERIFY");actions.add("RETURN");
            }
        }
        return new Row(w.id,p.version,w.version,w.title,p.acceptanceCriteria,w.status,stale,w.sourceRequirementId,w.ownerAccountId,s.access.name(w.ownerAccountId),w.verifierAccountId,s.access.name(w.verifierAccountId),
            p.startsOn,w.dueDate,p.estimatedDays,p.progress,p.actualStartedOn,p.actualCompletedOn,s.ids(p.itemIdsJson).size(),List.copyOf(actions));
    }
}
