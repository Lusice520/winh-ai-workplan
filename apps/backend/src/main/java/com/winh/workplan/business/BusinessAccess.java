package com.winh.workplan.business;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.iam.account.AccountAuthorizationSnapshot;
import com.winh.workplan.iam.account.AccountDirectory;
import com.winh.workplan.iam.account.AccountStatus;
import com.winh.workplan.iam.authorization.AuthorizationService;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.iam.shared.IdempotencyService;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class BusinessAccess {
    private final AuthorizationService authorization;
    private final AccountDirectory accounts;
    private final IdempotencyService idempotency;
    private final ObjectMapper mapper;

    public BusinessAccess(AuthorizationService authorization, AccountDirectory accounts,
            IdempotencyService idempotency, ObjectMapper mapper) {
        this.authorization = authorization; this.accounts = accounts;
        this.idempotency = idempotency; this.mapper = mapper;
    }
    public AccountAuthorizationSnapshot account(UUID id) {
        if (id == null) throw BusinessRules.invalid("ownerAccountId", "请选择启用的责任人。");
        return accounts.findAuthorizationSnapshot(id)
            .filter(a -> a.accountStatus() == AccountStatus.ENABLED)
            .orElseThrow(() -> BusinessRules.invalid("ownerAccountId", "所选人员不存在或已停用。"));
    }
    public String name(UUID id) {
        return id == null ? null : accounts.findAuthorizationSnapshot(id)
            .map(AccountAuthorizationSnapshot::displayName).orElse("历史用户");
    }
    public ResourceContext owned(UUID owner, UUID organization, UUID object) {
        return new ResourceContext(owner, organization, null, object == null ? null : object.toString(),
            false, true, true, true);
    }
    public ResourceContext creation(SessionPrincipal actor) {
        var account = account(actor.accountId());
        return owned(actor.accountId(), account.organizationUnitId(), null);
    }
    public boolean allows(SessionPrincipal actor, String permission, ResourceContext context) {
        return authorization.decide(actor, permission, context).allowed();
    }
    public void require(SessionPrincipal actor, String permission, ResourceContext context) {
        if (!allows(actor, permission, context)) throw new DomainException(HttpStatus.FORBIDDEN,
            "ACCESS_DENIED", "当前账号没有执行此操作的权限。");
    }
    public void readable(SessionPrincipal actor, String permission, ResourceContext context) {
        if (!allows(actor, permission, context)) throw BusinessRules.missing();
    }
    public List<String> actions(SessionPrincipal actor, ResourceContext context, String... permissions) {
        return Arrays.stream(permissions).filter(p -> allows(actor, p, context)).toList();
    }
    public IdempotencyService.IdempotencyReservation reserve(SessionPrincipal actor, String operation,
            UUID requestId, Object command) {
        if (requestId == null) throw BusinessRules.invalid("requestId", "缺少请求标识，请重新打开表单。");
        try {
            return idempotency.reserve(operation + ":" + actor.accountId(), requestId.toString(),
                mapper.writeValueAsString(command));
        } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    public void complete(IdempotencyService.IdempotencyReservation reservation, UUID id) {
        idempotency.complete(reservation, id);
    }
    public List<Person> people(SessionPrincipal actor) {
        return accounts.listActive().stream().filter(a -> allows(actor, "BUSINESS_PEOPLE_READ",
            owned(a.accountId(), a.organizationUnitId(), a.accountId())))
            .map(a -> new Person(a.accountId(), a.displayName(), a.organizationUnitId())).toList();
    }
    public record Person(UUID id, String name, UUID organizationUnitId) {}
}
