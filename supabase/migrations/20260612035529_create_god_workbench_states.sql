create table if not exists public.god_workbench_states (
    user_id uuid not null references auth.users(id) on delete cascade,
    document_id text not null default 'default',
    state jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, document_id)
);

alter table public.god_workbench_states enable row level security;

drop policy if exists "god_workbench_states_select_own" on public.god_workbench_states;
drop policy if exists "god_workbench_states_insert_own" on public.god_workbench_states;
drop policy if exists "god_workbench_states_update_own" on public.god_workbench_states;
drop policy if exists "god_workbench_states_delete_own" on public.god_workbench_states;

create policy "god_workbench_states_select_own"
on public.god_workbench_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "god_workbench_states_insert_own"
on public.god_workbench_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "god_workbench_states_update_own"
on public.god_workbench_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "god_workbench_states_delete_own"
on public.god_workbench_states
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists god_workbench_states_updated_at_idx
on public.god_workbench_states (updated_at desc);
