-- Allow multiple clients on a trip, and keep one auto-generated check-in task per flight.
create table if not exists public.crm_trip_clients (
  trip_id uuid not null references public.crm_trips(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (trip_id, client_id)
);

insert into public.crm_trip_clients (trip_id, client_id)
select id, client_id from public.crm_trips
where client_id is not null
on conflict do nothing;

alter table public.crm_trip_clients enable row level security;
revoke all on public.crm_trip_clients from anon, authenticated;
grant all on public.crm_trip_clients to service_role;

create or replace function public.crm_sync_primary_trip_client()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.client_id is not null then
    insert into public.crm_trip_clients (trip_id, client_id)
    values (new.id, new.client_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_trip_primary_client_sync on public.crm_trips;
create trigger crm_trip_primary_client_sync
after insert or update of client_id on public.crm_trips
for each row execute function public.crm_sync_primary_trip_client();

create or replace function public.crm_create_trip_with_clients(
  p_client_ids uuid[],
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
  p_trip_notes text,
  p_services jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  primary_client_id uuid;
  created_trip_id uuid;
  selected_client_id uuid;
begin
  if p_client_ids is null or cardinality(p_client_ids) = 0 then raise exception 'client_required'; end if;
  primary_client_id := p_client_ids[1];
  foreach selected_client_id in array p_client_ids loop
    if not exists (select 1 from public.crm_clients where id = selected_client_id) then raise exception 'client_not_found'; end if;
  end loop;

  created_trip_id := public.crm_create_trip_with_details(
    primary_client_id, p_reference, p_destination, p_departure_date, p_return_date,
    p_status, p_operator, p_adults, p_children_count, p_total_amount, p_currency,
    p_trip_notes, p_services
  );

  insert into public.crm_trip_clients (trip_id, client_id)
  select created_trip_id, selected_client_id
  from unnest(p_client_ids) as selected_client_id
  on conflict do nothing;
  return created_trip_id;
end;
$$;

create or replace function public.crm_set_trip_clients(p_trip_id uuid, p_client_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  primary_client_id uuid;
  selected_client_id uuid;
begin
  if p_client_ids is null or cardinality(p_client_ids) = 0 then raise exception 'client_required'; end if;
  if not exists (select 1 from public.crm_trips where id = p_trip_id) then raise exception 'trip_not_found'; end if;
  primary_client_id := p_client_ids[1];
  foreach selected_client_id in array p_client_ids loop
    if not exists (select 1 from public.crm_clients where id = selected_client_id) then raise exception 'client_not_found'; end if;
  end loop;

  update public.crm_trips set client_id = primary_client_id, updated_at = now() where id = p_trip_id;
  delete from public.crm_trip_clients where trip_id = p_trip_id;
  insert into public.crm_trip_clients (trip_id, client_id)
  select p_trip_id, selected_client_id from unnest(p_client_ids) as selected_client_id
  on conflict do nothing;
end;
$$;

revoke all on function public.crm_create_trip_with_clients(uuid[], text, text, date, date, text, text, smallint, smallint, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.crm_create_trip_with_clients(uuid[], text, text, date, date, text, text, smallint, smallint, numeric, text, text, jsonb) to service_role;
revoke all on function public.crm_set_trip_clients(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.crm_set_trip_clients(uuid, uuid[]) to service_role;

alter table public.crm_trip_tasks
  add column if not exists source_service_id uuid references public.crm_trip_services(id) on delete cascade;
create unique index if not exists crm_trip_tasks_source_service_unique
  on public.crm_trip_tasks (source_service_id)
  where source_service_id is not null;

create or replace function public.crm_sync_flight_checkin_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_service public.crm_trip_services%rowtype;
  task_title text;
begin
  if tg_op = 'DELETE' then
    delete from public.crm_trip_tasks where source_service_id = old.id;
    return old;
  end if;

  target_service := new;
  if target_service.service_type <> 'flight' or target_service.starts_on is null then
    delete from public.crm_trip_tasks where source_service_id = target_service.id;
    return new;
  end if;

  task_title := 'Check-in 48h antes · ' || left(target_service.title, 210);
  insert into public.crm_trip_tasks (trip_id, source_service_id, title, due_at, completed, sort_order)
  values (
    target_service.trip_id,
    target_service.id,
    task_title,
    ((target_service.starts_on::timestamp - interval '2 days') at time zone 'Europe/Lisbon'),
    false,
    5
  )
  on conflict (source_service_id) where source_service_id is not null
  do update set trip_id = excluded.trip_id, title = excluded.title, due_at = excluded.due_at;
  return new;
end;
$$;

drop trigger if exists crm_trip_service_checkin_reminder on public.crm_trip_services;
create trigger crm_trip_service_checkin_reminder
after insert or update or delete on public.crm_trip_services
for each row execute function public.crm_sync_flight_checkin_task();

insert into public.crm_trip_tasks (trip_id, source_service_id, title, due_at, completed, sort_order)
select service.trip_id, service.id, 'Check-in 48h antes · ' || left(service.title, 210),
  ((service.starts_on::timestamp - interval '2 days') at time zone 'Europe/Lisbon'),
  false, 5
from public.crm_trip_services as service
where service.service_type = 'flight' and service.starts_on is not null
on conflict (source_service_id) where source_service_id is not null
do update set trip_id = excluded.trip_id, title = excluded.title, due_at = excluded.due_at;
