package com.winh.workplan.finance;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface ForecastBookRepository extends JpaRepository<ForecastBook,UUID> {
    Optional<ForecastBook> findByProjectIdAndPeriodAndCurrency(UUID projectId,String period,String currency);
}
