package com.winh.workplan.finance;

import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.business.*;
import com.winh.workplan.contracts.ContractDirectory;
import com.winh.workplan.files.FileDirectory;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.project.ProjectDirectory;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Component;

/** Transactions and project serialization belong to command services, never to this helper. */
@Component
class IncomeStore {
    final ForecastBookRepository books;final ForecastRevisionRepository revisions;final ProjectIncomeRepository incomes;final IncomeEventRepository events;
    final ProjectDirectory projects;final ContractDirectory contracts;final FileDirectory files;final BusinessAccess access;final BusinessHistory history;final ObjectMapper mapper;
    IncomeStore(ForecastBookRepository books,ForecastRevisionRepository revisions,ProjectIncomeRepository incomes,IncomeEventRepository events,
        ProjectDirectory projects,ContractDirectory contracts,FileDirectory files,BusinessAccess access,BusinessHistory history,ObjectMapper mapper){
        this.books=books;this.revisions=revisions;this.incomes=incomes;this.events=events;this.projects=projects;this.contracts=contracts;this.files=files;this.access=access;this.history=history;this.mapper=mapper;
    }
    ProjectDirectory.ProjectContext context(SessionPrincipal actor,UUID projectId,String permission){
        var p=permission==null?projects.requireReadable(actor,projectId,"FINANCE_READ"):projects.requireWritable(actor,projectId,permission);
        if(permission!=null){access.require(actor,"FINANCE_READ",p.authorization());if(!projects.participant(projectId,actor.accountId()))throw conflict("请由项目当前成员办理收入事项。");}
        return p;
    }
    boolean canWrite(SessionPrincipal actor,ProjectDirectory.ProjectContext p,String permission){return !"CLOSED".equals(p.status())&&projects.participant(p.id(),actor.accountId())&&access.allows(actor,permission,p.authorization());}
    ProjectIncome income(UUID projectId,UUID id){if(id==null)throw missing();return incomes.findById(id).filter(i->i.projectId.equals(projectId)).orElseThrow(BusinessRules::missing);}
    ForecastBook book(UUID projectId,UUID id){return books.findById(id).filter(b->b.projectId.equals(projectId)).orElseThrow(BusinessRules::missing);}
    List<IncomeViews.Line> lines(ForecastRevision r){return Arrays.asList(read(r.linesJson,IncomeViews.Line[].class));}
    String period(String input){
        if(input==null||!input.matches("[0-9]{4}-[0-9]{2}"))throw invalid("period","请选择 YYYY-MM 格式的月份。");
        try{YearMonth.parse(input);}catch(DateTimeException e){throw invalid("period","月份无效。");}return input;
    }
    String currency(String input){
        if(input==null||!input.matches("[A-Z]{3}"))throw invalid("currency","请明确选择三位大写币种代码。");
        try{if(Currency.getInstance(input).getDefaultFractionDigits()<0)throw new IllegalArgumentException();}catch(IllegalArgumentException e){throw invalid("currency","币种无效或未明确。");}return input;
    }
    BigDecimal positive(BigDecimal value){if(value==null)throw invalid("amount","请填写金额。");amount(value,"amount");if(value.signum()<=0)throw invalid("amount","金额须大于零，最多两位小数。");return value.setScale(2);}
    static LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Shanghai"));}
    void actualDate(LocalDate date){if(date==null||date.isAfter(today()))throw invalid("occurredOn","请填写已实际发生的日期，不能晚于今天。");}
    void confirmer(UUID projectId,UUID id,UUID submitter){
        if(id==null||id.equals(submitter))throw invalid("confirmerId","指定确认人必须与提交人不同。");
        var person=access.account(id);if(!projects.participant(projectId,id))throw invalid("confirmerId","确认人须为本项目启用成员。");
        var actor=new SessionPrincipal(id,person.loginName(),person.displayName(),false,false,new UUID(0,0));
        var p=context(actor,projectId,null);if(!access.allows(actor,"FINANCE_INCOME_CONFIRM",p.authorization()))throw invalid("confirmerId","所选成员没有收入确认权限。");
    }
    IncomeViews.Source source(SessionPrincipal actor,UUID projectId,IncomeCommands.Source input){
        if(input==null)return null;
        if(input.contractId()==null)throw invalid("contractId","合同来源不完整。");
        var c=contracts.financialReference(actor,projectId,input.contractId(),true);
        if(input.contractVersion()==null||input.contractVersion()!=c.version())throw conflict("来源合同已变化，请重新核对当前版本。");
        ContractDirectory.ContractNodeReference n=null;
        if(input.nodeId()!=null){n=contracts.requireNode(actor,projectId,input.nodeId());if(!c.id().equals(n.contractId()))throw invalid("nodeId","经营节点不属于所选合同。");if(input.nodeVersion()==null||input.nodeVersion()!=n.version())throw conflict("来源合同节点已变化，请重新核对。");}
        else if(input.nodeVersion()!=null)throw invalid("nodeId","请同时填写节点与版本。");
        return new IncomeViews.Source(c.id(),c.version(),c.number(),c.title(),n==null?null:n.id(),n==null?null:n.version(),n==null?null:n.title());
    }
    void recheckSource(SessionPrincipal actor,UUID projectId,IncomeViews.Source source){if(source!=null)source(actor,projectId,new IncomeCommands.Source(source.contractId(),source.contractVersion(),source.nodeId(),source.nodeVersion()));}
    IncomeViews.SourceView visibleSource(SessionPrincipal actor,UUID projectId,IncomeViews.Source value){
        if(value==null)return new IncomeViews.SourceView(null,false);
        try{contracts.financialReference(actor,projectId,value.contractId(),false);return new IncomeViews.SourceView(value,false);}
        catch(DomainException e){return new IncomeViews.SourceView(null,true);}
    }
    List<UUID> validateFiles(SessionPrincipal actor,UUID projectId,List<UUID> input){
        var ids=input==null?List.<UUID>of():input;
        if(ids.size()>20||ids.stream().anyMatch(Objects::isNull)||ids.stream().distinct().count()!=ids.size())throw invalid("fileVersionIds","依据资料最多20项，不得重复或为空。");
        ids.forEach(id->files.requirePublished(actor,projectId,id,null));return List.copyOf(ids);
    }
    List<UUID> ids(String json){return Arrays.asList(read(json,UUID[].class));}
    IncomeViews.Files visibleFiles(SessionPrincipal actor,UUID projectId,List<UUID> ids){
        var result=new ArrayList<FileDirectory.VersionReference>();int restricted=0;
        for(UUID id:ids)try{result.add(files.reference(actor,projectId,id));}catch(DomainException e){restricted++;}
        return new IncomeViews.Files(result,restricted);
    }
    IncomeViews.ForecastReference forecast(UUID projectId,String currency,UUID revisionId,UUID lineId){
        if(revisionId==null&&lineId==null)return null;
        if(revisionId==null||lineId==null)throw invalid("forecastLineId","请选择完整的预测版本与节点。");
        var r=revisions.findById(revisionId).orElseThrow(BusinessRules::missing);var b=book(projectId,r.bookId);
        if(!"PUBLISHED".equals(r.status))throw conflict("收入只能引用已发布的预测版本。");
        if(!currency.equals(b.currency))throw invalid("currency","所引用预测的币种不同，不能自动折算。");
        var line=lines(r).stream().filter(l->l.id().equals(lineId)).findFirst().orElseThrow(BusinessRules::missing);
        return new IncomeViews.ForecastReference(r.id,r.number,line.id(),line.title(),line.plannedOn(),line.amount());
    }
    IncomeViews.IncomeReference reference(UUID projectId,String currency,IncomeCommands.IncomeReference input){
        if(input==null)return null;var i=income(projectId,input.id());version(i,input.version());
        if(!currency.equals(i.currency))throw invalid("incomeReference","引用的收入币种不一致。");
        if(!"INCOME".equals(i.kind)||!Set.of("SUBMITTED","CONFIRMED").contains(i.status))throw conflict("预测依据须为已提交或已确认的正向收入。");
        return new IncomeViews.IncomeReference(i.id,i.version,i.title,i.amount,i.status);
    }
    IncomeViews.Line forecastLine(SessionPrincipal actor,ForecastBook b,IncomeCommands.ForecastLine input){
        if(input==null||input.id()==null)throw invalid("lines","每个预测节点须有稳定标识。");
        if(input.plannedOn()==null||!YearMonth.from(input.plannedOn()).toString().equals(b.period))throw invalid("plannedOn","预测日期须在所选月份内。");
        String type=choice(input.sourceType(),"sourceType","PROJECT","CONTRACT");
        if(("CONTRACT".equals(type))!=(input.source()!=null))throw invalid("source","请填写与来源类型一致的合同或项目说明。");
        return new IncomeViews.Line(input.id(),required(input.title(),"title",160),input.plannedOn(),positive(input.amount()),type,source(actor,b.projectId,input.source()),required(input.sourceNote(),"sourceNote",4000),reference(b.projectId,b.currency,input.incomeReference()),validateFiles(actor,b.projectId,input.fileVersionIds()));
    }
    void validateLine(SessionPrincipal actor,ForecastBook b,IncomeViews.Line l){
        recheckSource(actor,b.projectId,l.source());validateFiles(actor,b.projectId,l.fileVersionIds());
        if(l.incomeReference()!=null)reference(b.projectId,b.currency,new IncomeCommands.IncomeReference(l.incomeReference().id(),l.incomeReference().version()));
    }
    void validateIncome(SessionPrincipal actor,ProjectIncome i){
        actualDate(i.occurredOn);confirmer(i.projectId,i.confirmerId,i.submittedBy==null?i.ownerId:i.submittedBy);
        recheckSource(actor,i.projectId,read(i.sourceJson,IncomeViews.Source.class));validateFiles(actor,i.projectId,ids(i.filesJson));
        var f=read(i.forecastJson,IncomeViews.ForecastReference.class);if(f!=null)forecast(i.projectId,i.currency,f.revisionId(),f.lineId());
        if(i.originalIncomeId!=null){var original=income(i.projectId,i.originalIncomeId);
            if(!"INCOME".equals(original.kind)||!"CONFIRMED".equals(original.status)||!i.currency.equals(original.currency))throw invalid("originalIncomeId","原记录须为同项目、同币种的已确认正向收入。");
            if("REVERSAL".equals(i.kind)){
                if(i.amount.compareTo(original.amount)!=0)throw conflict("整笔冲销金额须与原收入一致。");
                if(i.occurredOn.isBefore(original.occurredOn))throw invalid("occurredOn","冲销日期不能早于原收入发生日期。");
                if(incomes.existsByOriginalIncomeIdAndKindAndStatus(original.id,"REVERSAL","CONFIRMED"))throw conflict("原收入已被整笔冲销，不能重复确认。");
            }
        }
    }
    Object rawIncome(ProjectIncome i){
        var m=new LinkedHashMap<String,Object>();m.put("id",i.id);m.put("version",i.version);m.put("kind",i.kind);m.put("status",i.status);m.put("title",i.title);m.put("amount",i.amount.toPlainString());m.put("currency",i.currency);m.put("occurredOn",i.occurredOn);
        m.put("sourceNote",i.sourceNote);m.put("source",read(i.sourceJson,IncomeViews.Source.class));m.put("forecast",read(i.forecastJson,IncomeViews.ForecastReference.class));m.put("unplannedReason",i.unplannedReason);m.put("originalIncomeId",i.originalIncomeId);
        m.put("ownerId",i.ownerId);m.put("ownerName",access.name(i.ownerId));m.put("createdBy",i.createdBy);m.put("creatorName",access.name(i.createdBy));m.put("confirmerId",i.confirmerId);m.put("confirmerName",access.name(i.confirmerId));m.put("submittedBy",i.submittedBy);m.put("submitterName",access.name(i.submittedBy));m.put("submittedAt",i.submittedAt);m.put("confirmedBy",i.confirmedBy);m.put("confirmedByName",access.name(i.confirmedBy));m.put("confirmedAt",i.confirmedAt);m.put("fileVersionIds",ids(i.filesJson));return m;
    }
    Object rawBook(ForecastBook b){
        var m=new LinkedHashMap<String,Object>();m.put("period",b.period);m.put("currency",b.currency);m.put("version",b.version);m.put("currentRevisionId",b.currentRevisionId);m.put("draftRevisionId",b.draftRevisionId);
        m.put("revisions",revisions.findAllByBookIdOrderByNumberDesc(b.id).stream().map(r->{var v=new LinkedHashMap<String,Object>();v.put("id",r.id);v.put("number",r.number);v.put("status",r.status);v.put("reason",r.reason);v.put("lines",lines(r));return v;}).toList());return m;
    }
    JsonNode visibleSnapshot(SessionPrincipal actor,UUID projectId,String json){var value=read(json,JsonNode.class);redact(actor,projectId,value);return value;}
    private void redact(SessionPrincipal actor,UUID projectId,JsonNode value){
        if(value instanceof ArrayNode a){a.forEach(v->redact(actor,projectId,v));return;}
        if(!(value instanceof ObjectNode o))return;
        var children=new ArrayList<JsonNode>();o.elements().forEachRemaining(children::add);children.forEach(v->redact(actor,projectId,v));
        if(o.has("source"))o.set("source",mapper.valueToTree(visibleSource(actor,projectId,read(o.get("source").toString(),IncomeViews.Source.class))));
        var fileIds=o.remove("fileVersionIds");if(fileIds!=null)o.set("files",mapper.valueToTree(visibleFiles(actor,projectId,ids(fileIds.toString()))));
    }
    void event(SessionPrincipal actor,UUID projectId,UUID id,String type,String action,String reason,Object before,Object after){
        var e=new IncomeEvent();e.projectId=projectId;e.objectId=id;e.objectType=type;e.action=action;e.reason=required(reason,"reason",4000);e.actorId=actor.accountId();e.beforeJson=json(before);e.afterJson=json(after);events.saveAndFlush(e);
        history.record(id,"INCOME_"+type,"INCOME_"+action,"经营收入事项已记录，完整原因和原始依据见收入历史。",actor.accountId());
    }
    String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    <T>T read(String json,Class<T> type){try{return mapper.readValue(json,type);}catch(Exception e){throw new IllegalStateException(e);}}
}
