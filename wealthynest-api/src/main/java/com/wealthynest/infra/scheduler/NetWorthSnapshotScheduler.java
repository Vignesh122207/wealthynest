package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse;
import com.wealthynest.domain.networth.service.NetWorthService;
import com.wealthynest.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.time.LocalDate;

@Slf4j
@Component
@RequiredArgsConstructor
public class NetWorthSnapshotScheduler {

    private final NetWorthService  netWorthService;
    private final UserRepository   userRepository;

    /** Entry point called by JobSchedulerService (NET_WORTH_SNAPSHOT job — configurable/triggerable from Admin). */
    public void takeMonthlySnapshots() {
        LocalDate prev  = LocalDate.now().minusMonths(1);
        int year  = prev.getYear();
        int month = prev.getMonthValue();
        log.info("Taking net worth snapshots for {}/{}", year, month);

        userRepository.findAll().forEach(user -> {
            try {
                NetWorthSummaryResponse summary = netWorthService.getSummary(user.getId(), user.getFamilyId());
                netWorthService.saveSnapshot(user.getId(), summary.getTotalNetWorth(), year, month);
            } catch (Exception e) {
                log.warn("Failed net worth snapshot for user {}: {}", user.getId(), e.getMessage());
            }
        });

        log.info("Net worth snapshots complete for {}/{}", year, month);
    }
}
