begin;

alter table public.crm_leads alter column email drop not null;
alter table public.crm_leads add constraint crm_public_request_requires_email
  check (source <> 'public_form' or email is not null);

create function public.crm_link_request_client(p_lead_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  lead public.crm_leads%rowtype;
  customer public.crm_clients%rowtype;
  contact_email text;
begin
  select * into lead from public.crm_leads where id = p_lead_id for update;
  if not found then raise exception 'lead_not_found'; end if;

  if lead.client_id is not null then
    select * into customer from public.crm_clients where id = lead.client_id;
    if not found then raise exception 'client_not_found'; end if;
  else
    contact_email := nullif(lower(btrim(lead.email)), '');
    insert into public.crm_clients (full_name, email, phone, language, source)
    values (lead.full_name, contact_email, lead.phone, lead.language, 'lead')
    on conflict do nothing returning * into customer;
    if customer.id is null and contact_email is not null then
      select * into customer from public.crm_clients
      where lower(btrim(email)) = contact_email and btrim(email) <> '';
    end if;
    if customer.id is null then raise exception 'client_create_failed'; end if;
    update public.crm_leads set client_id = customer.id, updated_at = now()
    where id = p_lead_id returning * into lead;
  end if;
  return jsonb_build_object('client', to_jsonb(customer), 'lead', to_jsonb(lead));
end;
$$;
revoke all on function public.crm_link_request_client(uuid) from public, anon, authenticated;
grant execute on function public.crm_link_request_client(uuid) to service_role;

create or replace function public.crm_convert_lead_to_trip(p_lead_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  lead public.crm_leads%rowtype;
  selected_client_id uuid;
  created_trip_id uuid;
begin
  select * into lead from public.crm_leads where id = p_lead_id for update;
  if not found then raise exception 'lead_not_found'; end if;
  if lead.status <> 'won' then raise exception 'lead_not_confirmed'; end if;
  selected_client_id := (public.crm_link_request_client(p_lead_id)->'client'->>'id')::uuid;

  insert into public.crm_trips (lead_id, client_id, destination, departure_date, return_date, status)
  values (lead.id, selected_client_id, lead.destination, lead.departure_date, lead.return_date, 'planning')
  on conflict (lead_id) where lead_id is not null do nothing;

  select id into created_trip_id from public.crm_trips where lead_id = lead.id;
  return created_trip_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
