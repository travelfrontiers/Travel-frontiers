begin;

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
  select created_trip_id, traveler.client_id
  from unnest(p_client_ids) as traveler(client_id)
  on conflict do nothing;
  return created_trip_id;
end;
$$;

commit;
