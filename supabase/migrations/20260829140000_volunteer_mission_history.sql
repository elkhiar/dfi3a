-- Private volunteer history for completed and cancelled mission registrations.

begin;

create or replace function public.get_my_mission_history()
returns table (
  registration_id uuid,
  mission_slug text,
  mission_title text,
  category_name text,
  city text,
  general_area text,
  starts_at timestamptz,
  ends_at timestamptz,
  cover_image_path text,
  ngo_name text,
  mission_status public.mission_status,
  registration_status public.registration_status,
  attendance_status public.attendance_status,
  points_applied bigint,
  cancellation_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  return query
  select
    registration.id,
    mission.slug,
    mission.title,
    category.name_fr,
    mission.city,
    mission.general_area,
    mission.starts_at,
    mission.ends_at,
    mission.cover_image_path,
    ngo.name,
    mission.status,
    registration.status,
    registration.attendance_status,
    coalesce(sum(transaction.amount), 0)::bigint,
    case
      when mission.status = 'cancelled' then mission.cancellation_reason
      when registration.status = 'cancelled' then registration.cancellation_reason
      else null
    end
  from public.registrations registration
  join public.missions mission on mission.id = registration.mission_id
  join public.categories category on category.id = mission.category_id
  join public.ngos ngo on ngo.id = mission.ngo_id
  left join public.point_transactions transaction
    on transaction.registration_id = registration.id
  where registration.volunteer_user_id = auth.uid()
    and (
      registration.status = 'cancelled'
      or mission.status in ('completed', 'cancelled')
      or mission.ends_at <= now()
    )
  group by
    registration.id,
    mission.id,
    category.name_fr,
    ngo.name
  order by coalesce(registration.cancelled_at, mission.ends_at) desc;
end;
$$;

revoke all on function public.get_my_mission_history() from public;
grant execute on function public.get_my_mission_history() to authenticated;

commit;
