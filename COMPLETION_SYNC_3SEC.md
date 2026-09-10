# 3-Second Cross-Device Completion Sync

This update adds a lightweight background completion-change feed.

## What changed

- The app checks for completion/reopen changes every 3 seconds while online.
- It does **not** reload the browser page.
- It does **not** reset filters, pagination, map position, groups, or navigation.
- Farmers page performs one silent fresh data load only when a real completion change is received.
- Open Map updates farmer marker status in place.
- Dashboard silently refreshes only when a completion/reopen change is received.
- The existing durable Complete/Reopen queue remains authoritative while a local action is waiting for server confirmation.
- Completion changes are recorded by a database trigger, so the completion/reopen write and its sync event are atomic.

## Required Supabase step

Run the updated `supabase/schema.sql` against the project's Supabase database once.

The migration creates:

- `public.completion_events`
- `public.log_completion_change()`
- `completed_farmers_completion_event` trigger

No frontend Supabase Realtime configuration is required for this polling method.

## Normal behavior

Enumerator A taps Complete:

1. A's card changes immediately (existing optimistic workflow).
2. The action remains in the existing durable local queue until the server confirms it.
3. Supabase commits the completion and atomically creates a completion event.
4. Enumerator B's next 3-second background poll receives the event.
5. B's UI updates silently without a page reload.
6. If B has a local pending Complete/Reopen action for the same BP, B's local queued action is never overwritten.

Reopen works the same way in the opposite direction.

## Important

The 3-second timer is a **status synchronization timer**, not a full-page auto-refresh.
