alter table public.posts
    drop constraint if exists posts_author_check,
    add constraint posts_author_check
        check (
            ((identity_id is not null) <> (alias_session_id is not null))
            or coalesce(author_snapshot, '{}'::jsonb) <> '{}'::jsonb
        );

alter table public.comments
    drop constraint if exists comments_author_check,
    add constraint comments_author_check
        check (
            ((identity_id is not null) <> (alias_session_id is not null))
            or coalesce(author_snapshot, '{}'::jsonb) <> '{}'::jsonb
        );
