package com.wealthynest.domain.admin.repository;

import com.wealthynest.domain.admin.entity.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, Boolean> {
}
