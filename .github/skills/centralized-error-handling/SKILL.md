# Centralized Error Handling

## Description

Enforces that all backend errors are thrown as `AppError` instances and handled by the central `errorHandler` middleware. Use this skill when writing services, controllers, or adding new error types.

## Applies To

- `backend/src/features/**`
- `backend/src/shared/errors/`
- `backend/src/shared/middleware/errorHandler.mjs`

---

## `AppError` Class

Located at `shared/errors/AppError.mjs`:

```js
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
```

---

## Rules

### 1. Services throw `AppError` for domain errors

```js
// ✅ Correct
if (!user) throw new AppError('Usuario no encontrado', 404);
if (requester.role !== 'ADMIN') throw new AppError('No autorizado', 403);

// ❌ Wrong — returning error objects instead of throwing
return { error: 'Not found', status: 404 };

// ❌ Wrong — throwing plain Error
throw new Error('Something went wrong');
```

### 2. Controllers must not expose raw database errors

```js
// ✅ Correct — service already wrapped error in AppError
async getUser(req, res) {
  const user = await userService.getById(req.params.id);
  return res.json(user);
}

// ❌ Wrong — leaking Supabase internals
async getUser(req, res) {
  const { data, error } = await supabase.from('profiles')...;
  if (error) return res.status(400).json({ message: error.message });
}
```

### 3. `errorHandler` middleware catches everything

Located at `shared/middleware/errorHandler.mjs`:

```js
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  console.error('[Unhandled]', err);
  return res.status(500).json({ message: 'Error interno del servidor.' });
}
```

Registered in `app.mjs` as the **last** middleware:
```js
app.use(errorHandler);
```

---

## Common Status Codes

| Situation | Code |
|-----------|------|
| Missing or invalid input | `400` |
| Unauthenticated | `401` |
| Insufficient permissions | `403` |
| Resource not found | `404` |
| Conflict (duplicate, constraint) | `409` |
| Internal / unexpected | `500` |

---

## Anti-patterns to Reject

- ❌ `res.status(400).json({ message: error.message })` inside a service
- ❌ `try/catch` that swallows errors silently (`catch (e) {}`)
- ❌ `console.error` as the only error-handling mechanism
- ❌ `throw new Error(...)` anywhere outside `AppError` (use `AppError` instead)
- ❌ Multiple `try/catch` blocks in controllers for different error types

---

## Checklist

- [ ] All `throw` statements in services use `AppError`
- [ ] Controllers use `try/catch` only to catch unexpected errors and pass to `next(err)`
- [ ] `errorHandler` is the last `app.use(...)` in `app.mjs`
- [ ] Raw Supabase errors are wrapped in `AppError` inside repositories
- [ ] No `res.status(...).json(...)` inside service files
