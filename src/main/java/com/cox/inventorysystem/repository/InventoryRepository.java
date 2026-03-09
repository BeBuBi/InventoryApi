package com.cox.inventorysystem.repository;

import com.cox.inventorysystem.model.Inventory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, String> {

    @Query("""
            SELECT i FROM Inventory i
            WHERE (:search IS NULL OR LOWER(i.hostname) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:operationalStatus IS NULL OR i.operationalStatus = :operationalStatus)
              AND (:sources IS NULL OR i.sources LIKE CONCAT('%', :sources, '%'))
            """)
    Page<Inventory> findAllFiltered(
            @Param("search") String search,
            @Param("operationalStatus") String operationalStatus,
            @Param("sources") String sources,
            Pageable pageable
    );

    @Query("SELECT COUNT(i) FROM Inventory i")
    long countTotal();

    @Query("SELECT COUNT(i) FROM Inventory i WHERE i.sources LIKE '%vsphere%'")
    long countVsphere();

    @Query("SELECT COUNT(i) FROM Inventory i WHERE i.sources LIKE '%newrelic%'")
    long countNewrelic();

    @Query("SELECT COUNT(i) FROM Inventory i WHERE i.sources LIKE '%cmdb%'")
    long countCmdb();
}
