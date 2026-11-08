-- Travel Frontiers CRM foundation. Apply only to the dedicated Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 160),
  email text not null check (char_length(email) <= 254),
  language text not null default 'pt' check (language in ('pt','en','fr')),
  phone text check (phone is null or char_length(phone) <= 40),
  destination text check (destination is null or char_length(destination) <= 240),
  departure_date date,
  return_date date,
  date_flexible boolean not null default false,
  adults smallint not null default 1 check (adults between 1 and 20),
  children_ages smallint[] not null default '{}',
  travel_style text check (travel_style is null or char_length(travel_style) <= 120),
  budget text check (budget is null or char_length(budget) <= 120),
  notes text check (notes is null or char_length(notes) <= 4000),
  status text not null default 'new' check (status in ('new','qualifying','research','quote_preparing','quote_sent','awaiting_reply','won','lost')),
  source text not null default 'public_form',
  consent_privacy boolean not null default false,
  privacy_consent_at timestamptz,
  internal_notes text
);

create table if not exists public.crm_trips (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.crm_leads(id) on delete restrict,
  reference text unique,
  destination text,
  departure_date date,
  return_date date,
  status text not null default 'planning' check (status in ('planning','confirmed','travelling','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_trip_tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.crm_trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  due_at timestamptz,
  completed boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.crm_convert_lead_to_trip(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_lead public.crm_leads%rowtype;
  created_trip_id uuid;
  inserted_count integer;
begin
  select * into selected_lead from public.crm_leads where id = p_lead_id;
  if not found then
    raise exception 'lead_not_found';
  end if;
  if selected_lead.status <> 'won' then
    raise exception 'lead_not_confirmed';
  end if;

  insert into public.crm_trips (lead_id, destination, departure_date, return_date, status)
  values (selected_lead.id, selected_lead.destination, selected_lead.departure_date, selected_lead.return_date, 'planning')
  on conflict (lead_id) do nothing;
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

alter table public.crm_leads enable row level security;
alter table public.crm_trips enable row level security;
alter table public.crm_trip_tasks enable row level security;

-- Public visitors may submit leads only. Reads and CRM changes use server-only API routes
-- that verify the signed-in Sanity Studio account before using the service role key.
drop policy if exists "public may submit leads" on public.crm_leads;
create policy "public may submit leads" on public.crm_leads
  for insert to anon with check (
    status = 'new' and source = 'public_form' and internal_notes is null and consent_privacy = true
  );

-- Remove any broad authenticated policies from an earlier draft. The CRM API is
-- the only reader/editor and uses its server-only key after verifying Studio auth.
drop policy if exists "authenticated user manages leads" on public.crm_leads;
drop policy if exists "authenticated user manages trips" on public.crm_trips;
drop policy if exists "authenticated user manages trip tasks" on public.crm_trip_tasks;

grant insert on public.crm_leads to anon;
grant all on public.crm_leads, public.crm_trips, public.crm_trip_tasks to service_role;
