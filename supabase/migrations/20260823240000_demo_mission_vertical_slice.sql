-- First end-to-end mission used to validate public reading and volunteer registration.

begin;

-- Platform-imported NGOs can exist before an owner account is assigned.
alter table public.ngos alter column owner_user_id drop not null;

alter table public.missions add column if not exists slug text;
update public.missions set slug = id::text where slug is null;
alter table public.missions alter column slug set not null;
create unique index if not exists missions_slug_key on public.missions (slug);

insert into public.tags (slug, name_fr)
values ('welcome-guidance', 'Accueil et orientation')
on conflict (slug) do update set name_fr = excluded.name_fr;

insert into public.ngos (
  id,
  owner_user_id,
  name,
  description,
  main_city,
  status,
  approved_at
) values (
  '10000000-0000-4000-8000-000000000001',
  null,
  'Association Amal',
  'Association locale engagée dans les actions de santé et de solidarité à Casablanca.',
  'Casablanca',
  'approved',
  now()
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  main_city = excluded.main_city,
  status = excluded.status,
  approved_at = coalesce(public.ngos.approved_at, excluded.approved_at);

insert into public.missions (
  id,
  slug,
  ngo_id,
  category_id,
  title,
  summary,
  description,
  cover_image_path,
  city,
  general_area,
  approximate_latitude,
  approximate_longitude,
  starts_at,
  ends_at,
  active_duration_minutes,
  registration_deadline,
  capacity,
  difficulty,
  requirements,
  languages,
  accessibility,
  duration_points,
  difficulty_multiplier,
  urgent_bonus,
  urgency_status,
  urgency_justification,
  urgency_needed_by,
  status,
  published_at
) values (
  '20000000-0000-4000-8000-000000000001',
  'blood-donation-casablanca',
  '10000000-0000-4000-8000-000000000001',
  (select id from public.categories where slug = 'health'),
  'Don de sang à Casablanca',
  'Soutenez une collecte de sang organisée au centre-ville.',
  'Rejoignez notre équipe pour accueillir les donneurs, les orienter dans le centre et contribuer au bon déroulement de cette journée solidaire.',
  '/assets/missions/blood-donation.png',
  'Casablanca',
  'Mers Sultan',
  33.579900,
  -7.613300,
  '2026-09-12 09:00:00+01',
  '2026-09-12 13:00:00+01',
  240,
  '2026-09-10 18:00:00+01',
  30,
  'standard',
  array[
    'Être ponctuel et disponible pendant toute la mission',
    'Être à l’aise pour accueillir et orienter le public',
    'Aucune expérience médicale nécessaire'
  ],
  array['Français', 'Darija'],
  'Lieu accessible aux personnes à mobilité réduite.',
  160,
  1,
  40,
  'approved',
  'Renforcer rapidement l’équipe d’accueil pour fluidifier la collecte.',
  '2026-09-12 09:00:00+01',
  'published',
  now()
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  summary = excluded.summary,
  description = excluded.description,
  cover_image_path = excluded.cover_image_path,
  city = excluded.city,
  general_area = excluded.general_area,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  active_duration_minutes = excluded.active_duration_minutes,
  registration_deadline = excluded.registration_deadline,
  capacity = excluded.capacity,
  difficulty = excluded.difficulty,
  requirements = excluded.requirements,
  accessibility = excluded.accessibility,
  duration_points = excluded.duration_points,
  difficulty_multiplier = excluded.difficulty_multiplier,
  urgent_bonus = excluded.urgent_bonus,
  urgency_status = excluded.urgency_status,
  status = excluded.status;

insert into public.mission_private_details (
  mission_id,
  exact_address,
  exact_latitude,
  exact_longitude,
  meeting_instructions,
  organizer_contact
) values (
  '20000000-0000-4000-8000-000000000001',
  'Centre de transfusion, Mers Sultan, Casablanca',
  33.579900,
  -7.613300,
  'Présentez-vous à l’accueil 15 minutes avant le début.',
  'Contact communiqué aux bénévoles inscrits'
)
on conflict (mission_id) do update set
  exact_address = excluded.exact_address,
  exact_latitude = excluded.exact_latitude,
  exact_longitude = excluded.exact_longitude,
  meeting_instructions = excluded.meeting_instructions,
  organizer_contact = excluded.organizer_contact;

insert into public.mission_tags (mission_id, tag_id)
select
  '20000000-0000-4000-8000-000000000001'::uuid,
  id
from public.tags
where slug in ('blood-donation', 'welcome-guidance')
on conflict do nothing;

create or replace function public.get_public_mission(p_slug text)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  description text,
  cover_image_path text,
  city text,
  general_area text,
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
    mission.id,
    mission.slug,
    mission.title,
    mission.summary,
    mission.description,
    mission.cover_image_path,
    mission.city,
    mission.general_area,
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
    )
  from public.missions mission
  join public.ngos ngo on ngo.id = mission.ngo_id
  join public.categories category on category.id = mission.category_id
  where mission.slug = p_slug
    and mission.status = 'published'
    and ngo.status = 'approved'
  limit 1;
$$;

revoke all on function public.get_public_mission(text) from public;
grant execute on function public.get_public_mission(text) to anon, authenticated;

comment on function public.get_public_mission(text) is
  'Returns one published mission with safe public fields, tags, and an aggregate participant count.';

commit;
