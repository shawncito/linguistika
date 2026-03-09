# Feature Independence

## Description

Enforces loose coupling between feature modules. Features must not directly import files from one another — cross-feature coordination happens only through services. Use this skill when writing code that requires data from another domain.

## Applies To

- `backend/src/features/**`

---

## Core Rule

> Features are independent units. They do not reach into each other's internals.

---

## Rules

### 1. Features must not import files from other features directly

```js
// ❌ Wrong — workLogs imports users repository directly
import { findById } from '../users/users.repository.mjs';

// ❌ Wrong — departments imports workLogs schemas
import { WORK_LOG_STATUSES } from '../workLogs/workLogs.schemas.mjs';

// ✅ Correct — coordinate through services
import { getUserById } from '../users/users.service.mjs';
```

### 2. Only services may coordinate cross-feature logic

If `workLogs` needs to validate that a `student_id` exists, it calls the `users` **service** (not repository):

```js
// features/workLogs/workLogs.service.mjs
import { getUserById } from '../users/users.service.mjs';

export async function createWorkLog(payload, requester) {
  const student = await getUserById(payload.studentId);  // ← service, not repository
  if (!student) throw new AppError('Estudiante no encontrado', 404);
  ...
}
```

### 3. Shared functionality goes into `shared/`

Constants, mappers, regex, middleware, and utility functions used across two or more features must live in `shared/`, not in any feature folder.

```js
// ✅ Correct
import { toUser } from '../../shared/utils/mappers.mjs';
import { INSTITUTIONAL_EMAIL_REGEX } from '../../shared/utils/regex.mjs';
```

---

## Dependency Graph (Allowed)

```
features/auth          ← uses shared/
features/users         ← uses shared/
features/departments   ← uses shared/
features/workLogs      ← uses shared/ + may call users.service / departments.service
features/rates         ← uses shared/
features/kiosk         ← uses shared/ + may call users.service / departments.service

shared/                ← used by ALL features, imports nothing from features/
```

No arrows between feature folders at the `repository` or `schemas` level.

---

## How to Handle Cross-Feature Data Needs

| Scenario | Solution |
|----------|----------|
| `workLogs` needs to verify a student exists | Call `users.service.getUserById(id)` |
| `workLogs` needs to verify a department exists | Call `departments.service.getDepartmentById(id)` |
| `departments` needs to check if head exists | Call `users.service.getUserById(headId)` |
| Two features share a validation regex | Move regex to `shared/utils/regex.mjs` |
| Two features share a mapper | Move mapper to `shared/utils/mappers.mjs` |

---

## Anti-patterns to Reject

- ❌ `import { findAll } from '../users/users.repository.mjs'` inside any other feature
- ❌ `import { WORK_LOG_STATUSES } from '../workLogs/workLogs.schemas.mjs'` inside another feature
- ❌ Feature A calling Feature B's controller or route directly
- ❌ Circular imports between two features (A imports B, B imports A)

---

## Detecting Violations

Run this search to find cross-feature imports:

```powershell
# Check if workLogs imports from users repository directly
Select-String -Path "backend/src/features/workLogs/*.mjs" -Pattern "from '../users/"
```

Any match on a `*.repository.mjs` or `*.schemas.mjs` from another feature is a violation.

---

## Checklist

- [ ] No feature directly imports a `*.repository.mjs` from another feature
- [ ] No feature directly imports a `*.schemas.mjs` from another feature
- [ ] Cross-feature coordination is done exclusively through service calls
- [ ] Shared constants are in `shared/`, not repeated in multiple features
- [ ] No circular imports between feature folders
