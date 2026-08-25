-- dfi3a MVP foundation
-- This migration creates the first data model with secure-by-default RLS.
-- Mission creation and joining remain blocked until protected functions are added.

begin;

create extension if not exists pgcrypto;

create type public.account_type as enum ('volunteer', 'ngo', 'admin');
create type public.ngo_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.mission_status as enum ('draft', 'published', 'completed', 'cancelled');
create type public.mission_difficulty as enum ('standard', 'demanding', 'high');
create type public.urgency_status as enum (
  'not_requested',
  'pending',
  'approved',
  'rejected',
  'removed'
);
create type public.registration_status as enum ('joined', 'cancelled');
create type public.attendance_status as enum ('not_verified', 'present', 'absent');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type public.account_type not null default 'volunteer',
  first_name text,
  last_name text,
  birthdate date,
  city text,
  bio text check (char_length(bio) <= 300),
  avatar_path text,
  show_in_participants boolean not null default true,
  show_in_leaderboard boolean not null default true,
  show_city boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ngos (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.profiles(user_id) on delete restrict,
  name text not null,
  description text,
  main_city text not null,
  logo_path text,
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  status public.ngo_status not null default 'pending',
  approved_at timestamptz,
  approved_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ngo_applications (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null unique references public.ngos(id) on delete cascade,
  legal_name text not null,
  legal_address text not null,
  contact_full_name text not null,
  official_email text not null,
  phone text not null,
  registration_number text not null,
  registration_document_path text not null,
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ngo_categories (
  ngo_id uuid not null references public.ngos(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (ngo_id, category_id)
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  summary text not null check (char_length(summary) between 10 and 180),
  description text not null,
  cover_image_path text not null,
  city text not null,
  general_area text not null,
  approximate_latitude numeric(9, 6),
  approximate_longitude numeric(9, 6),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active_duration_minutes integer not null check (active_duration_minutes > 0),
  registration_deadline timestamptz not null,
  capacity integer check (capacity is null or capacity > 0),
  difficulty public.mission_difficulty not null default 'standard',
  difficulty_justification text,
  minimum_recommended_age integer check (
    minimum_recommended_age is null
    or minimum_recommended_age between 12 and 99
  ),
  requirements text[] not null default '{}',
  languages text[] not null default '{}',
  physical_requirements text,
  equipment text,
  accessibility text,
  additional_instructions text,
  duration_points integer not null default 0 check (duration_points >= 0),
  difficulty_multiplier numeric(4, 2) not null default 1 check (difficulty_multiplier >= 1),
  urgent_bonus integer not null default 0 check (urgent_bonus >= 0),
  total_points integer generated always as (
    round(duration_points * difficulty_multiplier)::integer + urgent_bonus
  ) stored,
  urgency_status public.urgency_status not null default 'not_requested',
  urgency_justification text,
  urgency_needed_by timestamptz,
  urgency_review_reason text,
  urgency_reviewed_at timestamptz,
  urgency_reviewed_by uuid references public.profiles(user_id) on delete set null,
  status public.mission_status not null default 'draft',
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_time_order check (ends_at > starts_at),
  constraint mission_deadline_order check (registration_deadline <= starts_at),
  constraint mission_latitude_range check (
    approximate_latitude is null
    or approximate_latitude between -90 and 90
  ),
  constraint mission_longitude_range check (
    approximate_longitude is null
    or approximate_longitude between -180 and 180
  ),
  constraint demanding_mission_has_justification check (
    difficulty = 'standard'
    or nullif(trim(difficulty_justification), '') is not null
  ),
  constraint urgent_request_has_details check (
    urgency_status = 'not_requested'
    or (
      nullif(trim(urgency_justification), '') is not null
      and urgency_needed_by is not null
    )
  )
);

-- Exact meeting details are intentionally isolated from publicly readable missions.
create table public.mission_private_details (
  mission_id uuid primary key references public.missions(id) on delete cascade,
  exact_address text not null,
  exact_latitude numeric(9, 6) not null check (exact_latitude between -90 and 90),
  exact_longitude numeric(9, 6) not null check (exact_longitude between -180 and 180),
  meeting_instructions text not null,
  organizer_contact text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission_tags (
  mission_id uuid not null references public.missions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  primary key (mission_id, tag_id)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete restrict,
  volunteer_user_id uuid not null references public.profiles(user_id) on delete restrict,
  status public.registration_status not null default 'joined',
  attendance_status public.attendance_status not null default 'not_verified',
  requirements_accepted_at timestamptz not null,
  schedule_conflict_accepted_at timestamptz,
  points_quote integer not null check (points_quote >= 0),
  joined_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  is_late_cancellation boolean not null default false,
  attendance_finalized_at timestamptz,
  attendance_finalized_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, volunteer_user_id),
  constraint registration_cancellation_details check (
    (status = 'joined' and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create index missions_public_discovery_idx
  on public.missions (status, city, starts_at)
  where status = 'published';
create index missions_category_idx on public.missions (category_id, starts_at);
create index missions_ngo_idx on public.missions (ngo_id, status, starts_at);
create index registrations_volunteer_idx
  on public.registrations (volunteer_user_id, status, joined_at desc);
create index registrations_mission_idx
  on public.registrations (mission_id, status, joined_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();
create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();
create trigger ngos_set_updated_at
before update on public.ngos
for each row execute function public.set_updated_at();
create trigger ngo_applications_set_updated_at
before update on public.ngo_applications
for each row execute function public.set_updated_at();
create trigger missions_set_updated_at
before update on public.missions
for each row execute function public.set_updated_at();
create trigger mission_private_details_set_updated_at
before update on public.mission_private_details
for each row execute function public.set_updated_at();
create trigger registrations_set_updated_at
before update on public.registrations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_account_type text;
begin
  requested_account_type := new.raw_user_meta_data ->> 'account_type';

  insert into public.profiles (
    user_id,
    account_type,
    first_name,
    last_name
  ) values (
    new.id,
    case
      when requested_account_type = 'ngo' then 'ngo'::public.account_type
      else 'volunteer'::public.account_type
    end,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and account_type = 'admin'
  );
$$;

create or replace function public.owns_ngo(target_ngo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ngos
    where id = target_ngo_id
      and owner_user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.ngos enable row level security;
alter table public.ngo_applications enable row level security;
alter table public.ngo_categories enable row level security;
alter table public.missions enable row level security;
alter table public.mission_private_details enable row level security;
alter table public.mission_tags enable row level security;
alter table public.registrations enable row level security;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "active_categories_are_public"
on public.categories for select to anon, authenticated
using (is_active or public.is_admin());

create policy "active_tags_are_public"
on public.tags for select to anon, authenticated
using (is_active or public.is_admin());

create policy "approved_ngos_are_public"
on public.ngos for select to anon, authenticated
using (status = 'approved' or owner_user_id = auth.uid() or public.is_admin());

create policy "owners_read_ngo_application"
on public.ngo_applications for select to authenticated
using (public.owns_ngo(ngo_id) or public.is_admin());

create policy "published_missions_are_public"
on public.missions for select to anon, authenticated
using (
  status in ('published', 'completed')
  or public.owns_ngo(ngo_id)
  or public.is_admin()
);

create policy "public_mission_tags_are_readable"
on public.mission_tags for select to anon, authenticated
using (
  exists (
    select 1
    from public.missions
    where missions.id = mission_tags.mission_id
      and (
        missions.status in ('published', 'completed')
        or public.owns_ngo(missions.ngo_id)
        or public.is_admin()
      )
  )
);

create policy "volunteers_read_own_registrations"
on public.registrations for select to authenticated
using (
  volunteer_user_id = auth.uid()
  or exists (
    select 1
    from public.missions
    where missions.id = registrations.mission_id
      and public.owns_ngo(missions.ngo_id)
  )
  or public.is_admin()
);

create policy "private_details_for_owners_and_participants"
on public.mission_private_details for select to authenticated
using (
  exists (
    select 1
    from public.missions
    where missions.id = mission_private_details.mission_id
      and public.owns_ngo(missions.ngo_id)
  )
  or exists (
    select 1
    from public.registrations
    where registrations.mission_id = mission_private_details.mission_id
      and registrations.volunteer_user_id = auth.uid()
      and registrations.status = 'joined'
  )
  or public.is_admin()
);

-- Explicit grants complement RLS. Mutating protected workflow tables is added later.
revoke all on table public.profiles, public.categories, public.tags, public.ngos,
  public.ngo_applications, public.ngo_categories, public.missions,
  public.mission_private_details, public.mission_tags, public.registrations
  from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.tags, public.ngos, public.missions, public.mission_tags
  to anon, authenticated;
grant select on public.profiles, public.ngo_applications, public.registrations,
  public.mission_private_details to authenticated;
grant update (
  first_name,
  last_name,
  birthdate,
  city,
  bio,
  avatar_path,
  show_in_participants,
  show_in_leaderboard,
  show_city
) on public.profiles to authenticated;

revoke execute on function public.is_admin() from public;
revoke execute on function public.owns_ngo(uuid) from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.owns_ngo(uuid) to anon, authenticated;

insert into public.categories (slug, name_fr, display_order) values
  ('environment', 'Environnement', 10),
  ('health', 'Santé', 20),
  ('social-support', 'Aide sociale', 30),
  ('education', 'Éducation', 40),
  ('culture-heritage', 'Culture et patrimoine', 50),
  ('animal-welfare', 'Protection animale', 60),
  ('sports', 'Sport', 70),
  ('emergency-humanitarian', 'Urgence et aide humanitaire', 80),
  ('community-development', 'Développement communautaire', 90),
  ('other', 'Autre', 100);

insert into public.tags (slug, name_fr) values
  ('children', 'Enfants'),
  ('seniors', 'Seniors'),
  ('beach-cleanup', 'Nettoyage de plage'),
  ('blood-donation', 'Don de sang'),
  ('food-distribution', 'Distribution alimentaire'),
  ('disability-support', 'Soutien au handicap'),
  ('tree-planting', 'Plantation d’arbres'),
  ('public-awareness', 'Sensibilisation');

commit;
