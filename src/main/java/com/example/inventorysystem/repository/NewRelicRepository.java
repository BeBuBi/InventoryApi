package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.NewRelic;
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
            """)
    Page<NewRelic> findAllFiltered(
            @Param("search") String search,
            @Param("service") String service,
            @Param("environment") String environment,
            Pageable pageable
    );
}
