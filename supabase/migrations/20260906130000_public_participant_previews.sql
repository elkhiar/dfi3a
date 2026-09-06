-- Replace decorative mission-card initials with privacy-aware participant previews.

begin;

create or replace function public.get_public_mission_participant_previews(p_mission_ids uuid[])
returns table (
  mission_id uuid,
  display_name text,
  avatar_path text
)
language sql
security definer
stable
set search_path = ''
as $$
  with ranked_participants as (
    select
      registration.mission_id,
      coalesce(
        nullif(trim(concat_ws(
          ' ',
          profile.first_name,
          case
            when nullif(trim(profile.last_name), '') is not null
              then left(trim(profile.last_name), 1) || '.'
            else null
          end
        )), ''),
        'Bénévole dfi3a'
      ) as display_name,
      profile.avatar_path,
      row_number() over (
        partition by registration.mission_id
        order by registration.joined_at, registration.id
      ) as preview_position
    from public.registrations registration
    join public.profiles profile
      on profile.user_id = registration.volunteer_user_id
    join public.missions mission
      on mission.id = registration.mission_id
    where registration.mission_id = any(coalesce(p_mission_ids, array[]::uuid[]))
      and registration.status = 'joined'
      and profile.account_type = 'volunteer'
      and profile.show_in_participants
      and mission.status = 'published'
  )
  select
    ranked_participants.mission_id,
    ranked_participants.display_name,
    ranked_participants.avatar_path
  from ranked_participants
  where ranked_participants.preview_position <= 3
  order by ranked_participants.mission_id, ranked_participants.preview_position;
$$;

revoke all on function public.get_public_mission_participant_previews(uuid[]) from public;
grant execute on function public.get_public_mission_participant_previews(uuid[]) to anon, authenticated;

comment on function public.get_public_mission_participant_previews(uuid[]) is
  'Returns at most three privacy-approved participant previews per published mission.';

commit;
