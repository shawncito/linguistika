# Realtime Subscription Pattern

## Description

Defines how to add live updates to any hook in this project using Supabase Realtime. Use this skill whenever a hook needs to reflect database changes without the user refreshing the page.

## Applies To

- `frontend/hooks/**`
- Any hook that displays data from a Supabase table

---

## Core Rule

> Every hook that shows data from a table that other users can mutate **must** subscribe to that table's changes via `subscribeToTableChanges` from `frontend/lib/realtime.ts`.

---

## Required Pattern

A hook that uses realtime must have **two separate `useEffect` calls**:

### 1 — Fetch on filter change (normal)
```ts
useEffect(() => {
  let cancelled = false;
  setIsLoading(true);

  fetchData(params)
    .then(result => { if (!cancelled) setData(result); })
    .catch(err   => { if (!cancelled) setError(err.message); })
    .finally(()  => { if (!cancelled) setIsLoading(false); });

  return () => { cancelled = true; };
}, [param1, param2, ...]); // re-runs when filters change
```

### 2 — Realtime background refresh (separate, mounts once)
```ts
const paramsRef = useRef(params);
useEffect(() => { paramsRef.current = params; }); // always current, no deps

useEffect(() => {
  let refreshTimer: number | null = null;

  const scheduleBackgroundRefresh = () => {
    if (refreshTimer !== null) return;            // debounce: only one pending timer
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      fetchData(paramsRef.current)               // always uses latest filters
        .then(result => setData(result))
        .catch(err   => console.warn('[Realtime] refresh fallido', err));
      // ↑ NO setIsLoading(true) — refresh is silent
    }, 250);
  };

  const unsubscribe = subscribeToTableChanges({
    table:    'nombre_tabla',
    onChange: scheduleBackgroundRefresh,
  });

  return () => {
    unsubscribe();
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  };
}, []); // empty deps — mounts once, paramsRef keeps it current
```

---

## Key Rules

| Rule | Why |
|------|-----|
| `paramsRef.current` is updated via its own `useEffect` (no deps) | Avoids "Cannot access refs during render" error from the React compiler |
| The realtime `useEffect` has `[]` deps | The subscription mounts once — no re-subscribe on filter changes |
| Realtime refresh does **not** set `isLoading = true` | Prevents UI flicker; data updates silently in the background |
| 250ms debounce timer | Prevents thundering herd when multiple DB rows change at once |
| `if (refreshTimer !== null) return` guard | Only one pending refresh at a time per hook instance |

---

## When `subscribeToTableChanges` Disables Itself

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, `getRealtimeClient()` returns `null` and `subscribeToTableChanges` returns a no-op unsubscribe function. No error is thrown. This is the expected behavior in local dev without `.env`.

---

## Hooks That Already Use This Pattern

| Hook | Table | Notes |
|------|-------|-------|
| `useWorkLogs` | `work_logs` | Full pattern with `isLoading` guard |
| `useAccountingReport` | `work_logs` | Two separate `useEffect`s; `paramsRef` carries query params |

---

## Anti-Patterns to Avoid

```ts
// ❌ WRONG: updating paramsRef directly during render
const paramsRef = useRef(params);
paramsRef.current = params; // React compiler error: "Cannot access refs during render"

// ✅ CORRECT: update inside useEffect
const paramsRef = useRef(params);
useEffect(() => { paramsRef.current = params; });
```

```ts
// ❌ WRONG: single useEffect for both fetch and subscribe
useEffect(() => {
  fetchData(params);
  subscribeToTableChanges(...);
}, [params]); // re-subscribes on every filter change — leaks channels

// ✅ CORRECT: two separate useEffects
useEffect(() => { fetchData(params); }, [params]);
useEffect(() => { subscribeToTableChanges(...); }, []);
```

```ts
// ❌ WRONG: setIsLoading(true) in the realtime refresh
const scheduleBackgroundRefresh = () => {
  setIsLoading(true); // blocks the UI — looks like a page reload
  fetchData(paramsRef.current).then(setData);
};
```
