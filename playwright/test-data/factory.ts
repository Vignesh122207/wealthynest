import {faker} from "@faker-js/faker";

// Centralized generators for form input values used across specs — keeps magic numbers/strings
// out of individual tests and gives every run unique-enough data to avoid collisions between
// parallel workers (e.g. two workers both registering a user or naming a bank account).

export function uniqueSuffix(): string {
  return `${Date.now()}-${faker.number.int({ min: 1000, max: 9999 })}`;
}

export function randomUser() {
  const suffix = uniqueSuffix();
  return {
    fullName: faker.person.fullName(),
    email: `e2e-${suffix}@wealthynest.test`,
    password: "E2eTestPassword1",
  };
}

// Real bank names, not a fully random string — but a shared regressionUser (tests/regression/)
// accumulates accounts across many tests, and AccountPicker selection matches by exact visible
// text, so a name drawn from only these 4 fixed options collides often enough to actually break
// tests once enough of them have run. The numeric suffix keeps it recognizably "a bank" while
// guaranteeing every generated name is unique for the life of a run.
export function randomBankAccount() {
  return {
    bankName: `${faker.helpers.arrayElement(["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank"])} ${faker.number.int({ min: 1000, max: 9999 })}`,
    accountNumber: faker.finance.accountNumber(4),
    openingBalance: faker.number.int({ min: 5000, max: 50000 }),
  };
}

export function randomExpense() {
  return {
    amount: faker.number.int({ min: 100, max: 5000 }),
    description: faker.commerce.productName(),
  };
}

export function randomIncome() {
  return {
    amount: faker.number.int({ min: 10000, max: 100000 }),
    description: `${faker.date.month()} income`,
  };
}

export function randomTransfer() {
  return {
    amount: faker.number.int({ min: 100, max: 2000 }),
    description: "E2E transfer",
  };
}

export function randomBudget() {
  return {
    amount: faker.number.int({ min: 2000, max: 20000 }),
  };
}

export function randomGoal() {
  return {
    name: `${faker.word.adjective()} ${faker.word.noun()} Goal`.replace(/^\w/, (c) => c.toUpperCase()),
    targetAmount: faker.number.int({ min: 50000, max: 500000 }),
  };
}

export function randomFixedDeposit(todayISO: string) {
  const maturity = new Date();
  maturity.setFullYear(maturity.getFullYear() + 1);
  return {
    bankName: `${faker.helpers.arrayElement(["HDFC Bank", "ICICI Bank", "Punjab National Bank"])} ${faker.number.int({ min: 1000, max: 9999 })}`,
    investedAmount: faker.number.int({ min: 10000, max: 100000 }),
    couponRate: faker.number.float({ min: 5, max: 8, fractionDigits: 2 }),
    purchaseDate: todayISO,
    maturityDate: maturity.toISOString().split("T")[0],
  };
}

export function randomBond(todayISO: string) {
  return {
    companyName: `E2E Bond ${faker.string.alphanumeric(6)}`,
    faceValuePerBond: faker.number.int({ min: 1000, max: 10000 }),
    quantity: faker.number.int({ min: 1, max: 20 }),
    couponRate: faker.number.float({ min: 5, max: 9, fractionDigits: 2 }),
    purchaseDate: todayISO,
  };
}

export function randomCategoryName(): string {
  return `E2E ${faker.commerce.department()} ${uniqueSuffix()}`;
}

export function randomAsset() {
  return {
    name: `${faker.commerce.productName()} ${uniqueSuffix()}`,
    currentValue: faker.number.int({ min: 50000, max: 2000000 }),
  };
}

export function randomVaultItem() {
  return {
    title: `E2E Vault ${faker.internet.domainWord()} ${uniqueSuffix()}`,
    secret: faker.internet.password({ length: 16 }),
    username: faker.internet.email(),
  };
}

export function randomSecureNote() {
  return {
    title: `E2E Note ${faker.internet.domainWord()} ${uniqueSuffix()}`,
    note: faker.lorem.sentence(),
  };
}

export function randomLiability() {
  const principalAmount = faker.number.int({ min: 100000, max: 3000000 });
  return {
    name: `${faker.company.name()} Loan ${uniqueSuffix()}`,
    principalAmount,
    outstandingAmount: Math.round(principalAmount * faker.number.float({ min: 0.3, max: 0.9 })),
  };
}
