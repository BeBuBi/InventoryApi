package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.Vsphere;
import java.util.List;
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
              AND ((:powerStates) IS EMPTY OR v.powerState IN (:powerStates))
              AND ((:sourceUrls) IS EMPTY OR v.sourceUrl IN (:sourceUrls))
              AND ((:guestOsTypes) IS EMPTY OR v.guestOs IN (:guestOsTypes))
            """)
    Page<Vsphere> findAllFiltered(
            @Param("search") String search,
            @Param("powerStates") List<String> powerStates,
            @Param("sourceUrls") List<String> sourceUrls,
            @Param("guestOsTypes") List<String> guestOsTypes,
            Pageable pageable
    );

    @Query("SELECT DISTINCT v.sourceUrl FROM Vsphere v WHERE v.sourceUrl IS NOT NULL ORDER BY v.sourceUrl")
    List<String> findDistinctSourceUrls();

    @Query("SELECT DISTINCT v.guestOs FROM Vsphere v WHERE v.guestOs IS NOT NULL ORDER BY v.guestOs ASC")
    List<String> findDistinctGuestOs();
}
