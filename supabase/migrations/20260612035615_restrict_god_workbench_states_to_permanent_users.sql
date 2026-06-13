drop policy if exists "god_workbench_states_select_own" on public.god_workbench_states;
drop policy if exists "god_workbench_states_insert_own" on public.god_workbench_states;
drop policy if exists "god_workbench_states_update_own" on public.god_workbench_states;
drop policy if exists "god_workbench_states_delete_own" on public.god_workbench_states;

create policy "god_workbench_states_select_own"
on public.god_workbench_states
for select
to authenticated
using (
    (select auth.uid()) = user_id
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
);

create policy "god_workbench_states_insert_own"
on public.god_workbench_states
for insert
to authenticated
with check (
    (select auth.uid()) = user_id
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
);

create policy "god_workbench_states_update_own"
on public.god_workbench_states
for update
to authenticated
using (
    (select auth.uid()) = user_id
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
)
with check (
    (select auth.uid()) = user_id
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
);

create policy "god_workbench_states_delete_own"
on public.god_workbench_states
for delete
to authenticated
using (
    (select auth.uid()) = user_id
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
);
