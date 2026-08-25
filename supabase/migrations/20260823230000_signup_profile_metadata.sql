-- Store required volunteer onboarding fields when Auth creates the profile.

begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_account_type text;
  requested_birthdate text;
begin
  requested_account_type := new.raw_user_meta_data ->> 'account_type';
  requested_birthdate := new.raw_user_meta_data ->> 'birthdate';

  insert into public.profiles (
    user_id,
    account_type,
    first_name,
    last_name,
    birthdate,
    city
  ) values (
    new.id,
    case
      when requested_account_type = 'ngo' then 'ngo'::public.account_type
      else 'volunteer'::public.account_type
    end,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    case
      when requested_birthdate ~ '^\d{4}-\d{2}-\d{2}$'
        then requested_birthdate::date
      else null
    end,
    nullif(trim(new.raw_user_meta_data ->> 'city'), '')
  );

  return new;
end;
$$;

commit;
