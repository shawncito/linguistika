# Safe Refactoring Rules

## Description

Provides a safe, incremental approach for refactoring backend code without breaking existing functionality. Use this skill whenever restructuring files, moving code between layers, or splitting a monolithic handler into feature modules.

## Applies To

- Any refactoring of `backend/server.mjs` into `backend/src/features/`
- Any file reorganization in `backend/src/`

---

## Core Principle

> Refactor structure, not behavior. The API contract stays identical until explicitly changed.

---

## Rules

### 1. Do not change API contracts unless explicitly required

- HTTP method, path, request body shape, and response shape must remain identical after a refactor.
- If a contract change is needed, it is a **separate task** — not part of the refactor.

```
Before: PATCH /api/v1/users/:id  →  { name, carnet, isActive }
After:  PATCH /api/v1/users/:id  →  { name, carnet, isActive }  ✅ unchanged
```

### 2. Maintain existing endpoint behavior

- Existing validations, error messages, status codes, and business rules must produce the same output after the refactor.
- Write a simple smoke test or manual check before and after moving a handler.

### 3. Refactor in small incremental steps

Preferred order for migrating a feature from `server.mjs`:

```
Step 1: Create the feature folder and empty files
Step 2: Move repositories (Supabase calls)
Step 3: Move services (business logic)
Step 4: Move controllers (req/res)
Step 5: Move routes and register in app.mjs
Step 6: Remove from server.mjs
Step 7: Verify behavior is unchanged
```

One feature at a time. Commit after each feature is complete.

### 4. Ensure imports are updated after moving files

When a function or constant moves to a new file, update every import site before committing.

```js
// Before (inline in server.mjs)
function toUser(row) { ... }

// After — update all callers
import { toUser } from '../../shared/utils/mappers.mjs';
```

Run a search for the old reference to confirm no stale imports remain:
```
grep -r "from '../../server'" backend/src/
```

### 5. Run tests after each structural change

After completing each step:
- Run `npm run dev` and confirm the server starts without errors.
- Manually hit affected endpoints (or run integration tests if available).
- Only proceed to the next step after confirming no regressions.

---

## Migration Order for SENDA Features

When migrating `server.mjs` → feature modules, follow this sequence to minimize risk:

| Priority | Feature | Reason |
|----------|---------|--------|
| 1 | `auth` | Self-contained, no cross-feature dependencies |
| 2 | `rates` | Smallest feature, easiest to validate |
| 3 | `departments` | Moderate complexity, referenced by others |
| 4 | `users` | Higher complexity, many role checks |
| 5 | `workLogs` | Highest complexity, most business rules |
| 6 | `kiosk` | Not yet in API — add after others are stable |

---

## Checklist — Before Starting a Refactor

- [ ] Identify the feature scope (which routes/handlers will move)
- [ ] Note the current API contract (endpoints, request/response shapes)
- [ ] Run existing tests / smoke test current behavior
- [ ] Create a dedicated git branch for the refactor

## Checklist — After Each Step

- [ ] Server starts without errors (`npm run dev`)
- [ ] Affected endpoints respond correctly
- [ ] No stale imports from old file locations
- [ ] No leftover dead code in `server.mjs` for the migrated feature

## Checklist — After Full Feature Migration

- [ ] `server.mjs` has no remaining code for this feature
- [ ] Feature folder has all 5 files (`routes`, `controller`, `service`, `repository`, `schemas`)
- [ ] Route is registered in `app.mjs`
- [ ] Commit message follows: `refactor(<feature>): migrate to feature module`
