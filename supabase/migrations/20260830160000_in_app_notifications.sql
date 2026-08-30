-- Private in-app notifications for volunteers, NGOs and administrators.

begin;

create type public.notification_type as enum (
  'registration_confirmed',
  'registration_joined',
  'registration_cancelled',
  'mission_updated',
  'mission_cancelled',
  'attendance_present',
  'attendance_absent',
  'ngo_application_submitted',
  'ngo_application_approved',
  'ngo_application_rejected',
  'urgency_requested',
  'urgency_approved',
  'urgency_rejected'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(user_id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 300),
  action_path text check (
    action_path is null
    or (char_length(action_path) between 1 and 240 and action_path like '/%')
  ),
  mission_id uuid references public.missions(id) on delete cascade,
  ngo_id uuid references public.ngos(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "users_read_own_notifications"
on public.notifications for select to authenticated
using (recipient_user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_user_id = auth.uid();

  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.notifications
  set read_at = now()
  where recipient_user_id = auth.uid()
    and read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.enqueue_notification(
  p_recipient_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_action_path text default null,
  p_mission_id uuid default null,
  p_ngo_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient_user_id is null then
    return;
  end if;

  insert into public.notifications (
    recipient_user_id, type, title, body, action_path, mission_id, ngo_id
  ) values (
    p_recipient_user_id, p_type, p_title, p_body, p_action_path, p_mission_id, p_ngo_id
  );
end;
$$;

create or replace function public.notify_registration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission_row public.missions%rowtype;
  ngo_owner_id uuid;
begin
  select mission.* into mission_row
  from public.missions mission
  where mission.id = new.mission_id;

  select ngo.owner_user_id into ngo_owner_id
  from public.ngos ngo
  where ngo.id = mission_row.ngo_id;

  if tg_op = 'INSERT' then
    if new.status = 'joined' then
      perform public.enqueue_notification(
        new.volunteer_user_id,
        'registration_confirmed',
        'Inscription confirmée',
        'Votre place pour « ' || mission_row.title || ' » est confirmée.',
        '/missions/' || mission_row.slug,
        mission_row.id,
        mission_row.ngo_id
      );
      perform public.enqueue_notification(
        ngo_owner_id,
        'registration_joined',
        'Nouvelle inscription',
        'Un bénévole vient de rejoindre « ' || mission_row.title || ' ».',
        '/ngo/missions/' || mission_row.id || '/attendance',
        mission_row.id,
        mission_row.ngo_id
      );
    end if;
    return new;
  end if;

  if new.status = 'joined' and old.status is distinct from new.status then
    perform public.enqueue_notification(
      new.volunteer_user_id,
      'registration_confirmed',
      'Inscription confirmée',
      'Votre place pour « ' || mission_row.title || ' » est confirmée.',
      '/missions/' || mission_row.slug,
      mission_row.id,
      mission_row.ngo_id
    );
    perform public.enqueue_notification(
      ngo_owner_id,
      'registration_joined',
      'Nouvelle inscription',
      'Un bénévole vient de rejoindre « ' || mission_row.title || ' ».',
      '/ngo/missions/' || mission_row.id || '/attendance',
      mission_row.id,
      mission_row.ngo_id
    );
  end if;

  if old.status = 'joined'
    and new.status = 'cancelled'
    and mission_row.status <> 'cancelled' then
    perform public.enqueue_notification(
      ngo_owner_id,
      'registration_cancelled',
      'Inscription annulée',
      'Un bénévole a annulé sa participation à « ' || mission_row.title || ' ».',
      '/ngo/missions/' || mission_row.id || '/attendance',
      mission_row.id,
      mission_row.ngo_id
    );
  end if;

  if old.attendance_finalized_at is null
    and new.attendance_finalized_at is not null then
    if new.attendance_status = 'present' then
      perform public.enqueue_notification(
        new.volunteer_user_id,
        'attendance_present',
        'Présence validée',
        'Votre présence à « ' || mission_row.title || ' » est confirmée : +' || new.points_quote || ' points.',
        '/events',
        mission_row.id,
        mission_row.ngo_id
      );
    elsif new.attendance_status = 'absent' then
      perform public.enqueue_notification(
        new.volunteer_user_id,
        'attendance_absent',
        'Absence enregistrée',
        'Votre absence à « ' || mission_row.title || ' » a été enregistrée.',
        '/events',
        mission_row.id,
        mission_row.ngo_id
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger registrations_notify_changes
after insert or update on public.registrations
for each row execute function public.notify_registration_change();

create or replace function public.notify_mission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ngo_owner_id uuid;
  admin_row record;
  registration_row record;
begin
  select ngo.owner_user_id into ngo_owner_id
  from public.ngos ngo
  where ngo.id = new.ngo_id;

  if tg_op = 'INSERT' then
    if new.urgency_status = 'pending' then
      for admin_row in
        select profile.user_id from public.profiles profile where profile.account_type = 'admin'
      loop
        perform public.enqueue_notification(
          admin_row.user_id,
          'urgency_requested',
          'Nouvelle demande urgente',
          '« ' || new.title || ' » attend une validation urgente.',
          '/admin',
          new.id,
          new.ngo_id
        );
      end loop;
    end if;
    return new;
  end if;

  if new.urgency_status = 'pending'
    and old.urgency_status is distinct from new.urgency_status then
    for admin_row in
      select profile.user_id from public.profiles profile where profile.account_type = 'admin'
    loop
      perform public.enqueue_notification(
        admin_row.user_id,
        'urgency_requested',
        'Nouvelle demande urgente',
        '« ' || new.title || ' » attend une validation urgente.',
        '/admin',
        new.id,
        new.ngo_id
      );
    end loop;
  end if;

  if old.urgency_status = 'pending'
    and new.urgency_status in ('approved', 'rejected') then
    perform public.enqueue_notification(
      ngo_owner_id,
      case when new.urgency_status = 'approved'
        then 'urgency_approved'::public.notification_type
        else 'urgency_rejected'::public.notification_type end,
      case when new.urgency_status = 'approved'
        then 'Urgence approuvée' else 'Urgence refusée' end,
      case when new.urgency_status = 'approved'
        then 'Votre mission « ' || new.title || ' » apparaît maintenant parmi les urgences.'
        else 'La demande urgente pour « ' || new.title || ' » n’a pas été approuvée.' end,
      '/missions/' || new.slug,
      new.id,
      new.ngo_id
    );
  end if;

  if old.status is distinct from new.status
    and new.status = 'cancelled' then
    for registration_row in
      select registration.volunteer_user_id
      from public.registrations registration
      where registration.mission_id = new.id and registration.status = 'joined'
    loop
      perform public.enqueue_notification(
        registration_row.volunteer_user_id,
        'mission_cancelled',
        'Mission annulée',
        '« ' || new.title || ' » a été annulée' ||
          case when nullif(trim(new.cancellation_reason), '') is not null
            then ' : ' || trim(new.cancellation_reason) else '.' end,
        '/events',
        new.id,
        new.ngo_id
      );
    end loop;
  elsif old.status = 'published'
    and new.status = 'published'
    and (
      old.title is distinct from new.title
      or old.starts_at is distinct from new.starts_at
      or old.ends_at is distinct from new.ends_at
      or old.registration_deadline is distinct from new.registration_deadline
      or old.city is distinct from new.city
      or old.general_area is distinct from new.general_area
      or old.requirements is distinct from new.requirements
      or old.accessibility is distinct from new.accessibility
      or old.difficulty is distinct from new.difficulty
      or old.capacity is distinct from new.capacity
    ) then
    for registration_row in
      select registration.volunteer_user_id
      from public.registrations registration
      where registration.mission_id = new.id and registration.status = 'joined'
    loop
      perform public.enqueue_notification(
        registration_row.volunteer_user_id,
        'mission_updated',
        'Mission mise à jour',
        'Des informations importantes ont changé pour « ' || new.title || ' ».',
        '/missions/' || new.slug,
        new.id,
        new.ngo_id
      );
    end loop;
  end if;

  return new;
end;
$$;

create trigger missions_notify_changes
after insert or update on public.missions
for each row execute function public.notify_mission_change();

create or replace function public.notify_ngo_application_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ngo_row public.ngos%rowtype;
  admin_row record;
begin
  select ngo.* into ngo_row from public.ngos ngo where ngo.id = new.ngo_id;

  for admin_row in
    select profile.user_id from public.profiles profile where profile.account_type = 'admin'
  loop
    perform public.enqueue_notification(
      admin_row.user_id,
      'ngo_application_submitted',
      'Nouvelle demande ONG',
      '« ' || ngo_row.name || ' » attend votre validation.',
      '/admin',
      null,
      ngo_row.id
    );
  end loop;

  return new;
end;
$$;

create trigger ngo_applications_notify_insert
after insert on public.ngo_applications
for each row execute function public.notify_ngo_application_change();

create or replace function public.notify_ngo_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.enqueue_notification(
      new.owner_user_id,
      case when new.status = 'approved'
        then 'ngo_application_approved'::public.notification_type
        else 'ngo_application_rejected'::public.notification_type end,
      case when new.status = 'approved'
        then 'Demande ONG approuvée' else 'Demande ONG refusée' end,
      case when new.status = 'approved'
        then 'Votre espace « ' || new.name || ' » est maintenant actif.'
        else 'Votre demande pour « ' || new.name || ' » n’a pas été approuvée.' end,
      case when new.status = 'approved' then '/ngo/dashboard' else '/ngo/apply' end,
      null,
      new.id
    );
  end if;

  return new;
end;
$$;

create trigger ngos_notify_status_change
after update on public.ngos
for each row execute function public.notify_ngo_status_change();

revoke all on function public.enqueue_notification(
  uuid, public.notification_type, text, text, text, uuid, uuid
) from public;
revoke all on function public.notify_registration_change() from public;
revoke all on function public.notify_mission_change() from public;
revoke all on function public.notify_ngo_application_change() from public;
revoke all on function public.notify_ngo_status_change() from public;

commit;
