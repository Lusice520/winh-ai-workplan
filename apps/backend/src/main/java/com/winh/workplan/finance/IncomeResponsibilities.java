package com.winh.workplan.finance;
import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.project.*;
import java.util.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @Transactional(readOnly=true)
class IncomeResponsibilities implements ProjectResponsibilityContributor {
    private final IncomeStore s;
    IncomeResponsibilities(IncomeStore s){this.s=s;}
    @Override public String responsibilityDomain(){return "INCOME";}
    private List<ProjectIncome> unfinished(UUID projectId){return s.incomes.findAllByProjectIdOrderByOccurredOnDescCreatedAtDesc(projectId).stream().filter(i->Set.of("DRAFT","RETURNED","SUBMITTED").contains(i.status)).toList();}
    @Override public List<Responsibility> responsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId){
        var rows=unfinished(projectId).stream().filter(i->fromId.equals(i.ownerId)||fromId.equals(i.confirmerId)).toList();
        if(rows.isEmpty())return List.of();s.context(actor,projectId,null);
        return rows.stream().map(i->{var roles=new ArrayList<String>();if(fromId.equals(i.ownerId))roles.add("收入填报责任人");if(fromId.equals(i.confirmerId))roles.add("收入指定确认人");validate(i,fromId,toId);return new Responsibility("INCOME",i.id,i.version,i.title,roles);}).sorted(Comparator.comparing(Responsibility::objectId)).toList();
    }
    private void validate(ProjectIncome i,UUID fromId,UUID toId){
        if(fromId.equals(i.confirmerId)){if(toId.equals(i.ownerId))throw conflict("确认接任人与当前填报人须不同。");s.confirmer(i.projectId,toId,i.submittedBy==null?i.ownerId:i.submittedBy);}
        if(fromId.equals(i.ownerId)){
            if(toId.equals(i.confirmerId))throw conflict("填报接任人不能同时成为该收入的确认人。");var person=s.access.account(toId);var actor=new SessionPrincipal(toId,person.loginName(),person.displayName(),false,false,new UUID(0,0));var p=s.context(actor,i.projectId,null);
            if(!s.projects.participant(i.projectId,toId)||!s.access.allows(actor,"FINANCE_INCOME_SUBMIT",p.authorization()))throw conflict("填报接任人须为有收入提交权限的项目成员。");
        }
    }
    @Override public void validateRecipient(UUID projectId,UUID toId,List<Responsibility> expected){
        for(var r:expected){var i=s.income(projectId,r.objectId());if(r.roles().contains("收入指定确认人"))validate(i,i.confirmerId,toId);if(r.roles().contains("收入填报责任人"))validate(i,i.ownerId,toId);}
    }
    @Override @Transactional public void transferResponsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId,List<Responsibility> expected,String reason){
        if(expected.isEmpty())return;s.context(actor,projectId,"PROJECT_MEMBER_MANAGE");
        if(!responsibilities(actor,projectId,fromId,toId).equals(expected))throw conflict("未完成收入责任已变化，请重新预览交接。");
        for(var r:expected){var i=s.income(projectId,r.objectId());var before=s.rawIncome(i);if(r.roles().contains("收入填报责任人"))i.ownerId=toId;if(r.roles().contains("收入指定确认人"))i.confirmerId=toId;i.touch();s.incomes.flush();s.event(actor,projectId,i.id,"INCOME","RESPONSIBILITY_TRANSFER",reason,before,s.rawIncome(i));}
    }
    @EventListener public void beforeRemoval(ProjectDirectory.MemberRemovalRequested e){if(unfinished(e.projectId()).stream().anyMatch(i->e.accountId().equals(i.ownerId)||e.accountId().equals(i.confirmerId)))throw conflict("该成员仍有未完成的收入填报或确认责任，请先交接。");}
}
