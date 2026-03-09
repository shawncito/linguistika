# Backend Layer Responsibility

## Description

Enforces the correct responsibility boundary for each backend layer: routes, controllers, services, and repositories. Use this skill when writing new code, reviewing PRs, or deciding where a piece of logic belongs.

## Applies To

- `backend/src/features/**`
- `backend/src/shared/**`

---

## Layer Definitions

### Routes (`<feature>.routes.mjs`)

**Purpose:** Define HTTP endpoints and wire them to controllers.

```js
// ✅ Correct
router.post('/users', requireAuth, userController.createUser);

// ❌ Wrong — business logic inside a route
router.post('/users', requireAuth, async (req, res) => {
  const { role } = req.body;
  if (role === 'SUPER_ADMIN') return res.status(403).json(...);
});
```

Allowed:
- Import and apply middleware
- Call controller methods
- Define route paths

Forbidden:
- Business logic
- Direct service or repository calls
- Any `if/else` based on request content

---

### Controllers (`<feature>.controller.mjs`)

**Purpose:** Bridge HTTP and the service layer. Read request data, call service, send response.

```js
// ✅ Correct
async createUser(req, res) {
  const result = await userService.createUser(req.body, req.authUser);
  return res.status(201).json(result);
}

// ❌ Wrong — business logic inside controller
async createUser(req, res) {
  if (req.body.role === 'SUPER_ADMIN') return res.status(403)...;
}
```

Allowed:
- Read `req.body`, `req.params`, `req.query`, `req.authUser`
- Call service methods
- Map `AppError` to HTTP responses via `errorHandler`
- Return `res.json()` / `res.status().json()`

Forbidden:
- Business logic
- Role checks
- Direct Supabase or repository calls

---

### Services (`<feature>.service.mjs`)

**Purpose:** Contain all business rules, validations, and orchestration.

```js
// ✅ Correct
async createUser(body, requester) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(requester.role))
    throw new AppError('No autorizado', 403);
  return userRepository.insert(body);
}
```

Allowed:
- Role checks and authorization logic
- Business rule validation
- Calling repositories
- Calling other features' services (never their repositories)

Forbidden:
- `req` / `res` references
- Direct Supabase client calls
- Returning raw HTTP status codes

---

### Repositories (`<feature>.repository.mjs`)

**Purpose:** Execute all database operations and return normalized data.

```js
// ✅ Correct
async insert(payload) {
  const { data, error } = await adminSupabase.from('profiles').insert(payload).select('*').single();
  if (error) throw new AppError(error.message, 400);
  return toUser(data);
}
```

Allowed:
- All `supabase.from(...)` calls
- Mapping raw rows to domain objects (using `shared/utils/mappers.mjs`)
- Throwing `AppError` on DB errors

Forbidden:
- Business logic or role checks
- Importing from other feature repositories
- Returning raw Supabase response objects

---

## Decision Tree

```
Where does this code go?
├── Defines an HTTP endpoint?           → routes
├── Reads req / sends res?              → controller
├── Contains an if/else based on role
│   or business state?                  → service
└── Calls supabase.from(...)?           → repository
```

---

## Checklist

- [ ] Routes only call controllers and apply middleware
- [ ] Controllers contain zero business logic
- [ ] Services contain zero Supabase calls
- [ ] Repositories return normalized data (via mappers), never raw rows
- [ ] No layer imports from a deeper-than-one layer (controller never imports repository)
