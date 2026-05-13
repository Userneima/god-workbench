drop function if exists public.update_channel_current_round_state(
    uuid,
    text,
    jsonb,
    text,
    text,
    jsonb,
    timestamptz,
    timestamptz,
    jsonb
);

drop function if exists private.update_channel_current_round_state_impl(
    uuid,
    text,
    jsonb,
    text,
    text,
    jsonb,
    timestamptz,
    timestamptz,
    jsonb
);

create or replace function private.update_channel_current_round_state_impl(
    target_channel_id uuid,
    next_title text,
    next_theme text,
    next_god_profile jsonb,
    next_stage text,
    next_status text,
    next_deadlines jsonb,
    next_started_at timestamptz,
    next_completed_at timestamptz,
    next_reveal_map jsonb
)
returns public.channel_rounds
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    channel_row public.channels;
    round_row public.channel_rounds;
    can_edit_theme boolean := false;
    normalized_next_stage text;
    normalized_next_status text;
    normalized_next_deadlines jsonb;
    computed_default_title text;
begin
    select *
    into channel_row
    from public.channels
    where id = target_channel_id
    for update;

    if channel_row.id is null or channel_row.current_round_id is null then
        raise exception 'Current round is not initialized.'
            using errcode = 'P0002';
    end if;

    select *
    into round_row
    from public.channel_rounds
    where id = channel_row.current_round_id
    for update;

    if round_row.id is null then
        raise exception 'Current round is not initialized.'
            using errcode = 'P0002';
    end if;

    if round_row.lifecycle_status <> 'active' then
        raise exception 'Archived rounds are read-only.'
            using errcode = '42501';
    end if;

    normalized_next_stage := case
        when next_stage in ('wish', 'claim', 'delivery', 'guess', 'reveal') then next_stage
        else round_row.current_stage
    end;
    normalized_next_status := case
        when next_status = 'archived' then 'archived'
        else 'active'
    end;
    normalized_next_deadlines := private.normalize_round_deadlines(next_deadlines);

    can_edit_theme := private.is_channel_admin(target_channel_id)
        or coalesce(round_row.god_profile ->> 'userId', '') = coalesce((select auth.uid())::text, '');

    if not can_edit_theme then
        raise exception 'Only channel admins or the current god can update the round.'
            using errcode = '42501';
    end if;

    if not private.is_channel_admin(target_channel_id)
        and (
            normalized_next_stage is distinct from round_row.current_stage
            or normalized_next_status is distinct from round_row.lifecycle_status
            or normalized_next_deadlines is distinct from round_row.deadlines
            or coalesce(next_reveal_map, '{}'::jsonb) is distinct from round_row.reveal_map
            or coalesce(next_god_profile, '{}'::jsonb) is distinct from coalesce(round_row.god_profile, '{}'::jsonb)
            or next_title is not null
        ) then
        raise exception 'Only channel admins can change the stage, deadlines, reveal map, god or round title.'
            using errcode = '42501';
    end if;

    computed_default_title := private.default_round_title(next_started_at, next_theme);

    update public.channel_rounds
    set theme = nullif(btrim(coalesce(next_theme, '')), ''),
        god_profile = case
            when next_god_profile is null or next_god_profile = '{}'::jsonb then null
            else jsonb_build_object(
                'userId', nullif(coalesce(next_god_profile ->> 'userId', ''), ''),
                'name', nullif(coalesce(next_god_profile ->> 'name', ''), ''),
                'avatar', coalesce(next_god_profile ->> 'avatar', '')
            )
        end,
        current_stage = normalized_next_stage,
        lifecycle_status = normalized_next_status,
        deadlines = normalized_next_deadlines,
        started_at = next_started_at,
        completed_at = next_completed_at,
        reveal_map = coalesce(next_reveal_map, '{}'::jsonb),
        default_title = computed_default_title,
        title = case
            when next_title is null then coalesce(nullif(btrim(coalesce(title, '')), ''), computed_default_title)
            else coalesce(nullif(btrim(coalesce(next_title, '')), ''), computed_default_title)
        end,
        updated_at = now()
    where id = round_row.id
    returning *
    into round_row;

    perform private.sync_channel_round_mirror(target_channel_id, round_row.id);

    return round_row;
end;
$$;

create or replace function public.update_channel_current_round_state(
    target_channel_id uuid,
    next_title text default null,
    next_theme text default null,
    next_god_profile jsonb default null,
    next_stage text default null,
    next_status text default null,
    next_deadlines jsonb default null,
    next_started_at timestamptz default null,
    next_completed_at timestamptz default null,
    next_reveal_map jsonb default null
)
returns public.channel_rounds
language sql
security invoker
set search_path = public, auth, pg_temp
as $$
    select *
    from private.update_channel_current_round_state_impl(
        target_channel_id,
        next_title,
        next_theme,
        next_god_profile,
        next_stage,
        next_status,
        next_deadlines,
        next_started_at,
        next_completed_at,
        next_reveal_map
    );
$$;

grant execute on function private.update_channel_current_round_state_impl(
    uuid,
    text,
    text,
    jsonb,
    text,
    text,
    jsonb,
    timestamptz,
    timestamptz,
    jsonb
) to authenticated;

grant execute on function public.update_channel_current_round_state(
    uuid,
    text,
    text,
    jsonb,
    text,
    text,
    jsonb,
    timestamptz,
    timestamptz,
    jsonb
) to authenticated;
