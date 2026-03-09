# Repository Pattern Enforcement

## Description

Enforces that all database access is encapsulated inside repository files. Services never call Supabase directly; controllers never call repositories directly. Use this skill when writing data access code or reviewing any file that imports `supabase`.

## Applies To

- `backend/src/features/**/*.repository.mjs`
- `backend/src/shared/config/supabaseClient.mjs`

---

## The Only Permitted Flow

```
Controller → Service → Repository → Supabase (Database)
```

No shortcuts are allowed:

- ❌ `Controller → Repository`
- ❌ `Service → Supabase directly`
- ❌ `Route handler → Supabase directly`

---

## Rules

### 1. Services cannot directly access the Supabase client

```js
// ✅ Correct — service delegates to repository
async function createUser(payload, requester) {
  validateRole(requester);
  return userRepository.insert(payload);
}

// ❌ Wrong — service imports supabase
import { adminSupabase } from '../../config/supabaseClient.mjs';
const { data } = await adminSupabase.from('profiles').insert(payload);
```

### 2. Controllers cannot access repositories

```js
// ✅ Correct
async getUser(req, res) {
  const user = await userService.getById(req.params.id);
  return res.json(user);
}

// ❌ Wrong — controller bypasses service
async getUser(req, res) {
  const user = await userRepository.findById(req.params.id);
  return res.json(user);
}
```

### 3. Repositories must return normalized data

Repositories use mappers from `shared/utils/mappers.mjs` before returning data. They never return raw Supabase rows.

```js
// ✅ Correct
async findById(id) {
  const { data, error } = await adminSupabase.from('profiles').select('*').eq('id', id).single();
  if (error || !data) throw new AppError('Usuario no encontrado', 404);
  return toUser(data);           // ← always normalized
}

// ❌ Wrong — returning raw row
async findById(id) {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
  return data;                   // ← raw Supabase object
}
```

---

## Repository File Template

```js
// features/users/users.repository.mjs
import { adminSupabase } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';
import { toUser } from '../../shared/utils/mappers.mjs';

export async function findAll() {
  const { data, error } = await adminSupabase.from('profiles').select('*');
  if (error) throw new AppError(error.message, 400);
  return (data ?? []).map(toUser);
}

export async function findById(id) {
  const { data, error } = await adminSupabase.from('profiles').select('*').eq('id', id).single();
  if (error || !data) throw new AppError('Usuario no encontrado', 404);
  return toUser(data);
}

export async function insert(payload) {
  const { data, error } = await adminSupabase.from('profiles').insert(payload).select('*').single();
  if (error) throw new AppError(error.message, 400);
  return toUser(data);
}

export async function update(id, updates) {
  const { error } = await adminSupabase.from('profiles').update(updates).eq('id', id);
  if (error) throw new AppError(error.message, 400);
}

export async function remove(id) {
  const { error } = await adminSupabase.auth.admin.deleteUser(id);
  if (error) throw new AppError(error.message, 400);
}
```

---

## Supabase Client Access

Two clients are available from `shared/config/supabaseClient.mjs`:

| Client | When to use |
|--------|-------------|
| `adminSupabase` | Write operations, admin actions (uses `SERVICE_ROLE_KEY`) |
| `getAuthedSupabase(token)` | Read operations respecting RLS (uses user's JWT) |

Repositories choose the correct client based on the operation.

---

## Checklist

- [ ] No `supabase.from(...)` calls outside of `*.repository.mjs` files
- [ ] All repositories return typed/normalized data via `mappers.mjs`
- [ ] All DB errors are caught in repository and re-thrown as `AppError`
- [ ] Controllers never import any `*.repository.mjs` file
- [ ] Services never import `supabaseClient.mjs`
