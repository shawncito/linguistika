# Codebase Migration Strategy

## Description

Provides the complete step-by-step strategy for migrating the current `backend/server.mjs` monolith into the feature-based architecture. Covers how to move code, preserve functionality, order commits, and validate each migration step. Use this skill when starting or continuing the backend restructuring.

## Applies To

- `backend/server.mjs` → `backend/src/`
- Migration of all 5 active features: `auth`, `users`, `departments`, `workLogs`, `rates`

---

## Overall Migration Goal

```
BEFORE                          AFTER
─────────────────────           ──────────────────────────────────────
backend/                        backend/
  server.mjs  (all logic)         src/
                                    main.mjs
                                    app.mjs
                                    config/
                                    shared/
                                    features/
                                      auth/
                                      users/
                                      departments/
                                      workLogs/
                                      rates/
                                      kiosk/     ← (scaffolded, no routes yet)
```

---

## Migration Priority

Migrate in this order to minimize risk at each step:

| Step | Feature | Endpoints | Risk |
|------|---------|-----------|------|
| 1 | `auth` | 3 | Low — no cross-feature deps |
| 2 | `rates` | 2 | Low — smallest feature |
| 3 | `departments` | 4 | Medium — referenced by workLogs |
| 4 | `users` | 5 | Medium-high — complex role logic |
| 5 | `workLogs` | 4 | High — most business rules |
| 6 | `kiosk` | 0 | Scaffold only (no endpoints yet) |

---

## Per-Feature Migration Steps

Follow this exact sequence for each feature:

```
1. Create feature folder and all 5 empty files
2. Move Supabase queries → *.repository.mjs
3. Move business logic → *.service.mjs
4. Move req/res handling → *.controller.mjs
5. Move route declarations → *.routes.mjs
6. Move constants/validators → *.schemas.mjs
7. Register feature router in app.mjs
8. Delete migrated handlers from server.mjs
9. Move shared helpers (mappers, regex, normalize) to shared/ if not already there
10. Run server + smoke test all affected endpoints
11. Commit: refactor(<feature>): migrate to feature module
```

---

## Setting Up `src/` Before Migrating

Before migrating any feature, scaffold the target structure:

```
backend/src/
  main.mjs                   ← entry point (replaces server.mjs top-level bootstrap)
  app.mjs                    ← Express app setup, middleware, route registration
  shared/
    config/
      supabaseClient.mjs     ← extract adminSupabase + getAuthedSupabase
      logger.mjs
    middleware/
      requireAuth.mjs        ← extract requireAuth from server.mjs
      errorHandler.mjs
    errors/
      AppError.mjs
    utils/
      normalize.mjs          ← extract normalizeOptionalText, normalizeIsoTimestamp
      regex.mjs              ← extract INSTITUTIONAL_EMAIL_REGEX, COST_CENTER_REGEX
      mappers.mjs            ← extract toUser, toDepartment, toWorkLog
```

Commit this scaffold **before** migrating any feature:
```
chore(backend): scaffold src/ structure for feature-based migration
```

---

## Preserving Functionality During Migration

### API contract must not change

Before migrating each feature, document its current contract:

```
Feature: auth
  POST /api/v1/auth/login     body: { identifier, password }  → { accessToken, user }
  GET  /api/v1/auth/me                                        → User
  POST /api/v1/auth/logout                                    → 204
```

After migration, verify these contracts are identical.

### Run smoke tests after every feature

After migrating each feature and before committing:

```powershell
# Start server
npm run dev:backend

# Quick smoke test (adjust values)
curl -X POST http://localhost:4000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"identifier":"admin","password":"Test#123456"}'
```

---

## Import Update Rules

After moving a function to a new file, grep for any remaining imports of the old location:

```powershell
# Example: confirm toUser is no longer imported from server.mjs
Select-String -Path "backend/src/**/*.mjs" -Pattern "from '.*server'" -Recurse
```

---

## Commit Message Convention

```
chore(backend): scaffold src/ structure
refactor(auth): migrate to feature module
refactor(rates): migrate to feature module
refactor(departments): migrate to feature module
refactor(users): migrate to feature module
refactor(workLogs): migrate to feature module
chore(kiosk): scaffold feature, no routes yet
chore(backend): remove legacy server.mjs after full migration
```

Keep commits **atomic** — one per feature.

---

## Definition of Done

The migration is complete when:

- [ ] `backend/src/` exists with all 5 active features fully migrated
- [ ] `backend/server.mjs` is empty of business logic (or removed)
- [ ] All endpoints respond identically to pre-migration behavior
- [ ] `shared/` contains all cross-feature utilities
- [ ] `kiosk` feature is scaffolded (even without routes)
- [ ] No stale imports pointing to old file locations
- [ ] All commits are atomic and follow the convention above
- [ ] Server starts cleanly with `npm run dev:backend`
