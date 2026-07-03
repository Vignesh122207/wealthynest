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
CREATE USER wealthnest WITH PASSWORD 'wealthynest';
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

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register | Register |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/refresh | Refresh token |
| POST | /api/v1/auth/logout | Logout |
| GET  | /api/v1/users/me | Current user profile |
| POST | /api/v1/families | Create family |
| POST | /api/v1/families/join | Join family |
| GET/POST/PUT/DELETE | /api/v1/expenses | Expense CRUD |
| GET/POST | /api/v1/categories | Categories |
| GET/POST/DELETE | /api/v1/budgets | Budget CRUD |
| GET/POST/PUT/DELETE | /api/v1/assets | Asset CRUD |
| GET | /api/v1/assets/net-worth | Net worth |
| GET/POST/PUT/DELETE | /api/v1/investments | Investment CRUD |
| GET/POST | /api/v1/dividends | Dividend income |
| GET/POST | /api/v1/bond-interests | Bond interest |
| GET | /api/v1/analytics/dashboard | Dashboard summary |
| GET | /api/v1/notifications | Notifications |

## Build
```bash
mvn clean package -DskipTests
java -jar target/wealthynest-api-1.0.0.jar --spring.profiles.active=prod
```
