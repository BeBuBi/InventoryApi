package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.Vsphere;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VsphereRepository extends JpaRepository<Vsphere, String> {

    Optional<Vsphere> findByVmId(String vmId);

    @Query("""
            SELECT v FROM Vsphere v
            WHERE (:search IS NULL OR LOWER(v.hostname) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:datacenter IS NULL OR v.datacenter = :datacenter)
              AND (:powerState IS NULL OR v.powerState = :powerState)
            """)
    Page<Vsphere> findAllFiltered(
            @Param("search") String search,
            @Param("datacenter") String datacenter,
            @Param("powerState") String powerState,
            Pageable pageable
    );
}
