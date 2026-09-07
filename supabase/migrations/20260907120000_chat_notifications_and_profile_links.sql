-- Live chat notifications and profile-aware chat/leaderboard payloads.

alter type public.notification_type add value if not exists 'chat_message';

begin;

drop function if exists public.get_leaderboard(text);

create function public.get_leaderboard(p_period text default 'month')
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  city text,
  avatar_path text,
  points bigint,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with volunteer_scores as (
    select
      profile.user_id,
      concat_ws(' ', profile.first_name, left(profile.last_name, 1) || '.') as display_name,
      case when profile.show_city then profile.city else null end as city,
      profile.avatar_path,
      coalesce(sum(transaction.amount) filter (
        where p_period = 'all'
          or transaction.created_at >= date_trunc('month', now())
      ), 0)::bigint as points,
      profile.created_at
    from public.profiles profile
    left join public.point_transactions transaction
      on transaction.volunteer_user_id = profile.user_id
    where profile.account_type = 'volunteer'
      and profile.show_in_leaderboard
    group by profile.user_id, profile.first_name, profile.last_name,
      profile.show_city, profile.city, profile.avatar_path, profile.created_at
  )
  select
    row_number() over (order by volunteer_scores.points desc, volunteer_scores.created_at)::bigint,
    volunteer_scores.user_id,
    nullif(trim(volunteer_scores.display_name), ''),
    volunteer_scores.city,
    volunteer_scores.avatar_path,
    volunteer_scores.points,
    volunteer_scores.user_id = auth.uid()
  from volunteer_scores
  order by volunteer_scores.points desc, volunteer_scores.created_at
  limit 100;
$$;

revoke all on function public.get_leaderboard(text) from public;
grant execute on function public.get_leaderboard(text) to anon, authenticated;

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
      or profile.show_in_leaderboard
      or profile.user_id = auth.uid()
      or exists (
        select 1 from public.friend_connections connection
        where connection.user_low_id = least(auth.uid(), profile.user_id)
          and connection.user_high_id = greatest(auth.uid(), profile.user_id)
          and connection.status = 'accepted'
      )
      or exists (
        select 1
        from public.registrations viewer_registration
        join public.registrations other_registration
          on other_registration.mission_id = viewer_registration.mission_id
        where viewer_registration.volunteer_user_id = auth.uid()
          and viewer_registration.status = 'joined'
          and other_registration.volunteer_user_id = profile.user_id
          and other_registration.status = 'joined'
      )
    );
$$;

revoke all on function public.get_public_volunteer_profile(uuid) from public;
grant execute on function public.get_public_volunteer_profile(uuid) to anon, authenticated;

create or replace function public.get_mission_chat_messages_v2(
  p_mission_id uuid,
  p_limit integer default 100
)
returns table (
  message_id uuid,
  author_user_id uuid,
  author_display_name text,
  author_role text,
  author_avatar_path text,
  author_ngo_id uuid,
  content text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_mission_chat(p_mission_id) then
    raise exception using errcode = 'P0001', message = 'chat_access_denied';
  end if;

  return query
  select recent.message_id, recent.author_user_id, recent.author_display_name,
    recent.author_role, recent.author_avatar_path, recent.author_ngo_id,
    recent.content, recent.created_at
  from (
    select
      message.id as message_id,
      message.author_user_id,
      case
        when profile.account_type = 'admin' then 'Équipe dfi3a'
        when ngo.owner_user_id = message.author_user_id then ngo.name
        else coalesce(
          nullif(trim(concat_ws(' ', profile.first_name,
            case when nullif(trim(profile.last_name), '') is not null
              then left(trim(profile.last_name), 1) || '.' else null end)), ''),
          'Bénévole'
        )
      end as author_display_name,
      case
        when profile.account_type = 'admin' then 'admin'
        when ngo.owner_user_id = message.author_user_id then 'ngo'
        else 'volunteer'
      end as author_role,
      case
        when ngo.owner_user_id = message.author_user_id then ngo.logo_path
        else profile.avatar_path
      end as author_avatar_path,
      case when ngo.owner_user_id = message.author_user_id then ngo.id else null end as author_ngo_id,
      message.content,
      message.created_at
    from public.mission_chat_messages message
    join public.profiles profile on profile.user_id = message.author_user_id
    join public.missions mission on mission.id = message.mission_id
    join public.ngos ngo on ngo.id = mission.ngo_id
    where message.mission_id = p_mission_id
    order by message.created_at desc, message.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) recent
  order by recent.created_at, recent.message_id;
end;
$$;

revoke all on function public.get_mission_chat_messages_v2(uuid, integer) from public;
grant execute on function public.get_mission_chat_messages_v2(uuid, integer) to authenticated;

create or replace function public.notify_mission_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission_row public.missions%rowtype;
  ngo_row public.ngos%rowtype;
  author_name text;
  recipient_row record;
begin
  select mission.* into mission_row
  from public.missions mission
  where mission.id = new.mission_id;

  select ngo.* into ngo_row
  from public.ngos ngo
  where ngo.id = mission_row.ngo_id;

  select case
    when profile.account_type = 'admin' then 'Équipe dfi3a'
    when ngo_row.owner_user_id = new.author_user_id then ngo_row.name
    else coalesce(nullif(trim(profile.first_name), ''), 'Un bénévole')
  end into author_name
  from public.profiles profile
  where profile.user_id = new.author_user_id;

  for recipient_row in
    select registration.volunteer_user_id as user_id
    from public.registrations registration
    where registration.mission_id = new.mission_id
      and registration.status = 'joined'
    union
    select ngo_row.owner_user_id
  loop
    if recipient_row.user_id is distinct from new.author_user_id then
      perform public.enqueue_notification(
        recipient_row.user_id,
        'chat_message',
        left('Nouveau message · ' || mission_row.title, 100),
        left(author_name || ' : ' || regexp_replace(new.content, '\s+', ' ', 'g'), 300),
        '/missions/' || mission_row.slug || '/chat',
        mission_row.id,
        mission_row.ngo_id
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists mission_chat_messages_notify_insert on public.mission_chat_messages;
create trigger mission_chat_messages_notify_insert
after insert on public.mission_chat_messages
for each row execute function public.notify_mission_chat_message();

revoke all on function public.notify_mission_chat_message() from public;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
