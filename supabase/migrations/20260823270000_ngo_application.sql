-- Separate NGO accounts submit a private application for administrator review.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ngo-documents',
  'ngo-documents',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "ngo_accounts_upload_own_documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ngo-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles
    where user_id = auth.uid() and account_type = 'ngo'
  )
);

create policy "ngo_accounts_read_own_documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'ngo-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create or replace function public.submit_ngo_application(
  p_name text,
  p_description text,
  p_main_city text,
  p_legal_name text,
  p_legal_address text,
  p_contact_full_name text,
  p_official_email text,
  p_phone text,
  p_registration_number text,
  p_registration_document_path text
)
returns table (
  ngo_id uuid,
  application_status public.ngo_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_ngo_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = current_user_id and account_type = 'ngo'
  ) then
    raise exception using errcode = 'P0001', message = 'ngo_account_required';
  end if;

  if nullif(trim(p_name), '') is null
    or nullif(trim(p_main_city), '') is null
    or nullif(trim(p_legal_name), '') is null
    or nullif(trim(p_legal_address), '') is null
    or nullif(trim(p_contact_full_name), '') is null
    or nullif(trim(p_official_email), '') is null
    or nullif(trim(p_phone), '') is null
    or nullif(trim(p_registration_number), '') is null
    or nullif(trim(p_registration_document_path), '') is null then
    raise exception using errcode = 'P0001', message = 'missing_required_fields';
  end if;

  select id into saved_ngo_id
  from public.ngos
  where owner_user_id = current_user_id;

  if saved_ngo_id is null then
    insert into public.ngos (
      owner_user_id, name, description, main_city, status
    ) values (
      current_user_id, trim(p_name), nullif(trim(p_description), ''),
      trim(p_main_city), 'pending'
    ) returning id into saved_ngo_id;
  else
    update public.ngos set
      name = trim(p_name),
      description = nullif(trim(p_description), ''),
      main_city = trim(p_main_city),
      status = 'pending',
      approved_at = null,
      approved_by = null
    where id = saved_ngo_id and status in ('pending', 'rejected');
  end if;

  insert into public.ngo_applications (
    ngo_id, legal_name, legal_address, contact_full_name,
    official_email, phone, registration_number,
    registration_document_path, rejection_reason, submitted_at,
    reviewed_at, reviewed_by
  ) values (
    saved_ngo_id, trim(p_legal_name), trim(p_legal_address),
    trim(p_contact_full_name), lower(trim(p_official_email)), trim(p_phone),
    trim(p_registration_number), trim(p_registration_document_path),
    null, now(), null, null
  )
  on conflict on constraint ngo_applications_ngo_id_key do update set
    legal_name = excluded.legal_name,
    legal_address = excluded.legal_address,
    contact_full_name = excluded.contact_full_name,
    official_email = excluded.official_email,
    phone = excluded.phone,
    registration_number = excluded.registration_number,
    registration_document_path = excluded.registration_document_path,
    rejection_reason = null,
    submitted_at = now(),
    reviewed_at = null,
    reviewed_by = null;

  return query select saved_ngo_id, 'pending'::public.ngo_status;
end;
$$;

revoke all on function public.submit_ngo_application(
  text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_ngo_application(
  text, text, text, text, text, text, text, text, text, text
) to authenticated;

commit;
