package com.winh.workplan.finance;
import com.winh.workplan.iam.identity.SessionPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/projects/{projectId}")
class IncomeController {
    private final IncomeService service;private final IncomeQuery query;
    IncomeController(IncomeService service,IncomeQuery query){this.service=service;this.query=query;}
    @GetMapping("/income-workspace") IncomeViews.Workspace workspace(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@RequestParam String period,@RequestParam String currency){return query.workspace(actor,projectId,period,currency);}
    @PostMapping("/income-forecasts") IncomeViews.Book saveForecast(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@Valid @RequestBody IncomeCommands.ForecastSave input){return query.book(actor,projectId,service.saveForecast(actor,projectId,input));}
    @GetMapping("/income-forecasts/{id}") IncomeViews.Book book(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id){return query.book(actor,projectId,id);}
    @GetMapping("/income-forecasts/{id}/history") List<IncomeViews.Event> bookHistory(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id){query.book(actor,projectId,id);return query.history(actor,projectId,id);}
    @PostMapping("/income-forecasts/{id}/commands") IncomeViews.Book forecastAction(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody IncomeCommands.ForecastAction input){service.forecastAction(actor,projectId,id,input);return query.book(actor,projectId,id);}
    @PostMapping("/incomes") IncomeViews.Detail create(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@Valid @RequestBody IncomeCommands.IncomeSave input){return query.detail(actor,projectId,service.saveIncome(actor,projectId,null,input));}
    @PatchMapping("/incomes/{id}") IncomeViews.Detail edit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody IncomeCommands.IncomeSave input){service.saveIncome(actor,projectId,id,input);return query.detail(actor,projectId,id);}
    @GetMapping("/incomes/{id}") IncomeViews.Detail detail(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id){return query.detail(actor,projectId,id);}
    @PostMapping("/incomes/{id}/commands") IncomeViews.Detail action(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody IncomeCommands.IncomeAction input){service.act(actor,projectId,id,input);return query.detail(actor,projectId,id);}
}
