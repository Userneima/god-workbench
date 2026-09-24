create table if not exists public.god_workbench_public_archives (
    archive_id uuid primary key default gen_random_uuid(),
    creator_user_id uuid not null references auth.users(id) on delete cascade,
    schema_version integer not null default 1,
    round_id text not null,
    round_label text not null,
    theme text not null,
    god_name text not null,
    reveal_rows jsonb not null default '[]'::jsonb,
    completion_rows jsonb not null default '[]'::jsonb,
    source_app_version text not null default 'unknown',
    published_at timestamptz not null default now()
);

alter table public.god_workbench_public_archives enable row level security;

drop policy if exists "god_workbench_public_archives_select_public" on public.god_workbench_public_archives;
drop policy if exists "god_workbench_public_archives_insert_creator" on public.god_workbench_public_archives;
drop policy if exists "god_workbench_public_archives_update_none" on public.god_workbench_public_archives;
drop policy if exists "god_workbench_public_archives_delete_none" on public.god_workbench_public_archives;

create policy "god_workbench_public_archives_select_public"
on public.god_workbench_public_archives
for select
to anon, authenticated
using (true);

create policy "god_workbench_public_archives_insert_creator"
on public.god_workbench_public_archives
for insert
to authenticated
with check (
    (select auth.uid()) = creator_user_id
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is false
);

create index if not exists god_workbench_public_archives_published_at_idx
on public.god_workbench_public_archives (published_at desc);

create index if not exists god_workbench_public_archives_round_idx
on public.god_workbench_public_archives (round_id, theme);
