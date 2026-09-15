package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryCommands.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class DeliveryFindingService {
    private final DeliveryStore s;
    DeliveryFindingService(DeliveryStore s){this.s=s;}
    Workspace save(SessionPrincipal actor,UUID projectId,UUID id,SaveFinding input){
        var c=s.writable(actor,projectId,"DG2_EDIT");s.manager(actor,c);
        var res=s.access.reserve(actor,"dg2.finding:"+Objects.toString(id,c.id+":new"),input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        var body=DeliveryRules.finding(input.finding());s.member(projectId,body.ownerId());s.member(projectId,body.verifierId());s.member(projectId,body.escalationOwnerId());
        var f=id==null?new DeliveryFinding():require(c,id);if(id!=null)version(f,input.findingVersion());
        String before=id==null?null:s.codec.write(s.findingFact(f));
        if(id!=null&&"CLOSED".equals(f.status))throw conflict("已验证关闭的事项保持原记录，新发现请另行登记。");
        if(id==null&&s.findings.findAllByCaseIdOrderByCreatedAtAsc(c.id).size()>=200)throw conflict("遗留事项超过 200 项，请先整理项目范围与分工。");
        f.caseId=c.id;f.contentJson=s.codec.write(body);f.blocking=DeliveryRules.BLOCKING_IMPACTS.contains(body.impactCategory());
        f.preparedBy=actor.accountId();f.status="OPEN";f.evidence=null;f.evidenceBy=null;f.evidenceAt=null;f.verification=null;f.verifiedBy=null;f.verifiedAt=null;
        f.touch();s.findings.saveAndFlush(f);s.touch(c);
        s.record(c,f.id,"FINDING",f.version,before,s.codec.write(s.findingFact(f)),actor.accountId(),input.reason(),null,null);
        s.access.complete(res,f.id);return s.workspace(actor,projectId);
    }
    Workspace resolve(SessionPrincipal actor,UUID projectId,UUID id,ResolveFinding input){
        String action=choice(input.action(),"action","SUBMIT_EVIDENCE","VERIFY","RETURN");
        var c=s.writable(actor,projectId,"SUBMIT_EVIDENCE".equals(action)?"DG2_EDIT":"DG2_REVIEW");var res=s.access.reserve(actor,"delivery.finding.resolve:"+id,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);var f=require(c,id);version(f,input.findingVersion());
        var body=s.codec.read(f.contentJson,Finding.class);
        String evidence=required(input.evidence(),"evidence",4000);String before=s.codec.write(s.findingFact(f));
        if("SUBMIT_EVIDENCE".equals(action)){
            if(!body.ownerId().equals(actor.accountId())||!"OPEN".equals(f.status))throw conflict("请由本事项责任人在待处理状态提交证据。");
            f.evidence=evidence;f.evidenceBy=actor.accountId();f.evidenceAt=Instant.now();f.status="PENDING_VERIFICATION";
        }else{
            if(!body.verifierId().equals(actor.accountId())||actor.accountId().equals(body.ownerId())||actor.accountId().equals(f.evidenceBy))
                throw conflict("请由指定的独立验证人处理。");
            if(!"PENDING_VERIFICATION".equals(f.status))throw conflict("请先由责任人提交完成证据。");
            f.verification=evidence;f.verifiedBy=actor.accountId();f.verifiedAt=Instant.now();f.status="VERIFY".equals(action)?"CLOSED":"OPEN";
        }
        f.touch();s.findings.flush();s.touch(c);
        s.record(c,f.id,"FINDING",f.version,before,s.codec.write(s.findingFact(f)),actor.accountId(),"遗留事项 "+action+"。",null,null);
        s.access.complete(res,f.id);return s.workspace(actor,projectId);
    }
    private DeliveryFinding require(DeliveryCase c,UUID id){return s.findings.findById(id).filter(f->f.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);}
}
