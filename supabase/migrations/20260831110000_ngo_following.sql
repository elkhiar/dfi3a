-- Volunteers can follow approved NGOs and receive one notification per newly published mission.

alter type public.notification_type add value if not exists 'ngo_new_mission';

begin;

create table if not exists public.ngo_follows (
  volunteer_user_id uuid not null references public.profiles(user_id) on delete cascade,
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (volunteer_user_id, ngo_id)
);

create index if not exists ngo_follows_ngo_created_idx
  on public.ngo_follows (ngo_id, created_at desc);

alter table public.ngo_follows enable row level security;

drop policy if exists "volunteers_read_own_ngo_follows" on public.ngo_follows;
create policy "volunteers_read_own_ngo_follows"
on public.ngo_follows for select to authenticated
using (volunteer_user_id = auth.uid());

revoke all on table public.ngo_follows from anon, authenticated;
grant select on table public.ngo_follows to authenticated;

create or replace function public.set_ngo_followed(p_ngo_id uuid, p_followed boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.user_id = current_user_id
      and profile.account_type = 'volunteer'
  ) then
    raise exception 'volunteer_account_required';
  end if;

  if not exists (
    select 1 from public.ngos ngo
    where ngo.id = p_ngo_id
      and ngo.status = 'approved'
  ) then
    raise exception 'approved_ngo_required';
  end if;

  if p_followed then
    insert into public.ngo_follows (volunteer_user_id, ngo_id)
    values (current_user_id, p_ngo_id)
    on conflict (volunteer_user_id, ngo_id) do nothing;
  else
    delete from public.ngo_follows
    where volunteer_user_id = current_user_id
      and ngo_id = p_ngo_id;
  end if;

  return p_followed;
end;
$$;

create or replace function public.is_following_ngo(p_ngo_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.ngo_follows follow
    where follow.volunteer_user_id = auth.uid()
      and follow.ngo_id = p_ngo_id
  );
$$;

create or replace function public.get_my_followed_ngos()
returns table (
  ngo_id uuid,
  name text,
  description text,
  main_city text,
  logo_path text,
  followed_at timestamptz
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
    ngo.logo_path,
    follow.created_at
  from public.ngo_follows follow
  join public.ngos ngo on ngo.id = follow.ngo_id
  where follow.volunteer_user_id = auth.uid()
    and ngo.status = 'approved'
  order by follow.created_at desc;
$$;

create or replace function public.notify_ngo_followers_of_new_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  follower record;
  ngo_name text;
begin
  if new.status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  select ngo.name into ngo_name
  from public.ngos ngo
  where ngo.id = new.ngo_id
    and ngo.status = 'approved';

  if ngo_name is null then
    return new;
  end if;

  for follower in
    select follow.volunteer_user_id
    from public.ngo_follows follow
    where follow.ngo_id = new.ngo_id
  loop
    if not exists (
      select 1 from public.notifications notification
      where notification.recipient_user_id = follower.volunteer_user_id
        and notification.mission_id = new.id
        and notification.type = 'ngo_new_mission'
    ) then
      perform public.enqueue_notification(
        follower.volunteer_user_id,
        'ngo_new_mission',
        'Nouvelle mission de ' || ngo_name,
        '« ' || new.title || ' » vient d’être publiée.',
        '/missions/' || new.slug,
        new.id,
        new.ngo_id
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_ngo_followers_of_new_mission on public.missions;
create trigger notify_ngo_followers_of_new_mission
after insert or update of status on public.missions
for each row execute function public.notify_ngo_followers_of_new_mission();

revoke all on function public.set_ngo_followed(uuid, boolean) from public;
revoke all on function public.is_following_ngo(uuid) from public;
revoke all on function public.get_my_followed_ngos() from public;
revoke all on function public.notify_ngo_followers_of_new_mission() from public;
grant execute on function public.set_ngo_followed(uuid, boolean) to authenticated;
grant execute on function public.is_following_ngo(uuid) to authenticated;
grant execute on function public.get_my_followed_ngos() to authenticated;

notify pgrst, 'reload schema';

commit;
