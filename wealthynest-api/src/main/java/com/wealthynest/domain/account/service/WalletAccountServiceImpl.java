package com.wealthynest.domain.account.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.common.response.PagedResponse;
import org.springframework.http.HttpStatus;
import com.wealthynest.domain.account.dto.request.CreateAccountRequest;
import com.wealthynest.domain.account.dto.request.TransferRequest;
import com.wealthynest.domain.account.dto.request.UpdateTransferRequest;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.dto.response.AccountTransactionItem;
import com.wealthynest.domain.account.dto.response.TransferResponse;
import com.wealthynest.domain.account.entity.AccountTransfer;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.goal.repository.GoalRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class WalletAccountServiceImpl implements WalletAccountService {

    private final WalletAccountRepository   accountRepository;
    private final AccountTransferRepository transferRepository;
    private final IncomeRepository          incomeRepository;
    private final ExpenseRepository         expenseRepository;
    private final CategoryRepository        categoryRepository;
    private final InvestmentRepository      investmentRepository;
    private final GoalRepository            goalRepository;

    @Override
    @Transactional(readOnly = true)
    public List<AccountResponse> getAccounts(UUID userId) {
        return accountRepository.findByUserIdOrderByCreatedAtAsc(userId)
                .stream().filter(a -> !a.isArchived()).map(this::enrich).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountResponse> getArchivedAccounts(UUID userId) {
        return accountRepository.findByUserIdAndArchivedTrueOrderByCreatedAtAsc(userId)
                .stream().map(this::enrich).toList();
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse archiveAccount(UUID id, UUID userId) {
        WalletAccount acct = accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", id));
        if (!acct.getUserId().equals(userId)) throw new AccessDeniedException();
        acct.setArchived(true);
        return enrich(accountRepository.save(acct));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse unarchiveAccount(UUID id, UUID userId) {
        WalletAccount acct = accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account", "id", id));
        if (!acct.getUserId().equals(userId)) throw new AccessDeniedException();

        // Singleton types (CASH_WALLET, EMERGENCY_FUND) can only have one active account at a time.
        // Block the restore if there is already an active account of the same type.
        boolean singleton = acct.getAccountType() != AccountType.BANK_ACCOUNT
                         && acct.getAccountType() != AccountType.CREDIT_CARD;
        if (singleton && accountRepository.existsByUserIdAndAccountTypeAndArchivedFalse(userId, acct.getAccountType())) {
            String typeName = acct.getAccountType().name().replace('_', ' ').toLowerCase();
            throw new BusinessException(
                "You already have an active " + typeName + " account. Archive it first before restoring this one.",
                HttpStatus.CONFLICT
            );
        }

        acct.setArchived(false);
        return enrich(accountRepository.save(acct));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse createAccount(UUID userId, CreateAccountRequest req) {
        // BANK_ACCOUNT and CREDIT_CARD can be created multiple times; others are singletons
        boolean singleton = req.getAccountType() != AccountType.BANK_ACCOUNT
                         && req.getAccountType() != AccountType.CREDIT_CARD;
        if (singleton) {
            String typeName = req.getAccountType().name().replace('_', ' ').toLowerCase();
            // Block if an active account of this type already exists
            if (accountRepository.existsByUserIdAndAccountTypeAndArchivedFalse(userId, req.getAccountType())) {
                throw new BusinessException("You already have an active " + typeName + " account.", HttpStatus.CONFLICT);
            }
            // Block if an archived account of this type exists — force restore instead of creating a duplicate
            if (accountRepository.existsByUserIdAndAccountType(userId, req.getAccountType())) {
                throw new BusinessException(
                    "You have an archived " + typeName + " account with existing history. " +
                    "Restore it to keep your records, or delete it permanently before creating a new one.",
                    HttpStatus.CONFLICT
                );
            }
        }
        WalletAccount account = WalletAccount.builder()
                .userId(userId)
                .accountType(req.getAccountType())
                .name(req.getName())
                .bankName(req.getBankName())
                .accountNumber(req.getAccountNumber())
                .openingBalance(req.getOpeningBalance() != null ? req.getOpeningBalance() : BigDecimal.ZERO)
                .creditLimit(req.getCreditLimit())
                .statementDay(req.getStatementDay())
                .paymentDueDay(req.getPaymentDueDay())
                .apr(req.getApr())
                .build();
        return enrich(accountRepository.save(account));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse updateAccount(UUID id, UUID userId, CreateAccountRequest req) {
        WalletAccount account = findAndValidate(id, userId);
        account.setName(req.getName());
        if (req.getBankName()      != null) account.setBankName(req.getBankName());
        if (req.getAccountNumber() != null) account.setAccountNumber(req.getAccountNumber());
        if (req.getOpeningBalance() != null) account.setOpeningBalance(req.getOpeningBalance());
        if (req.getCreditLimit()   != null) account.setCreditLimit(req.getCreditLimit());
        if (req.getStatementDay()  != null) account.setStatementDay(req.getStatementDay());
        if (req.getPaymentDueDay() != null) account.setPaymentDueDay(req.getPaymentDueDay());
        if (req.getApr()           != null) account.setApr(req.getApr());
        return enrich(accountRepository.save(account));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public void deleteAccount(UUID id, UUID userId) {
        WalletAccount account = findAndValidate(id, userId);
        // Clear nullable FK references so deletion doesn't hit constraint violations
        expenseRepository.clearAccountId(id);
        incomeRepository.clearAccountId(id);
        investmentRepository.clearLinkedAccountId(id);
        investmentRepository.clearDebitAccountId(id);
        goalRepository.clearAccountId(id);
        // Transfers have ON DELETE RESTRICT — must be deleted explicitly
        transferRepository.deleteAll(transferRepository.findByAccountId(id));
        // debt_records.account_id has ON DELETE SET NULL — handled by DB
        // recurring_income.account_id has ON DELETE CASCADE — handled by DB
        accountRepository.delete(account);
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public TransferResponse transfer(UUID userId, TransferRequest req) {
        if (req.getFromAccountId().equals(req.getToAccountId()))
            throw new BusinessException("Cannot transfer to the same account.", HttpStatus.BAD_REQUEST);
        WalletAccount from = findAndValidate(req.getFromAccountId(), userId);
        WalletAccount to   = findAndValidate(req.getToAccountId(),   userId);
        AccountTransfer transfer = AccountTransfer.builder()
                .userId(userId)
                .fromAccountId(from.getId())
                .toAccountId(to.getId())
                .amount(req.getAmount())
                .description(req.getDescription())
                .transferDate(req.getTransferDate())
                .build();
        return toTransferResponse(transferRepository.save(transfer), from.getName(), to.getName());
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public TransferResponse updateTransfer(UUID transferId, UUID userId, UpdateTransferRequest req) {
        AccountTransfer t = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer", "id", transferId));
        if (!t.getUserId().equals(userId)) throw new AccessDeniedException();
        if (req.getAmount()       != null) t.setAmount(req.getAmount());
        if (req.getTransferDate() != null) t.setTransferDate(req.getTransferDate());
        if (req.getDescription()  != null) t.setDescription(req.getDescription());
        AccountTransfer saved = transferRepository.save(t);
        List<WalletAccount> accounts = accountRepository.findByUserIdOrderByCreatedAtAsc(userId);
        Map<UUID, String> nameMap = accounts.stream()
                .collect(Collectors.toMap(WalletAccount::getId, WalletAccount::getName));
        return toTransferResponse(saved,
                nameMap.getOrDefault(saved.getFromAccountId(), "Unknown"),
                nameMap.getOrDefault(saved.getToAccountId(),   "Unknown"));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public void deleteTransfer(UUID transferId, UUID userId) {
        AccountTransfer t = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer", "id", transferId));
        if (!t.getUserId().equals(userId)) throw new AccessDeniedException();
        transferRepository.delete(t);
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<TransferResponse> getTransfers(UUID userId, Pageable pageable) {
        List<WalletAccount> accounts = accountRepository.findByUserIdOrderByCreatedAtAsc(userId);
        Map<UUID, String> nameMap = accounts.stream()
                .collect(Collectors.toMap(WalletAccount::getId, WalletAccount::getName));
        Page<TransferResponse> page = transferRepository
                .findByUserIdOrderByTransferDateDesc(userId, pageable)
                .map(t -> toTransferResponse(t,
                        nameMap.getOrDefault(t.getFromAccountId(), "Unknown"),
                        nameMap.getOrDefault(t.getToAccountId(),   "Unknown")));
        return PagedResponse.of(page);
    }

    // ─── private helpers ───────────────────────────────────────────────────────

    private WalletAccount findAndValidate(UUID id, UUID userId) {
        WalletAccount a = accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WalletAccount", "id", id));
        if (!a.getUserId().equals(userId)) throw new AccessDeniedException();
        return a;
    }

    private AccountResponse enrich(WalletAccount account) {
        UUID id = account.getId();
        // Full sums (including debt + adjustments) — used only for balance calculation
        BigDecimal incomeIn     = incomeRepository.sumByAccountId(id);
        BigDecimal expenseOut   = expenseRepository.sumByAccountId(id);
        BigDecimal transfersIn  = transferRepository.sumTransfersIn(id);
        BigDecimal transfersOut = transferRepository.sumTransfersOut(id);

        // Display totals exclude debt entries and balance adjustments
        BigDecimal displayTransfersIn  = transferRepository.sumRegularTransfersIn(id);
        BigDecimal displayTransfersOut = transferRepository.sumRegularTransfersOut(id);
        BigDecimal displayIn  = incomeRepository.sumRegularByAccountId(id).add(displayTransfersIn);
        BigDecimal displayOut = expenseRepository.sumRegularByAccountId(id).add(displayTransfersOut);

        boolean isCreditCard = account.getAccountType() == AccountType.CREDIT_CARD;
        BigDecimal balance = isCreditCard
                ? account.getOpeningBalance().add(expenseOut).add(transfersOut).subtract(incomeIn).subtract(transfersIn)
                : account.getOpeningBalance()
                        .add(incomeIn).add(transfersIn)
                        .subtract(expenseOut).subtract(transfersOut);

        List<AccountTransactionItem> recent = buildRecentTransactions(account);

        AccountResponse.AccountResponseBuilder builder = AccountResponse.builder()
                .id(account.getId())
                .accountType(account.getAccountType().name())
                .name(account.getName())
                .bankName(account.getBankName())
                .accountNumber(account.getAccountNumber())
                .openingBalance(account.getOpeningBalance())
                .currentBalance(balance)
                .totalMoneyIn(displayIn)
                .totalMoneyOut(displayOut)
                .recentTransactions(recent)
                .createdAt(account.getCreatedAt())
                .archived(account.isArchived());

        if (isCreditCard) {
            BigDecimal limit = account.getCreditLimit();
            BigDecimal available = limit != null
                    ? limit.subtract(balance).max(BigDecimal.ZERO) : null;
            LocalDate today = LocalDate.now();
            LocalDate nextStatement = null;
            LocalDate nextDue       = null;
            if (account.getStatementDay() != null) {
                int sd = account.getStatementDay();
                nextStatement = today.getDayOfMonth() < sd
                        ? today.withDayOfMonth(sd)
                        : today.plusMonths(1).withDayOfMonth(sd);
            }
            if (account.getPaymentDueDay() != null && nextStatement != null) {
                // Due date = payment_due_day of the month AFTER next statement
                nextDue = nextStatement.plusMonths(1).withDayOfMonth(account.getPaymentDueDay());
            }
            builder.creditLimit(limit)
                   .availableCredit(available)
                   .statementDay(account.getStatementDay())
                   .paymentDueDay(account.getPaymentDueDay())
                   .apr(account.getApr())
                   .nextStatementDate(nextStatement)
                   .nextDueDate(nextDue);
        }

        return builder.build();
    }

    private List<AccountTransactionItem> buildRecentTransactions(WalletAccount account) {
        UUID id = account.getId();

        List<AccountTransactionItem> items = new ArrayList<>();

        // Income credits — tag DIVIDEND/INTEREST as INVESTMENT source for frontend badge
        incomeRepository.findTop5ByAccountIdAndDebtFalseOrderByIncomeDateDesc(id).forEach(e -> {
            String src = e.getSource().name();
            boolean fromInvestment = "DIVIDEND".equals(src) || "INTEREST".equals(src);
            items.add(AccountTransactionItem.builder()
                .id(e.getId().toString())
                .type("INCOME")
                .label(src)
                .source(fromInvestment ? "INVESTMENT" : "MANUAL")
                .amount(e.getAmount())
                .date(e.getIncomeDate())
                .description(e.getDescription())
                .build());
        });

        // Expense debits — batch-load categories to avoid N+1
        List<Expense> top5Expenses = expenseRepository.findTop5ByAccountIdAndDebtFalseOrderByExpenseDateDesc(id);
        Set<UUID> catIds = top5Expenses.stream().map(Expense::getCategoryId).collect(Collectors.toSet());
        Map<UUID, String> catNames = categoryRepository.findAllById(catIds).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName));
        top5Expenses.forEach(e -> {
            String categoryName = catNames.getOrDefault(e.getCategoryId(), "Expense");
            items.add(AccountTransactionItem.builder()
                .id(e.getId().toString())
                .type("EXPENSE")
                .label(categoryName)
                .amount(e.getAmount())
                .date(e.getExpenseDate())
                .description(e.getDescription())
                .build());
        });

        // Transfers — limited query; no longer loads all rows
        transferRepository.findTop5ByAccountId(id).forEach(t -> {
            boolean isIn       = id.equals(t.getToAccountId());
            boolean isAdjust   = "Balance Adjustment".equals(t.getDescription());
            String  txnType    = isAdjust ? "ADJUSTMENT" : (isIn ? "TRANSFER_IN" : "TRANSFER_OUT");
            String  txnLabel   = isAdjust ? "Adjustment" : (isIn ? "Transfer In" : "Transfer Out");
            items.add(AccountTransactionItem.builder()
                .id(t.getId().toString())
                .type(txnType)
                .label(txnLabel)
                .amount(t.getAmount())
                .date(t.getTransferDate())
                .description(t.getDescription())
                .build());
        });

        // Debt-tagged expenses (lent out, borrowed repayments) — shown as DEBT_OUT
        expenseRepository.findTop5ByAccountIdAndDebtTrueOrderByExpenseDateDesc(id).forEach(e ->
            items.add(AccountTransactionItem.builder()
                .id(e.getId().toString())
                .type("DEBT_OUT")
                .label("Debt")
                .amount(e.getAmount())
                .date(e.getExpenseDate())
                .description(e.getDescription())
                .build()));

        // Debt-tagged incomes (borrowed in, lent repayments received) — shown as DEBT_IN
        incomeRepository.findTop5ByAccountIdAndDebtTrueOrderByIncomeDateDesc(id).forEach(e ->
            items.add(AccountTransactionItem.builder()
                .id(e.getId().toString())
                .type("DEBT_IN")
                .label("Debt")
                .amount(e.getAmount())
                .date(e.getIncomeDate())
                .description(e.getDescription())
                .build()));

        return items.stream()
                .sorted(Comparator.comparing(AccountTransactionItem::getDate).reversed())
                .limit(10)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] generateStatementCsv(UUID accountId, UUID userId) {
        WalletAccount account = accountRepository.findById(accountId)
                .orElseThrow(() -> new com.wealthynest.common.exception.ResourceNotFoundException("Account", "id", accountId));
        if (!account.getUserId().equals(userId)) throw new com.wealthynest.common.exception.AccessDeniedException();

        // Load all transactions
        List<AccountTransactionItem> items = new ArrayList<>();

        incomeRepository.findAllByAccountIdOrderByIncomeDateDesc(accountId).forEach(e -> {
            String src = e.getSource().name();
            boolean fromInvestment = "DIVIDEND".equals(src) || "INTEREST".equals(src);
            items.add(AccountTransactionItem.builder()
                .id(e.getId().toString()).type("INCOME").label(src)
                .source(fromInvestment ? "INVESTMENT" : "MANUAL")
                .amount(e.getAmount()).date(e.getIncomeDate()).description(e.getDescription())
                .build());
        });

        List<Expense> expenses = expenseRepository.findAllByAccountIdOrderByExpenseDateDesc(accountId);
        Set<UUID> catIds = expenses.stream().map(Expense::getCategoryId).collect(Collectors.toSet());
        Map<UUID, String> catNames = categoryRepository.findAllById(catIds).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName));
        expenses.forEach(e -> items.add(AccountTransactionItem.builder()
                .id(e.getId().toString()).type("EXPENSE")
                .label(catNames.getOrDefault(e.getCategoryId(), "Expense"))
                .amount(e.getAmount()).date(e.getExpenseDate()).description(e.getDescription())
                .build()));

        transferRepository.findByAccountId(accountId).forEach(t -> {
            boolean isIn = accountId.equals(t.getToAccountId());
            items.add(AccountTransactionItem.builder()
                .id(t.getId().toString()).type(isIn ? "TRANSFER_IN" : "TRANSFER_OUT")
                .label(isIn ? "Transfer In" : "Transfer Out")
                .amount(t.getAmount()).date(t.getTransferDate()).description(t.getDescription())
                .build());
        });

        items.sort(Comparator.comparing(AccountTransactionItem::getDate).reversed());

        StringBuilder sb = new StringBuilder("Date,Type,Description,Label,Amount (INR)\n");
        for (AccountTransactionItem it : items) {
            String sign = "EXPENSE".equals(it.getType()) || "TRANSFER_OUT".equals(it.getType()) || "DEBT_OUT".equals(it.getType()) ? "-" : "+";
            sb.append(it.getDate()).append(',')
              .append(it.getType()).append(',')
              .append(escape(it.getDescription())).append(',')
              .append(escape(it.getLabel())).append(',')
              .append(sign).append(it.getAmount()).append('\n');
        }
        return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private String escape(String v) {
        if (v == null) return "";
        return v.contains(",") || v.contains("\"") ? "\"" + v.replace("\"", "\"\"") + "\"" : v;
    }

    @Override @Transactional
    public AccountResponse adjustBalance(UUID id, UUID userId, BigDecimal targetBalance) {
        WalletAccount account = findAndValidate(id, userId);
        AccountResponse current = enrich(account);
        BigDecimal diff = targetBalance.subtract(current.getCurrentBalance());
        if (diff.compareTo(BigDecimal.ZERO) == 0) return current;

        LocalDate today = LocalDate.now();
        if (diff.compareTo(BigDecimal.ZERO) > 0) {
            // Money comes in from nowhere → toAccountId=account, fromAccountId=null
            transferRepository.save(AccountTransfer.builder()
                    .userId(userId)
                    .fromAccountId(null)
                    .toAccountId(id)
                    .amount(diff)
                    .description("Balance Adjustment")
                    .transferDate(today)
                    .build());
        } else {
            // Money goes out to nowhere → fromAccountId=account, toAccountId=null
            transferRepository.save(AccountTransfer.builder()
                    .userId(userId)
                    .fromAccountId(id)
                    .toAccountId(null)
                    .amount(diff.abs())
                    .description("Balance Adjustment")
                    .transferDate(today)
                    .build());
        }
        return enrich(account);
    }

    private TransferResponse toTransferResponse(AccountTransfer t, String fromName, String toName) {
        boolean isAdjustment = "Balance Adjustment".equals(t.getDescription());
        String resolvedFromName = t.getFromAccountId() == null ? (isAdjustment ? "Adjustment" : "External") : fromName;
        String resolvedToName   = t.getToAccountId()   == null ? (isAdjustment ? "Adjustment" : "Investment") : toName;
        return TransferResponse.builder()
                .id(t.getId()).fromAccountId(t.getFromAccountId()).fromAccountName(resolvedFromName)
                .toAccountId(t.getToAccountId()).toAccountName(resolvedToName)
                .amount(t.getAmount()).description(t.getDescription())
                .transferDate(t.getTransferDate()).createdAt(t.getCreatedAt())
                .build();
    }
}
