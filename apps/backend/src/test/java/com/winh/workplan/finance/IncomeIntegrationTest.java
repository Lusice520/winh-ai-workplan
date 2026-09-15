package com.winh.workplan.finance;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.contracts.ContractService;
import com.winh.workplan.contracts.ContractDirectory.*;
import com.winh.workplan.files.FileService;
import com.winh.workplan.files.FileDirectory.VersionReference;
import com.winh.workplan.iam.account.*;
import com.winh.workplan.iam.authorization.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.organization.*;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.project.*;
import com.winh.workplan.project.ProjectDirectory.ProjectContext;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:income;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH")
class IncomeIntegrationTest {
    @Autowired IncomeStore s;@Autowired IncomeService service;@Autowired IncomeQuery query;@Autowired IncomeResponsibilities responsibility;
    @Autowired OrganizationUnitRepository orgs;@Autowired UserAccountRepository accounts;
    @MockitoBean ProjectService projects;@MockitoBean DefaultAuthorizationService authorization;@MockitoBean ContractService contracts;@MockitoBean FileService files;
    UUID projectId,orgId;SessionPrincipal finance,pmo,marketing,successor;String projectStatus;
    Map<UUID,Set<String>> grants=new HashMap<>();LocalDate today=IncomeStore.today();String period=YearMonth.from(today).toString();
    @BeforeEach void setup(){
        projectId=UUID.randomUUID();projectStatus="ACTIVE";grants.clear();
        orgId=orgs.saveAndFlush(new OrganizationUnit("验证·收入团队","INC-"+UUID.randomUUID(),OrganizationUnitType.COMPANY,null,null,0,OrganizationUnitStatus.ENABLED)).getId();
        finance=person("财务","FINANCE_FORECAST_EDIT","PROJECT_MEMBER_MANAGE");pmo=person("PMO","FINANCE_INCOME_SUBMIT");marketing=person("营销","FINANCE_INCOME_CONFIRM");successor=person("接任","FINANCE_INCOME_CONFIRM","FINANCE_INCOME_SUBMIT");
        when(authorization.decide(any(),anyString(),any())).thenAnswer(i->{SessionPrincipal a=i.getArgument(0);return new AuthorizationDecision(grants.getOrDefault(a.accountId(),Set.of()).contains(i.getArgument(1)),"TEST",List.of());});
        when(projects.participant(eq(projectId),any())).thenAnswer(i->grants.containsKey(i.getArgument(1)));
        when(projects.requireReadable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
        when(projects.requireWritable(any(),any(),anyString())).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(2)));
    }
    SessionPrincipal person(String label,String... rights){
        String login="income-"+UUID.randomUUID();var a=accounts.saveAndFlush(new UserAccount(login,login,"验证·"+label,null,null,null,orgs.findById(orgId).orElseThrow(),"unused-test",false,false));
        var codes=new HashSet<>(List.of("FINANCE_READ","BUSINESS_PEOPLE_READ"));codes.addAll(List.of(rights));grants.put(a.getId(),codes);
        return new SessionPrincipal(a.getId(),login,a.getDisplayName(),false,false,UUID.randomUUID());
    }
    ProjectContext context(SessionPrincipal actor,UUID id,String code){
        if(!projectId.equals(id)||!grants.getOrDefault(actor.accountId(),Set.of()).contains(code))throw BusinessRules.missing();
        if("CLOSED".equals(projectStatus)&&!code.endsWith("READ"))throw BusinessRules.conflict("已关闭");
        return new ProjectContext(projectId,"INC-TEST","验证·收入项目",pmo.accountId(),pmo.accountId(),projectStatus,"PRESALES",new ResourceContext(pmo.accountId(),orgId,projectId,projectId.toString(),true,true,true,true),UUID.randomUUID(),UUID.randomUUID(),"验证客户");
    }
    IncomeCommands.ForecastLine line(UUID id,String amount,IncomeCommands.IncomeReference ref){return new IncomeCommands.ForecastLine(id,"验证·方案节点",today,new BigDecimal(amount),"PROJECT",null,"验证·明确项目预测依据",ref,List.of());}
    IncomeViews.Book saveForecast(String currency,List<IncomeCommands.ForecastLine> lines){
        var b=query.workspace(finance,projectId,period,currency).book();var d=b==null?null:b.revisions().stream().filter(r->r.id().equals(b.draftRevisionId())).findFirst().orElse(null);
        var input=new IncomeCommands.ForecastSave(UUID.randomUUID(),period,currency,b==null?null:b.version(),d==null?null:d.version(),lines,"验证·人工修订预测");
        return query.book(finance,projectId,service.saveForecast(finance,projectId,input));
    }
    void bookAction(IncomeViews.Book b,String action){var d=b.revisions().stream().filter(r->r.id().equals(b.draftRevisionId())).findFirst().orElseThrow();service.forecastAction(finance,projectId,b.id(),new IncomeCommands.ForecastAction(UUID.randomUUID(),b.version(),d.version(),action,"验证·"+action));}
    IncomeCommands.IncomeSave input(Long version,String kind,String value,String currency,LocalDate date,UUID original,UUID confirmer,List<UUID> fileIds,IncomeCommands.Source source){return new IncomeCommands.IncomeSave(UUID.randomUUID(),version,kind,"验证·收入事实",value==null?null:new BigDecimal(value),currency,date,"验证·实际收入依据",source,null,null,"验证·明确未按预测填报",original,confirmer,fileIds,"验证·填报");}
    UUID create(String value,String currency,LocalDate date){return service.saveIncome(pmo,projectId,null,input(null,"INCOME",value,currency,date,null,marketing.accountId(),List.of(),null));}
    IncomeViews.Detail detail(UUID id){return query.detail(finance,projectId,id);}
    IncomeCommands.IncomeAction command(UUID id,String action){return new IncomeCommands.IncomeAction(UUID.randomUUID(),detail(id).income().version(),action,"验证·"+action+"实际依据");}
    void act(SessionPrincipal actor,UUID id,String action){service.act(actor,projectId,id,command(id,action));}
    void confirm(UUID id){act(pmo,id,"SUBMIT");act(marketing,id,"CONFIRM");}
    @Test void draftAndPublicationAreSeparateAndStableLineHistorySurvivesDiscard(){
        UUID lineId=UUID.randomUUID();var b=saveForecast("CNY",List.of(line(lineId,"100.00",null)));assertThat(query.workspace(finance,projectId,period,"CNY").totals().planned()).isZero();
        bookAction(b,"PUBLISH");b=saveForecast("CNY",List.of(line(lineId,"120.00",null)));assertThat(query.workspace(finance,projectId,period,"CNY").totals().planned()).isEqualByComparingTo("100");
        var draft=b.revisions().getFirst();var publish=new IncomeCommands.ForecastAction(UUID.randomUUID(),b.version(),draft.version(),"PUBLISH","验证·人工发布第二版");service.forecastAction(finance,projectId,b.id(),publish);service.forecastAction(finance,projectId,b.id(),publish);
        assertThat(query.workspace(finance,projectId,period,"CNY").totals().planned()).isEqualByComparingTo("120");
        b=saveForecast("CNY",List.of(line(lineId,"150",null)));bookAction(b,"DISCARD");var result=query.book(finance,projectId,b.id());assertThat(result.revisions()).hasSize(3);assertThat(result.revisions().get(2).lines().getFirst().amount()).isEqualByComparingTo("100");assertThat(result.revisions().get(2).lines().getFirst().id()).isEqualTo(lineId);
        assertThat(query.workspace(finance,projectId,period,"CNY").totals().planned()).isEqualByComparingTo("120");
    }
    @Test void twoIndependentRoundsPreserveOriginalFilesAndPendingReferencesNeverAutoPublish(){
        UUID doc=UUID.randomUUID(),v1=UUID.randomUUID(),v2=UUID.randomUUID();
        for(UUID v:List.of(v1,v2)){var ref=new VersionReference(doc,v,projectId,"验证·收入依据","synthetic.txt",v.equals(v1)?1:2,"INTERNAL","PUBLISHED",true,0,"a".repeat(64));when(files.requirePublished(any(),eq(projectId),eq(v),isNull())).thenReturn(ref);when(files.reference(any(),eq(projectId),eq(v))).thenReturn(ref);}
        UUID id=service.saveIncome(pmo,projectId,null,input(null,"INCOME","20","CNY",today,null,marketing.accountId(),List.of(v1),null));act(pmo,id,"SUBMIT");
        var b=saveForecast("CNY",List.of(line(UUID.randomUUID(),"12",new IncomeCommands.IncomeReference(id,detail(id).income().version()))));bookAction(b,"PUBLISH");
        assertThat(query.workspace(finance,projectId,period,"CNY").totals().confirmedNet()).isZero();assertThat(query.workspace(finance,projectId,period,"CNY").totals().planned()).isEqualByComparingTo("12");
        assertThatThrownBy(()->act(pmo,id,"CONFIRM")).isInstanceOf(DomainException.class);act(marketing,id,"RETURN");
        service.saveIncome(pmo,projectId,id,input(detail(id).income().version(),"INCOME","20","CNY",today,null,marketing.accountId(),List.of(v2),null));act(pmo,id,"SUBMIT");act(marketing,id,"CONFIRM");
        assertThat(detail(id).history()).hasSize(6);assertThat(detail(id).history().get(1).after().path("files").path("files").get(0).path("versionId").asText()).isEqualTo(v1.toString());assertThat(detail(id).income().files().files().getFirst().versionId()).isEqualTo(v2);
        assertThat(query.workspace(finance,projectId,period,"CNY").totals().confirmedNet()).isEqualByComparingTo("20");assertThat(query.workspace(finance,projectId,period,"CNY").totals().planned()).isEqualByComparingTo("12");
        assertThatThrownBy(()->service.saveIncome(pmo,projectId,id,input(detail(id).income().version(),"INCOME","1","CNY",today,null,marketing.accountId(),List.of(),null))).isInstanceOf(DomainException.class);
    }
    @Test void reversalUsesItsOwnMonthAndCurrencyAndAllowsOnlyOneConfirmedCorrection(){
        LocalDate prior=YearMonth.from(today).minusMonths(1).atDay(5);UUID original=create("50","CNY",prior);confirm(original);
        var body=input(null,"REVERSAL",null,"CNY",today,original,marketing.accountId(),List.of(),null);UUID reversal=service.saveIncome(pmo,projectId,null,body);assertThat(service.saveIncome(pmo,projectId,null,body)).isEqualTo(reversal);
        UUID competing=service.saveIncome(pmo,projectId,null,input(null,"REVERSAL",null,"CNY",today,original,marketing.accountId(),List.of(),null));act(pmo,reversal,"SUBMIT");act(pmo,competing,"SUBMIT");act(marketing,reversal,"CONFIRM");
        assertThatThrownBy(()->act(marketing,competing,"CONFIRM")).isInstanceOf(DomainException.class);assertThat(detail(competing).income().status()).isEqualTo("SUBMITTED");assertThat(detail(original).income().reversed()).isTrue();
        assertThat(query.workspace(finance,projectId,YearMonth.from(prior).toString(),"CNY").totals().confirmedNet()).isEqualByComparingTo("50");assertThat(query.workspace(finance,projectId,period,"CNY").totals().confirmedNet()).isEqualByComparingTo("-50");
        UUID usd=create("80","USD",today);confirm(usd);assertThat(query.workspace(finance,projectId,period,"USD").totals().confirmedNet()).isEqualByComparingTo("80");
    }
    @Test void invalidAmountDatesSourceVersionAndFilesRollBackAllRecordsAndIdempotency(){
        assertThatThrownBy(()->create("1.001","CNY",today)).isInstanceOf(DomainException.class);assertThatThrownBy(()->create("0","CNY",today)).isInstanceOf(DomainException.class);assertThatThrownBy(()->create("1","XXX",today)).isInstanceOf(DomainException.class);assertThatThrownBy(()->create("1","CNY",today.plusDays(1))).isInstanceOf(DomainException.class);
        UUID contract=UUID.randomUUID();when(contracts.financialReference(any(),eq(projectId),eq(contract),eq(true))).thenReturn(new ContractFinancialReference(contract,2,"SYN-01","验证·合同","EFFECTIVE","ARCHIVED"));
        assertThatThrownBy(()->service.saveIncome(pmo,projectId,null,input(null,"INCOME","1","CNY",today,null,marketing.accountId(),List.of(),new IncomeCommands.Source(contract,1L,null,null)))).isInstanceOf(DomainException.class);
        UUID file=UUID.randomUUID();var body=input(null,"INCOME","1","CNY",today,null,marketing.accountId(),List.of(file),null);when(files.requirePublished(any(),eq(projectId),eq(file),isNull())).thenThrow(BusinessRules.conflict("验证·资料未发布"));
        assertThatThrownBy(()->service.saveIncome(pmo,projectId,null,body)).isInstanceOf(DomainException.class);assertThat(query.workspace(finance,projectId,period,"CNY").incomes()).isEmpty();
        when(files.requirePublished(any(),eq(projectId),eq(file),isNull())).thenReturn(new VersionReference(UUID.randomUUID(),file,projectId,"验证·依据","a.txt",1,"INTERNAL","PUBLISHED",true,0,"b".repeat(64)));
        UUID id=service.saveIncome(pmo,projectId,null,body);assertThat(detail(id).income().amount()).isEqualByComparingTo("1");
    }
    @Test void currentSourcePermissionsRedactIdsInBothCurrentAndHistoricalViews(){
        UUID contract=UUID.randomUUID(),file=UUID.randomUUID();var ref=new ContractFinancialReference(contract,1,"SYN-SECRET","验证·受限合同","EFFECTIVE","ARCHIVED");when(contracts.financialReference(any(),eq(projectId),eq(contract),anyBoolean())).thenReturn(ref);
        UUID id=service.saveIncome(pmo,projectId,null,input(null,"INCOME","10","CNY",today,null,marketing.accountId(),List.of(file),new IncomeCommands.Source(contract,1L,null,null)));
        when(contracts.financialReference(eq(finance),eq(projectId),eq(contract),eq(false))).thenThrow(BusinessRules.missing());when(files.reference(eq(finance),eq(projectId),eq(file))).thenThrow(BusinessRules.missing());
        var result=detail(id);assertThat(result.income().source().restricted()).isTrue();assertThat(result.income().files().restricted()).isEqualTo(1);String json=s.json(result);assertThat(json).doesNotContain(contract.toString(),file.toString(),"SYN-SECRET","受限合同");
        var persisted=s.events.findAllByProjectIdAndObjectIdOrderByCreatedAtAsc(projectId,id).getFirst();assertThat(persisted.afterJson).contains(contract.toString(),file.toString());
    }
    @Test void pausedAllowsFactsClosedDeniesAndVersionReplayCannotOverwrite(){
        projectStatus="PAUSED";UUID id=create("10","CNY",today);var stale=command(id,"CANCEL");act(pmo,id,"SUBMIT");assertThatThrownBy(()->service.act(pmo,projectId,id,stale)).isInstanceOf(DomainException.class);
        var confirm=command(id,"CONFIRM");service.act(marketing,projectId,id,confirm);service.act(marketing,projectId,id,confirm);assertThat(detail(id).history()).hasSize(3);
        projectStatus="CLOSED";assertThatThrownBy(()->create("5","CNY",today)).isInstanceOf(DomainException.class);assertThat(detail(id).income().allowedActions()).isEmpty();
        assertThatThrownBy(()->query.detail(finance,UUID.randomUUID(),id)).isInstanceOf(DomainException.class);
    }
    @Test void handoffKeepsOriginalRoundSubmitterAndRequiresAnIndependentQualifiedRecipient(){
        UUID id=create("10","CNY",today);act(pmo,id,"SUBMIT");assertThatThrownBy(()->responsibility.beforeRemoval(new ProjectDirectory.MemberRemovalRequested(projectId,marketing.accountId()))).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->responsibility.responsibilities(finance,projectId,marketing.accountId(),pmo.accountId())).isInstanceOf(DomainException.class);
        var rows=responsibility.responsibilities(finance,projectId,marketing.accountId(),successor.accountId());responsibility.validateRecipient(projectId,successor.accountId(),rows);responsibility.transferResponsibilities(finance,projectId,marketing.accountId(),successor.accountId(),rows,"验证·正式责任交接");
        assertThat(detail(id).income().submittedBy()).isEqualTo(pmo.accountId());assertThat(detail(id).income().confirmerId()).isEqualTo(successor.accountId());assertThatThrownBy(()->act(marketing,id,"CONFIRM")).isInstanceOf(DomainException.class);
        act(successor,id,"CONFIRM");assertThat(detail(id).income().confirmedBy()).isEqualTo(successor.accountId());
    }
    @Test void unavailableOptionalContractFilesDoNotBlockTheFinancialWorkspace(){
        grants.get(finance.accountId()).addAll(Set.of("CONTRACT_READ","CONTRACT_SENSITIVE_READ"));
        UUID contractId=UUID.randomUUID();var c=mock(com.winh.workplan.contracts.ContractViews.Master.class);
        when(c.id()).thenReturn(contractId);when(c.archiveStatus()).thenReturn("ARCHIVED");when(c.status()).thenReturn("EFFECTIVE");
        when(contracts.forProject(finance,projectId)).thenReturn(List.of(c));
        when(contracts.financialReference(finance,projectId,contractId,true)).thenThrow(BusinessRules.conflict("签署文件当前受限"));
        when(contracts.nodeOptions(finance,projectId)).thenReturn(List.of(new ContractNodeReference(UUID.randomUUID(),contractId,1,"验证·节点",today)));
        UUID id=create("10","CNY",today);var w=query.workspace(finance,projectId,period,"CNY");
        assertThat(w.incomes()).extracting(IncomeViews.Row::id).containsExactly(id);assertThat(w.contracts()).isEmpty();assertThat(w.contractNodes()).isEmpty();
    }

}
