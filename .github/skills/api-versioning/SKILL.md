# API Versioning

## Description

Enforces that all backend routes are prefixed with an API version and that breaking changes are introduced through new versions rather than modifying existing ones. Use this skill when adding new routes, changing response shapes, or planning breaking changes.

## Applies To

- `backend/src/app.mjs`
- `backend/src/features/**/*.routes.mjs`

---

## Rule

> All routes must be prefixed with `/api/v<N>`. New versions are introduced only when a breaking change is required.

---

## Current Version

This project is on **v1**. All routes follow:

```
/api/v1/<resource>
```

Examples:
```
GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
POST   /api/v1/users/:id/reset-password
GET    /api/v1/departments
POST   /api/v1/departments
PATCH  /api/v1/departments/:id
DELETE /api/v1/departments/:id
GET    /api/v1/work-logs
POST   /api/v1/work-logs
PATCH  /api/v1/work-logs/:id/status
PATCH  /api/v1/work-logs/bulk-status
GET    /api/v1/rate
PUT    /api/v1/rate
POST   /api/v1/auth/login
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
```

---

## How to Register Routes in `app.mjs`

```js
// app.mjs
const API = '/api/v1';

app.use(`${API}/auth`,        authRouter);
app.use(`${API}/users`,       usersRouter);
app.use(`${API}/departments`, departmentsRouter);
app.use(`${API}/work-logs`,   workLogsRouter);
app.use(`${API}/rate`,        ratesRouter);
app.use(`${API}/kiosk`,       kioskRouter);   // when ready
```

The version prefix is set **once** in `app.mjs` — routes inside `*.routes.mjs` declare paths **without** the version prefix:

```js
// features/users/users.routes.mjs
router.get('/',       requireAuth, userController.getAll);
router.post('/',      requireAuth, userController.create);
router.patch('/:id',  requireAuth, userController.update);
router.delete('/:id', requireAuth, userController.remove);
```

---

## When to Create a New Version (`v2`)

Create `/api/v2/` only when a change is **breaking** for existing consumers:

| Change type | Breaking? | Action |
|-------------|-----------|--------|
| New optional field in response | ❌ No | Add to v1 |
| New endpoint | ❌ No | Add to v1 |
| Removing a response field | ✅ Yes | Create v2 |
| Renaming a required request field | ✅ Yes | Create v2 |
| Changing a route path | ✅ Yes | Create v2 |
| New required field in request body | ✅ Yes | Create v2 |

---

## Non-versioned Routes

Only system/infrastructure routes are exempt from versioning:

```
GET /health    ← infrastructure health check
```

All business routes must be versioned.

---

## Checklist

- [ ] All new routes are registered under `/api/v1/` in `app.mjs`
- [ ] Feature route files declare paths without the version prefix
- [ ] Version prefix is defined as a constant in `app.mjs`, not hardcoded per router
- [ ] No breaking change introduced in an existing versioned route
- [ ] `/health` is the only unversioned route
