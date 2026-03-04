package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.SyncSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ScheduleRepository extends JpaRepository<SyncSchedule, Long> {

    Optional<SyncSchedule> findByService(String service);
}
