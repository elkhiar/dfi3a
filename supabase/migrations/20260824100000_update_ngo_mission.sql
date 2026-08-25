-- Owners can edit an upcoming published mission without gaining direct table update rights.

begin;

create or replace function public.update_ngo_mission(
  p_mission_id uuid,
  p_category_slug text,
  p_title text,
  p_description text,
  p_cover_image_path text,
  p_city text,
  p_general_area text,
  p_approximate_latitude numeric,
  p_approximate_longitude numeric,
  p_exact_address text,
  p_exact_latitude numeric,
  p_exact_longitude numeric,
  p_meeting_instructions text,
  p_organizer_contact text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_registration_deadline timestamptz,
  p_capacity integer,
  p_difficulty public.mission_difficulty,
  p_difficulty_justification text,
  p_requirements text[],
  p_accessibility text,
  p_tag_slugs text[]
)
returns table (
  mission_id uuid,
  mission_slug text,
  total_points integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_mission public.missions%rowtype;
  target_category_id uuid;
  active_registration_count integer;
  calculated_duration_minutes integer;
  base_points integer;
  multiplier numeric(4, 2);
  rules public.point_rules%rowtype;
begin
  select mission.* into target_mission
  from public.missions as mission
  where mission.id = p_mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'mission_not_found';
  end if;
  if not public.owns_ngo(target_mission.ngo_id) then
    raise exception using errcode = 'P0001', message = 'mission_owner_required';
  end if;
  if target_mission.status <> 'published' or target_mission.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'mission_not_editable';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null then
    raise exception using errcode = 'P0001', message = 'mission_content_required';
  end if;
  if p_ends_at <= p_starts_at or p_registration_deadline > p_starts_at then
    raise exception using errcode = 'P0001', message = 'invalid_mission_schedule';
  end if;
  if p_difficulty <> 'standard' and nullif(trim(p_difficulty_justification), '') is null then
    raise exception using errcode = 'P0001', message = 'difficulty_justification_required';
  end if;

  select count(*)::integer into active_registration_count
  from public.registrations as registration
  where registration.mission_id = p_mission_id and registration.status = 'joined';

  if p_capacity is not null and p_capacity < greatest(active_registration_count, 1) then
    raise exception using errcode = 'P0001', message = 'capacity_below_registrations';
  end if;

  select category.id into target_category_id
  from public.categories as category
  where category.slug = p_category_slug and category.is_active;

  if target_category_id is null then
    raise exception using errcode = 'P0001', message = 'invalid_category';
  end if;

  select point_rule.* into rules
  from public.point_rules as point_rule
  where point_rule.id = true;

  calculated_duration_minutes := round(extract(epoch from (p_ends_at - p_starts_at)) / 60)::integer;
  base_points := ceil(calculated_duration_minutes / 60.0)::integer * rules.points_per_hour;
  multiplier := case p_difficulty
    when 'demanding' then rules.demanding_multiplier
    when 'high' then rules.high_multiplier
    else rules.standard_multiplier
  end;

  update public.missions set
    category_id = target_category_id,
    title = trim(p_title),
    summary = left(trim(p_description), 180),
    description = trim(p_description),
    cover_image_path = coalesce(nullif(trim(p_cover_image_path), ''), cover_image_path),
    city = trim(p_city),
    general_area = trim(p_general_area),
    approximate_latitude = p_approximate_latitude,
    approximate_longitude = p_approximate_longitude,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    active_duration_minutes = calculated_duration_minutes,
    registration_deadline = p_registration_deadline,
    capacity = p_capacity,
    difficulty = p_difficulty,
    difficulty_justification = case when p_difficulty = 'standard' then null else trim(p_difficulty_justification) end,
    requirements = coalesce(p_requirements, '{}'),
    accessibility = nullif(trim(p_accessibility), '')
  where id = p_mission_id;

  update public.mission_private_details as details set
    exact_address = trim(p_exact_address),
    exact_latitude = p_exact_latitude,
    exact_longitude = p_exact_longitude,
    meeting_instructions = trim(p_meeting_instructions),
    organizer_contact = trim(p_organizer_contact)
  where details.mission_id = p_mission_id;

  delete from public.mission_tags as mission_tag
  where mission_tag.mission_id = p_mission_id;
  insert into public.mission_tags (mission_id, tag_id)
  select p_mission_id, tag.id
  from public.tags as tag
  where tag.slug = any(coalesce(p_tag_slugs, '{}')) and tag.is_active
  on conflict do nothing;

  update public.registrations as registration set
    points_quote = round(base_points * multiplier)::integer + target_mission.urgent_bonus
  where registration.mission_id = p_mission_id
    and registration.status = 'joined'
    and registration.attendance_finalized_at is null;

  return query
  select p_mission_id, target_mission.slug,
    round(base_points * multiplier)::integer + target_mission.urgent_bonus;
end;
$$;

revoke all on function public.update_ngo_mission(
  uuid, text, text, text, text, text, text, numeric, numeric,
  text, numeric, numeric, text, text, timestamptz, timestamptz,
  timestamptz, integer, public.mission_difficulty, text, text[], text, text[]
) from public;

grant execute on function public.update_ngo_mission(
  uuid, text, text, text, text, text, text, numeric, numeric,
  text, numeric, numeric, text, text, timestamptz, timestamptz,
  timestamptz, integer, public.mission_difficulty, text, text[], text, text[]
) to authenticated;

notify pgrst, 'reload schema';

commit;
