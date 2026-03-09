# Shared Utilities Rule

## Description

Defines what belongs in `shared/` and prevents duplication of cross-cutting logic across feature folders. Use this skill when writing helper functions, middleware, mappers, regex patterns, or error classes.

## Applies To

- `backend/src/shared/`
- Any utility function referenced by more than one feature

---

## Rule

> If logic is used by more than one feature, it belongs in `shared/`. Features contain only domain-specific code.

---

## `shared/` Structure

```
shared/
  config/
    supabaseClient.mjs     ← adminSupabase + getAuthedSupabase factory
    logger.mjs             ← centralized logger instance
  middleware/
    requireAuth.mjs        ← JWT validation + attaches req.supabase / req.authUser
    errorHandler.mjs       ← global Express error handler
    validateRequest.mjs    ← optional schema-based validation middleware
  errors/
    AppError.mjs           ← AppError class
  utils/
    normalize.mjs          ← normalizeOptionalText, normalizeIsoTimestamp
    regex.mjs              ← INSTITUTIONAL_EMAIL_REGEX, COST_CENTER_REGEX
    mappers.mjs            ← toUser, toDepartment, toWorkLog, toRate
```

---

## What Goes in `shared/` vs Feature

| Logic | Where |
|-------|-------|
| JWT auth middleware | `shared/middleware/requireAuth.mjs` |
| Error handler middleware | `shared/middleware/errorHandler.mjs` |
| `AppError` class | `shared/errors/AppError.mjs` |
| Supabase client instances | `shared/config/supabaseClient.mjs` |
| `toUser`, `toWorkLog` row mappers | `shared/utils/mappers.mjs` |
| `normalizeOptionalText` | `shared/utils/normalize.mjs` |
| Email / cost center regex | `shared/utils/regex.mjs` |
| User CRUD logic | `features/users/users.service.mjs` |
| Work log status machine | `features/workLogs/workLogs.service.mjs` |
| Billing cycle formula | `features/workLogs/workLogs.schemas.mjs` or service |

---

## Rules

### 1. Never duplicate shared helpers inside a feature

```js
// ❌ Wrong — normalize.mjs duplicated inside workLogs feature
// features/workLogs/utils.mjs
export function normalizeOptionalText(value) { ... }

// ✅ Correct — import from shared
import { normalizeOptionalText } from '../../shared/utils/normalize.mjs';
```

### 2. Features must not define their own middleware

```js
// ❌ Wrong — requireAuth re-implemented in a feature
// features/auth/auth.middleware.mjs
export async function requireAuth(req, res, next) { ... }

// ✅ Correct — imported from shared
import { requireAuth } from '../../shared/middleware/requireAuth.mjs';
```

### 3. Shared utilities must be domain-agnostic

A utility in `shared/` must not contain business rules tied to a single feature.

```js
// ❌ Wrong — work-log-specific logic in shared
// shared/utils/workLogHelpers.mjs
export function validateWorkLogStatus(status) { ... }

// ✅ Correct — keep in feature
// features/workLogs/workLogs.schemas.mjs
export const WORK_LOG_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED']);
```

---

## Adding a New Shared Utility

1. Check if it already exists in `shared/`.
2. If not, determine the correct sub-folder (`utils/`, `middleware/`, `errors/`, or `config/`).
3. Create the file following existing naming patterns.
4. Export named functions (no default exports in shared utilities).
5. Import in all features that need it.

---

## Checklist

- [ ] No utility function is defined in more than one place
- [ ] All regex constants (`INSTITUTIONAL_EMAIL_REGEX`, `COST_CENTER_REGEX`) live in `shared/utils/regex.mjs`
- [ ] All row mappers (`toUser`, `toDepartment`, `toWorkLog`) live in `shared/utils/mappers.mjs`
- [ ] All normalize helpers live in `shared/utils/normalize.mjs`
- [ ] `requireAuth` is imported from `shared/`, not redefined per feature
- [ ] New shared utilities are domain-agnostic (no single-feature business logic)
