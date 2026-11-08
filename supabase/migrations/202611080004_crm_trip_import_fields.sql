-- Fields populated from operator reservation/quote PDFs after human review.
alter table public.crm_trips
  add column if not exists operator text check (operator is null or char_length(operator) <= 160),
  add column if not exists adults smallint check (adults is null or adults between 1 and 20),
  add column if not exists children_count smallint check (children_count is null or children_count between 0 and 30),
  add column if not exists total_amount numeric(12,2) check (total_amount is null or total_amount >= 0),
  add column if not exists currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists trip_notes text check (trip_notes is null or char_length(trip_notes) <= 4000);

create table if not exists public.crm_trip_services (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.crm_trips(id) on delete cascade,
  service_type text not null check (service_type in ('flight','accommodation','activity','transfer','insurance','other')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  provider text check (provider is null or char_length(provider) <= 160),
  reference text check (reference is null or char_length(reference) <= 100),
  starts_on date,
  ends_on date,
  details text check (details is null or char_length(details) <= 4000),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create index if not exists crm_trip_services_trip_idx
  on public.crm_trip_services (trip_id, sort_order, created_at);

alter table public.crm_trip_services enable row level security;
revoke all on public.crm_trip_services from anon, authenticated;
grant all on public.crm_trip_services to service_role;

create or replace function public.crm_create_trip_with_details(
  p_client_id uuid,
  p_reference text,
  p_destination text,
  p_departure_date date,
  p_return_date date,
  p_status text,
  p_operator text,
  p_adults smallint,
  p_children_count smallint,
  p_total_amount numeric,
  p_currency text,
  p_trip_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_trip_id uuid;
begin
  if not exists (select 1 from public.crm_clients where id = p_client_id) then
    raise exception 'client_not_found';
  end if;
  insert into public.crm_trips (
    client_id, reference, destination, departure_date, return_date, status,
    operator, adults, children_count, total_amount, currency, trip_notes
  ) values (
    p_client_id, nullif(btrim(p_reference), ''), nullif(btrim(p_destination), ''), p_departure_date, p_return_date, p_status,
    nullif(btrim(p_operator), ''), p_adults, p_children_count, p_total_amount, upper(p_currency), nullif(btrim(p_trip_notes), '')
  ) returning id into created_trip_id;
  insert into public.crm_trip_tasks (trip_id, title, sort_order) values
    (created_trip_id, 'Enviar email com a mensagem para o quarto', 10),
    (created_trip_id, 'Fazer check-in', 20),
    (created_trip_id, 'Perguntar se está tudo bem', 30);
  return created_trip_id;
end;
$$;

revoke all on function public.crm_create_trip_with_details(uuid, text, text, date, date, text, text, smallint, smallint, numeric, text, text) from public, anon, authenticated;
grant execute on function public.crm_create_trip_with_details(uuid, text, text, date, date, text, text, smallint, smallint, numeric, text, text) to service_role;

create or replace function public.crm_convert_lead_to_trip(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_lead public.crm_leads%rowtype;
  selected_client_id uuid;
  created_trip_id uuid;
  inserted_count integer;
begin
  select * into selected_lead from public.crm_leads where id = p_lead_id;
  if not found then raise exception 'lead_not_found'; end if;
  if selected_lead.status <> 'won' then raise exception 'lead_not_confirmed'; end if;

  selected_client_id := selected_lead.client_id;
  if selected_client_id is null then
    insert into public.crm_clients (full_name, email, phone, language, source)
    values (selected_lead.full_name, lower(btrim(selected_lead.email)), selected_lead.phone, selected_lead.language, 'lead')
    on conflict do nothing;
    select id into selected_client_id from public.crm_clients
      where lower(btrim(email)) = lower(btrim(selected_lead.email))
      order by created_at asc limit 1;
    if selected_client_id is null then raise exception 'client_create_failed'; end if;
    update public.crm_leads set client_id = selected_client_id where id = selected_lead.id;
  end if;

  insert into public.crm_trips (lead_id, client_id, destination, departure_date, return_date, status, adults, children_count)
  values (selected_lead.id, selected_client_id, selected_lead.destination, selected_lead.departure_date, selected_lead.return_date, 'planning', selected_lead.adults, cardinality(selected_lead.children_ages))
  on conflict (lead_id) where lead_id is not null do nothing;
  get diagnostics inserted_count = row_count;
  select id into created_trip_id from public.crm_trips where lead_id = selected_lead.id;
  if inserted_count = 1 then
    insert into public.crm_trip_tasks (trip_id, title, sort_order) values
      (created_trip_id, 'Enviar email com a mensagem para o quarto', 10),
      (created_trip_id, 'Fazer check-in', 20),
      (created_trip_id, 'Perguntar se está tudo bem', 30);
  end if;
  return created_trip_id;
end;
$$;

revoke all on function public.crm_convert_lead_to_trip(uuid) from public, anon, authenticated;
grant execute on function public.crm_convert_lead_to_trip(uuid) to service_role;
