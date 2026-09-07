-- Direct messages are open by default; recipients may restrict them to friends.

begin;

alter table public.profiles
  add column if not exists messages_from_friends_only boolean not null default false;
alter table public.profiles alter column messages_from_friends_only set default false;
grant update (messages_from_friends_only) on public.profiles to authenticated;

drop policy if exists "friends_read_shared_messages" on public.friend_messages;
create policy "participants_read_direct_messages"
on public.friend_messages for select to authenticated
using (auth.uid() in (sender_user_id, recipient_user_id));

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
        then left(trim(profile.last_name), 1) || '.' end)), ''), 'Utilisateur dfi3a'),
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

revoke all on function public.can_message_user(uuid) from public;
revoke all on function public.send_friend_message(uuid, text) from public;
revoke all on function public.get_friend_messages(uuid, integer) from public;
revoke all on function public.get_my_friend_conversations() from public;
grant execute on function public.can_message_user(uuid) to authenticated;
grant execute on function public.send_friend_message(uuid, text) to authenticated;
grant execute on function public.get_friend_messages(uuid, integer) to authenticated;
grant execute on function public.get_my_friend_conversations() to authenticated;

notify pgrst, 'reload schema';

commit;
