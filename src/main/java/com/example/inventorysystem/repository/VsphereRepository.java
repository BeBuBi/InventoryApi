package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.Vsphere;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface VsphereRepository extends JpaRepository<Vsphere, String> {

    @Query("""
            SELECT v FROM Vsphere v
            WHERE (:search IS NULL OR LOWER(v.hostname) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:cluster IS NULL OR v.cluster = :cluster)
              AND (:datacenter IS NULL OR v.datacenter = :datacenter)
              AND (:powerState IS NULL OR v.powerState = :powerState)
            """)
    Page<Vsphere> findAllFiltered(
            @Param("search") String search,
            @Param("cluster") String cluster,
            @Param("datacenter") String datacenter,
            @Param("powerState") String powerState,
            Pageable pageable
    );
}
