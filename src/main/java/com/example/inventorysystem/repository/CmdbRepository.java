package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.Cmdb;
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
              AND (:os IS NULL OR c.os = :os)
              AND (:environment IS NULL OR c.environment = :environment)
            """)
    Page<Cmdb> findAllFiltered(
            @Param("search") String search,
            @Param("os") String os,
            @Param("environment") String environment,
            Pageable pageable
    );
}
