# Logging Rules

## Description

Enforces consistent, centralized logging across the backend. Prevents raw `console.log` usage and ensures that important events — authentication, errors, critical operations, and DB failures — are always captured. Use this skill when adding new features, handling errors, or reviewing code for observability.

## Applies To

- `backend/src/**`
- `backend/src/shared/config/logger.mjs`

---

## Centralized Logger

All logging must go through the **centralized logger** defined in `shared/config/logger.mjs`.

```js
// shared/config/logger.mjs
export const logger = {
  info:  (msg, meta = {}) => console.info(`[INFO]  ${msg}`, meta),
  warn:  (msg, meta = {}) => console.warn(`[WARN]  ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, meta),
  debug: (msg, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') console.debug(`[DEBUG] ${msg}`, meta);
  },
};
```

> In production you can swap this for `winston` or `pino` without changing any call sites.

---

## Rule: No `console.log` Directly

```js
// ❌ Wrong — raw console usage
console.log('User created:', user.id);
console.error('Something failed:', err);

// ✅ Correct — use the centralized logger
import { logger } from '../../shared/config/logger.mjs';
logger.info('User created', { userId: user.id });
logger.error('User creation failed', { error: err.message });
```

---

## What Must Be Logged

### Authentication events

```js
// Successful login
logger.info('Login successful', { userId: user.id, role: user.role });

// Failed login
logger.warn('Login failed', { identifier, reason: error.message });

// Password reset
logger.info('Password reset performed', { targetUserId: id, by: requester.id });
```

### Errors

All errors caught by `errorHandler` are automatically logged there. Inside repositories or services, log before re-throwing:

```js
// repository
const { data, error } = await supabase.from('profiles')...;
if (error) {
  logger.error('DB query failed on profiles', { error: error.message });
  throw new AppError(error.message, 400);
}
```

### Database failures

```js
logger.error('Work log insert failed', { error: error.message, payload });
```

### Critical operations

```js
// User deletion
logger.warn('User account deleted', { deletedUserId: id, by: requester.id });

// Rate update
logger.info('Hourly rate updated', { rate, by: requester.id });

// Bulk status update
logger.info('Bulk work-log status update', { count: updates.length, by: req.authUser.id });
```

---

## Log Levels Reference

| Level | When to use |
|-------|-------------|
| `info` | Normal successful operations (login, create, update) |
| `warn` | Failed login attempts, expected but notable events (account disabled, resource not found used as flow) |
| `error` | DB failures, unexpected errors, thrown exceptions |
| `debug` | Internal state, intermediate values (dev only) |

---

## What Must NOT Be Logged

- Passwords or tokens (even for debugging)
- Full request bodies containing credentials
- PII beyond what's necessary for tracing (prefer IDs over names/emails in logs)

```js
// ❌ Never log
logger.info('Login attempt', { identifier, password });

// ✅ Safe
logger.info('Login attempt', { identifier });
```

---

## Error Handler Logging

The global `errorHandler` middleware logs all unhandled errors automatically:

```js
// shared/middleware/errorHandler.mjs
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    logger.warn('AppError', { message: err.message, status: err.statusCode, path: req.path });
    return res.status(err.statusCode).json({ message: err.message });
  }
  logger.error('Unhandled error', { message: err.message, stack: err.stack, path: req.path });
  return res.status(500).json({ message: 'Error interno del servidor.' });
}
```

---

## Checklist

- [ ] No `console.log`, `console.error`, or `console.warn` outside `logger.mjs`
- [ ] All login successes and failures are logged
- [ ] All DB errors are logged before being re-thrown as `AppError`
- [ ] All critical destructive operations (delete, reset-password, bulk-update) are logged
- [ ] Logs never contain passwords, tokens, or full credential payloads
- [ ] `errorHandler` is the final catch-all that logs unhandled errors
