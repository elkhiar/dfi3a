-- Verified point ledger and privacy-aware volunteer leaderboards.

begin;

create type public.point_transaction_reason as enum (
  'mission_attendance',
  'late_cancellation',
  'no_show',
  'manual_adjustment'
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  volunteer_user_id uuid not null references public.profiles(user_id) on delete restrict,
  registration_id uuid references public.registrations(id) on delete restrict,
  amount integer not null check (amount <> 0),
  reason public.point_transaction_reason not null,
  description text,
  created_at timestamptz not null default now(),
  unique (registration_id, reason)
);

create index point_transactions_volunteer_date_idx
on public.point_transactions (volunteer_user_id, created_at desc);

alter table public.point_transactions enable row level security;

create policy "volunteers_read_own_point_transactions"
on public.point_transactions for select to authenticated
using (volunteer_user_id = auth.uid() or public.is_admin());

revoke all on table public.point_transactions from anon, authenticated;
grant select on public.point_transactions to authenticated;

create or replace function public.get_my_points_summary()
returns table (
  total_points bigint,
  monthly_points bigint,
  completed_missions bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(transaction.amount), 0)::bigint,
    coalesce(sum(transaction.amount) filter (
      where transaction.created_at >= date_trunc('month', now())
    ), 0)::bigint,
    count(*) filter (
      where transaction.reason = 'mission_attendance'
        and transaction.amount > 0
    )::bigint
  from public.point_transactions transaction
  where transaction.volunteer_user_id = auth.uid();
$$;

revoke all on function public.get_my_points_summary() from public;
grant execute on function public.get_my_points_summary() to authenticated;

create or replace function public.get_leaderboard(p_period text default 'month')
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  city text,
  points bigint,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with volunteer_scores as (
    select
      profile.user_id,
      concat_ws(' ', profile.first_name, left(profile.last_name, 1) || '.') as display_name,
      case when profile.show_city then profile.city else null end as city,
      coalesce(sum(transaction.amount) filter (
        where p_period = 'all'
          or transaction.created_at >= date_trunc('month', now())
      ), 0)::bigint as points,
      profile.created_at
    from public.profiles profile
    left join public.point_transactions transaction
      on transaction.volunteer_user_id = profile.user_id
    where profile.account_type = 'volunteer'
      and profile.show_in_leaderboard
    group by profile.user_id, profile.first_name, profile.last_name,
      profile.show_city, profile.city, profile.created_at
  )
  select
    row_number() over (order by volunteer_scores.points desc, volunteer_scores.created_at)::bigint,
    volunteer_scores.user_id,
    nullif(trim(volunteer_scores.display_name), ''),
    volunteer_scores.city,
    volunteer_scores.points,
    volunteer_scores.user_id = auth.uid()
  from volunteer_scores
  order by volunteer_scores.points desc, volunteer_scores.created_at
  limit 100;
$$;

revoke all on function public.get_leaderboard(text) from public;
grant execute on function public.get_leaderboard(text) to anon, authenticated;

comment on table public.point_transactions is
  'Immutable-style ledger for verified attendance points and MVP penalties.';

commit;
