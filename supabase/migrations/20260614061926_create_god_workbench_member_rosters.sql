create table if not exists public.god_workbench_member_rosters (
    document_id text primary key default 'default',
    participants jsonb not null default '[]'::jsonb,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.god_workbench_member_rosters enable row level security;

create policy "Everyone can read god workbench member rosters"
on public.god_workbench_member_rosters
for select
to anon, authenticated
using (true);

create policy "Authenticated users can create god workbench member rosters"
on public.god_workbench_member_rosters
for insert
to authenticated
with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
);

create policy "Authenticated users can update god workbench member rosters"
on public.god_workbench_member_rosters
for update
to authenticated
using (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
)
with check (
    coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
);

grant select on table public.god_workbench_member_rosters to anon, authenticated;
grant insert, update on table public.god_workbench_member_rosters to authenticated;
