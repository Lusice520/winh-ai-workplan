package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import static org.assertj.core.api.Assertions.*;
import com.winh.workplan.delivery.configuration.ConfigurationDefinitions;
import com.winh.workplan.iam.shared.DomainException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;

class DeliveryRulesTest {
    private final LocalDate start=LocalDate.of(2026,10,1),end=start.plusDays(10);
    @Test void templateDependenciesCannotBeDisguisedAsParallelOrLoseRequiredStages(){
        UUID a=UUID.randomUUID(),b=UUID.randomUUID();var first=stage("A",List.of(b),List.of(b));var second=stage("B",List.of(a),List.of());
        var template=new ConfigurationDefinitions.Template(List.of("SYSTEM_INTEGRATION"),List.of(template("A"),template("B")));
        var problems=DeliveryRules.stageProblems(List.of(fact(a,Content.of(first)),fact(b,Content.of(second))),template);
        assertThat(problems).anyMatch(p->p.contains("循环")).anyMatch(p->p.contains("并行关系与前置顺序冲突"));
        assertThat(DeliveryRules.stageProblems(List.of(fact(a,Content.of(first))),template)).anyMatch(p->p.contains("模板阶段缺失"));
    }
    @Test void oneContentKindAndPreciseNonNegativeMoneyAreEnforced(){
        var good=new Budget("FULL","范围",List.of(),null,null,null,null,List.of(line("1.10"),line("2.20")));
        var content=new Content(null,null,null,null,null,good);
        assertThat(DeliveryRules.budgetTotal(List.of(fact(UUID.randomUUID(),DeliveryRules.content(content))))).isEqualByComparingTo("3.30");
        assertThatThrownBy(()->DeliveryRules.content(new Content(stage("A",List.of(),List.of()),null,null,null,null,good)))
            .isInstanceOf(DomainException.class).hasMessageContaining("一种");
        var invalid=new Budget("FULL","范围",List.of(),null,null,null,null,List.of(line("1.001")));
        assertThatThrownBy(()->DeliveryRules.content(new Content(null,null,null,null,null,invalid))).isInstanceOf(DomainException.class).hasMessageContaining("两位小数");
    }
    @Test void dateWindowsAndIndependentFindingVerificationAreRequired(){
        assertThat(DeliveryRules.within(start,end,start.plusDays(1),end)).isFalse();
        assertThat(DeliveryRules.within(start,end,start,end)).isTrue();
        UUID person=UUID.randomUUID();var finding=new Finding("首段资源","GAP","INITIAL_RESOURCE","HIGH",person,person,end,"承诺完成","首段",person,"升级责任人");
        assertThatThrownBy(()->DeliveryRules.finding(finding)).isInstanceOf(DomainException.class).hasMessageContaining("不同人员");
        assertThat(DeliveryRules.BLOCKING_IMPACTS).contains("LEGAL","SCOPE","RESPONSIBILITY","INITIAL_RESOURCE","KEY_DATE","BUDGET").doesNotContain("DETAIL");
    }
    private Stage stage(String code,List<UUID> before,List<UUID> parallel){return new Stage(code,code,true,null,null,UUID.randomUUID(),start,end,before,parallel,"A".equals(code),List.of("动作"),List.of("成果"),"完成");}
    private ConfigurationDefinitions.Stage template(String code){return new ConfigurationDefinitions.Stage(code,code,"REQUIRED",null,"阶段负责人",List.of(),List.of(),List.of("验收"),List.of("动作"),List.of("成果"),"完成");}
    private BudgetLine line(String amount){return new BudgetLine("费用","OTHER",new BigDecimal(amount),null,null,null,null,"依据");}
    private ObjectFact fact(UUID id,Content content){return new ObjectFact(id,0,content.kind(),content,UUID.randomUUID(),false,0);}
}
