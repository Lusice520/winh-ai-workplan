package com.winh.workplan.finance;
import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class IncomeService {
    private final IncomeStore s;
    IncomeService(IncomeStore s){this.s=s;}
    UUID saveForecast(SessionPrincipal actor,UUID projectId,IncomeCommands.ForecastSave input){
        s.context(actor,projectId,"FINANCE_FORECAST_EDIT");String period=s.period(input.period()),currency=s.currency(input.currency());
        var key=s.access.reserve(actor,"income.forecast.save:"+projectId,input.requestId(),input);if(key.replayed())return key.targetId();
        var b=s.books.findByProjectIdAndPeriodAndCurrency(projectId,period,currency).orElse(null);Object before=null;
        if(b==null){if(input.bookVersion()!=null||input.draftVersion()!=null)throw conflict("预测册不存在，请刷新月份。");b=new ForecastBook();b.projectId=projectId;b.period=period;b.currency=currency;b=s.books.saveAndFlush(b);}
        else{version(b,input.bookVersion());before=s.rawBook(b);}
        if(input.lines()==null||input.lines().isEmpty()||input.lines().size()>100)throw invalid("lines","预测须有1至100个节点。");
        if(input.lines().stream().anyMatch(Objects::isNull)||input.lines().stream().map(IncomeCommands.ForecastLine::id).distinct().count()!=input.lines().size())throw invalid("lines","预测节点标识不得重复。");
        ForecastRevision r;
        if(b.draftRevisionId==null){if(input.draftVersion()!=null)throw conflict("当前已无草案，请刷新后建立新版本。");r=new ForecastRevision();r.bookId=b.id;r.number=s.revisions.findAllByBookIdOrderByNumberDesc(b.id).stream().mapToInt(v->v.number).max().orElse(0)+1;}
        else{r=s.revisions.findById(b.draftRevisionId).orElseThrow(BusinessRules::missing);version(r,input.draftVersion());if(!"DRAFT".equals(r.status))throw conflict("当前版本已不再是草案。");}
        var book=b;var lines=input.lines().stream().map(l->s.forecastLine(actor,book,l)).toList();
        r.linesJson=s.json(lines);r.reason=required(input.reason(),"reason",4000);r.editedBy=actor.accountId();r.touch();r=s.revisions.saveAndFlush(r);
        b.draftRevisionId=r.id;b.touch();s.books.flush();s.event(actor,projectId,b.id,"FORECAST","DRAFT_SAVE",r.reason,before,s.rawBook(b));s.access.complete(key,b.id);return b.id;
    }
    void forecastAction(SessionPrincipal actor,UUID projectId,UUID bookId,IncomeCommands.ForecastAction input){
        s.context(actor,projectId,"FINANCE_FORECAST_EDIT");var b=s.book(projectId,bookId);var key=s.access.reserve(actor,"income.forecast.act:"+bookId,input.requestId(),input);if(key.replayed())return;
        version(b,input.bookVersion());if(b.draftRevisionId==null)throw conflict("当前没有待发布草案。");var r=s.revisions.findById(b.draftRevisionId).orElseThrow(BusinessRules::missing);version(r,input.draftVersion());
        String action=choice(input.action(),"action","PUBLISH","DISCARD"),reason=required(input.reason(),"reason",4000);if(!"DRAFT".equals(r.status))throw conflict("只能办理当前草案。");var before=s.rawBook(b);
        if("PUBLISH".equals(action)){s.lines(r).forEach(l->s.validateLine(actor,b,l));r.status="PUBLISHED";r.publishedAt=Instant.now();r.publishedBy=actor.accountId();b.currentRevisionId=r.id;}
        else r.status="DISCARDED";
        r.reason=reason;r.editedBy=actor.accountId();r.touch();s.revisions.flush();b.draftRevisionId=null;b.touch();s.books.flush();s.event(actor,projectId,b.id,"FORECAST",action,reason,before,s.rawBook(b));s.access.complete(key,b.id);
    }
    UUID saveIncome(SessionPrincipal actor,UUID projectId,UUID id,IncomeCommands.IncomeSave input){
        s.context(actor,projectId,"FINANCE_INCOME_SUBMIT");var key=s.access.reserve(actor,(id==null?"income.create:"+projectId:"income.edit:"+id),input.requestId(),input);if(key.replayed())return key.targetId();
        ProjectIncome i;Object before=null;
        if(id==null){if(input.version()!=null)throw invalid("version","新记录不能带旧版本。");i=new ProjectIncome();i.projectId=projectId;i.createdBy=actor.accountId();i.ownerId=actor.accountId();i.kind=choice(input.kind(),"kind","INCOME","REVERSAL");i.originalIncomeId=input.originalIncomeId();}
        else{i=s.income(projectId,id);version(i,input.version());owner(actor,i);if(!Set.of("DRAFT","RETURNED").contains(i.status))throw conflict("请先撤回或等待退回，再修改收入正文。");if(!i.kind.equals(input.kind())||!Objects.equals(i.originalIncomeId,input.originalIncomeId()))throw invalid("kind","不能改写收入类型或原收入关联；请另建记录。");before=s.rawIncome(i);}
        i.title=required(input.title(),"title",160);i.currency=s.currency(input.currency());i.occurredOn=input.occurredOn();i.sourceNote=required(input.sourceNote(),"sourceNote",4000);i.confirmerId=input.confirmerId();
        s.confirmer(projectId,i.confirmerId,i.ownerId);s.actualDate(i.occurredOn);
        if("REVERSAL".equals(i.kind)){if(i.originalIncomeId==null)throw invalid("originalIncomeId","请选择需整笔冲销的已确认收入。");var original=s.income(projectId,i.originalIncomeId);i.amount=original.amount;if(input.amount()!=null&&input.amount().compareTo(i.amount)!=0)throw invalid("amount","冲销金额由原收入确定，不能调整。");}
        else i.amount=s.positive(input.amount());
        i.sourceJson=s.json(s.source(actor,projectId,input.source()));var forecast=s.forecast(projectId,i.currency,input.forecastRevisionId(),input.forecastLineId());i.forecastJson=s.json(forecast);
        i.unplannedReason=forecast==null?required(input.unplannedReason(),"unplannedReason",4000):optional(input.unplannedReason(),"unplannedReason",4000);
        i.filesJson=s.json(s.validateFiles(actor,projectId,input.fileVersionIds()));
        // A returned round keeps its old submitter in history, but the next draft belongs to the current owner.
        if("RETURNED".equals(i.status)){i.status="DRAFT";i.submittedBy=null;i.submittedAt=null;}
        s.validateIncome(actor,i);i.touch();s.incomes.saveAndFlush(i);s.event(actor,projectId,i.id,"INCOME",id==null?"CREATE":"EDIT",input.reason(),before,s.rawIncome(i));s.access.complete(key,i.id);return i.id;
    }
    void act(SessionPrincipal actor,UUID projectId,UUID id,IncomeCommands.IncomeAction input){
        String action=choice(input.action(),"action","SUBMIT","RETURN","CONFIRM","WITHDRAW","CANCEL");boolean review=Set.of("RETURN","CONFIRM").contains(action);
        s.context(actor,projectId,review?"FINANCE_INCOME_CONFIRM":"FINANCE_INCOME_SUBMIT");var i=s.income(projectId,id);var key=s.access.reserve(actor,"income.act:"+id,input.requestId(),input);if(key.replayed())return;
        version(i,input.version());String reason=required(input.reason(),"reason",4000);var before=s.rawIncome(i);
        if(review){
            if(!"SUBMITTED".equals(i.status))throw conflict("当前记录不在待确认状态。");
            if(!actor.accountId().equals(i.confirmerId)||actor.accountId().equals(i.submittedBy))throw conflict("请由指定营销确认人独立办理。");
            s.confirmer(projectId,i.confirmerId,i.submittedBy);
            if("CONFIRM".equals(action)){s.validateIncome(actor,i);i.status="CONFIRMED";i.confirmedBy=actor.accountId();i.confirmedAt=Instant.now();}else i.status="RETURNED";
        }else{
            owner(actor,i);
            switch(action){
                case "SUBMIT" -> {if(!Set.of("DRAFT","RETURNED").contains(i.status))throw conflict("仅草案或退回记录可提交。");i.submittedBy=actor.accountId();i.submittedAt=Instant.now();s.validateIncome(actor,i);i.status="SUBMITTED";}
                case "WITHDRAW" -> {if(!"SUBMITTED".equals(i.status)||!actor.accountId().equals(i.submittedBy))throw conflict("仅当轮提交人可撤回待确认记录。");i.status="DRAFT";i.submittedBy=null;i.submittedAt=null;}
                case "CANCEL" -> {if(!Set.of("DRAFT","RETURNED").contains(i.status))throw conflict("仅草案或退回记录可取消。");i.status="CANCELLED";}
                default -> throw invalid("action","收入动作无效。");
            }
        }
        i.touch();s.incomes.flush();s.event(actor,projectId,id,"INCOME",action,reason,before,s.rawIncome(i));s.access.complete(key,id);
    }
    private void owner(SessionPrincipal actor,ProjectIncome i){if(!actor.accountId().equals(i.ownerId))throw conflict("请由当前收入填报责任人处理草案。");}
}
