package com.cox.inventorysystem.repository;

import com.cox.inventorysystem.model.Inventory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

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

    @Query("""
            SELECT i FROM Inventory i
            WHERE (i.sources LIKE '%vsphere%' OR i.sources LIKE '%newrelic%')
              AND i.sources NOT LIKE '%cmdb%'
              AND (:search IS NULL OR LOWER(i.hostname) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:powerState IS NULL OR i.powerState = :powerState)
              AND (:sources IS NULL OR i.sources LIKE CONCAT('%', :sources, '%'))
            """)
    Page<Inventory> findMissingFromCmdb(
            @Param("search") String search,
            @Param("powerState") String powerState,
            @Param("sources") String sources,
            Pageable pageable);

    @Query("""
            SELECT COUNT(i) FROM Inventory i
            WHERE (i.sources LIKE '%vsphere%' OR i.sources LIKE '%newrelic%')
              AND i.sources NOT LIKE '%cmdb%'
            """)
    long countMissingFromCmdb();

    /** Fetch all hosts that are in CMDB and have at least one vSphere or NR IP to compare. */
    @Query("""
            SELECT i FROM Inventory i
            WHERE i.sources LIKE '%cmdb%'
              AND (i.vsphereIpv4 IS NOT NULL OR i.nrIpv4 IS NOT NULL)
              AND (:search IS NULL OR LOWER(i.hostname) LIKE LOWER(CONCAT('%', :search, '%')))
            """)
    List<Inventory> findCandidatesForIpDiscrepancy(@Param("search") String search);
}
