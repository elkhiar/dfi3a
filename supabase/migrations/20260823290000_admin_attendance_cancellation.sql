-- Administrator reviews, volunteer cancellation, and NGO attendance finalization.

begin;

create or replace function public.review_ngo_application(
  p_ngo_id uuid,
  p_approved boolean,
  p_reason text default null
)
returns public.ngo_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.ngo_status;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'admin_required';
  end if;

  next_status := case when p_approved then 'approved'::public.ngo_status
    else 'rejected'::public.ngo_status end;

  update public.ngos set
    status = next_status,
    approved_at = case when p_approved then now() else null end,
    approved_by = case when p_approved then auth.uid() else null end
  where id = p_ngo_id and status in ('pending', 'rejected');

  if not found then
    raise exception using errcode = 'P0001', message = 'ngo_application_not_reviewable';
  end if;

  update public.ngo_applications set
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejection_reason = case when p_approved then null else nullif(trim(p_reason), '') end
  where ngo_id = p_ngo_id;

  return next_status;
end;
$$;

create or replace function public.review_mission_urgency(
  p_mission_id uuid,
  p_approved boolean,
  p_reason text default null
)
returns public.urgency_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.urgency_status;
  configured_bonus integer;
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'admin_required';
  end if;

  select urgent_bonus into configured_bonus
  from public.point_rules where point_rules.id = true;

  next_status := case when p_approved then 'approved'::public.urgency_status
    else 'rejected'::public.urgency_status end;

  update public.missions set
    urgency_status = next_status,
    urgent_bonus = case when p_approved then configured_bonus else 0 end,
    urgency_review_reason = nullif(trim(p_reason), ''),
    urgency_reviewed_at = now(),
    urgency_reviewed_by = auth.uid()
  where id = p_mission_id and urgency_status = 'pending';

  if not found then
    raise exception using errcode = 'P0001', message = 'urgency_request_not_reviewable';
  end if;

  return next_status;
end;
$$;

create or replace function public.cancel_registration(
  p_mission_id uuid,
  p_reason text default null
)
returns table (
  was_late boolean,
  points_deducted integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration public.registrations%rowtype;
  mission public.missions%rowtype;
  penalty integer;
  late boolean;
begin
  select * into registration
  from public.registrations
  where mission_id = p_mission_id
    and volunteer_user_id = auth.uid()
    and status = 'joined'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'active_registration_not_found';
  end if;

  select * into mission from public.missions where id = p_mission_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'mission_not_found';
  end if;
  if mission.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'mission_already_started';
  end if;

  late := now() > mission.registration_deadline;
  select late_cancellation_penalty into penalty
  from public.point_rules where point_rules.id = true;

  update public.registrations set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = nullif(trim(p_reason), ''),
    is_late_cancellation = late
  where id = registration.id;

  if late then
    insert into public.point_transactions (
      volunteer_user_id, registration_id, amount, reason, description
    ) values (
      auth.uid(), registration.id, -penalty, 'late_cancellation',
      'Annulation après la date limite'
    ) on conflict (registration_id, reason) do nothing;
  end if;

  return query select late, case when late then penalty else 0 end;
end;
$$;

create or replace function public.get_mission_attendance(p_mission_id uuid)
returns table (
  registration_id uuid,
  volunteer_user_id uuid,
  display_name text,
  attendance_status public.attendance_status,
  finalized boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mission public.missions%rowtype;
begin
  select * into mission from public.missions where id = p_mission_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'mission_not_found';
  end if;

  if not public.owns_ngo(mission.ngo_id) and not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'mission_owner_required';
  end if;

  if now() < mission.starts_at then
    raise exception using errcode = 'P0001', message = 'attendance_not_open';
  end if;

  return query
  select registration.id, registration.volunteer_user_id,
    concat_ws(' ', profile.first_name, profile.last_name),
    registration.attendance_status,
    registration.attendance_finalized_at is not null
  from public.registrations registration
  join public.profiles profile on profile.user_id = registration.volunteer_user_id
  where registration.mission_id = p_mission_id
    and registration.status = 'joined'
  order by profile.first_name, profile.last_name;
end;
$$;

create or replace function public.set_attendance_status(
  p_registration_id uuid,
  p_status public.attendance_status
)
returns public.attendance_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission public.missions%rowtype;
begin
  if p_status = 'not_verified' then
    raise exception using errcode = 'P0001', message = 'invalid_attendance_status';
  end if;

  select mission_row.* into mission
  from public.registrations registration
  join public.missions mission_row on mission_row.id = registration.mission_id
  where registration.id = p_registration_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'registration_not_found';
  end if;

  if not public.owns_ngo(mission.ngo_id) and not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'mission_owner_required';
  end if;
  if now() < mission.starts_at then
    raise exception using errcode = 'P0001', message = 'attendance_not_open';
  end if;

  update public.registrations set attendance_status = p_status
  where id = p_registration_id and attendance_finalized_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'attendance_already_finalized';
  end if;
  return p_status;
end;
$$;

create or replace function public.finalize_mission_attendance(p_mission_id uuid)
returns table (
  present_count integer,
  absent_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission public.missions%rowtype;
  no_show_amount integer;
  saved_present_count integer;
  saved_absent_count integer;
begin
  select * into mission from public.missions where id = p_mission_id for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'mission_not_found';
  end if;

  if not public.owns_ngo(mission.ngo_id) and not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'mission_owner_required';
  end if;
  if now() < mission.ends_at then
    raise exception using errcode = 'P0001', message = 'mission_not_ended';
  end if;
  if exists (
    select 1 from public.registrations
    where mission_id = p_mission_id and status = 'joined'
      and attendance_status = 'not_verified'
  ) then
    raise exception using errcode = 'P0001', message = 'attendance_incomplete';
  end if;

  select no_show_penalty into no_show_amount
  from public.point_rules where point_rules.id = true;

  insert into public.point_transactions (
    volunteer_user_id, registration_id, amount, reason, description
  )
  select volunteer_user_id, id, points_quote, 'mission_attendance',
    'Présence validée pour la mission'
  from public.registrations
  where mission_id = p_mission_id and status = 'joined'
    and attendance_status = 'present'
  on conflict (registration_id, reason) do nothing;

  insert into public.point_transactions (
    volunteer_user_id, registration_id, amount, reason, description
  )
  select volunteer_user_id, id, -no_show_amount, 'no_show',
    'Absence à la mission'
  from public.registrations
  where mission_id = p_mission_id and status = 'joined'
    and attendance_status = 'absent'
  on conflict (registration_id, reason) do nothing;

  update public.registrations set
    attendance_finalized_at = now(),
    attendance_finalized_by = auth.uid()
  where mission_id = p_mission_id and status = 'joined'
    and attendance_finalized_at is null;

  select count(*) filter (where attendance_status = 'present')::integer,
    count(*) filter (where attendance_status = 'absent')::integer
  into saved_present_count, saved_absent_count
  from public.registrations
  where mission_id = p_mission_id and status = 'joined';

  update public.missions set status = 'completed'
  where id = p_mission_id;

  return query select saved_present_count, saved_absent_count;
end;
$$;

revoke all on function public.review_ngo_application(uuid, boolean, text) from public;
revoke all on function public.review_mission_urgency(uuid, boolean, text) from public;
revoke all on function public.cancel_registration(uuid, text) from public;
revoke all on function public.get_mission_attendance(uuid) from public;
revoke all on function public.set_attendance_status(uuid, public.attendance_status) from public;
revoke all on function public.finalize_mission_attendance(uuid) from public;

grant execute on function public.review_ngo_application(uuid, boolean, text) to authenticated;
grant execute on function public.review_mission_urgency(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_registration(uuid, text) to authenticated;
grant execute on function public.get_mission_attendance(uuid) to authenticated;
grant execute on function public.set_attendance_status(uuid, public.attendance_status) to authenticated;
grant execute on function public.finalize_mission_attendance(uuid) to authenticated;

commit;
