package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.Inventory;
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
              AND (:environment IS NULL OR i.environment = :environment)
              AND (:status IS NULL OR i.status = :status)
              AND (:assetType IS NULL OR i.assetType = :assetType)
            """)
    Page<Inventory> findAllFiltered(
            @Param("search") String search,
            @Param("environment") String environment,
            @Param("status") String status,
            @Param("assetType") String assetType,
            Pageable pageable
    );
}
