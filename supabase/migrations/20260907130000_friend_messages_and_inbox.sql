-- Unified volunteer inbox and private messages limited to accepted friends.

alter type public.notification_type add value if not exists 'friend_message';

begin;

alter table public.profiles alter column show_in_directory set default true;
alter table public.profiles
  add column if not exists messages_from_friends_only boolean not null default false;
grant update (messages_from_friends_only) on public.profiles to authenticated;

create table public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.profiles(user_id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_user_id <> recipient_user_id)
);

create index friend_messages_participants_created_idx
  on public.friend_messages (sender_user_id, recipient_user_id, created_at desc);
create index friend_messages_recipient_unread_idx
  on public.friend_messages (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.friend_messages enable row level security;
alter table public.friend_messages replica identity full;

create policy "friends_read_shared_messages"
on public.friend_messages for select to authenticated
using (
  auth.uid() in (sender_user_id, recipient_user_id)
);

revoke all on public.friend_messages from anon, authenticated;
grant select on public.friend_messages to authenticated;

create or replace function public.can_message_user(p_recipient_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_recipient_user_id is distinct from auth.uid()
    and exists (
      select 1
      from public.profiles recipient
      where recipient.user_id = p_recipient_user_id
        and recipient.account_type = 'volunteer'
        and (
          not recipient.messages_from_friends_only
          or exists (
            select 1 from public.friend_connections connection
            where connection.user_low_id = least(auth.uid(), p_recipient_user_id)
              and connection.user_high_id = greatest(auth.uid(), p_recipient_user_id)
              and connection.status = 'accepted'
          )
        )
    );
$$;

create or replace function public.send_friend_message(
  p_friend_user_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_content text := trim(p_content);
  created_message_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;
  if p_friend_user_id is null or p_friend_user_id = current_user_id then
    raise exception using errcode = 'P0001', message = 'invalid_recipient';
  end if;
  if char_length(cleaned_content) < 1 or char_length(cleaned_content) > 1000 then
    raise exception using errcode = 'P0001', message = 'invalid_message';
  end if;
  if not public.can_message_user(p_friend_user_id) then
    raise exception using errcode = 'P0001', message = 'recipient_friends_only';
  end if;
  if exists (
    select 1 from public.friend_messages message
    where message.sender_user_id = current_user_id
      and message.created_at > now() - interval '1 second'
  ) then
    raise exception using errcode = 'P0001', message = 'message_rate_limited';
  end if;

  insert into public.friend_messages (sender_user_id, recipient_user_id, content)
  values (current_user_id, p_friend_user_id, cleaned_content)
  returning id into created_message_id;

  return created_message_id;
end;
$$;

create or replace function public.get_friend_messages(
  p_friend_user_id uuid,
  p_limit integer default 150
)
returns table (
  message_id uuid,
  sender_user_id uuid,
  content text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;
  if not public.can_message_user(p_friend_user_id)
    and not exists (
      select 1 from public.friend_messages message
      where (message.sender_user_id = current_user_id and message.recipient_user_id = p_friend_user_id)
         or (message.sender_user_id = p_friend_user_id and message.recipient_user_id = current_user_id)
    ) then
    raise exception using errcode = 'P0001', message = 'conversation_access_denied';
  end if;

  return query
  select recent.message_id, recent.sender_user_id, recent.content, recent.created_at, recent.read_at
  from (
    select message.id as message_id, message.sender_user_id, message.content,
      message.created_at, message.read_at
    from public.friend_messages message
    where (message.sender_user_id = current_user_id and message.recipient_user_id = p_friend_user_id)
       or (message.sender_user_id = p_friend_user_id and message.recipient_user_id = current_user_id)
    order by message.created_at desc, message.id desc
    limit least(greatest(coalesce(p_limit, 150), 1), 250)
  ) recent
  order by recent.created_at, recent.message_id;
end;
$$;

create or replace function public.mark_friend_messages_read(p_friend_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.friend_messages
  set read_at = now()
  where recipient_user_id = auth.uid()
    and sender_user_id = p_friend_user_id
    and read_at is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.get_my_friend_conversations()
returns table (
  friend_user_id uuid,
  display_name text,
  avatar_path text,
  latest_content text,
  latest_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with conversation_people as (
    select case when connection.user_low_id = auth.uid()
      then connection.user_high_id else connection.user_low_id end as friend_user_id
    from public.friend_connections connection
    where auth.uid() in (connection.user_low_id, connection.user_high_id)
      and connection.status = 'accepted'
    union
    select case when message.sender_user_id = auth.uid()
      then message.recipient_user_id else message.sender_user_id end
    from public.friend_messages message
    where auth.uid() in (message.sender_user_id, message.recipient_user_id)
  )
  select
    profile.user_id,
    coalesce(nullif(trim(concat_ws(' ', profile.first_name,
      case when nullif(trim(profile.last_name), '') is not null
        then left(trim(profile.last_name), 1) || '.' end)), ''), 'Ami dfi3a'),
    profile.avatar_path,
    latest.content,
    latest.created_at,
    (select count(*) from public.friend_messages unread
      where unread.sender_user_id = profile.user_id
        and unread.recipient_user_id = auth.uid()
        and unread.read_at is null)::bigint
  from conversation_people
  join public.profiles profile on profile.user_id = conversation_people.friend_user_id
  left join lateral (
    select message.content, message.created_at
    from public.friend_messages message
    where (message.sender_user_id = auth.uid() and message.recipient_user_id = profile.user_id)
       or (message.sender_user_id = profile.user_id and message.recipient_user_id = auth.uid())
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  order by latest.created_at desc nulls last, profile.first_name, profile.last_name;
$$;

create or replace function public.get_my_mission_conversations()
returns table (
  mission_id uuid,
  mission_slug text,
  mission_title text,
  ngo_id uuid,
  ngo_name text,
  ngo_logo_path text,
  latest_content text,
  latest_at timestamptz,
  latest_author_role text,
  latest_author_avatar_path text,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mission.id,
    mission.slug,
    mission.title,
    ngo.id,
    ngo.name,
    ngo.logo_path,
    latest.content,
    latest.created_at,
    latest.author_role,
    latest.author_avatar_path,
    (select count(*) from public.notifications notification
      where notification.recipient_user_id = auth.uid()
        and notification.type = 'chat_message'
        and notification.action_path = '/missions/' || mission.slug || '/chat'
        and notification.read_at is null)::bigint
  from public.registrations registration
  join public.missions mission on mission.id = registration.mission_id
  join public.ngos ngo on ngo.id = mission.ngo_id
  left join lateral (
    select
      message.content,
      message.created_at,
      case when ngo.owner_user_id = message.author_user_id then 'ngo' else profile.account_type::text end as author_role,
      case when ngo.owner_user_id = message.author_user_id then ngo.logo_path else profile.avatar_path end as author_avatar_path
    from public.mission_chat_messages message
    join public.profiles profile on profile.user_id = message.author_user_id
    where message.mission_id = mission.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where registration.volunteer_user_id = auth.uid()
    and registration.status = 'joined'
  order by coalesce(latest.created_at, mission.starts_at) desc
  limit 100;
$$;

create or replace function public.mark_conversation_notifications_read(p_action_path text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if p_action_path is null or p_action_path not like '/%' then
    return 0;
  end if;
  update public.notifications
  set read_at = now()
  where recipient_user_id = auth.uid()
    and action_path = p_action_path
    and type in ('chat_message', 'friend_message')
    and read_at is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.notify_friend_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_name text;
begin
  select coalesce(nullif(trim(profile.first_name), ''), 'Un ami')
  into sender_name
  from public.profiles profile
  where profile.user_id = new.sender_user_id;

  perform public.enqueue_notification(
    new.recipient_user_id,
    'friend_message',
    'Nouveau message de ' || sender_name,
    left(regexp_replace(new.content, '\s+', ' ', 'g'), 300),
    '/messages/' || new.sender_user_id,
    null,
    null
  );
  return new;
end;
$$;

create trigger friend_messages_notify_insert
after insert on public.friend_messages
for each row execute function public.notify_friend_message();

revoke all on function public.send_friend_message(uuid, text) from public;
revoke all on function public.can_message_user(uuid) from public;
revoke all on function public.get_friend_messages(uuid, integer) from public;
revoke all on function public.mark_friend_messages_read(uuid) from public;
revoke all on function public.get_my_friend_conversations() from public;
revoke all on function public.get_my_mission_conversations() from public;
revoke all on function public.mark_conversation_notifications_read(text) from public;
revoke all on function public.notify_friend_message() from public;
grant execute on function public.send_friend_message(uuid, text) to authenticated;
grant execute on function public.can_message_user(uuid) to authenticated;
grant execute on function public.get_friend_messages(uuid, integer) to authenticated;
grant execute on function public.mark_friend_messages_read(uuid) to authenticated;
grant execute on function public.get_my_friend_conversations() to authenticated;
grant execute on function public.get_my_mission_conversations() to authenticated;
grant execute on function public.mark_conversation_notifications_read(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friend_messages'
  ) then
    alter publication supabase_realtime add table public.friend_messages;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
