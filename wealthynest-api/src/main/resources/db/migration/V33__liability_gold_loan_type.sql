-- Adds GOLD_LOAN to the manual liabilities type check, matching the new LOAN account's loan_type.
ALTER TABLE liabilities DROP CONSTRAINT IF EXISTS liabilities_liability_type_check;
ALTER TABLE liabilities ADD CONSTRAINT liabilities_liability_type_check CHECK (liability_type IN (
    'HOME_LOAN', 'CAR_LOAN', 'PERSONAL_LOAN', 'CREDIT_CARD',
    'EDUCATION_LOAN', 'GOLD_LOAN', 'BUSINESS_LOAN', 'OTHER'));
