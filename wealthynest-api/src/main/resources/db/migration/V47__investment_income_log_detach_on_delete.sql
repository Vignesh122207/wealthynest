-- income_entry_id had no ON DELETE clause (defaulted to NO ACTION), which blocked
-- WalletAccountServiceImpl.deleteAccount(alsoDeleteTransactions=true) from ever deleting an
-- income entry that had a dividend/investment income event logged against it — the log row's
-- own fields (investment_id, income_type, event_date, amount) are still meaningful without it,
-- and InvestmentServiceImpl already null-checks getIncomeEntryId() at every read site, so detach
-- rather than cascade-delete — same treatment already given to debt_records.account_id.
ALTER TABLE investment_income_log
    DROP CONSTRAINT investment_income_log_income_entry_id_fkey,
    ADD CONSTRAINT investment_income_log_income_entry_id_fkey
        FOREIGN KEY (income_entry_id) REFERENCES income_entries(id) ON DELETE SET NULL;
