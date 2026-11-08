-- Separate people from sales requests so one client can have multiple trips.
create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 160),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  language text not null default 'pt' check (language in ('pt','en','fr')),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_clients_email_unique
  on public.crm_clients (lower(btrim(email)))
  where email is not null and btrim(email) <> '';

alter table public.crm_leads
  add column if not exists client_id uuid references public.crm_clients(id) on delete set null;

alter table public.crm_trips
  add column if not exists client_id uuid references public.crm_clients(id) on delete restrict;

-- Preserve existing leads and trips by creating one client per unique email.
insert into public.crm_clients (full_name, email, phone, language, source)
select distinct on (lower(btrim(email)))
  full_name, lower(btrim(email)), phone, language, 'lead'
from public.crm_leads
where nullif(btrim(email), '') is not null
order by lower(btrim(email)), created_at asc, id asc
on conflict do nothing;

update public.crm_leads as lead
set client_id = client.id
from public.crm_clients as client
where lead.client_id is null
  and nullif(btrim(lead.email), '') is not null
  and lower(btrim(lead.email)) = lower(btrim(client.email));

update public.crm_trips as trip
set client_id = lead.client_id
from public.crm_leads as lead
where trip.client_id is null and trip.lead_id = lead.id;

alter table public.crm_trips alter column client_id set not null;
alter table public.crm_trips alter column lead_id drop not null;
alter table public.crm_trips drop constraint if exists crm_trips_lead_id_key;
create unique index if not exists crm_trips_lead_id_unique
  on public.crm_trips (lead_id) where lead_id is not null;

alter table public.crm_clients enable row level security;
revoke all on public.crm_clients from anon, authenticated;
grant all on public.crm_clients to service_role;

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

  insert into public.crm_trips (lead_id, client_id, destination, departure_date, return_date, status)
  values (selected_lead.id, selected_client_id, selected_lead.destination, selected_lead.departure_date, selected_lead.return_date, 'planning')
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

create or replace function public.crm_create_manual_trip(
  p_client_id uuid,
  p_reference text,
  p_destination text,
  p_departure_date date,
  p_return_date date,
  p_status text
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
  insert into public.crm_trips (client_id, reference, destination, departure_date, return_date, status)
  values (p_client_id, nullif(btrim(p_reference), ''), nullif(btrim(p_destination), ''), p_departure_date, p_return_date, p_status)
  returning id into created_trip_id;
  insert into public.crm_trip_tasks (trip_id, title, sort_order) values
    (created_trip_id, 'Enviar email com a mensagem para o quarto', 10),
    (created_trip_id, 'Fazer check-in', 20),
    (created_trip_id, 'Perguntar se está tudo bem', 30);
  return created_trip_id;
end;
$$;

revoke all on function public.crm_convert_lead_to_trip(uuid) from public, anon, authenticated;
grant execute on function public.crm_convert_lead_to_trip(uuid) to service_role;
revoke all on function public.crm_create_manual_trip(uuid, text, text, date, date, text) from public, anon, authenticated;
grant execute on function public.crm_create_manual_trip(uuid, text, text, date, date, text) to service_role;
