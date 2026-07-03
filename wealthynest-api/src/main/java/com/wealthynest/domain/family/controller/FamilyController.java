package com.wealthynest.domain.family.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import com.wealthynest.domain.expense.service.ExpenseService;
import com.wealthynest.domain.networth.service.NetWorthService;
import com.wealthynest.domain.family.dto.request.CreateFamilyRequest;
import com.wealthynest.domain.family.dto.request.JoinFamilyRequest;
import com.wealthynest.domain.family.dto.request.RenameFamilyRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import com.wealthynest.domain.family.dto.response.FamilyMemberResponse;
import com.wealthynest.domain.family.dto.response.FamilyMonthlyStatsResponse;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.domain.family.dto.response.FamilyResponse;
import com.wealthynest.domain.family.service.FamilyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/families")
@RequiredArgsConstructor
public class FamilyController {
    private final FamilyService    familyService;
    private final ExpenseService   expenseService;
    private final NetWorthService  netWorthService;
    private final IncomeRepository  incomeRepository;
    private final ExpenseRepository expenseRepository;
    private final UserRepository    userRepository;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<FamilyResponse>> createFamily(@Valid @RequestBody CreateFamilyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.created(familyService.createFamily(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PostMapping("/join")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<FamilyResponse>> joinFamily(@Valid @RequestBody JoinFamilyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                familyService.joinFamily(SecurityUtils.requireCurrentUserId(), request)));
    }

    @GetMapping("/{familyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<FamilyResponse>> getFamily(@PathVariable UUID familyId) {
        return ResponseEntity.ok(ApiResponse.success(
                familyService.getFamily(SecurityUtils.requireCurrentUserId(), familyId)));
    }

    @GetMapping("/{familyId}/members")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<FamilyMemberResponse>>> getMembers(@PathVariable UUID familyId) {
        return ResponseEntity.ok(ApiResponse.success(
                familyService.getMembers(SecurityUtils.requireCurrentUserId(), familyId)));
    }

    @PutMapping("/{familyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<FamilyResponse>> renameFamily(
            @PathVariable UUID familyId,
            @Valid @RequestBody RenameFamilyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                familyService.renameFamily(familyId, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/{familyId}/members/{memberId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable UUID familyId,
            @PathVariable UUID memberId) {
        familyService.removeMember(familyId, SecurityUtils.requireCurrentUserId(), memberId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/leave")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> leaveFamily() {
        familyService.leaveFamily(SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{familyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteFamily(@PathVariable UUID familyId) {
        familyService.deleteFamily(familyId, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{familyId}/admin/{targetId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> revokeAdmin(
            @PathVariable UUID familyId,
            @PathVariable UUID targetId) {
        familyService.revokeAdmin(familyId, SecurityUtils.requireCurrentUserId(), targetId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{familyId}/transfer-admin")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> transferAdmin(
            @PathVariable UUID familyId,
            @RequestBody Map<String, String> body) {
        UUID newAdminId = UUID.fromString(body.get("newAdminId"));
        familyService.transferAdmin(familyId, SecurityUtils.requireCurrentUserId(), newAdminId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /** All expenses across every family member — used exclusively by the Family tab spending chart. */
    @GetMapping("/{familyId}/expenses")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PagedResponse<ExpenseResponse>> getFamilyExpenses(
            @PathVariable UUID familyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "500") int size) {
        familyService.getFamily(SecurityUtils.requireCurrentUserId(), familyId); // membership check
        Pageable pageable = PageRequest.of(page, Math.min(size, 500), Sort.by("expenseDate").descending());
        return ResponseEntity.ok(PagedResponse.of(expenseService.getFamilyExpenses(familyId, startDate, endDate, pageable)));
    }

    /** Combined net worth of all family members — used exclusively by the Family tab. */
    @GetMapping("/{familyId}/net-worth")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<BigDecimal>> getFamilyNetWorth(@PathVariable UUID familyId) {
        familyService.getFamily(SecurityUtils.requireCurrentUserId(), familyId); // membership check
        return ResponseEntity.ok(ApiResponse.success(netWorthService.getFamilyNetWorth(familyId)));
    }

    /** Income, expense, savings and highest spender for a given month across all family members. */
    @GetMapping("/{familyId}/monthly-stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<FamilyMonthlyStatsResponse>> getMonthlyStats(
            @PathVariable UUID familyId,
            @RequestParam int year,
            @RequestParam int month) {
        familyService.getFamily(SecurityUtils.requireCurrentUserId(), familyId); // membership check

        var members = userRepository.findByFamilyId(familyId);

        BigDecimal totalIncome  = BigDecimal.ZERO;
        BigDecimal totalExpense = BigDecimal.ZERO;
        String     topName      = null;
        BigDecimal topAmount    = BigDecimal.ZERO;

        for (var member : members) {
            BigDecimal inc = incomeRepository.sumByUserAndPeriod(member.getId(), year, month);
            BigDecimal exp = expenseRepository.sumByUserAndMonth(member.getId(), year, month);
            if (inc == null) inc = BigDecimal.ZERO;
            if (exp == null) exp = BigDecimal.ZERO;
            totalIncome  = totalIncome.add(inc);
            totalExpense = totalExpense.add(exp);
            if (exp.compareTo(topAmount) > 0) {
                topAmount = exp;
                topName   = member.getFullName();
            }
        }

        return ResponseEntity.ok(ApiResponse.success(FamilyMonthlyStatsResponse.builder()
            .totalIncome(totalIncome)
            .totalExpense(totalExpense)
            .savings(totalIncome.subtract(totalExpense))
            .highestSpenderName(topName)
            .highestSpenderAmount(topAmount.compareTo(BigDecimal.ZERO) > 0 ? topAmount : null)
            .build()));
    }
}
