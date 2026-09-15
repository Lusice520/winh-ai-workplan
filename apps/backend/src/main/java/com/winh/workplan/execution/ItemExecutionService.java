package com.winh.workplan.execution;
import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.execution.ExecutionRules.*;
import static com.winh.workplan.execution.ExecutionCommands.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class ItemExecutionService {
    private final ExecutionStore s;
    ItemExecutionService(ExecutionStore s){this.s=s;}
    void profile(SessionPrincipal actor,UUID projectId,UUID id,ProfileCommand input){
        var c=s.write(actor,projectId,"DELIVERY_EXECUTION_MANAGE");s.manager(actor,c);var ref=s.object(c,id,"ITEM");
        var reservation=s.access.reserve(actor,"execution.profile:"+id,input.requestId(),input);if(reservation.replayed())return;
        objectVersion(ref,input.objectVersion());var row=s.profiles.findByProjectIdAndItemId(projectId,id).orElse(null);expected(row,input.version());
        String reason=required(input.reason(),"reason",2000);s.runningProject(c);
        if(input.requiresReceipt()==null||input.requiresInstallation()==null)throw invalid("requiresReceipt","请明确到货与安装是否适用。");
        if(row!=null&&s.itemRows(c,id).stream().anyMatch(ExecutionRules::active)&&
            (row.requiresReceipt!=input.requiresReceipt()||row.requiresInstallation!=input.requiresInstallation()))throw conflict("清单已有有效执行记录，不能改变适用环节绕过数量关系。");
        var before=s.profileSnapshot(row);if(row==null){row=new ExecutionItemProfile();row.projectId=projectId;row.itemId=id;}
        row.requiresReceipt=input.requiresReceipt();row.requiresInstallation=input.requiresInstallation();row.brand=optional(input.brand(),"brand",160);
        row.model=optional(input.model(),"model",160);row.supplier=optional(input.supplier(),"supplier",240);row.scopeJson=s.rules.json(ref.content().item());row.objectVersion=ref.version();
        row.touch();s.profiles.saveAndFlush(row);s.record(c,ref,"ITEM_PROFILE",reason,today(),actor.accountId(),before,s.profileSnapshot(row));s.access.complete(reservation,row.id);
    }
    UUID record(SessionPrincipal actor,UUID projectId,UUID id,ItemCommand input){
        var c=s.write(actor,projectId,"DELIVERY_EXECUTION_EDIT");var ref=s.object(c,id,"ITEM");s.requireResponsible(actor,c,ref);
        var reservation=s.access.reserve(actor,"execution.item.record:"+id,input.requestId(),input);if(reservation.replayed())return reservation.targetId();
        objectVersion(ref,input.objectVersion());var profile=s.profiles.findByProjectIdAndItemId(projectId,id).orElseThrow(()->conflict("请先由项目经理明确本清单适用的执行环节。"));
        expected(profile,input.version());s.runningProject(c);var date=date(input.occurredOn());s.occurredDuringStage(c,ref,date);
        String kind=choice(input.kind(),"kind","RECEIVED","INSTALLED","ACCEPTED");
        if("RECEIVED".equals(kind)&&!profile.requiresReceipt||"INSTALLED".equals(kind)&&!profile.requiresInstallation)throw conflict("该环节已明确不适用，请核对清单执行安排。");
        String evidence=required(input.evidence(),"evidence",4000);var fileIds=s.validateFiles(actor,projectId,input.fileVersionIds());
        if("ACCEPTED".equals(kind))s.checkReviewer(c,input.verifierId(),actor.accountId(),s.owner(c,ref));
        else if(input.verifierId()!=null)throw invalid("verifierId","到货与安装不指定验收人；请在验收提交时选择。");
        var row=new ExecutionItemEvent();row.projectId=projectId;row.itemId=id;row.kind=kind;row.status="ACCEPTED".equals(kind)?"PENDING":"RECORDED";
        row.quantity=quantity(input.quantity());row.occurredOn=date;row.evidence=evidence;row.filesJson=s.rules.json(fileIds);row.submittedBy=actor.accountId();row.verifierId=input.verifierId();
        row.scopeHash=s.rules.scopeHash(ref);row.objectVersion=ref.version();row.baselineVersion=c.scope().baselineVersion();
        var all=new ArrayList<>(s.itemRows(c,id));all.add(row);s.rules.validateTimeline(profile,ref.content().item().quantity(),all,row.scopeHash);
        s.items.saveAndFlush(row);profile.touch();s.profiles.flush();s.record(c,ref,"ITEM_"+kind,evidence,date,actor.accountId(),null,s.itemSnapshot(row));s.access.complete(reservation,row.id);return row.id;
    }
    void decide(SessionPrincipal actor,UUID projectId,UUID eventId,Decision input){
        String action=choice(input.action(),"action","VERIFY","RETURN","REVERSE");
        var c=s.write(actor,projectId,"REVERSE".equals(action)?"DELIVERY_EXECUTION_READ":"DELIVERY_EXECUTION_REVIEW");
        var row=s.items.findById(eventId).filter(e->e.projectId.equals(projectId)).orElseThrow(BusinessRules::missing);
        if("REVERSE".equals(action))s.access.require(actor,"ACCEPTED".equals(row.kind)?"DELIVERY_EXECUTION_REVIEW":"DELIVERY_EXECUTION_EDIT",c.project().authorization());
        var ref=s.object(c,row.itemId,"ITEM");var reservation=s.access.reserve(actor,"execution.item.decide:"+eventId,input.requestId(),input);if(reservation.replayed())return;
        objectVersion(ref,input.objectVersion());expected(row,input.version());String note=required(input.note(),"note",4000);Object before=s.itemSnapshot(row);
        var profile=s.profiles.findByProjectIdAndItemId(projectId,row.itemId).orElseThrow();
        if("REVERSE".equals(action)){
            if(!Set.of("RECORDED","VERIFIED").contains(row.status)||"REVERSAL".equals(row.kind)||s.items.existsByReversalOfId(row.id))throw conflict("仅有效的已记录或已验证事实可以冲回。");
            if("ACCEPTED".equals(row.kind))s.independent(actor,c,row.verifierId,row.submittedBy,s.owner(c,ref));
            else if(!actor.accountId().equals(row.submittedBy)&&!actor.accountId().equals(c.scope().managerId()))throw conflict("请由原登记人或当前项目经理说明原因更正。");
            requireDownstreamReopened(c,ref);
            row.status="REVERSED";row.touch();s.items.flush();
            s.rules.validateTimeline(profile,ref.content().item().quantity(),s.itemRows(c,row.itemId),s.rules.scopeHash(ref));
            var reversal=new ExecutionItemEvent();reversal.projectId=projectId;reversal.itemId=row.itemId;reversal.kind="REVERSAL";reversal.status="RECORDED";
            reversal.quantity=row.quantity;reversal.occurredOn=today();reversal.evidence=note;reversal.submittedBy=actor.accountId();reversal.reversalOfId=row.id;
            reversal.scopeHash=s.rules.scopeHash(ref);reversal.objectVersion=ref.version();reversal.baselineVersion=c.scope().baselineVersion();s.items.saveAndFlush(reversal);
        }else{
            if(!"ACCEPTED".equals(row.kind)||!"PENDING".equals(row.status))throw conflict("仅待验收记录可以核验或退回。");
            s.independent(actor,c,row.verifierId,row.submittedBy,s.owner(c,ref));
            if("VERIFY".equals(action)){
                if(!row.scopeHash.equals(s.rules.scopeHash(ref)))throw conflict("验收范围已变化，请退回后按当前范围重新提交。");
                s.validateFiles(actor,projectId,s.fileIds(row.filesJson));
                s.rules.validateTimeline(profile,ref.content().item().quantity(),s.itemRows(c,row.itemId),s.rules.scopeHash(ref));row.status="VERIFIED";
            }else row.status="RETURNED";
            row.decidedBy=actor.accountId();row.decidedAt=Instant.now();row.decision=note;row.touch();s.items.flush();
        }
        profile.touch();s.profiles.flush();s.record(c,ref,"ITEM_"+action,note,today(),actor.accountId(),before,s.itemSnapshot(row));s.access.complete(reservation,row.id);
    }
    private void requireDownstreamReopened(ExecutionStore.Context c,com.winh.workplan.delivery.ApprovedDeliveryDirectory.ObjectReference ref){
        var stage=s.stages.findByProjectIdAndStageId(c.project().id(),s.stageId(ref)).orElse(null);
        if(stage!=null&&"COMPLETED".equals(stage.status))throw conflict("阶段已有完成结论，请先由项目经理明确重开。");
        var milestone=s.milestones.findByProjectIdAndMilestoneId(c.project().id(),ref.content().item().milestoneId()).orElse(null);
        if(milestone!=null&&!"OPEN".equals(milestone.status))throw conflict("关联里程碑已有待验证或已验证结论，请先退回或明确重开。");
    }
}
