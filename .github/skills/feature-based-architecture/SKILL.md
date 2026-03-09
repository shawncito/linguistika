# Feature Based Architecture Enforcement

## Description

Enforces that backend code in this project is always organized by **feature/domain** rather than by technical layer. Use this skill whenever adding a new feature, refactoring existing code, reviewing a PR, or answering questions about where code should live.

## Applies To

- `backend/src/**`
- Any new Node/Express module in this project

---

## Core Rule

> Every piece of backend code must belong to a **feature folder**. A feature is identified by its business domain (e.g., `users`, `departments`, `workLogs`, `kiosk`, `auth`, `rates`).

---

## Required Structure Per Feature

Each feature folder must contain **all five** of these files:

```
features/
  <featureName>/
    <featureName>.routes.mjs       ← Express Router; maps HTTP verbs to controller methods
    <featureName>.controller.mjs   ← Handles req/res; calls service; no business logic
    <featureName>.service.mjs      ← Business logic and role/status validation
    <featureName>.repository.mjs   ← All Supabase queries; no business logic
    <featureName>.schemas.mjs      ← Input validation schemas (regex, required fields, enums)
```

### File Responsibilities

| File | Responsibility | What it must NOT do |
|------|---------------|---------------------|
| `routes` | Register endpoints, apply middleware | Contain logic |
| `controller` | Read req, call service, send res | Query DB directly |
| `service` | Enforce business rules, role checks | Query DB directly |
| `repository` | Run all Supabase queries | Contain business rules |
| `schemas` | Define validation constants and shapes | Import from other features |

---

## Shared Code Rules

Anything used by **more than one feature** goes into `shared/`:

```
shared/
  middleware/
    requireAuth.mjs
    errorHandler.mjs
    validateRequest.mjs
  errors/
    AppError.mjs
  utils/
    normalize.mjs      ← normalizeOptionalText, normalizeIsoTimestamp
    regex.mjs          ← INSTITUTIONAL_EMAIL_REGEX, COST_CENTER_REGEX
    mappers.mjs        ← toUser, toDepartment, toWorkLog
```

---

## Cross-Feature Communication Rules

1. **A feature's repository must never be imported by another feature.**
2. **Cross-feature calls go through services only.**
   - ✅ `workLogs.service` → `users.service.getById(id)`
   - ❌ `workLogs.service` → `users.repository.findById(id)`
3. **Schemas are local to each feature** — do not share schema files across features.

---

## Checklist — Adding a New Feature

- [ ] Created folder `features/<featureName>/`
- [ ] All five files exist (`routes`, `controller`, `service`, `repository`, `schemas`)
- [ ] Route file is registered in `app.mjs` (e.g., `app.use('/api/v1/<featureName>', featureRouter)`)
- [ ] Controller contains zero SQL or Supabase calls
- [ ] Repository contains zero role checks or business conditionals
- [ ] Any shared logic is placed in `shared/`, not duplicated
- [ ] No direct import of another feature's repository

## Checklist — Refactoring Existing Code from `server.mjs`

- [ ] Identify all `app.get/post/patch/delete` calls for the feature in `server.mjs`
- [ ] Move route declarations → `<feature>.routes.mjs`
- [ ] Extract handler body → split between `controller` (req/res) and `service` (logic)
- [ ] Move all `supabase.from(...)` calls → `<feature>.repository.mjs`
- [ ] Move helper functions (`toUser`, `toDepartment`, etc.) → `shared/utils/mappers.mjs`
- [ ] Move regex constants → `shared/utils/regex.mjs`
- [ ] Move `normalizeOptionalText`, `normalizeIsoTimestamp` → `shared/utils/normalize.mjs`
- [ ] Verify `server.mjs` no longer contains any route-level logic for this feature

---

## Current Feature Map (as of 2026-03-05)

| Feature | Status | Routes count |
|---------|--------|-------------|
| `auth` | ✅ active | 3 |
| `users` | ✅ active | 5 |
| `departments` | ✅ active | 4 |
| `workLogs` | ✅ active | 4 |
| `rates` | ✅ active | 2 |
| `kiosk` | 🚧 schema ready, no API yet | 0 |

---

## Example: Adding `kiosk` Feature

```
features/
  kiosk/
    kiosk.routes.mjs
    kiosk.controller.mjs
    kiosk.service.mjs       ← enforce: only DEPT_HEAD/SUPER_ADMIN can activate
    kiosk.repository.mjs    ← queries on kiosk_state, kiosk_sessions
    kiosk.schemas.mjs       ← validate departmentId, shifts format
```

Register in `app.mjs`:
```js
import kioskRouter from './features/kiosk/kiosk.routes.mjs';
app.use('/api/v1/kiosk', kioskRouter);
```

---

## Anti-patterns to Reject

- ❌ A single `server.mjs` containing all route handlers
- ❌ A `controllers/` folder with files named after HTTP methods (`get.mjs`, `post.mjs`)
- ❌ A `services/` folder at the top level mixing all domains
- ❌ Importing `users.repository.mjs` directly inside `workLogs.service.mjs`
- ❌ Putting shared mappers/regex inside a specific feature folder
