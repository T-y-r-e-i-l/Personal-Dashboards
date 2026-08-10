# RLS smoke checklist

Run after applying `supabase/migrations/20260810000000_init.sql` and creating two users in Supabase Auth.

1. Sign up as User A, complete onboarding, create a task and capture.
2. Sign up as User B in a private window.
3. In Supabase SQL editor (as service role) confirm both users have rows:

```sql
select user_id, count(*) from tasks group by user_id;
select user_id, count(*) from captures group by user_id;
```

4. As User B in the app, confirm User A's tasks/captures never appear.
5. As User B, attempt a crafted client query for User A's `user_id` — RLS should return empty/error.

Automated browser E2E for cross-user RLS requires two seeded accounts and env secrets; keep this checklist until those fixtures exist.
