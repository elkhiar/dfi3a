-- Rich public NGO profiles. Only approved organisations and public missions are exposed.

begin;

create or replace function public.get_public_ngo_profile(p_ngo_id uuid)
returns table (
  ngo_id uuid,
  name text,
  description text,
  main_city text,
  logo_path text,
  website_url text,
  social_links jsonb,
  member_since timestamptz,
  categories text[],
  mission_count integer,
  completed_mission_count integer,
  volunteer_participation_count integer
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    ngo.id,
    ngo.name,
    coalesce(ngo.description, ''),
    ngo.main_city,
    ngo.logo_path,
    ngo.website_url,
    coalesce(ngo.social_links, '{}'::jsonb),
    coalesce(ngo.approved_at, ngo.created_at),
    coalesce((
      select array_agg(category_name order by category_name)
      from (
        select distinct category.name_fr as category_name
        from public.missions mission
        join public.categories category on category.id = mission.category_id
        where mission.ngo_id = ngo.id
          and mission.status in ('published', 'completed')
        union
        select distinct category.name_fr as category_name
        from public.ngo_categories ngo_category
        join public.categories category on category.id = ngo_category.category_id
        where ngo_category.ngo_id = ngo.id
      ) public_categories
    ), array[]::text[]),
    (
      select count(*)::integer
      from public.missions mission
      where mission.ngo_id = ngo.id
        and mission.status in ('published', 'completed')
    ),
    (
      select count(*)::integer
      from public.missions mission
      where mission.ngo_id = ngo.id
        and mission.status = 'completed'
    ),
    (
      select count(*)::integer
      from public.registrations registration
      join public.missions mission on mission.id = registration.mission_id
      where mission.ngo_id = ngo.id
        and mission.status in ('published', 'completed')
        and registration.status = 'joined'
    )
  from public.ngos ngo
  where ngo.id = p_ngo_id
    and ngo.status = 'approved';
$$;

create or replace function public.get_public_ngo_missions(p_ngo_id uuid)
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
  registration_count integer,
  mission_status public.mission_status
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    mission.id,
    mission.slug,
    mission.title,
    mission.summary,
    mission.description,
    mission.cover_image_path,
    mission.city,
    mission.general_area,
    mission.approximate_latitude,
    mission.approximate_longitude,
    mission.starts_at,
    mission.ends_at,
    mission.active_duration_minutes,
    mission.registration_deadline,
    mission.capacity,
    mission.difficulty,
    mission.total_points,
    mission.urgency_status = 'approved',
    mission.requirements,
    mission.accessibility,
    ngo.name,
    category.name_fr,
    coalesce((
      select array_agg(tag.name_fr order by tag.name_fr)
      from public.mission_tags mission_tag
      join public.tags tag on tag.id = mission_tag.tag_id
      where mission_tag.mission_id = mission.id
    ), array[]::text[]),
    (
      select count(*)::integer
      from public.registrations registration
      where registration.mission_id = mission.id
        and registration.status = 'joined'
    ),
    mission.status
  from public.missions mission
  join public.ngos ngo on ngo.id = mission.ngo_id
  join public.categories category on category.id = mission.category_id
  where mission.ngo_id = p_ngo_id
    and ngo.status = 'approved'
    and mission.status in ('published', 'completed')
  order by
    case when mission.ends_at > now() then 0 else 1 end,
    case when mission.ends_at > now() then mission.starts_at end asc,
    mission.starts_at desc;
$$;

revoke all on function public.get_public_ngo_profile(uuid) from public;
revoke all on function public.get_public_ngo_missions(uuid) from public;
grant execute on function public.get_public_ngo_profile(uuid) to anon, authenticated;
grant execute on function public.get_public_ngo_missions(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
