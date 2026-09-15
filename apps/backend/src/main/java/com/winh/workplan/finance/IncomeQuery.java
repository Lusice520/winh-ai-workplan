package com.winh.workplan.finance;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.contracts.ContractDirectory;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.project.ProjectDirectory;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @Transactional(readOnly=true)
class IncomeQuery {
    private final IncomeStore s;
    IncomeQuery(IncomeStore s){this.s=s;}
    IncomeViews.Workspace workspace(SessionPrincipal actor,UUID projectId,String period,String currency){
        var p=s.context(actor,projectId,null);period=s.period(period);currency=s.currency(currency);
        var b=s.books.findByProjectIdAndPeriodAndCurrency(projectId,period,currency).orElse(null);
        var all=s.incomes.findAllByProjectIdOrderByOccurredOnDescCreatedAtDesc(projectId);String selectedPeriod=period,selectedCurrency=currency;
        var scoped=all.stream().filter(i->i.currency.equals(selectedCurrency)&&YearMonth.from(i.occurredOn).toString().equals(selectedPeriod)).toList();
        BigDecimal planned=b==null||b.currentRevisionId==null?BigDecimal.ZERO:s.lines(s.revisions.findById(b.currentRevisionId).orElseThrow()).stream().map(IncomeViews.Line::amount).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal confirmed=BigDecimal.ZERO,pending=BigDecimal.ZERO,reversal=BigDecimal.ZERO;
        for(var i:scoped){if("CONFIRMED".equals(i.status))confirmed=confirmed.add("REVERSAL".equals(i.kind)?i.amount.negate():i.amount);if("SUBMITTED".equals(i.status)){if("REVERSAL".equals(i.kind))reversal=reversal.add(i.amount);else pending=pending.add(i.amount);}}
        var confirmers=s.access.people(actor).stream().filter(a->{try{s.confirmer(projectId,a.id(),actor.accountId());return true;}catch(DomainException e){return false;}}).toList();
        var contractOptions=new ArrayList<ContractDirectory.ContractFinancialReference>();List<ContractDirectory.ContractNodeReference> nodes=List.of();
        if(s.access.allows(actor,"CONTRACT_READ",p.authorization())&&s.access.allows(actor,"CONTRACT_SENSITIVE_READ",p.authorization())){
            for(var c:s.contracts.forProject(actor,projectId))if("ARCHIVED".equals(c.archiveStatus())&&!"TERMINATED".equals(c.status())){
                // Optional source selection must not make finance reads depend on restricted contract files.
                try{contractOptions.add(s.contracts.financialReference(actor,projectId,c.id(),true));}catch(DomainException ignored){}
            }
            var selectable=contractOptions.stream().map(ContractDirectory.ContractFinancialReference::id).collect(java.util.stream.Collectors.toSet());
            nodes=s.contracts.nodeOptions(actor,projectId).stream().filter(n->selectable.contains(n.contractId())).toList();
        }
        var actions=new ArrayList<String>();for(String code:List.of("FINANCE_FORECAST_EDIT","FINANCE_INCOME_SUBMIT","FINANCE_INCOME_CONFIRM"))if(s.canWrite(actor,p,code))actions.add(code);
        return new IncomeViews.Workspace(projectId,p.name(),period,currency,b==null?null:book(actor,projectId,b.id),new IncomeViews.Totals(planned,confirmed,pending,reversal,scoped.size()),scoped.stream().map(i->row(actor,p,i)).toList(),confirmers,contractOptions,nodes,actions);
    }
    IncomeViews.Book book(SessionPrincipal actor,UUID projectId,UUID id){s.context(actor,projectId,null);var b=s.book(projectId,id);return new IncomeViews.Book(b.id,b.version,b.period,b.currency,b.currentRevisionId,b.draftRevisionId,s.revisions.findAllByBookIdOrderByNumberDesc(id).stream().map(r->revision(actor,projectId,r)).toList());}
    private IncomeViews.Revision revision(SessionPrincipal actor,UUID projectId,ForecastRevision r){
        var lines=s.lines(r);return new IncomeViews.Revision(r.id,r.version,r.number,r.status,r.reason,s.access.name(r.editedBy),s.access.name(r.publishedBy),r.publishedAt,r.updatedAt,lines.stream().map(IncomeViews.Line::amount).reduce(BigDecimal.ZERO,BigDecimal::add),lines.stream().map(l->new IncomeViews.LineView(l.id(),l.title(),l.plannedOn(),l.amount(),l.sourceType(),s.visibleSource(actor,projectId,l.source()),l.sourceNote(),l.incomeReference(),s.visibleFiles(actor,projectId,l.fileVersionIds()))).toList());
    }
    IncomeViews.Detail detail(SessionPrincipal actor,UUID projectId,UUID id){var p=s.context(actor,projectId,null);var i=s.income(projectId,id);return new IncomeViews.Detail(row(actor,p,i),history(actor,projectId,id));}
    List<IncomeViews.Event> history(SessionPrincipal actor,UUID projectId,UUID id){s.context(actor,projectId,null);return s.events.findAllByProjectIdAndObjectIdOrderByCreatedAtAsc(projectId,id).stream().map(e->new IncomeViews.Event(e.id,e.action,e.reason,e.actorId,s.access.name(e.actorId),e.createdAt,s.visibleSnapshot(actor,projectId,e.beforeJson),s.visibleSnapshot(actor,projectId,e.afterJson))).toList();}
    IncomeViews.Row row(SessionPrincipal actor,ProjectDirectory.ProjectContext p,ProjectIncome i){
        var actions=new ArrayList<String>();boolean owner=actor.accountId().equals(i.ownerId),edit=s.canWrite(actor,p,"FINANCE_INCOME_SUBMIT");
        boolean reversed="INCOME".equals(i.kind)&&s.incomes.existsByOriginalIncomeIdAndKindAndStatus(i.id,"REVERSAL","CONFIRMED");
        if(owner&&edit){if(Set.of("DRAFT","RETURNED").contains(i.status))actions.addAll(List.of("EDIT","SUBMIT","CANCEL"));if("SUBMITTED".equals(i.status)&&actor.accountId().equals(i.submittedBy))actions.add("WITHDRAW");}
        if("SUBMITTED".equals(i.status)&&actor.accountId().equals(i.confirmerId)&&!actor.accountId().equals(i.submittedBy)&&s.canWrite(actor,p,"FINANCE_INCOME_CONFIRM"))actions.addAll(List.of("CONFIRM","RETURN"));
        if(edit&&"CONFIRMED".equals(i.status)&&"INCOME".equals(i.kind)){if(!reversed)actions.add("REVERSE");actions.add("CORRECT");}
        return new IncomeViews.Row(i.id,i.version,i.kind,i.status,i.title,i.amount,i.currency,i.occurredOn,i.sourceNote,s.visibleSource(actor,p.id(),s.read(i.sourceJson,IncomeViews.Source.class)),s.read(i.forecastJson,IncomeViews.ForecastReference.class),i.unplannedReason,i.originalIncomeId,reversed,i.createdBy,s.access.name(i.createdBy),i.ownerId,s.access.name(i.ownerId),i.confirmerId,s.access.name(i.confirmerId),i.submittedBy,s.access.name(i.submittedBy),i.submittedAt,i.confirmedBy,s.access.name(i.confirmedBy),i.confirmedAt,s.visibleFiles(actor,p.id(),s.ids(i.filesJson)),actions);
    }
}
