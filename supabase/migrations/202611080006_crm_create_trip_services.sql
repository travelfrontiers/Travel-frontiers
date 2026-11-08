-- Create the trip and all reviewed flight/accommodation records in one transaction.
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
  p_trip_notes text,
  p_services jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_trip_id uuid;
  service_row jsonb;
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

  for service_row in select value from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) as items(value)
  loop
    insert into public.crm_trip_services (
      trip_id, service_type, title, provider, reference, starts_on, ends_on, details
    ) values (
      created_trip_id,
      service_row->>'service_type',
      btrim(service_row->>'title'),
      nullif(btrim(service_row->>'provider'), ''),
      nullif(btrim(service_row->>'reference'), ''),
      nullif(service_row->>'starts_on', '')::date,
      nullif(service_row->>'ends_on', '')::date,
      nullif(btrim(service_row->>'details'), '')
    );
  end loop;
  return created_trip_id;
end;
$$;

revoke all on function public.crm_create_trip_with_details(uuid, text, text, date, date, text, text, smallint, smallint, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.crm_create_trip_with_details(uuid, text, text, date, date, text, text, smallint, smallint, numeric, text, text, jsonb) to service_role;
