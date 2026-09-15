package com.winh.workplan.iam.account;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID>, JpaSpecificationExecutor<UserAccount> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from UserAccount a where a.id = :id")
    Optional<UserAccount> lockForResourceCommit(UUID id);

	Optional<UserAccount> findByLoginNameNormalized(String loginNameNormalized);

	boolean existsByLoginNameNormalized(String loginNameNormalized);

	boolean existsByEmployeeCode(String employeeCode);

	long countByBootstrapSystemAdministratorTrueAndAccountStatus(AccountStatus accountStatus);

	long countByOrganizationUnitIdAndAccountStatus(UUID organizationUnitId, AccountStatus accountStatus);
}
