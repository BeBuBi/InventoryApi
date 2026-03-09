package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.NewRelic;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NewRelicRepository extends JpaRepository<NewRelic, String> {

    @Query("""
            SELECT n FROM NewRelic n
            WHERE (:search IS NULL OR LOWER(n.hostname) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:service IS NULL OR n.service = :service)
              AND (:environment IS NULL OR n.environment = :environment)
              AND (:accountIds IS NULL OR n.accountId IN (:accountIds))
              AND (:linuxDistros IS NULL OR n.linuxDistribution IN (:linuxDistros))
            """)
    Page<NewRelic> findAllFiltered(
            @Param("search") String search,
            @Param("service") String service,
            @Param("environment") String environment,
            @Param("accountIds") List<String> accountIds,
            @Param("linuxDistros") List<String> linuxDistros,
            Pageable pageable
    );

    @Query("SELECT DISTINCT n.environment FROM NewRelic n WHERE n.environment IS NOT NULL ORDER BY n.environment")
    List<String> findDistinctEnvironments();

    @Query("SELECT DISTINCT n.accountId FROM NewRelic n WHERE n.accountId IS NOT NULL ORDER BY n.accountId")
    List<String> findDistinctAccountIds();

    @Query("SELECT DISTINCT n.linuxDistribution FROM NewRelic n WHERE n.linuxDistribution IS NOT NULL ORDER BY n.linuxDistribution")
    List<String> findDistinctLinuxDistros();
}
