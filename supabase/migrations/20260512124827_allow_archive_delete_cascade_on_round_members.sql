create or replace function private.prepare_round_member_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    round_row public.channel_rounds;
begin
    if tg_op = 'DELETE' then
        select *
        into round_row
        from public.channel_rounds
        where id = old.round_id;

        if round_row.id is null then
            return old;
        end if;
    else
        select *
        into round_row
        from public.channel_rounds
        where id = new.round_id;

        if round_row.id is null then
            raise exception 'Round not found.'
                using errcode = 'P0002';
        end if;
    end if;

    perform private.round_write_guard(round_row.channel_id, round_row.id);

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$$;
