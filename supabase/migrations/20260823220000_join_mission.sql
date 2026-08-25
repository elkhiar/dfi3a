-- Protected volunteer registration workflow.
-- Capacity is checked while locking the mission row to prevent oversubscription.

begin;

create or replace function public.join_mission(
  p_mission_id uuid,
  p_accept_schedule_conflict boolean default false
)
returns table (
  registration_id uuid,
  points_quote integer,
  had_schedule_conflict boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_mission public.missions%rowtype;
  active_registration_count integer;
  existing_registration public.registrations%rowtype;
  schedule_conflict boolean;
  saved_registration_id uuid;
begin
  if current_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = current_user_id
      and account_type = 'volunteer'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'volunteer_account_required';
  end if;

  select mission.*
  into target_mission
  from public.missions as mission
  join public.ngos as ngo on ngo.id = mission.ngo_id
  where mission.id = p_mission_id
    and mission.status = 'published'
    and ngo.status = 'approved'
  for update of mission;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'mission_not_available';
  end if;

  if target_mission.registration_deadline <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'registration_closed';
  end if;

  if target_mission.starts_at <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'mission_already_started';
  end if;

  select registration.*
  into existing_registration
  from public.registrations as registration
  where registration.mission_id = p_mission_id
    and registration.volunteer_user_id = current_user_id;

  if found and existing_registration.status = 'joined' then
    raise exception using
      errcode = 'P0001',
      message = 'already_joined';
  end if;

  if target_mission.capacity is not null then
    select count(*)::integer
    into active_registration_count
    from public.registrations
    where mission_id = p_mission_id
      and status = 'joined';

    if active_registration_count >= target_mission.capacity then
      raise exception using
        errcode = 'P0001',
        message = 'mission_full';
    end if;
  end if;

  select exists (
    select 1
    from public.registrations as registration
    join public.missions as joined_mission
      on joined_mission.id = registration.mission_id
    where registration.volunteer_user_id = current_user_id
      and registration.status = 'joined'
      and joined_mission.id <> p_mission_id
      and joined_mission.status = 'published'
      and joined_mission.starts_at < target_mission.ends_at
      and joined_mission.ends_at > target_mission.starts_at
  ) into schedule_conflict;

  if schedule_conflict and not p_accept_schedule_conflict then
    raise exception using
      errcode = 'P0001',
      message = 'schedule_conflict';
  end if;

  insert into public.registrations (
    mission_id,
    volunteer_user_id,
    status,
    attendance_status,
    requirements_accepted_at,
    schedule_conflict_accepted_at,
    points_quote,
    joined_at,
    cancelled_at,
    cancellation_reason,
    is_late_cancellation,
    attendance_finalized_at,
    attendance_finalized_by
  ) values (
    p_mission_id,
    current_user_id,
    'joined',
    'not_verified',
    now(),
    case when schedule_conflict then now() else null end,
    target_mission.total_points,
    now(),
    null,
    null,
    false,
    null,
    null
  )
  on conflict (mission_id, volunteer_user_id)
  do update set
    status = 'joined',
    attendance_status = 'not_verified',
    requirements_accepted_at = excluded.requirements_accepted_at,
    schedule_conflict_accepted_at = excluded.schedule_conflict_accepted_at,
    points_quote = excluded.points_quote,
    joined_at = excluded.joined_at,
    cancelled_at = null,
    cancellation_reason = null,
    is_late_cancellation = false,
    attendance_finalized_at = null,
    attendance_finalized_by = null
  returning id into saved_registration_id;

  return query
  select saved_registration_id, target_mission.total_points, schedule_conflict;
end;
$$;

revoke all on function public.join_mission(uuid, boolean) from public;
grant execute on function public.join_mission(uuid, boolean) to authenticated;

comment on function public.join_mission(uuid, boolean) is
  'Joins a published mission as a volunteer, enforcing deadlines, capacity, overlap acknowledgement, and a locked points quote.';

commit;
