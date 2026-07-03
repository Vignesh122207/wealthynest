package com.wealthynest.domain.admin.repository;

import com.wealthynest.domain.admin.entity.JobScheduleConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JobScheduleConfigRepository extends JpaRepository<JobScheduleConfig, String> {
}
