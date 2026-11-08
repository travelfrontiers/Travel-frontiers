-- Make client records maintainable while preserving trip operations and history.
alter table public.crm_trips alter column client_id drop not null;
alter table public.crm_trips drop constraint if exists crm_trips_client_id_fkey;
alter table public.crm_trips
  add constraint crm_trips_client_id_fkey
  foreign key (client_id) references public.crm_clients(id) on delete set null;

alter table public.crm_trip_clients drop constraint if exists crm_trip_clients_client_id_fkey;
alter table public.crm_trip_clients
  add constraint crm_trip_clients_client_id_fkey
  foreign key (client_id) references public.crm_clients(id) on delete cascade;

create or replace function public.crm_delete_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_trip record;
  replacement_client_id uuid;
begin
  if not exists (select 1 from public.crm_clients where id = p_client_id) then
    raise exception 'client_not_found';
  end if;

  -- Keep each trip's primary client when another traveller remains linked.
  for linked_trip in
    select id from public.crm_trips where client_id = p_client_id
  loop
    select relation.client_id into replacement_client_id
    from public.crm_trip_clients as relation
    where relation.trip_id = linked_trip.id and relation.client_id <> p_client_id
    order by relation.created_at asc, relation.client_id asc
    limit 1;

    update public.crm_trips
    set client_id = replacement_client_id, updated_at = now()
    where id = linked_trip.id;
  end loop;

  -- Retain an anonymous opportunity record while removing its personal details.
  update public.crm_leads
  set client_id = null,
      full_name = 'Cliente removido',
      email = 'removed-' || id::text || '@privacy.invalid',
      phone = null,
      destination = null,
      departure_date = null,
      return_date = null,
      date_flexible = false,
      adults = 1,
      children_ages = '{}',
      travel_style = null,
      budget = null,
      notes = null,
      internal_notes = null,
      follow_up_date = null,
      lost_reason = null,
      status = 'lost',
      updated_at = now()
  where client_id = p_client_id;

  -- Documents and client links cascade; trip records/tasks stay operational.
  delete from public.crm_clients where id = p_client_id;
end;
$$;

revoke all on function public.crm_delete_client(uuid) from public, anon, authenticated;
grant execute on function public.crm_delete_client(uuid) to service_role;
