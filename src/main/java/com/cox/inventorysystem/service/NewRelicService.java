package com.cox.inventorysystem.service;

import com.cox.inventorysystem.dto.NewRelicResponse;
import com.cox.inventorysystem.dto.PagedResponse;
import com.cox.inventorysystem.exception.ResourceNotFoundException;
import com.cox.inventorysystem.repository.NewRelicRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NewRelicService {

    private final NewRelicRepository newRelicRepository;

    public PagedResponse<NewRelicResponse> list(
            String search,
            String service,
            String environment,
            List<String> accountIds,
            List<String> linuxDistros,
            int page,
            int size) {

        var pageable = PageRequest.of(page, size, Sort.by("hostname").ascending());
        var results = newRelicRepository.findAllFiltered(
                nullIfBlank(search),
                nullIfBlank(service),
                nullIfBlank(environment),
                nullIfEmpty(accountIds),
                nullIfEmpty(linuxDistros),
                pageable);
        return new PagedResponse<>(results.map(NewRelicResponse::new));
    }

    public List<String> listEnvironments() {
        return newRelicRepository.findDistinctEnvironments();
    }

    public List<String> listAccountIds() {
        return newRelicRepository.findDistinctAccountIds();
    }

    public List<String> listLinuxDistros() {
        return newRelicRepository.findDistinctLinuxDistros();
    }

    public NewRelicResponse getByHostname(String hostname) {
        return newRelicRepository.findById(hostname)
                .map(NewRelicResponse::new)
                .orElseThrow(() -> new ResourceNotFoundException("New Relic record not found: " + hostname));
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private List<String> nullIfEmpty(List<String> list) {
        return (list == null || list.isEmpty()) ? null : list;
    }
}
