-- Enforce mission integrity in PostgreSQL instead of trusting browser-calculated values.

begin;

drop policy if exists "ngo_accounts_delete_own_documents" on storage.objects;
create policy "ngo_accounts_delete_own_documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ngo-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ngo_accounts_delete_own_mission_images" on storage.objects;
create policy "ngo_accounts_delete_own_mission_images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'mission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.normalize_mission_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules public.point_rules%rowtype;
  calculated_minutes integer;
begin
  if new.ends_at <= new.starts_at then
    raise exception using errcode = 'P0001', message = 'invalid_mission_schedule';
  end if;

  if (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
      or new.registration_deadline is distinct from old.registration_deadline)
    and new.registration_deadline >= new.starts_at then
    raise exception using errcode = 'P0001', message = 'registration_deadline_must_precede_start';
  end if;

  if new.status = 'published'
    and (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at)
    and new.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'mission_start_must_be_in_future';
  end if;

  if tg_op = 'UPDATE'
    and new.urgency_status = 'approved'
    and new.urgency_status is distinct from old.urgency_status
    and new.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'urgency_mission_already_started';
  end if;

  select point_rule.* into rules
  from public.point_rules as point_rule
  where point_rule.id = true;

  if not found then
    raise exception using errcode = 'P0001', message = 'point_rules_missing';
  end if;

  calculated_minutes := round(extract(epoch from (new.ends_at - new.starts_at)) / 60)::integer;
  new.active_duration_minutes := calculated_minutes;
  new.duration_points := ceil(calculated_minutes / 60.0)::integer * rules.points_per_hour;
  new.difficulty_multiplier := case new.difficulty
    when 'demanding' then rules.demanding_multiplier
    when 'high' then rules.high_multiplier
    else rules.standard_multiplier
  end;
  new.urgent_bonus := case
    when new.urgency_status = 'approved' then rules.urgent_bonus
    else 0
  end;

  return new;
end;
$$;

drop trigger if exists normalize_mission_integrity on public.missions;
create trigger normalize_mission_integrity
before insert or update on public.missions
for each row execute function public.normalize_mission_integrity();

revoke all on function public.normalize_mission_integrity() from public;

-- Recalculate existing rows with the same trusted formula.
update public.missions set updated_at = updated_at;

-- The public pin is generated from the private exact point by the database.
create or replace function public.refresh_approximate_mission_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  distance_meters numeric := 60 + random() * 40;
  angle_radians numeric := random() * 2 * pi();
  latitude_offset numeric;
  longitude_offset numeric;
begin
  if new.exact_latitude is null or new.exact_longitude is null then
    return new;
  end if;

  latitude_offset := distance_meters * cos(angle_radians) / 111320;
  longitude_offset := distance_meters * sin(angle_radians)
    / (111320 * greatest(abs(cos(radians(new.exact_latitude))), 0.01));

  update public.missions as mission set
    approximate_latitude = new.exact_latitude + latitude_offset,
    approximate_longitude = new.exact_longitude + longitude_offset
  where mission.id = new.mission_id;

  return new;
end;
$$;

drop trigger if exists refresh_approximate_mission_location on public.mission_private_details;
create trigger refresh_approximate_mission_location
after insert or update of exact_latitude, exact_longitude on public.mission_private_details
for each row execute function public.refresh_approximate_mission_location();

revoke all on function public.refresh_approximate_mission_location() from public;

-- Replace any browser-supplied public point for existing missions as well.
update public.mission_private_details
set exact_latitude = exact_latitude,
    exact_longitude = exact_longitude
where exact_latitude is not null and exact_longitude is not null;

-- Once an NGO has been approved or suspended, its reviewed legal file cannot be
-- replaced through the public submission RPC. Administrators retain review access.
create or replace function public.lock_reviewed_ngo_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.ngo_status;
begin
  select ngo.status into current_status
  from public.ngos as ngo
  where ngo.id = new.ngo_id;

  if current_status in ('approved', 'suspended') and not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'ngo_application_locked';
  end if;

  return new;
end;
$$;

drop trigger if exists lock_reviewed_ngo_application on public.ngo_applications;
create trigger lock_reviewed_ngo_application
before update on public.ngo_applications
for each row execute function public.lock_reviewed_ngo_application();

revoke all on function public.lock_reviewed_ngo_application() from public;

create or replace function public.get_public_missions()
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  description text,
  cover_image_path text,
  city text,
  general_area text,
  approximate_latitude numeric,
  approximate_longitude numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  active_duration_minutes integer,
  registration_deadline timestamptz,
  capacity integer,
  difficulty public.mission_difficulty,
  total_points integer,
  is_urgent boolean,
  requirements text[],
  accessibility text,
  ngo_name text,
  category_name text,
  tags text[],
  registration_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mission.id, mission.slug, mission.title, mission.summary, mission.description,
    mission.cover_image_path, mission.city, mission.general_area,
    mission.approximate_latitude, mission.approximate_longitude,
    mission.starts_at, mission.ends_at, mission.active_duration_minutes,
    mission.registration_deadline, mission.capacity, mission.difficulty,
    mission.total_points, mission.urgency_status = 'approved', mission.requirements,
    mission.accessibility, ngo.name, category.name_fr,
    coalesce((
      select array_agg(tag.name_fr order by tag.name_fr)
      from public.mission_tags as mission_tag
      join public.tags as tag on tag.id = mission_tag.tag_id
      where mission_tag.mission_id = mission.id
    ), array[]::text[]),
    (
      select count(*)::integer
      from public.registrations as registration
      where registration.mission_id = mission.id and registration.status = 'joined'
    )
  from public.missions as mission
  join public.ngos as ngo on ngo.id = mission.ngo_id
  join public.categories as category on category.id = mission.category_id
  where mission.status = 'published'
    and mission.ends_at > now()
    and ngo.status = 'approved'
  order by mission.starts_at;
$$;

revoke all on function public.get_public_missions() from public;
grant execute on function public.get_public_missions() to anon, authenticated;

notify pgrst, 'reload schema';

commit;
