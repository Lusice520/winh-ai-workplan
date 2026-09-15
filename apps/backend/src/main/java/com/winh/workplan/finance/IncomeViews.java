package com.winh.workplan.finance;
import com.winh.workplan.business.BusinessAccess.Person;
import com.winh.workplan.contracts.ContractDirectory.*;
import com.winh.workplan.files.FileDirectory.VersionReference;
import java.math.BigDecimal;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.time.*;
import java.util.*;
final class IncomeViews {
    private IncomeViews(){}
    record Source(UUID contractId,long contractVersion,String contractNumber,String contractTitle,UUID nodeId,Long nodeVersion,String nodeTitle){}
    record SourceView(Source value,boolean restricted){}
    record Files(List<VersionReference> files,int restricted){}
    record IncomeReference(UUID id,long version,String title,@JsonSerialize(using=ToStringSerializer.class) BigDecimal amount,String status){}
    record ForecastReference(UUID revisionId,int revisionNumber,UUID lineId,String title,LocalDate plannedOn,@JsonSerialize(using=ToStringSerializer.class) BigDecimal amount){}
    record Line(UUID id,String title,LocalDate plannedOn,@JsonSerialize(using=ToStringSerializer.class) BigDecimal amount,String sourceType,Source source,String sourceNote,IncomeReference incomeReference,List<UUID> fileVersionIds){}
    record LineView(UUID id,String title,LocalDate plannedOn,@JsonSerialize(using=ToStringSerializer.class) BigDecimal amount,String sourceType,SourceView source,String sourceNote,IncomeReference incomeReference,Files files){}
    record Revision(UUID id,long version,int number,String status,String reason,String editedByName,String publishedByName,Instant publishedAt,Instant updatedAt,@JsonSerialize(using=ToStringSerializer.class) BigDecimal total,List<LineView> lines){}
    record Book(UUID id,long version,String period,String currency,UUID currentRevisionId,UUID draftRevisionId,List<Revision> revisions){}
    record Row(UUID id,long version,String kind,String status,String title,@JsonSerialize(using=ToStringSerializer.class) BigDecimal amount,String currency,LocalDate occurredOn,
        String sourceNote,SourceView source,ForecastReference forecast,String unplannedReason,UUID originalIncomeId,boolean reversed,
        UUID createdBy,String creatorName,UUID ownerId,String ownerName,UUID confirmerId,String confirmerName,UUID submittedBy,String submitterName,Instant submittedAt,
        UUID confirmedBy,String confirmedByName,Instant confirmedAt,Files files,List<String> allowedActions){}
    record Event(UUID id,String action,String reason,UUID actorId,String actorName,Instant at,com.fasterxml.jackson.databind.JsonNode before,com.fasterxml.jackson.databind.JsonNode after){}
    record Detail(Row income,List<Event> history){}
    record Totals(@JsonSerialize(using=ToStringSerializer.class) BigDecimal planned,@JsonSerialize(using=ToStringSerializer.class) BigDecimal confirmedNet,@JsonSerialize(using=ToStringSerializer.class) BigDecimal pendingIncome,@JsonSerialize(using=ToStringSerializer.class) BigDecimal pendingReversal,long count){}
    record Workspace(UUID projectId,String projectName,String period,String currency,Book book,Totals totals,List<Row> incomes,
        List<Person> confirmers,List<ContractFinancialReference> contracts,List<ContractNodeReference> contractNodes,List<String> allowedActions){}
}
