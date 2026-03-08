package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.Cmdb;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CmdbRepository extends JpaRepository<Cmdb, String> {

    @Query("""
            SELECT c FROM Cmdb c
            WHERE (:search IS NULL OR LOWER(c.hostname) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:operationalStatus IS NULL OR c.operationalStatus = :operationalStatus)
            """)
    Page<Cmdb> findAllFiltered(
            @Param("search") String search,
            @Param("operationalStatus") String operationalStatus,
            Pageable pageable
    );

    @Query("SELECT DISTINCT c.operationalStatus FROM Cmdb c WHERE c.operationalStatus IS NOT NULL ORDER BY c.operationalStatus")
    List<String> findDistinctOperationalStatuses();
}
