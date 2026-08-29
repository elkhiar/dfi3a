-- Allow an NGO to cancel its own future mission without penalising volunteers.

begin;

create or replace function public.cancel_ngo_mission(
  p_mission_id uuid,
  p_reason text
)
returns table (
  mission_id uuid,
  cancelled_registration_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission public.missions%rowtype;
  cancelled_count integer;
  clean_reason text;
begin
  clean_reason := nullif(trim(p_reason), '');
  if clean_reason is null or char_length(clean_reason) < 10 then
    raise exception using errcode = 'P0001', message = 'cancellation_reason_required';
  end if;

  select * into mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'mission_not_found';
  end if;
  if not public.owns_ngo(mission.ngo_id) and not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'mission_owner_required';
  end if;
  if mission.status not in ('draft', 'published') then
    raise exception using errcode = 'P0001', message = 'mission_not_cancellable';
  end if;
  if now() >= mission.starts_at then
    raise exception using errcode = 'P0001', message = 'mission_already_started';
  end if;

  update public.missions set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = clean_reason
  where id = p_mission_id;

  update public.registrations set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Mission annulée par l’ONG : ' || clean_reason,
    is_late_cancellation = false
  where registrations.mission_id = p_mission_id
    and status = 'joined';

  get diagnostics cancelled_count = row_count;
  return query select p_mission_id, cancelled_count;
end;
$$;

revoke all on function public.cancel_ngo_mission(uuid, text) from public;
grant execute on function public.cancel_ngo_mission(uuid, text) to authenticated;

commit;
