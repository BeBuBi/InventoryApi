package com.example.inventorysystem.repository;

import com.example.inventorysystem.model.Credential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CredentialRepository extends JpaRepository<Credential, Long> {

    List<Credential> findByService(String service);

    List<Credential> findByServiceAndEnabledTrue(String service);

    Optional<Credential> findByServiceAndName(String service, String name);

    boolean existsByServiceAndName(String service, String name);
}
