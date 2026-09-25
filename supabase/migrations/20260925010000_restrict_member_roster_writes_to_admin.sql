-- Nickname accounts let every weekly god sign up, so "any permanent user"
-- is no longer a safe write rule for the shared roster. Only the club admin
-- (章鱼烧's account) may create or update it; everyone can still read it.

drop policy if exists "Authenticated users can create god workbench member rosters" on public.god_workbench_member_rosters;
drop policy if exists "Authenticated users can update god workbench member rosters" on public.god_workbench_member_rosters;

create policy "Roster admin can create god workbench member rosters"
on public.god_workbench_member_rosters
for insert
to authenticated
with check ((select auth.uid()) = '905df538-3907-40ad-929f-2561af837724'::uuid);

create policy "Roster admin can update god workbench member rosters"
on public.god_workbench_member_rosters
for update
to authenticated
using ((select auth.uid()) = '905df538-3907-40ad-929f-2561af837724'::uuid)
with check ((select auth.uid()) = '905df538-3907-40ad-929f-2561af837724'::uuid);
