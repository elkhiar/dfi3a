-- Text-only mission group chat with participant access, reports and NGO moderation.

begin;

create table public.mission_chat_messages (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  author_user_id uuid not null references public.profiles(user_id) on delete restrict,
  content text not null check (
    char_length(trim(content)) between 1 and 1000
  ),
  created_at timestamptz not null default now()
);

create index mission_chat_messages_mission_created_idx
  on public.mission_chat_messages (mission_id, created_at, id);
create index mission_chat_messages_author_created_idx
  on public.mission_chat_messages (author_user_id, created_at desc);

alter table public.mission_chat_messages replica identity full;

create table public.mission_chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.mission_chat_messages(id) on delete set null,
  mission_id uuid not null references public.missions(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(user_id) on delete restrict,
  reported_author_user_id uuid not null references public.profiles(user_id) on delete restrict,
  content_snapshot text not null,
  reason text not null check (char_length(trim(reason)) between 3 and 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(user_id) on delete set null,
  unique (message_id, reporter_user_id)
);

create index mission_chat_reports_mission_created_idx
  on public.mission_chat_reports (mission_id, created_at desc);

create or replace function public.can_read_mission_chat(
  p_mission_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.profiles profile
      where profile.user_id = auth.uid() and profile.account_type = 'admin'
    )
    or exists (
      select 1
      from public.missions mission
      join public.ngos ngo on ngo.id = mission.ngo_id
      where mission.id = p_mission_id and ngo.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.registrations registration
      where registration.mission_id = p_mission_id
        and registration.volunteer_user_id = auth.uid()
    )
  );
$$;

create or replace function public.can_send_mission_chat(
  p_mission_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.missions mission
    where mission.id = p_mission_id
      and mission.status = 'published'
      and now() < mission.ends_at
      and (
        exists (
          select 1 from public.ngos ngo
          where ngo.id = mission.ngo_id and ngo.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from public.registrations registration
          where registration.mission_id = mission.id
            and registration.volunteer_user_id = auth.uid()
            and registration.status = 'joined'
        )
      )
  );
$$;

create or replace function public.can_moderate_mission_chat(
  p_mission_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.profiles profile
      where profile.user_id = auth.uid() and profile.account_type = 'admin'
    )
    or exists (
      select 1
      from public.missions mission
      join public.ngos ngo on ngo.id = mission.ngo_id
      where mission.id = p_mission_id and ngo.owner_user_id = auth.uid()
    )
  );
$$;

alter table public.mission_chat_messages enable row level security;
alter table public.mission_chat_reports enable row level security;

create policy "mission_members_read_chat_messages"
on public.mission_chat_messages for select to authenticated
using (public.can_read_mission_chat(mission_id));

create policy "mission_moderators_read_chat_reports"
on public.mission_chat_reports for select to authenticated
using (public.can_moderate_mission_chat(mission_id));

revoke all on public.mission_chat_messages from anon, authenticated;
revoke all on public.mission_chat_reports from anon, authenticated;
grant select on public.mission_chat_messages to authenticated;
grant select on public.mission_chat_reports to authenticated;

create or replace function public.get_mission_chat_context(p_mission_id uuid)
returns table (
  mission_id uuid,
  mission_slug text,
  mission_title text,
  mission_ends_at timestamptz,
  mission_status public.mission_status,
  viewer_role text,
  can_read boolean,
  can_send boolean,
  can_moderate boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_account_type public.account_type;
  mission_row public.missions%rowtype;
  owns_mission boolean := false;
  has_registration boolean := false;
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  select profile.account_type into current_account_type
  from public.profiles profile where profile.user_id = current_user_id;

  select mission.* into mission_row
  from public.missions mission where mission.id = p_mission_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'mission_not_found';
  end if;

  select exists (
    select 1 from public.ngos ngo
    where ngo.id = mission_row.ngo_id and ngo.owner_user_id = current_user_id
  ) into owns_mission;
  select exists (
    select 1 from public.registrations registration
    where registration.mission_id = p_mission_id
      and registration.volunteer_user_id = current_user_id
  ) into has_registration;

  return query select
    mission_row.id,
    mission_row.slug,
    mission_row.title,
    mission_row.ends_at,
    mission_row.status,
    case
      when current_account_type = 'admin' then 'admin'
      when owns_mission then 'ngo'
      when has_registration then 'volunteer'
      else coalesce(current_account_type::text, 'unknown')
    end,
    public.can_read_mission_chat(p_mission_id),
    public.can_send_mission_chat(p_mission_id),
    public.can_moderate_mission_chat(p_mission_id);
end;
$$;

create or replace function public.get_mission_chat_messages(
  p_mission_id uuid,
  p_limit integer default 100
)
returns table (
  message_id uuid,
  author_user_id uuid,
  author_display_name text,
  author_role text,
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
    recent.author_role, recent.content, recent.created_at
  from (
    select message.id as message_id,
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

create or replace function public.send_mission_chat_message(
  p_mission_id uuid,
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
  if char_length(cleaned_content) < 1 or char_length(cleaned_content) > 1000 then
    raise exception using errcode = 'P0001', message = 'invalid_chat_message';
  end if;
  if not public.can_send_mission_chat(p_mission_id) then
    raise exception using errcode = 'P0001', message = 'chat_read_only';
  end if;
  if exists (
    select 1 from public.mission_chat_messages message
    where message.author_user_id = current_user_id
      and message.created_at > now() - interval '2 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'chat_rate_limited';
  end if;

  insert into public.mission_chat_messages (mission_id, author_user_id, content)
  values (p_mission_id, current_user_id, cleaned_content)
  returning id into created_message_id;

  return created_message_id;
end;
$$;

create or replace function public.report_mission_chat_message(
  p_message_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  message_row public.mission_chat_messages%rowtype;
  cleaned_reason text := trim(p_reason);
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;
  select message.* into message_row
  from public.mission_chat_messages message where message.id = p_message_id;
  if not found or not public.can_read_mission_chat(message_row.mission_id) then
    raise exception using errcode = 'P0001', message = 'chat_message_not_found';
  end if;
  if message_row.author_user_id = current_user_id then
    raise exception using errcode = 'P0001', message = 'cannot_report_own_message';
  end if;
  if char_length(cleaned_reason) < 3 or char_length(cleaned_reason) > 300 then
    raise exception using errcode = 'P0001', message = 'invalid_report_reason';
  end if;

  insert into public.mission_chat_reports (
    message_id, mission_id, reporter_user_id, reported_author_user_id,
    content_snapshot, reason
  ) values (
    message_row.id, message_row.mission_id, current_user_id,
    message_row.author_user_id, message_row.content, cleaned_reason
  ) on conflict (message_id, reporter_user_id) do nothing;

  return true;
end;
$$;

create or replace function public.moderate_mission_chat_message(
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_mission_id uuid;
begin
  select message.mission_id into message_mission_id
  from public.mission_chat_messages message where message.id = p_message_id;
  if not found then return false; end if;
  if not public.can_moderate_mission_chat(message_mission_id) then
    raise exception using errcode = 'P0001', message = 'chat_moderation_denied';
  end if;

  delete from public.mission_chat_messages where id = p_message_id;
  return found;
end;
$$;

revoke all on function public.can_read_mission_chat(uuid) from public;
revoke all on function public.can_send_mission_chat(uuid) from public;
revoke all on function public.can_moderate_mission_chat(uuid) from public;
revoke all on function public.get_mission_chat_context(uuid) from public;
revoke all on function public.get_mission_chat_messages(uuid, integer) from public;
revoke all on function public.send_mission_chat_message(uuid, text) from public;
revoke all on function public.report_mission_chat_message(uuid, text) from public;
revoke all on function public.moderate_mission_chat_message(uuid) from public;

grant execute on function public.get_mission_chat_context(uuid) to authenticated;
grant execute on function public.get_mission_chat_messages(uuid, integer) to authenticated;
grant execute on function public.send_mission_chat_message(uuid, text) to authenticated;
grant execute on function public.report_mission_chat_message(uuid, text) to authenticated;
grant execute on function public.moderate_mission_chat_message(uuid) to authenticated;
grant execute on function public.can_read_mission_chat(uuid) to authenticated;
grant execute on function public.can_send_mission_chat(uuid) to authenticated;
grant execute on function public.can_moderate_mission_chat(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mission_chat_messages'
  ) then
    alter publication supabase_realtime add table public.mission_chat_messages;
  end if;
end;
$$;

commit;
