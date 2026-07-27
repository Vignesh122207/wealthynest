# WealthyNest API

Spring Boot 3 REST API for the WealthyNest personal finance platform.

## Tech Stack
- Java 21, Spring Boot 3.2
- PostgreSQL + Flyway
- Redis (caching + rate limiting)
- JWT access + refresh tokens
- MapStruct, Lombok, SLF4J, Bucket4j

## Prerequisites
- Java 21+, Maven 3.9+
- PostgreSQL 15+, Redis 7+

## Setup

```sql
CREATE DATABASE wealthynest;
CREATE USER wealthynest WITH PASSWORD 'wealthynest';
GRANT ALL PRIVILEGES ON DATABASE wealthynest TO wealthynest;
```

```bash
export DB_URL=jdbc:postgresql://localhost:5432/wealthynest
export DB_USERNAME=wealthynest
export DB_PASSWORD=wealthynest
export JWT_SECRET=your-256-bit-secret-here
export REDIS_HOST=localhost
mvn spring-boot:run
```

API → http://localhost:8080

## Key Endpoints

Full module list under `domain/`: account, admin, analytics, asset, auth, budget, casimport,
category, debt, expense, expensesplit, family, goal, income, investment, liability, networth,
notification, recurringgoalcontribution, recurringincome, recurringtransfer, report,
statementimport, support, user, vault.

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register | Register |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/refresh | Refresh token |
| POST | /api/v1/auth/logout | Logout |
| GET  | /api/v1/users/me | Current user profile |
| ...  | /api/v1/users/me/webauthn | Passkey registration/login |
| POST | /api/v1/families | Create family |
| POST | /api/v1/families/join | Join family |
| GET/POST/PUT/DELETE | /api/v1/accounts | Wallet account CRUD + transfers |
| GET/POST/PUT/DELETE | /api/v1/expenses | Expense CRUD |
| ...  | /api/v1/expense-splits | Expense split tracking |
| GET/POST | /api/v1/categories | Categories |
| GET/POST/DELETE | /api/v1/budgets | Budget CRUD |
| GET/POST/PUT/DELETE | /api/v1/assets | Asset CRUD |
| GET/POST/PUT/DELETE | /api/v1/liabilities | Liability CRUD |
| GET/POST/PUT/DELETE | /api/v1/debts | Debt CRUD |
| GET | /api/v1/net-worth | Net worth (current + history) |
| GET/POST/PUT/DELETE | /api/v1/investments | Investment CRUD, incl. dividend suggestions |
| GET/POST/PUT/DELETE | /api/v1/goals | Goal CRUD, incl. family-shared goals |
| ...  | /api/v1/recurring-income, /recurring-transfer, /recurring-goal-contribution | Recurring rules |
| POST | /api/v1/statement-import | Bank CSV statement import |
| POST | /api/v1/cas-import | CAS PDF import |
| GET/POST/PUT/DELETE | /api/v1/vault, /api/v1/vault/items | Secure vault (notes/credentials, TOTP) |
| GET | /api/v1/analytics/dashboard | Dashboard summary |
| GET/PUT | /api/v1/notifications | Notifications + preferences (in-app + push) |
| ...  | /api/v1/support/tickets | Support tickets |
| ...  | /api/v1/admin, /api/v1/admin/tickets | Admin console |
| GET | /api/v1/reports | Monthly/annual/CSV export reports |

## Build
```bash
mvn clean package -DskipTests
java -jar target/wealthynest-api-1.0.0.jar --spring.profiles.active=prod
```
