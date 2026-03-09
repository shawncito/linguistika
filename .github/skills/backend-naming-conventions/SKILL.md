# Backend Naming Conventions

## Description

Defines naming conventions for files, functions, variables, and classes in the backend. Use this skill when creating new files, writing functions, or reviewing code for consistency.

## Applies To

- `backend/src/**`

---

## File Names

Feature files follow the pattern `<featureName>.<layer>.mjs` in kebab-case for multi-word features:

```
features/
  auth/
    auth.routes.mjs
    auth.controller.mjs
    auth.service.mjs
    auth.repository.mjs
    auth.schemas.mjs
  users/
    users.routes.mjs
    users.controller.mjs
    users.service.mjs
    users.repository.mjs
    users.schemas.mjs
  workLogs/
    workLogs.routes.mjs
    workLogs.controller.mjs
    workLogs.service.mjs
    workLogs.repository.mjs
    workLogs.schemas.mjs
  departments/
    departments.routes.mjs
    ...
  rates/
    rates.routes.mjs
    ...
  kiosk/
    kiosk.routes.mjs
    ...
shared/
  middleware/
    requireAuth.mjs
    errorHandler.mjs
    validateRequest.mjs
  errors/
    AppError.mjs
  utils/
    normalize.mjs
    regex.mjs
    mappers.mjs
  config/
    supabaseClient.mjs
    logger.mjs
```

---

## Function Names

Use **camelCase** verb-first naming:

### CRUD Operations

```js
// ✅ Correct
getUsers()
getUserById(id)
createUser(payload)
updateUser(id, updates)
deleteUser(id)

// Departments
getDepartments()
createDepartment(payload)
updateDepartment(id, updates)
deleteDepartment(id)

// Work Logs
getWorkLogs(filters)
createWorkLog(payload)
updateWorkLogStatus(id, status)
bulkUpdateWorkLogStatus(updates)

// Auth
login(identifier, password)
logout()
getSessionProfile(token)
resetPassword(userId, newPassword)
```

### Repository Functions

Match service names but do not include role/auth context:

```js
findAll()
findById(id)
findByFilters(filters)
insert(payload)
update(id, updates)
remove(id)
```

---

## Variable Names

Always **camelCase**:

```js
// ✅ Correct
const userId = req.params.id;
const requesterRole = requester.role;
const normalizedName = String(name).trim();
const isActive = Boolean(req.body.isActive);

// ❌ Wrong
const user_id = req.params.id;
const RequesterRole = requester.role;
const NormalizedName = String(name).trim();
```

---

## Constants

**SCREAMING_SNAKE_CASE** for module-level constants:

```js
export const WORK_LOG_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED']);
export const WORK_LOG_ENTRY_SOURCES = new Set(['MANUAL', 'KIOSK']);
export const INSTITUTIONAL_EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
export const COST_CENTER_REGEX = /^\d{2}-\d{4}$/;
```

---

## Classes

**PascalCase** — used only for error classes and potentially loggers:

```js
export class AppError extends Error { ... }
export class Logger { ... }
```

---

## Route Handler Methods (Controllers)

Follow the same verb pattern as service functions:

```js
export const userController = {
  getAll:         async (req, res) => { ... },
  getById:        async (req, res) => { ... },
  create:         async (req, res) => { ... },
  update:         async (req, res) => { ... },
  remove:         async (req, res) => { ... },
  resetPassword:  async (req, res) => { ... },
};
```

---

## Checklist

- [ ] All feature files follow `<featureName>.<layer>.mjs` naming
- [ ] All functions use camelCase with a verb prefix
- [ ] All module-level constants use SCREAMING_SNAKE_CASE
- [ ] All variables inside functions use camelCase
- [ ] All class names use PascalCase
- [ ] Controller methods match their service counterpart names
