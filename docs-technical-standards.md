# CLAUDE.md —  Technical Standards

> **Purpose:** This file is the single source of truth for engineering standards. All code generated or modified by Claude Code MUST comply with these standards. They are derived from the organization's official Technical Standards (Coding Standards v1.0, Enterprise Data Standards, OpenAPI Validation Rules, and Build Pipeline requirements).
>
> **Compliance is mandatory.** OpenAPI CRITICAL and HIGH violations block releases (enforced since 4 Jan 2026). Unit-test coverage gates are enforced in CI.

---

## 1. Architecture & Design

- **Use N-Tier (3-Tier) architecture** with strict separation:
  - **Presentation Tier** — UI only. Must be as "dumb" as possible; contains **no business logic**.
  - **Business Logic Tier** — all business rules and process coordination live here.
  - **Data Tier** — persistent storage/retrieval behind an abstract interface; never expose storage details upward.
- **Closed Layer Architecture:** each layer communicates **only with the layer directly below it**. Never let the presentation layer talk to the data layer directly.
- **UI/Logic separation is non-negotiable.** Business logic must be fully independent of any UI so it can be tested in isolation and reused across web, mobile, and API. Use MVC, MVP, or MVVM as appropriate to the framework.

## 2. Coding Standards

### 2.1 Naming Conventions
| Element | Rule | Example |
|---|---|---|
| Variables | `camelCase` (or `snake_case` per language convention), noun, intention-revealing | `userProfile` not `usr` |
| Booleans | Prefix with `is`, `has`, or `can` | `isUserActive` not `status` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_CONNECTIONS = 100` |
| Functions | `camelCase`, verb describing the action; retrieval functions start with `get` | `calculateTotalPrice()`, `getUserById(id)` |
| Classes | `PascalCase`, noun | `UserAccount` |
| Files | `kebab-case` (especially web projects) | `user-profile.component.js` |

- Names must be **clear, pronounceable, and searchable**. No ambiguous abbreviations (only universally understood ones like `db`).
- No disinformation: don't name something `accountList` unless it is actually a List.

### 2.2 Formatting
- **Always use automatic formatters:** Prettier/ESLint (JS/TS), Black (Python), clang-format (C/C++), `dotnet format` (.NET). Configure once, run on save / in CI.
- Line length: **80–120 characters max**.
- Indentation: **spaces, not tabs** (2 or 4 per language convention).
- Use blank lines to separate logical blocks (like paragraphs).
- Code must look as if a single person wrote it — consistency over personal style.

### 2.3 Comments
- **Explain WHY, not WHAT.** Code should be clear enough to explain what it does.
- No redundant comments that restate the code.
- **Never leave commented-out code** — delete it; version control keeps history.

## 3. Version Control & Collaboration

- **Git is the standard.** Each commit must be small and focused on a single change.
- **Branching:** follow Git Flow. Every new feature gets its own branch.
- **Code review:** every change must be reviewed by at least one other developer before merge.
- **Legacy code golden rule:** never modify legacy code without tests covering it first. Write **characterization tests** (capture current behavior as-is) before changing anything.
- **Boy Scout Rule:** always leave the code a little cleaner than you found it.

## 4. Testing Requirements (CI-Enforced)

### 4.1 Coverage Gates
Builds **fail** below the minimum coverage. Current enforcement schedule:

| Effective Date | Target | Minimum (build-blocking) |
|---|---|---|
| 8 Feb 2026 | 40% | 20% |
| 8 Mar 2026 | 60% | 40% |
| **11 Apr 2026 (current)** | **90%** | **60%** |

> Coverage is a measurement, not the goal — tests must cover the functional intent and expected usage, not just lines.

### 4.2 Test Commands & Tooling (used by the pipeline)
| Language / Framework | Command | Coverage Tool |
|---|---|---|
| .NET | `dotnet test` | Coverlet |
| Python | `pytest` | Coverage.py + pytest-cov |
| Java | `mvn clean test` | JaCoCo |
| Node | `npm test` | vitest |

### 4.3 Test Quality
- Tests must be **FIRST**: Fast, Isolated, Repeatable, Self-Validating, Timely.
- Structure every test with **Arrange–Act–Assert (AAA)**.
- Practice **TDD**: failing test → make it pass → refactor.
- **Do NOT mock infrastructure resources** (databases, message brokers, etc.). Mocks embed assumptions that break in production. **Use Testcontainers instead** — ephemeral Docker containers created per test run. Supported across all adopted languages.

## 5. Runtime & Build Pipeline

- **.NET:** target **.NET 10** (LTS). Use pipeline reference `net10.yaml`. `net80.yaml` is deprecated (June 2026).
- **Node:** use **Node 22**. Node 20 reached end of support on 1 Feb 2026 — do not target it.
- **Observability:** Elastic APM is **auto-injected** by the platform images. **Do NOT add the Elastic APM package or any APM configuration to the codebase** — remove them if found.
- `openapi.yaml` is the **sole source of truth** for exposed endpoints. Keep it complete and current; API tests and security scans run from it.

## 6. Database Standards (SQL Server)

### 6.1 Hard Rules & Restrictions (never violate)
- **Max 30 columns per table.**
- **Max 5 foreign keys per table.**
- Use **`IDENTITY`** for auto-increment. **Do NOT use sequences.**
- Use **`bigint`** for keys on large/high-volume tables. **Do NOT use UUID/GUID keys.**
- **No triggers. No User-Defined Table Types (UDTs). No SQL Agent jobs.**
- **Do NOT create tables for audit, errors, requests, or responses.**
- **Existing tables:** renaming columns is NOT allowed; changing column data types is NOT allowed.
- **`ORDER BY` must always be `ORDER BY id DESC`** — never sort by created/updated timestamps.
- **No files in the database** (images, logs, JSON blobs) — store externally.
- **No MAX-length types:** `NVARCHAR(MAX)`, `VARCHAR(MAX)`, `VARBINARY(MAX)` are forbidden — always set explicit lengths.
- Avoid SQL reserved keywords as table/column names.
- **No dynamic SQL** unless absolutely necessary — always use parameterized queries.

### 6.2 Design & Schema
- All transactions must be **ACID**-compliant; use transactions deliberately for critical operations.
- Write **set-based queries** (no row-by-row processing).
- Normalize to at least **3NF**.
- **ERDs must be reviewed and approved before implementation.**
- Schema changes are **need-driven**, small, and gradual. Ensure backward compatibility via the **Expand and Contract** pattern. Version the schema with **Liquibase or Flyway**. Every deployment needs a **rollback plan**.
- Define archival strategy per table (**Hot or Cold** archive, with retention period).
- Essential columns (**National ID, Date of Birth, Names**) must be `NOT NULL`.
- Every lookup value gets its **own lookup table**, placed in a dedicated **`lookup` schema** (e.g., `lookup.EmployeeType`).
- Return only the columns/rows actually needed — never `SELECT *` in production code.

### 6.3 Data Types
- Use **`NVARCHAR`** for ALL text columns (internationalization support).
- Numeric values use numeric types — never store numbers as text without strong justification.
- **Gender:** `CHAR(1)`, values `'M'` or `'F'`.
- **Email:** column named `Email`, type `NVARCHAR(50)`.
- **Every table** must have `CreatedAt` and `UpdatedAt` of type **`datetime2(7)`**. `UpdatedAt` initializes to `CreatedAt` and updates on every row change.

### 6.4 Naming Conventions (Database)
| Object | Rule | Example |
|---|---|---|
| Tables & Columns | `PascalCase`, **singular** table names | `Employee`, `User`, `Address` |
| Multilingual columns | Language suffix | `FirstNameAr`, `FirstNameEn` |
| Date-of-birth columns | Calendar suffix | `DOB_H` (Hijri), `DOB_G` (Gregorian) |
| Views | `v_` prefix | `v_ActiveUsers` |
| Functions | `fn_` prefix | `fn_CalculateSalary` |
| Stored procedures | `usp_` prefix | `usp_GetEmployeeDetails` |
| Unique constraints | `UQ_[Table_Column]` | `UQ_Employee_Email` |
| Foreign keys | `FK_[Table_Column]` | `FK_Order_CustomerID` |

### 6.5 Stored Procedures
- Start **every** stored procedure with `SET NOCOUNT ON`.

### 6.6 Indexing
- **Keep index count lean:** rarely more than **5–7 non-clustered indexes** per table; avoid non-clustered indexes unless justified by measured performance gains. Periodically drop unused indexes.
- Index **high-selectivity** columns (e.g., email, order_id); skip low-cardinality columns unless combined with a selective one.
- **Inspect the execution plan before AND after** adding any index (scans vs. seeks, eliminated sorts/hash joins).
- **Index every foreign-key column used in joins**; for composite FKs match the FK column order.
- **Composite index column order:** equality predicates (`=`) → range predicates (`>`, `<`, `BETWEEN`) → `ORDER BY`/`GROUP BY` columns.
- **Composite width:** ≤ 3 key columns; add covering columns via `INCLUDE` only as needed.
- **Never index** LOB, JSON, XML, or free-text columns in operational tables. If JSON/XML search is essential, use a computed column with a filtered index or full-text index.
- Use `UNIQUE` indexes when the business rule enforces uniqueness. Use filtered indexes for predicates like `is_active = 1`.
- Remember every index slows `INSERT`/`UPDATE`/`DELETE` — benchmark write-heavy workloads first.

## 7. API & OpenAPI Standards

> The `openapi.yaml` is validated automatically (55 rules). **CRITICAL and HIGH findings block releases.** Design every endpoint to pass these from the start.

### 7.1 CRITICAL Rules (release-blocking — must always pass)
1. **array-constraints** — every `type: array` schema defines **both `minItems` and `maxItems`**.
2. **array-items-required** — every `type: array` defines an `items` schema.
3. **content-type-header** — explicit, valid media types; no wildcards; **no response bodies on `204`/`304`**; schema matches the media type.
4. **method-semantics** — `GET`/`HEAD`/`OPTIONS` must be side-effect free and have **no request body**; `PUT`/`DELETE` documented as idempotent; creation `POST` returns `201`.
5. **path-params-required** — every path parameter is `required: true`, appears in the template, and is consistent across operations.
6. **request-body-validation** — no bodies on `GET`/`HEAD`/`DELETE`; `POST`/`PUT`/`PATCH` define structured request bodies.
7. **required-success-response** — every operation has at least one `2xx`, matching the method (`POST`→`201`, `DELETE`→`204`).
8. **response-code-range** — status codes numeric, 100–599, not deprecated; redirects include `Location`.
9. **discriminator-property-exists** — discriminator `propertyName` exists in properties and is `required`.
10. **schema-structure-required** — every schema has `type`/`properties`/composition/`$ref`/`items`/`enum` (no empty placeholder schemas).
11. **parameter-schema-required** — every parameter defines exactly one of `schema` or `content` (not both, not neither).
12. **security-schemes-defined** — every security requirement references a scheme declared in `components.securitySchemes`.

### 7.2 HIGH Rules (release-blocking — must always pass)
1. **enum-validation** — enums non-empty, type-aligned, no duplicates; `nullable: true` if `null` appears.
2. **integer-constraints** — every `integer`/`number` declares **both `minimum` and `maximum`** (unless enum).
3. **async-processing-202** — `202` responses include a **required `Location`** header (`type: string, format: uri`) and describe polling.
4. **caching-headers** — `GET`/`HEAD` success responses document `Cache-Control` + validator (`ETag`/`Last-Modified`) and a `304` response.
5. **deprecation-headers** — deprecated operations include `Deprecation`, `Sunset`, `Link` headers and migration guidance in the description.
6. **header-naming-conventions** — headers in **Kebab-Case**; **no `X-` prefix**; consistent casing.
7. **idempotency-key** — state-changing `POST`/`PATCH` support an `Idempotency-Key` header, replay headers on success, and `409 Conflict` for duplicates.
8. **location-header-201** — every `201` exposes a required `Location` header (`type: string, format: uri`).
9. **rate-limiting-headers** — success responses expose `RateLimit-Limit`/`Remaining`/`Reset` (integer schemas); `429` includes `Retry-After` + structured content.
10. **versioning-headers** — one consistent versioning strategy (`info.version`, server URL, path, header, or media type); responses echo version headers; never mix strategies.
11. **method-response-codes** — status codes match the HTTP method's intent.
12. **problem-details-format** — all `4xx`/`5xx` bodies use **`application/problem+json`** (RFC 9457) with `type`, `title`, `status`.
13. **security-response-codes** — secured endpoints document `401`, `403`, and `429` (with `Retry-After`), distinguishing authn vs authz.
14. **examples-valid** — every example validates against its schema.
15. **operation-id-format** — `operationId` is URL-safe (no spaces/slashes/`?`), consistent naming.
16. **operation-id-unique** — no duplicate `operationId`s.
17. **path-parameters-match** — every `{placeholder}` has a matching `in: path` parameter; no extras.
18. **path-parameters-not-empty** — no empty `{}` in path templates.
19. **path-keys-valid** — path keys contain no query strings and no trailing slashes.
20. **required-servers** — non-empty `servers` array.
21. **server-url-valid** — no placeholder hosts (`example.com`, `localhost`) and no trailing slashes in server URLs.

### 7.3 MEDIUM Rules (should fix — design for these by default)
- **string-constraints** — strings declare `minLength` and `maxLength` (unless enum).
- **endpoint-timeout** — every operation declares **`x-timeout`** (e.g., `x-timeout: 30s`).
- **batch-operations** — bulk endpoints document `207 Multi-Status` with a per-item results schema.
- **conditional-requests** — `GET` advertises `If-None-Match`; `PUT`/`PATCH`/`DELETE` accept `If-Match` and document `412`.
- **no-stack-traces** — error examples never contain stack traces, file paths, or internal details.
- **request-validation-errors** — `POST`/`PUT`/`PATCH` with bodies document `422` for semantic validation failures (distinct from `400` malformed syntax).
- **content-negotiation** — request/response media types enumerated; `415` documented when request bodies exist; `Accept` header for multi-format operations.
- **pagination-headers** — collection `GET`s document `limit`/`cursor` params, `Link` headers, and total counts.
- **default-response** — every operation defines a `default` error response with `application/problem+json` schema.
- **response-body-standards** — no bodies on `204`/`205`/`304`; consistent pagination shapes; structured errors.
- **response-description-quality** — descriptions are meaningful, never just the status phrase ("Not Found" ❌).
- **examples-value-xor** — each Example has exactly one of `value` or `externalValue`.
- **tags-consistency** — every operation tagged; all tags declared globally; unique tag names.
- **operation-description / parameter-description** — every operation and every parameter has a non-empty description.
- **server-variables** — templated server URLs define every variable with a `default`.
- **server-environments-required** — define all four environments via `x-environment`: `development`, `testing`, `staging`, `production`.

### 7.4 LOW Rules (apply when practical)
- **language-support** — string schemas declare `x-languages` array (e.g., `[en-US, ar-SA]`).
- **prefer-header** — `POST`/`PUT`/`PATCH` document `Prefer` request header and `Preference-Applied` response header.
- **head-method-consistency** — paths with `GET` also expose `HEAD` with identical status codes.
- **options-discovery** — resources expose `OPTIONS` with an `Allow` header.
- **no-ref-siblings** — never place properties next to `$ref`; use `allOf` for composition.

### 7.5 Custom Extension: `x-body` (OpenAPI Links)
When using `x-body` for field-level request-body mapping in Links: values must be strings, runtime expressions start with `$`, field paths are alphanumeric/underscore/dots, no duplicate paths, and the target operation must define a request body.

---

## 8. Quick Checklist for Every Change

Before considering any task done, verify:
- [ ] Business logic is in the business tier — none in UI or data access code.
- [ ] Names follow §2.1; formatter ran clean; no commented-out code.
- [ ] New/changed code has tests (AAA, FIRST); coverage ≥ **60%**; infra dependencies use **Testcontainers, not mocks**.
- [ ] Any DB change respects ALL hard rules in §6.1 (30 cols, 5 FKs, IDENTITY, bigint, no triggers/jobs/UDTs, `CreatedAt`/`UpdatedAt datetime2(7)`, naming in §6.4) and ships with a migration (Liquibase/Flyway) + rollback plan.
- [ ] `openapi.yaml` updated for any endpoint change and passes all **CRITICAL + HIGH** rules in §7.1–7.2.
- [ ] Errors use RFC 9457 `application/problem+json`; no stack traces anywhere.
- [ ] No Elastic APM packages/config added (platform auto-injects).
- [ ] Targeting .NET 10 / Node 22 (not .NET 8 / Node 20).
