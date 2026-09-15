package com.winh.workplan.finance;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface ForecastRevisionRepository extends JpaRepository<ForecastRevision,UUID> {
    List<ForecastRevision> findAllByBookIdOrderByNumberDesc(UUID bookId);
}
