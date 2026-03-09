# Architecture Preservation

## Description

Provides a decision checklist to follow before modifying or adding any backend code. Ensures that new code is placed in the correct feature and layer, and that global modules are not created unnecessarily. Use this skill as a pre-task verification step before writing any backend code.

## Applies To

- All modifications to `backend/src/`

---

## Pre-Task Checklist (run before writing any code)

### Step 1 — Identify the correct feature

Ask: *"Which business domain does this change belong to?"*

| If the change involves... | Feature |
|--------------------------|---------|
| Login, logout, session | `auth` |
| User creation, editing, roles, activation | `users` |
| Department CRUD, head assignment | `departments` |
| Work log creation, status transitions, bulk ops | `workLogs` |
| Hourly rate read/update | `rates` |
| Kiosk activation, sessions, shifts | `kiosk` |
| Middleware, mappers, regex, error class | `shared/` |

If no existing feature fits, **propose a new feature folder** rather than placing code in `shared/` or creating a top-level utility.

### Step 2 — Identify the correct layer

Ask: *"What kind of logic is this?"*

| Logic type | Layer |
|------------|-------|
| HTTP endpoint registration | `routes` |
| Request parsing + response sending | `controller` |
| Business rules, role checks, validation | `service` |
| Supabase queries | `repository` |
| Validation constants, enums, regex | `schemas` |

### Step 3 — Respect the route → controller → service → repository pattern

Never skip a layer or bypass the pattern:

```
✅ routes → controller → service → repository
❌ routes → service
❌ controller → repository
❌ service → supabase directly
```

### Step 4 — Avoid creating new global modules unnecessarily

Before creating a new top-level file or folder, check:

- Is there an existing feature or `shared/` location this belongs to?
- Is this code reusable across features, or specific to one?
- Does it fit into an existing layer (`service`, `repository`, etc.)?

Only create a new top-level concept when it clearly doesn't fit any existing structure.

---

## Examples

### Adding a "deactivate user" endpoint

1. Feature → `users` (user management domain)
2. Layer → route: `PATCH /users/:id` (already exists, reuse), controller: `update`, service: add `deactivateUser` logic
3. Pattern → route → controller → service (update `is_active`) → repository (update profiles)
4. No new global module needed

### Adding audit log for work log approvals

1. Feature → `workLogs` (existing domain)
2. Layer → extend `workLogs.service.mjs` and `workLogs.repository.mjs` with audit fields
3. Pattern → `updateWorkLogStatus` service → repository writes `approved_by/at`
4. Audit fields already exist in schema — no new module needed

### Adding a reporting endpoint for accounting

1. Feature → new `reports` feature (doesn't fit cleanly in `workLogs` or `rates`)
2. Layer → full feature scaffold: `reports.routes.mjs`, `reports.controller.mjs`, `reports.service.mjs`, `reports.repository.mjs`
3. Pattern → standard route → controller → service → repository
4. Registers at `/api/v1/reports` in `app.mjs`

---

## Warning Signs That Architecture Is Being Violated

- A file is being created at `backend/src/` root level (not in `features/` or `shared/`)
- A service file is growing to over ~150 lines (likely mixing concerns)
- A controller contains more than 5 lines of non-routing logic
- A `utils.mjs` file appears inside a feature folder
- A new feature imports from another feature's non-service files

---

## Checklist

- [ ] Identified the correct feature (or justified creating a new one)
- [ ] Identified the correct layer for each piece of code
- [ ] No layer is skipped in the call chain
- [ ] No new global module created without justification
- [ ] Code placement matches business domain, not technical convenience
