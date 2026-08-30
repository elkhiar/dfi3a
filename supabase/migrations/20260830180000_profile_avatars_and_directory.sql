-- Public discovery directories and volunteer profile avatars.

begin;

alter table public.profiles
add column if not exists show_in_directory boolean not null default false;

grant update (show_in_directory) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users_upload_own_profile_avatar" on storage.objects;
create policy "users_upload_own_profile_avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users_update_own_profile_avatar" on storage.objects;
create policy "users_update_own_profile_avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users_delete_own_profile_avatar" on storage.objects;
create policy "users_delete_own_profile_avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.search_public_ngos(p_query text default '')
returns table (
  ngo_id uuid,
  name text,
  description text,
  main_city text,
  logo_path text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    ngo.id,
    ngo.name,
    coalesce(ngo.description, ''),
    ngo.main_city,
    ngo.logo_path
  from public.ngos ngo
  where ngo.status = 'approved'
    and (
      nullif(trim(p_query), '') is null
      or concat_ws(' ', ngo.name, ngo.description, ngo.main_city)
        ilike '%' || trim(p_query) || '%'
    )
  order by ngo.name
  limit 100;
$$;

create or replace function public.search_public_volunteers(p_query text default '')
returns table (
  user_id uuid,
  display_name text,
  city text,
  bio text,
  avatar_path text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    profile.user_id,
    coalesce(
      nullif(trim(concat_ws(' ', profile.first_name,
        case
          when nullif(trim(profile.last_name), '') is not null
          then left(trim(profile.last_name), 1) || '.'
          else null
        end)), ''),
      'Bénévole dfi3a'
    ),
    case when profile.show_city then nullif(trim(profile.city), '') else null end,
    nullif(trim(profile.bio), ''),
    profile.avatar_path
  from public.profiles profile
  where profile.account_type = 'volunteer'
    and profile.show_in_directory
    and (
      nullif(trim(p_query), '') is null
      or concat_ws(' ', profile.first_name, profile.last_name,
        case when profile.show_city then profile.city else null end,
        profile.bio)
        ilike '%' || trim(p_query) || '%'
    )
  order by profile.first_name nulls last, profile.last_name nulls last
  limit 100;
$$;

revoke all on function public.search_public_ngos(text) from public;
revoke all on function public.search_public_volunteers(text) from public;
grant execute on function public.search_public_ngos(text) to anon, authenticated;
grant execute on function public.search_public_volunteers(text) to anon, authenticated;

commit;
