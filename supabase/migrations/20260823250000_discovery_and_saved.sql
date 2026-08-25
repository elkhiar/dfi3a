-- Public mission discovery plus persistent volunteer favorites.

begin;

insert into public.tags (slug, name_fr) values
  ('solidarity', 'Solidarité'),
  ('welcome', 'Accueil'),
  ('workshop', 'Animation'),
  ('families', 'Familles'),
  ('prevention', 'Prévention')
on conflict (slug) do update set name_fr = excluded.name_fr;

insert into public.ngos (id, owner_user_id, name, description, main_city, status, approved_at)
values
  (
    '10000000-0000-4000-8000-000000000002', null, 'Cœur Solidaire',
    'Collectif local mobilisé autour de la santé et de l’entraide.',
    'Casablanca', 'approved', now()
  ),
  (
    '10000000-0000-4000-8000-000000000003', null, 'Association Bahri',
    'Association engagée pour la protection du littoral marocain.',
    'Casablanca', 'approved', now()
  ),
  (
    '10000000-0000-4000-8000-000000000004', null, 'Fils de Casablanca',
    'Collectif citoyen dédié aux actions environnementales de proximité.',
    'Casablanca', 'approved', now()
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  main_city = excluded.main_city,
  status = excluded.status,
  approved_at = coalesce(public.ngos.approved_at, excluded.approved_at);

insert into public.missions (
  id, slug, ngo_id, category_id, title, summary, description, cover_image_path,
  city, general_area, approximate_latitude, approximate_longitude,
  starts_at, ends_at, active_duration_minutes, registration_deadline,
  capacity, difficulty, difficulty_justification, requirements, accessibility,
  duration_points, difficulty_multiplier, urgent_bonus,
  urgency_status, urgency_justification, urgency_needed_by, status, published_at
) values
  (
    '20000000-0000-4000-8000-000000000002', 'blood-drive-anfa',
    '10000000-0000-4000-8000-000000000002',
    (select id from public.categories where slug = 'health'),
    'Collecte solidaire à Anfa',
    'Accompagnez les donneurs pendant une collecte locale.',
    'Aidez notre équipe à accueillir les participants et à fluidifier leur parcours pendant la collecte.',
    '/assets/missions/blood-donation.png', 'Casablanca', 'Anfa', 33.588600, -7.664000,
    '2026-09-18 10:00:00+01', '2026-09-18 14:00:00+01', 240,
    '2026-09-16 20:00:00+01', 24, 'standard', null,
    array['Bon relationnel', 'Ponctualité'],
    'Lieu accessible aux personnes à mobilité réduite.',
    160, 1, 20, 'approved',
    'Renforcer l’accueil des donneurs pour la collecte.',
    '2026-09-18 10:00:00+01', 'published', now()
  ),
  (
    '20000000-0000-4000-8000-000000000003', 'clean-walk-ain-diab',
    '10000000-0000-4000-8000-000000000003',
    (select id from public.categories where slug = 'environment'),
    'Clean Walk Ain Diab',
    'Nettoyage collectif du littoral d’Ain Diab.',
    'Participez à une matinée de nettoyage du littoral avec une équipe de bénévoles engagés.',
    '/assets/missions/beach-cleanup.png', 'Casablanca', 'Aïn Diab', 33.594900, -7.690100,
    '2026-09-23 09:00:00+01', '2026-09-23 12:00:00+01', 180,
    '2026-09-21 18:00:00+01', null, 'standard', null,
    array['Prévoir une tenue confortable', 'Apporter une gourde'],
    'Parcours sur sable, accessibilité limitée.',
    100, 1, 0, 'not_requested', null, null, 'published', now()
  ),
  (
    '20000000-0000-4000-8000-000000000004', 'afforestation-casa',
    '10000000-0000-4000-8000-000000000004',
    (select id from public.categories where slug = 'environment'),
    'Afforestation Casa',
    'Participez à la plantation de jeunes arbres.',
    'Aidez à planter de jeunes arbres et à préparer les sols avec les habitants du quartier.',
    '/assets/missions/tree-planting.png', 'Casablanca', 'Sidi Bernoussi', 33.619400, -7.501700,
    '2026-09-25 10:00:00+01', '2026-09-25 14:00:00+01', 240,
    '2026-09-23 18:00:00+01', 20, 'demanding',
    'Travail physique modéré sur terrain irrégulier.',
    array['Bonne condition physique', 'Chaussures fermées'],
    'Terrain irrégulier et non adapté aux fauteuils roulants.',
    100, 1.2, 0, 'not_requested', null, null, 'published', now()
  ),
  (
    '20000000-0000-4000-8000-000000000005', 'animation-atelier-centre',
    '10000000-0000-4000-8000-000000000002',
    (select id from public.categories where slug = 'health'),
    'Animation Atelier Centre',
    'Aidez à accueillir et orienter les visiteurs.',
    'Animez un espace d’information et accompagnez les visiteurs pendant la journée.',
    '/assets/missions/blood-donation.png', 'Casablanca', 'Aïn Diab', 33.597500, -7.676700,
    '2026-09-27 15:00:00+01', '2026-09-27 19:00:00+01', 240,
    '2026-09-25 18:00:00+01', 18, 'standard', null,
    array['Aisance à l’oral', 'Esprit d’équipe'],
    'Lieu accessible aux personnes à mobilité réduite.',
    130, 1, 0, 'not_requested', null, null, 'published', now()
  ),
  (
    '20000000-0000-4000-8000-000000000006', 'sensibilisation-sante',
    '10000000-0000-4000-8000-000000000001',
    (select id from public.categories where slug = 'health'),
    'Sensibilisation Santé',
    'Informez les familles sur les gestes de prévention.',
    'Participez à une action de proximité consacrée aux gestes simples de prévention.',
    '/assets/missions/blood-donation.png', 'Casablanca', 'Bourgogne', 33.597100, -7.646200,
    '2026-10-02 10:00:00+01', '2026-10-02 13:00:00+01', 180,
    '2026-09-30 18:00:00+01', 25, 'standard', null,
    array['Écoute et bienveillance', 'Français ou darija'],
    'Lieu accessible aux personnes à mobilité réduite.',
    120, 1, 0, 'not_requested', null, null, 'published', now()
  )
on conflict (id) do update set
  slug = excluded.slug,
  ngo_id = excluded.ngo_id,
  category_id = excluded.category_id,
  title = excluded.title,
  summary = excluded.summary,
  description = excluded.description,
  cover_image_path = excluded.cover_image_path,
  city = excluded.city,
  general_area = excluded.general_area,
  approximate_latitude = excluded.approximate_latitude,
  approximate_longitude = excluded.approximate_longitude,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  active_duration_minutes = excluded.active_duration_minutes,
  registration_deadline = excluded.registration_deadline,
  capacity = excluded.capacity,
  difficulty = excluded.difficulty,
  difficulty_justification = excluded.difficulty_justification,
  requirements = excluded.requirements,
  accessibility = excluded.accessibility,
  duration_points = excluded.duration_points,
  difficulty_multiplier = excluded.difficulty_multiplier,
  urgent_bonus = excluded.urgent_bonus,
  urgency_status = excluded.urgency_status,
  urgency_justification = excluded.urgency_justification,
  urgency_needed_by = excluded.urgency_needed_by,
  status = excluded.status;

insert into public.mission_private_details (
  mission_id, exact_address, exact_latitude, exact_longitude,
  meeting_instructions, organizer_contact
) values
  ('20000000-0000-4000-8000-000000000002', 'Point de collecte Anfa, Casablanca', 33.588600, -7.664000, 'Présentez-vous 15 minutes avant le début.', 'Contact communiqué après inscription'),
  ('20000000-0000-4000-8000-000000000003', 'Point de rencontre plage Aïn Diab, Casablanca', 33.594900, -7.690100, 'Rendez-vous près du poste de secours.', 'Contact communiqué après inscription'),
  ('20000000-0000-4000-8000-000000000004', 'Terrain associatif Sidi Bernoussi, Casablanca', 33.619400, -7.501700, 'Portez des chaussures fermées et arrivez 15 minutes avant.', 'Contact communiqué après inscription'),
  ('20000000-0000-4000-8000-000000000005', 'Espace associatif Aïn Diab, Casablanca', 33.597500, -7.676700, 'Présentez-vous à l’accueil.', 'Contact communiqué après inscription'),
  ('20000000-0000-4000-8000-000000000006', 'Centre de quartier Bourgogne, Casablanca', 33.597100, -7.646200, 'Demandez l’équipe Association Amal à l’accueil.', 'Contact communiqué après inscription')
on conflict (mission_id) do update set
  exact_address = excluded.exact_address,
  exact_latitude = excluded.exact_latitude,
  exact_longitude = excluded.exact_longitude,
  meeting_instructions = excluded.meeting_instructions,
  organizer_contact = excluded.organizer_contact;

insert into public.mission_tags (mission_id, tag_id)
select mapping.mission_id, tag.id
from (values
  ('20000000-0000-4000-8000-000000000002'::uuid, 'blood-donation'),
  ('20000000-0000-4000-8000-000000000002'::uuid, 'solidarity'),
  ('20000000-0000-4000-8000-000000000003'::uuid, 'beach-cleanup'),
  ('20000000-0000-4000-8000-000000000004'::uuid, 'tree-planting'),
  ('20000000-0000-4000-8000-000000000005'::uuid, 'welcome'),
  ('20000000-0000-4000-8000-000000000005'::uuid, 'workshop'),
  ('20000000-0000-4000-8000-000000000006'::uuid, 'prevention'),
  ('20000000-0000-4000-8000-000000000006'::uuid, 'families')
) as mapping(mission_id, tag_slug)
join public.tags tag on tag.slug = mapping.tag_slug
on conflict do nothing;

create table public.saved_missions (
  volunteer_user_id uuid not null references public.profiles(user_id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (volunteer_user_id, mission_id)
);

alter table public.saved_missions enable row level security;

create policy "volunteers_read_own_saved_missions"
on public.saved_missions for select to authenticated
using (volunteer_user_id = auth.uid());

revoke all on table public.saved_missions from anon, authenticated;
grant select on public.saved_missions to authenticated;

create or replace function public.set_mission_saved(p_mission_id uuid, p_saved boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = auth.uid() and account_type = 'volunteer'
  ) then
    raise exception using errcode = 'P0001', message = 'volunteer_account_required';
  end if;

  if not exists (
    select 1
    from public.missions mission
    join public.ngos ngo on ngo.id = mission.ngo_id
    where mission.id = p_mission_id
      and mission.status = 'published'
      and ngo.status = 'approved'
  ) then
    raise exception using errcode = 'P0001', message = 'mission_not_available';
  end if;

  if p_saved then
    insert into public.saved_missions (volunteer_user_id, mission_id)
    values (auth.uid(), p_mission_id)
    on conflict do nothing;
  else
    delete from public.saved_missions
    where volunteer_user_id = auth.uid() and mission_id = p_mission_id;
  end if;

  return p_saved;
end;
$$;

revoke all on function public.set_mission_saved(uuid, boolean) from public;
grant execute on function public.set_mission_saved(uuid, boolean) to authenticated;

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
      from public.mission_tags mission_tag
      join public.tags tag on tag.id = mission_tag.tag_id
      where mission_tag.mission_id = mission.id
    ), array[]::text[]),
    (
      select count(*)::integer
      from public.registrations registration
      where registration.mission_id = mission.id and registration.status = 'joined'
    )
  from public.missions mission
  join public.ngos ngo on ngo.id = mission.ngo_id
  join public.categories category on category.id = mission.category_id
  where mission.status = 'published' and ngo.status = 'approved'
  order by mission.starts_at;
$$;

revoke all on function public.get_public_missions() from public;
grant execute on function public.get_public_missions() to anon, authenticated;

commit;
