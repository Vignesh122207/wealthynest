-- dividend_income and bond_interest (from V8) backed an entire live, authenticated REST module
-- (DividendController) that the frontend never called and no other backend code read from — the
-- real dividend/bond-interest crediting path is investment_income_log via
-- InvestmentServiceImpl.logIncome(). Confirmed via schema: no FK ever linked these tables to
-- anything else. Removing the dead module and its tables together.

DROP TABLE IF EXISTS dividend_income;
DROP TABLE IF EXISTS bond_interest;
