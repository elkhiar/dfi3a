-- Mutual volunteer friendships with explicit requests and privacy-aware public profiles.

alter type public.notification_type add value if not exists 'friend_request_received';
alter type public.notification_type add value if not exists 'friend_request_accepted';

begin;

create table if not exists public.friend_connections (
  user_low_id uuid not null references public.profiles(user_id) on delete cascade,
  user_high_id uuid not null references public.profiles(user_id) on delete cascade,
  requested_by uuid not null references public.profiles(user_id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_low_id, user_high_id),
  check (user_low_id < user_high_id),
  check (requested_by in (user_low_id, user_high_id))
);

create index if not exists friend_connections_high_status_idx
  on public.friend_connections (user_high_id, status, updated_at desc);
create index if not exists friend_connections_low_status_idx
  on public.friend_connections (user_low_id, status, updated_at desc);

alter table public.friend_connections enable row level security;

drop policy if exists "volunteers_read_own_friend_connections" on public.friend_connections;
create policy "volunteers_read_own_friend_connections"
on public.friend_connections for select to authenticated
using (auth.uid() in (user_low_id, user_high_id));

revoke all on table public.friend_connections from anon, authenticated;
grant select on table public.friend_connections to authenticated;

create or replace function public.get_friendship_state(p_other_user_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'anonymous'
    when auth.uid() = p_other_user_id then 'self'
    when connection.status = 'accepted' then 'friends'
    when connection.status = 'pending' and connection.requested_by = auth.uid() then 'outgoing_pending'
    when connection.status = 'pending' then 'incoming_pending'
    else 'none'
  end
  from (select 1) seed
  left join public.friend_connections connection
    on connection.user_low_id = least(auth.uid(), p_other_user_id)
   and connection.user_high_id = greatest(auth.uid(), p_other_user_id);
$$;

create or replace function public.send_friend_request(p_recipient_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  low_id uuid;
  high_id uuid;
  connection public.friend_connections%rowtype;
  sender_name text;
begin
  if current_user_id is null then raise exception 'authentication_required'; end if;
  if current_user_id = p_recipient_user_id then raise exception 'cannot_friend_self'; end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.user_id = current_user_id and profile.account_type = 'volunteer'
  ) then raise exception 'volunteer_account_required'; end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.user_id = p_recipient_user_id
      and profile.account_type = 'volunteer'
      and profile.show_in_directory
  ) then raise exception 'recipient_not_available'; end if;

  low_id := least(current_user_id, p_recipient_user_id);
  high_id := greatest(current_user_id, p_recipient_user_id);

  select * into connection
  from public.friend_connections
  where user_low_id = low_id and user_high_id = high_id;

  if found and connection.status = 'accepted' then return 'friends'; end if;
  if found and connection.status = 'pending' then
    return case when connection.requested_by = current_user_id then 'outgoing_pending' else 'incoming_pending' end;
  end if;

  insert into public.friend_connections (
    user_low_id, user_high_id, requested_by, status, created_at, responded_at, updated_at
  ) values (
    low_id, high_id, current_user_id, 'pending', now(), null, now()
  )
  on conflict (user_low_id, user_high_id) do update set
    requested_by = excluded.requested_by,
    status = 'pending',
    created_at = now(),
    responded_at = null,
    updated_at = now();

  select coalesce(nullif(trim(concat_ws(' ', profile.first_name,
    case when nullif(trim(profile.last_name), '') is not null then left(trim(profile.last_name), 1) || '.' end)), ''), 'Un bénévole')
  into sender_name
  from public.profiles profile where profile.user_id = current_user_id;

  perform public.enqueue_notification(
    p_recipient_user_id,
    'friend_request_received',
    'Nouvelle demande d’amitié',
    sender_name || ' souhaite vous ajouter à ses amis.',
    '/users/' || current_user_id,
    null,
    null
  );

  return 'outgoing_pending';
end;
$$;

create or replace function public.respond_friend_request(p_requester_user_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  responder_name text;
begin
  if current_user_id is null then raise exception 'authentication_required'; end if;

  update public.friend_connections connection
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_at = now(),
      updated_at = now()
  where connection.user_low_id = least(current_user_id, p_requester_user_id)
    and connection.user_high_id = greatest(current_user_id, p_requester_user_id)
    and connection.status = 'pending'
    and connection.requested_by = p_requester_user_id;

  if not found then raise exception 'incoming_request_not_found'; end if;

  if p_accept then
    select coalesce(nullif(trim(concat_ws(' ', profile.first_name,
      case when nullif(trim(profile.last_name), '') is not null then left(trim(profile.last_name), 1) || '.' end)), ''), 'Un bénévole')
    into responder_name
    from public.profiles profile where profile.user_id = current_user_id;

    perform public.enqueue_notification(
      p_requester_user_id,
      'friend_request_accepted',
      'Demande acceptée',
      responder_name || ' fait maintenant partie de vos amis.',
      '/users/' || current_user_id,
      null,
      null
    );
    return 'friends';
  end if;

  return 'none';
end;
$$;

create or replace function public.cancel_friend_request(p_recipient_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friend_connections connection
  where connection.user_low_id = least(auth.uid(), p_recipient_user_id)
    and connection.user_high_id = greatest(auth.uid(), p_recipient_user_id)
    and connection.status = 'pending'
    and connection.requested_by = auth.uid();
  return found;
end;
$$;

create or replace function public.remove_friend(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friend_connections connection
  where connection.user_low_id = least(auth.uid(), p_other_user_id)
    and connection.user_high_id = greatest(auth.uid(), p_other_user_id)
    and connection.status = 'accepted'
    and auth.uid() in (connection.user_low_id, connection.user_high_id);
  return found;
end;
$$;

create or replace function public.get_my_friend_connections()
returns table (
  user_id uuid,
  display_name text,
  city text,
  bio text,
  avatar_path text,
  relationship_state text,
  relationship_updated_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    other_profile.user_id,
    coalesce(nullif(trim(concat_ws(' ', other_profile.first_name,
      case when nullif(trim(other_profile.last_name), '') is not null then left(trim(other_profile.last_name), 1) || '.' end)), ''), 'Bénévole dfi3a'),
    case when other_profile.show_city then nullif(trim(other_profile.city), '') else null end,
    nullif(trim(other_profile.bio), ''),
    other_profile.avatar_path,
    case
      when connection.status = 'accepted' then 'friends'
      when connection.requested_by = auth.uid() then 'outgoing_pending'
      else 'incoming_pending'
    end,
    connection.updated_at
  from public.friend_connections connection
  join public.profiles other_profile
    on other_profile.user_id = case
      when connection.user_low_id = auth.uid() then connection.user_high_id
      else connection.user_low_id
    end
  where auth.uid() in (connection.user_low_id, connection.user_high_id)
    and connection.status in ('pending', 'accepted')
  order by
    case when connection.status = 'pending' and connection.requested_by <> auth.uid() then 0
         when connection.status = 'accepted' then 1 else 2 end,
    connection.updated_at desc;
$$;

create or replace function public.get_public_volunteer_profile(p_user_id uuid)
returns table (
  user_id uuid,
  display_name text,
  city text,
  bio text,
  avatar_path text,
  member_since timestamptz,
  total_points bigint
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    profile.user_id,
    coalesce(nullif(trim(concat_ws(' ', profile.first_name,
      case when nullif(trim(profile.last_name), '') is not null then left(trim(profile.last_name), 1) || '.' end)), ''), 'Bénévole dfi3a'),
    case when profile.show_city then nullif(trim(profile.city), '') else null end,
    nullif(trim(profile.bio), ''),
    profile.avatar_path,
    profile.created_at,
    case when profile.show_in_leaderboard then coalesce((
      select sum(transaction.amount)::bigint
      from public.point_transactions transaction
      where transaction.volunteer_user_id = profile.user_id
    ), 0::bigint) else null end
  from public.profiles profile
  where profile.user_id = p_user_id
    and profile.account_type = 'volunteer'
    and (
      profile.show_in_directory
      or profile.user_id = auth.uid()
      or exists (
        select 1 from public.friend_connections connection
        where connection.user_low_id = least(auth.uid(), profile.user_id)
          and connection.user_high_id = greatest(auth.uid(), profile.user_id)
          and connection.status = 'accepted'
      )
    );
$$;

revoke all on function public.get_friendship_state(uuid) from public;
revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.cancel_friend_request(uuid) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.get_my_friend_connections() from public;
revoke all on function public.get_public_volunteer_profile(uuid) from public;
grant execute on function public.get_friendship_state(uuid) to anon, authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_my_friend_connections() to authenticated;
grant execute on function public.get_public_volunteer_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
