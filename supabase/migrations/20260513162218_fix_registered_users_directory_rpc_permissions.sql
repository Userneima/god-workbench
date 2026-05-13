create or replace function public.list_registered_users()
returns table (
    user_id uuid,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz,
    last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
    select *
    from private.list_registered_users();
$$;

grant execute on function public.list_registered_users() to authenticated;
