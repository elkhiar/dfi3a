-- Idempotent repair for projects where the NGO mission creation migration was not applied.

begin;

create table if not exists public.point_rules (
  id boolean primary key default true check (id),
  points_per_hour integer not null check (points_per_hour > 0),
  standard_multiplier numeric(4, 2) not null check (standard_multiplier >= 1),
  demanding_multiplier numeric(4, 2) not null check (demanding_multiplier >= 1),
  high_multiplier numeric(4, 2) not null check (high_multiplier >= 1),
  urgent_bonus integer not null check (urgent_bonus >= 0),
  late_cancellation_penalty integer not null check (late_cancellation_penalty > 0),
  no_show_penalty integer not null check (no_show_penalty > 0),
  updated_at timestamptz not null default now()
);

insert into public.point_rules (
  id, points_per_hour, standard_multiplier, demanding_multiplier,
  high_multiplier, urgent_bonus, late_cancellation_penalty, no_show_penalty
) values (true, 40, 1, 1.2, 1.5, 40, 10, 25)
on conflict (id) do nothing;

alter table public.point_rules enable row level security;
drop policy if exists "point_rules_are_public" on public.point_rules;
create policy "point_rules_are_public"
on public.point_rules for select to anon, authenticated using (true);
revoke all on table public.point_rules from anon, authenticated;
grant select on public.point_rules to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-images', 'mission-images', true, 8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ngo_accounts_upload_mission_images" on storage.objects;
create policy "ngo_accounts_upload_mission_images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.ngos
    where owner_user_id = auth.uid() and status = 'approved'
  )
);

drop policy if exists "ngo_accounts_manage_own_mission_images" on storage.objects;
create policy "ngo_accounts_manage_own_mission_images"
on storage.objects for update to authenticated
using (
  bucket_id = 'mission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'mission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.create_ngo_mission(
  p_slug text,
  p_category_slug text,
  p_title text,
  p_summary text,
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
  p_active_duration_minutes integer,
  p_registration_deadline timestamptz,
  p_capacity integer,
  p_difficulty public.mission_difficulty,
  p_difficulty_justification text,
  p_requirements text[],
  p_accessibility text,
  p_tag_slugs text[],
  p_request_urgent boolean,
  p_urgency_justification text,
  p_urgency_needed_by timestamptz
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
  current_ngo_id uuid;
  current_category_id uuid;
  saved_mission_id uuid;
  base_points integer;
  multiplier numeric(4, 2);
  rules public.point_rules%rowtype;
begin
  select ngo.id into current_ngo_id
  from public.ngos as ngo
  where ngo.owner_user_id = auth.uid() and ngo.status = 'approved';

  if current_ngo_id is null then
    raise exception using errcode = 'P0001', message = 'approved_ngo_required';
  end if;

  if p_ends_at <= p_starts_at
    or p_registration_deadline > p_starts_at
    or p_active_duration_minutes <= 0 then
    raise exception using errcode = 'P0001', message = 'invalid_mission_schedule';
  end if;

  if p_request_urgent and (
    nullif(trim(p_urgency_justification), '') is null
    or p_urgency_needed_by is null
  ) then
    raise exception using errcode = 'P0001', message = 'urgency_details_required';
  end if;

  select category.id into current_category_id
  from public.categories as category
  where category.slug = p_category_slug and category.is_active;

  if current_category_id is null then
    raise exception using errcode = 'P0001', message = 'invalid_category';
  end if;

  select point_rule.* into rules
  from public.point_rules as point_rule
  where point_rule.id = true;

  base_points := ceil(p_active_duration_minutes / 60.0)::integer * rules.points_per_hour;
  multiplier := case p_difficulty
    when 'demanding' then rules.demanding_multiplier
    when 'high' then rules.high_multiplier
    else rules.standard_multiplier
  end;

  insert into public.missions (
    ngo_id, category_id, slug, title, summary, description, cover_image_path,
    city, general_area, approximate_latitude, approximate_longitude,
    starts_at, ends_at, active_duration_minutes, registration_deadline,
    capacity, difficulty, difficulty_justification, requirements, accessibility,
    duration_points, difficulty_multiplier, urgent_bonus,
    urgency_status, urgency_justification, urgency_needed_by,
    status, published_at
  ) values (
    current_ngo_id, current_category_id, trim(p_slug), trim(p_title), trim(p_summary),
    trim(p_description), trim(p_cover_image_path), trim(p_city), trim(p_general_area),
    p_approximate_latitude, p_approximate_longitude, p_starts_at, p_ends_at,
    p_active_duration_minutes, p_registration_deadline, p_capacity, p_difficulty,
    nullif(trim(p_difficulty_justification), ''), coalesce(p_requirements, '{}'),
    nullif(trim(p_accessibility), ''), base_points, multiplier, 0,
    case when p_request_urgent then 'pending'::public.urgency_status
      else 'not_requested'::public.urgency_status end,
    case when p_request_urgent then trim(p_urgency_justification) else null end,
    case when p_request_urgent then p_urgency_needed_by else null end,
    'published', now()
  ) returning id into saved_mission_id;

  insert into public.mission_private_details (
    mission_id, exact_address, exact_latitude, exact_longitude,
    meeting_instructions, organizer_contact
  ) values (
    saved_mission_id, trim(p_exact_address), p_exact_latitude, p_exact_longitude,
    trim(p_meeting_instructions), trim(p_organizer_contact)
  );

  insert into public.mission_tags (mission_id, tag_id)
  select saved_mission_id, tag.id
  from public.tags as tag
  where tag.slug = any(coalesce(p_tag_slugs, '{}')) and tag.is_active
  on conflict do nothing;

  return query
  select saved_mission_id, trim(p_slug), round(base_points * multiplier)::integer;
end;
$$;

revoke all on function public.create_ngo_mission(
  text, text, text, text, text, text, text, text, numeric, numeric,
  text, numeric, numeric, text, text, timestamptz, timestamptz, integer,
  timestamptz, integer, public.mission_difficulty, text, text[], text,
  text[], boolean, text, timestamptz
) from public;

grant execute on function public.create_ngo_mission(
  text, text, text, text, text, text, text, text, numeric, numeric,
  text, numeric, numeric, text, text, timestamptz, timestamptz, integer,
  timestamptz, integer, public.mission_difficulty, text, text[], text,
  text[], boolean, text, timestamptz
) to authenticated;

notify pgrst, 'reload schema';

commit;
