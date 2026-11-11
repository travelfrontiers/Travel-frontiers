begin;
do $$
declare
  first_client uuid := gen_random_uuid();
  second_client uuid := gen_random_uuid();
  trip uuid;
begin
  insert into public.crm_clients(id,full_name,source)
  values (first_client,'Synthetic trip client A','manual'), (second_client,'Synthetic trip client B','manual');
  trip := public.crm_create_typed_trip(
    array[first_client,second_client],
    '{"destination":"Synthetic","departure_date":"2027-04-06","return_date":"2027-04-20","status":"planning","adults":2,"children_count":0,"total_amount":1234,"currency":"EUR"}',
    '[{"service_type":"flight","title":"Synthetic outbound","starts_on":"2027-04-06","ends_on":"2027-04-07"},{"service_type":"accommodation","title":"Synthetic stay","starts_on":"2027-04-07","ends_on":"2027-04-19"}]',
    'circuit'
  );
  assert (select client_id=first_client and travel_type='circuit' from public.crm_trips where id=trip), 'trip created with primary client and type';
  assert (select count(*)=2 from public.crm_trip_clients where trip_id=trip), 'both travelers associated';
  assert (select count(*)=2 from public.crm_trip_services where trip_id=trip), 'flight and hotel saved';
  assert exists(select 1 from public.crm_trip_tasks where trip_id=trip and source_service_id is not null), 'flight check-in task created';
end;
$$;
rollback;
