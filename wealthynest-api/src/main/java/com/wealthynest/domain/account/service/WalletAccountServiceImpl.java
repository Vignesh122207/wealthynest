package com.wealthynest.domain.account.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.common.response.PagedResponse;
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
import com.wealthynest.domain.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletAccountServiceImpl implements WalletAccountService {

    /** Only one active account of these types may exist per user. */
    private static final Set<AccountType> SINGLETON_TYPES = Set.of(AccountType.CASH_WALLET, AccountType.EMERGENCY_FUND);

    private final WalletAccountRepository   accountRepository;
    private final AccountTransferRepository transferRepository;
    private final IncomeRepository          incomeRepository;
    private final ExpenseRepository         expenseRepository;
    private final CategoryRepository        categoryRepository;
    private final InvestmentRepository      investmentRepository;
    private final GoalRepository            goalRepository;
    private final AccountBalanceGuard       accountBalanceGuard;
    private final NotificationService       notificationService;

    @Override
    @Transactional(readOnly = true)
    public List<AccountResponse> getAccounts(UUID userId) {
        List<WalletAccount> accounts = accountRepository.findByUserIdOrderByCreatedAtAsc(userId)
                .stream().filter(a -> !a.isArchived()).toList();
        return enrichBatch(accounts);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountResponse> getAccountsForUsers(List<UUID> userIds) {
        if (userIds.isEmpty()) return List.of();
        return enrichBatch(accountRepository.findByUserIdInAndArchivedFalse(userIds));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountResponse> getArchivedAccounts(UUID userId) {
        List<WalletAccount> accounts = accountRepository.findByUserIdAndArchivedTrueOrderByCreatedAtAsc(userId);
        return enrichBatch(accounts);
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse archiveAccount(UUID id, UUID userId) {
        WalletAccount acct = findAndValidate(id, userId);
        acct.setArchived(true);
        return enrich(accountRepository.save(acct));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse unarchiveAccount(UUID id, UUID userId) {
        WalletAccount acct = findAndValidate(id, userId);

        // Singleton types (CASH_WALLET, EMERGENCY_FUND) can only have one active account at a time.
        // Block the restore if there is already an active account of the same type.
        boolean singleton = SINGLETON_TYPES.contains(acct.getAccountType());
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
        boolean singleton = SINGLETON_TYPES.contains(req.getAccountType());
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
        // Credit-limit/billing-cycle fields only mean anything for a card, and apr is shared between
        // card and loan — apply each only where it's relevant, regardless of what the request carries,
        // so a stale value left over from a different type picked earlier in the same form can't ride along.
        boolean isCC = req.getAccountType() == AccountType.CREDIT_CARD;
        boolean isLoan = req.getAccountType() == AccountType.LOAN;
        WalletAccount account = WalletAccount.builder()
                .userId(userId)
                .accountType(req.getAccountType())
                .name(req.getName())
                .bankName(req.getBankName())
                .accountNumber(req.getAccountNumber())
                .openingBalance(req.getOpeningBalance() != null ? req.getOpeningBalance() : BigDecimal.ZERO)
                .lowBalanceThreshold(req.getLowBalanceThreshold())
                .creditLimit(isCC ? req.getCreditLimit() : null)
                .statementDay(isCC ? req.getStatementDay() : null)
                .paymentDueDay(isCC ? req.getPaymentDueDay() : null)
                .apr((isCC || isLoan) ? req.getApr() : null)
                .build();
        if (req.getAccountType() == AccountType.LOAN) {
            applyLoanFields(account, req, userId);
            // Original principal defaults to the outstanding at creation when not given
            if (account.getPrincipalAmount() == null) account.setPrincipalAmount(account.getOpeningBalance());
        }
        // First-ever bank account becomes primary automatically; later ones need an explicit "Set as Primary".
        if (req.getAccountType() == AccountType.BANK_ACCOUNT
                && !accountRepository.existsByUserIdAndAccountTypeAndArchivedFalse(userId, AccountType.BANK_ACCOUNT)) {
            account.setPrimary(true);
        }
        return enrich(accountRepository.save(account));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse updateAccount(UUID id, UUID userId, CreateAccountRequest req) {
        WalletAccount account = findAndValidate(id, userId);
        boolean isCC = account.getAccountType() == AccountType.CREDIT_CARD;
        boolean isLoan = account.getAccountType() == AccountType.LOAN;
        account.setName(req.getName());
        if (req.getBankName()      != null) account.setBankName(req.getBankName());
        if (req.getAccountNumber() != null) account.setAccountNumber(req.getAccountNumber());
        if (req.getOpeningBalance() != null) account.setOpeningBalance(req.getOpeningBalance());
        if (req.getLowBalanceThreshold() != null) account.setLowBalanceThreshold(req.getLowBalanceThreshold());
        if (isCC && req.getCreditLimit()   != null) account.setCreditLimit(req.getCreditLimit());
        if (isCC && req.getStatementDay()  != null) account.setStatementDay(req.getStatementDay());
        if (isCC && req.getPaymentDueDay() != null) account.setPaymentDueDay(req.getPaymentDueDay());
        if ((isCC || isLoan) && req.getApr() != null) account.setApr(req.getApr());
        if (isLoan) applyLoanFields(account, req, userId);
        return enrich(accountRepository.save(account));
    }

    private void applyLoanFields(WalletAccount account, CreateAccountRequest req, UUID userId) {
        if (req.getLoanType()        != null) account.setLoanType(req.getLoanType());
        if (req.getPrincipalAmount() != null) account.setPrincipalAmount(req.getPrincipalAmount());
        if (req.getEmiAmount()       != null) account.setEmiAmount(req.getEmiAmount());
        if (req.getEmiDay()          != null) account.setEmiDay(req.getEmiDay());
        if (req.getLoanEndDate()     != null) account.setLoanEndDate(req.getLoanEndDate());
        if (req.getAutopayAccountId() != null) {
            WalletAccount source = accountRepository.findByIdAndUserId(req.getAutopayAccountId(), userId)
                    .orElseThrow(() -> new ResourceNotFoundException("WalletAccount", "id", req.getAutopayAccountId()));
            if (source.getAccountType().isLiability() || source.getAccountType() == AccountType.INVESTMENT) {
                throw new BusinessException("EMIs can only be auto-debited from a cash or bank account.", HttpStatus.BAD_REQUEST);
            }
            account.setAutopayAccountId(source.getId());
        }
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public void deleteAccount(UUID id, UUID userId, boolean alsoDeleteTransactions) {
        WalletAccount account = findAndValidate(id, userId);
        // Default: detach so reports/charts that sum by month or category keep reflecting money
        // that already moved. Opt-in: the user explicitly asked to purge this account's history too.
        if (alsoDeleteTransactions) {
            expenseRepository.deleteByAccountId(id);
            incomeRepository.deleteByAccountId(id);
        } else {
            expenseRepository.clearAccountId(id);
            incomeRepository.clearAccountId(id);
        }
        // Clear nullable FK references so deletion doesn't hit constraint violations
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
        accountBalanceGuard.validateSufficientBalance(from.getId(), userId, req.getAmount(), BigDecimal.ZERO);
        AccountTransfer transfer = AccountTransfer.builder()
                .userId(userId)
                .fromAccountId(from.getId())
                .toAccountId(to.getId())
                .amount(req.getAmount())
                .description(req.getDescription())
                .transferDate(req.getTransferDate())
                .build();
        TransferResponse response = toTransferResponse(transferRepository.save(transfer), from.getName(), to.getName());
        checkLowBalance(from.getId(), userId);
        return response;
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public TransferResponse updateTransfer(UUID transferId, UUID userId, UpdateTransferRequest req) {
        AccountTransfer t = findTransferAndValidate(transferId, userId);
        BigDecimal previousAmount = t.getAmount();
        if (req.getAmount()       != null) t.setAmount(req.getAmount());
        if (req.getTransferDate() != null) t.setTransferDate(req.getTransferDate());
        if (req.getDescription()  != null) t.setDescription(req.getDescription());
        if (req.getAmount() != null) {
            accountBalanceGuard.validateSufficientBalance(t.getFromAccountId(), userId, t.getAmount(), previousAmount);
        }
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
        transferRepository.delete(findTransferAndValidate(transferId, userId));
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

    /**
     * Fires a low-balance notification if the account has an alert threshold configured and its
     * live balance has dropped to/below it. Called right after any operation that can reduce a
     * spendable balance (expense debit, transfer out) — best-effort, never blocks the caller.
     */
    @Override
    public void checkLowBalance(UUID accountId, UUID userId) {
        if (accountId == null) return;
        try {
            WalletAccount account = accountRepository.findById(accountId).orElse(null);
            if (account == null || !account.getUserId().equals(userId)) return;
            if (account.getLowBalanceThreshold() == null || account.getAccountType().isLiability()) return;
            BigDecimal balance = enrich(account).getCurrentBalance();
            if (balance.compareTo(account.getLowBalanceThreshold()) <= 0) {
                notificationService.createLowBalanceNotification(
                        userId, account.getName(), balance, account.getLowBalanceThreshold());
            }
        } catch (Exception e) {
            log.warn("Low balance check failed for account={}: {}", accountId, e.getMessage());
        }
    }

    @Override
    public BigDecimal getCurrentBalance(UUID id, UUID userId) {
        return enrich(findAndValidate(id, userId)).getCurrentBalance();
    }

    // ─── private helpers ───────────────────────────────────────────────────────

    private WalletAccount findAndValidate(UUID id, UUID userId) {
        WalletAccount a = accountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WalletAccount", "id", id));
        if (!a.getUserId().equals(userId)) throw new AccessDeniedException();
        return a;
    }

    private AccountTransfer findTransferAndValidate(UUID transferId, UUID userId) {
        AccountTransfer t = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer", "id", transferId));
        if (!t.getUserId().equals(userId)) throw new AccessDeniedException();
        return t;
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

        return enrich(account, incomeIn, expenseOut, transfersIn, transfersOut, displayIn, displayOut);
    }

    /**
     * Enriches a whole account list with a fixed number of grouped queries instead of
     * running enrich()'s ~8 balance-aggregate queries once per account (N+1 on every
     * accounts-list / dashboard load).
     */
    private List<AccountResponse> enrichBatch(List<WalletAccount> accounts) {
        if (accounts.isEmpty()) return List.of();
        List<UUID> ids = accounts.stream().map(WalletAccount::getId).toList();

        Map<UUID, BigDecimal> incomeIn            = toSumMap(incomeRepository.sumByAccountIdsGrouped(ids));
        Map<UUID, BigDecimal> expenseOut          = toSumMap(expenseRepository.sumByAccountIdsGrouped(ids));
        Map<UUID, BigDecimal> transfersIn         = toSumMap(transferRepository.sumTransfersInGrouped(ids));
        Map<UUID, BigDecimal> transfersOut        = toSumMap(transferRepository.sumTransfersOutGrouped(ids));
        Map<UUID, BigDecimal> regularTransfersIn  = toSumMap(transferRepository.sumRegularTransfersInGrouped(ids));
        Map<UUID, BigDecimal> regularTransfersOut = toSumMap(transferRepository.sumRegularTransfersOutGrouped(ids));
        Map<UUID, BigDecimal> regularIncomeIn     = toSumMap(incomeRepository.sumRegularByAccountIdsGrouped(ids));
        Map<UUID, BigDecimal> regularExpenseOut   = toSumMap(expenseRepository.sumRegularByAccountIdsGrouped(ids));

        return accounts.stream().map(a -> {
            UUID id = a.getId();
            BigDecimal displayIn  = regularIncomeIn.getOrDefault(id, BigDecimal.ZERO)
                    .add(regularTransfersIn.getOrDefault(id, BigDecimal.ZERO));
            BigDecimal displayOut = regularExpenseOut.getOrDefault(id, BigDecimal.ZERO)
                    .add(regularTransfersOut.getOrDefault(id, BigDecimal.ZERO));
            return enrich(a,
                    incomeIn.getOrDefault(id, BigDecimal.ZERO),
                    expenseOut.getOrDefault(id, BigDecimal.ZERO),
                    transfersIn.getOrDefault(id, BigDecimal.ZERO),
                    transfersOut.getOrDefault(id, BigDecimal.ZERO),
                    displayIn, displayOut);
        }).toList();
    }

    private Map<UUID, BigDecimal> toSumMap(List<Object[]> rows) {
        Map<UUID, BigDecimal> map = new HashMap<>();
        for (Object[] row : rows) map.put((UUID) row[0], (BigDecimal) row[1]);
        return map;
    }

    private AccountResponse enrich(WalletAccount account, BigDecimal incomeIn, BigDecimal expenseOut,
                                    BigDecimal transfersIn, BigDecimal transfersOut,
                                    BigDecimal displayIn, BigDecimal displayOut) {
        boolean isCreditCard = account.getAccountType() == AccountType.CREDIT_CARD;
        // Liability accounts (credit card, loan): balance = outstanding — payments in reduce it
        BigDecimal balance = account.getAccountType().isLiability()
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
                .lowBalanceThreshold(account.getLowBalanceThreshold())
                .belowLowBalanceThreshold(account.getLowBalanceThreshold() != null
                        && !isCreditCard && account.getAccountType() != AccountType.LOAN
                        && balance.compareTo(account.getLowBalanceThreshold()) <= 0)
                .totalMoneyIn(displayIn)
                .totalMoneyOut(displayOut)
                .recentTransactions(recent)
                .createdAt(account.getCreatedAt())
                .archived(account.isArchived())
                .primary(account.isPrimary());

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

        if (account.getAccountType() == AccountType.LOAN) {
            LocalDate nextEmi = null;
            if (account.getEmiDay() != null && balance.compareTo(BigDecimal.ZERO) > 0) {
                LocalDate today = LocalDate.now();
                int ed = account.getEmiDay();
                nextEmi = today.getDayOfMonth() < ed
                        ? today.withDayOfMonth(ed)
                        : today.plusMonths(1).withDayOfMonth(ed);
            }
            String autopayName = account.getAutopayAccountId() != null
                    ? accountRepository.findById(account.getAutopayAccountId())
                            .map(WalletAccount::getName).orElse(null)
                    : null;
            builder.loanType(account.getLoanType() != null ? account.getLoanType().name() : null)
                   .principalAmount(account.getPrincipalAmount())
                   .emiAmount(account.getEmiAmount())
                   .emiDay(account.getEmiDay())
                   .autopayAccountId(account.getAutopayAccountId())
                   .autopayAccountName(autopayName)
                   .loanEndDate(account.getLoanEndDate())
                   .nextEmiDate(nextEmi)
                   .apr(account.getApr());
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
        Map<UUID, Category> catById = categoryRepository.findAllById(catIds).stream()
                .collect(Collectors.toMap(Category::getId, c -> c));
        top5Expenses.forEach(e -> {
            Category cat = catById.get(e.getCategoryId());
            items.add(AccountTransactionItem.builder()
                .id(e.getId().toString())
                .type("EXPENSE")
                .label(cat != null ? cat.getName() : "Expense")
                .categoryIcon(cat != null ? cat.getIcon() : null)
                .categoryColor(cat != null ? cat.getColor() : null)
                .amount(e.getAmount())
                .date(e.getExpenseDate())
                .description(e.getDescription())
                .build());
        });

        // Transfers — limited query; no longer loads all rows. Debt transfers (one-sided, tagged
        // isDebt) and balance adjustments ride the same query, distinguished into their own types.
        transferRepository.findTop5ByAccountId(id).forEach(t -> {
            boolean isIn       = id.equals(t.getToAccountId());
            boolean isAdjust   = "Balance Adjustment".equals(t.getDescription());
            String  txnType    = t.isDebt() ? (isIn ? "DEBT_IN" : "DEBT_OUT")
                                : isAdjust  ? "ADJUSTMENT"
                                : isIn      ? "TRANSFER_IN" : "TRANSFER_OUT";
            String  txnLabel   = t.isDebt() ? (t.getDebtContactName() != null ? t.getDebtContactName() : "Debt")
                                : isAdjust  ? "Adjustment"
                                : isIn      ? "Transfer In" : "Transfer Out";
            items.add(AccountTransactionItem.builder()
                .id(t.getId().toString())
                .type(txnType)
                .label(txnLabel)
                .amount(t.getAmount())
                .date(t.getTransferDate())
                .description(t.getDescription())
                .build());
        });

        return items.stream()
                .sorted(Comparator.comparing(AccountTransactionItem::getDate).reversed())
                .limit(10)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] generateStatementCsv(UUID accountId, UUID userId) {
        findAndValidate(accountId, userId);

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
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse adjustBalance(UUID id, UUID userId, BigDecimal targetBalance) {
        WalletAccount account = findAndValidate(id, userId);
        if (!account.getAccountType().isLiability() && targetBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Balance cannot be negative for " + account.getName() + ".", HttpStatus.BAD_REQUEST);
        }
        AccountResponse current = enrich(account);
        BigDecimal diff = targetBalance.subtract(current.getCurrentBalance());
        if (diff.compareTo(BigDecimal.ZERO) == 0) return current;

        // Asset balance = opening + incomeIn + transfersIn − expenseOut − transfersOut, so a transfer
        // INTO the account raises it. Liability balance (outstanding) is the mirror image
        // (opening + expenseOut + transfersOut − incomeIn − transfersIn), so raising the outstanding
        // needs a transfer OUT, and lowering it (an unlogged payment) needs a transfer IN — routing
        // both account types the same way silently moved liability balances in the wrong direction.
        boolean wantsIncrease = diff.compareTo(BigDecimal.ZERO) > 0;
        boolean routeAsIncomingTransfer = account.getAccountType().isLiability() != wantsIncrease;

        LocalDate today = LocalDate.now();
        if (routeAsIncomingTransfer) {
            transferRepository.save(AccountTransfer.builder()
                    .userId(userId)
                    .fromAccountId(null)
                    .toAccountId(id)
                    .amount(diff.abs())
                    .description("Balance Adjustment")
                    .transferDate(today)
                    .build());
        } else {
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

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResponse setPrimary(UUID id, UUID userId) {
        WalletAccount account = findAndValidate(id, userId);
        if (account.getAccountType() != AccountType.BANK_ACCOUNT) {
            throw new BusinessException("Only bank accounts can be set as primary.", HttpStatus.BAD_REQUEST);
        }
        accountRepository.clearPrimaryForType(userId, AccountType.BANK_ACCOUNT);
        account.setPrimary(true);
        return enrich(accountRepository.save(account));
    }

    private TransferResponse toTransferResponse(AccountTransfer t, String fromName, String toName) {
        boolean isAdjustment = "Balance Adjustment".equals(t.getDescription());
        boolean isDebt       = t.isDebt();
        String externalLabel = isDebt ? t.getDebtContactName() : isAdjustment ? "Adjustment" : "External";
        String investmentLabel = isDebt ? t.getDebtContactName() : isAdjustment ? "Adjustment" : "Investment";
        String resolvedFromName = t.getFromAccountId() == null ? externalLabel   : fromName;
        String resolvedToName   = t.getToAccountId()   == null ? investmentLabel : toName;
        return TransferResponse.builder()
                .id(t.getId()).fromAccountId(t.getFromAccountId()).fromAccountName(resolvedFromName)
                .toAccountId(t.getToAccountId()).toAccountName(resolvedToName)
                .amount(t.getAmount()).description(t.getDescription())
                .adjustment(isAdjustment)
                .debt(isDebt).debtContactName(t.getDebtContactName()).debtLabel(t.getDebtLabel())
                .transferDate(t.getTransferDate()).createdAt(t.getCreatedAt())
                .build();
    }
}
