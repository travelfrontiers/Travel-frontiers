-- Test against a disposable database after migration 026. All writes roll back.
begin;
do $$
declare
  primary_client uuid:=gen_random_uuid();
  traveler uuid:=gen_random_uuid();
  drive_document uuid:=gen_random_uuid();
  approved uuid;
  trip uuid;
  flight uuid;
  arrival uuid;
  item uuid;
  lease uuid:=gen_random_uuid();
  result jsonb;
  fields jsonb;
  services jsonb;
  rejected boolean:=false;
begin
  insert into public.crm_clients(id,full_name,language,source)
  values(primary_client,'Synthetic Primary','pt','manual'),(traveler,'Synthetic Traveler','pt','manual');
  insert into public.crm_drive_files(id,client_id,drive_file_id,file_name,mime_type)
  values(drive_document,primary_client,'operational_synthetic_document','Synthetic.pdf','application/pdf');
  services:='[
    {"service_type":"flight","title":"TP 123 · LIS → HEL","starts_on":"2027-03-29","ends_on":"2027-03-29","booking":{
      "flight_number":"TP 123","pnr":"LOCALZ1","origin":"LIS","destination_airport":"HEL",
      "departure_time":"17:30","departure_zone":"Europe/Lisbon","arrival_time":"23:15","arrival_zone":"Europe/Helsinki"}},
    {"service_type":"flight","title":"AY 99 · HEL → HKG","starts_on":"2027-03-30","ends_on":"2027-03-30","booking":{
      "flight_number":"AY 99","pnr":"LOCALZ1","origin":"HEL","destination_airport":"HKG",
      "departure_time":"00:35","departure_zone":"Europe/Helsinki","arrival_time":"17:40","arrival_zone":"Asia/Hong_Kong"}},
    {"service_type":"accommodation","title":"Hotel A","starts_on":"2027-03-30","ends_on":"2027-04-03","booking":{"status":"confirmed","confirmed_on":"2027-01-05","city":"HK","board":"PA"}},
    {"service_type":"accommodation","title":"Hotel B","starts_on":"2027-04-03","ends_on":"2027-04-05","booking":{"status":"requested"}}
  ]'::jsonb;

  trip:=public.crm_create_typed_trip(array[primary_client,traveler],
    '{"destination":"Synthetic","status":"planning","currency":"EUR","departure_date":"2027-03-29","return_date":"2027-04-08"}',services,'circuit');
  assert (select reference is null and client_id=primary_client from public.crm_trips where id=trip);
  assert (select count(*)=2 from public.crm_trip_clients where trip_id=trip);
  assert (select count(*)=2 from public.crm_trip_services where trip_id=trip and booking->>'pnr'='LOCALZ1');
  assert (select count(*)=2 from public.crm_trip_services where trip_id=trip and service_type='accommodation');
  assert public.crm_import_trip_services(trip,services)=0;
  assert (select booking->>'confirmed_on'='2027-01-05' from public.crm_trip_services where trip_id=trip and title='Hotel A');
  fields:='{"reference":"TF-20301","extra_references":"Supplier X: 00125","destination":"Synthetic","status":"planning","operator":"Synthetic operator","currency":"EUR","departure_date":"2027-03-29","return_date":"2027-04-08"}';
  result:=public.crm_update_trip(trip,array[primary_client,traveler],fields);
  assert result->>'reference'='TF-20301' and result->>'extra_references'='Supplier X: 00125';

  select id into flight from public.crm_trip_services where trip_id=trip and booking->>'flight_number'='TP 123';
  select id into arrival from public.crm_trip_services where trip_id=trip and booking->>'flight_number'='AY 99';
  assert (select departure_at='2027-03-29 16:30+00'::timestamptz from public.crm_trip_services where id=flight);
  assert (select arrival_at='2027-03-30 09:40+00'::timestamptz from public.crm_trip_services where id=arrival);
  select id into item from public.crm_trip_tasks where source_service_id=flight;
  assert (select due_at='2027-03-27 16:30+00'::timestamptz from public.crm_trip_tasks where id=item), '48 real hours across the daylight saving transition';
  update public.crm_trip_tasks set completed=true where id=item;
  update public.crm_trip_services set booking=booking||'{"departure_time":"16:00","departure_zone":"UTC","checkin_local":"2027-03-27T14:20"}' where id=flight;
  assert (select completed and due_at='2027-03-27 14:20+00'::timestamptz from public.crm_trip_tasks where id=item);
  update public.crm_trip_services set booking=booking||'{"status":"cancelled"}' where id=flight;
  assert (select completed and due_at is null from public.crm_trip_tasks where id=item);
  update public.crm_trip_services set booking=booking||'{"status":"confirmed"}' where id=flight;
  assert (select completed and due_at is not null from public.crm_trip_tasks where id=item);
  assert (select count(*)=1 from public.crm_trip_tasks where source_service_id=flight);
  begin
    update public.crm_trip_services set starts_on='2027-03-28',
      booking=(booking-'checkin_local')||'{"departure_zone":"Europe/Lisbon","departure_time":"01:30"}' where id=flight;
  exception when others then rejected:=sqlerrm='invalid_flight_schedule';
  end;
  assert rejected,'local time skipped by daylight saving is rejected';

  update public.crm_trip_services set starts_on=(now() at time zone 'Asia/Hong_Kong')::date+1,
    ends_on=null,booking=booking||'{"departure_zone":"Asia/Hong_Kong","departure_time":"23:59"}' where id=arrival;
  assert (select count(*)=1 from public.crm_claim_checkin_reminders(lease) where trip_id=trip);
  assert (select count(*)=0 from public.crm_claim_checkin_reminders(gen_random_uuid()) where trip_id=trip);
  perform public.crm_finish_checkin_reminders(lease,true);
  assert (select reminder_sent_at is not null from public.crm_trip_tasks where source_service_id=arrival);

  result:=public.crm_save_proposal(null,primary_client,null,trip,0,
    jsonb_build_object('title','Synthetic proposal','total_amount',1000,'currency','EUR','document_id',drive_document,
      'imported',jsonb_build_object('services',jsonb_build_array(services->2,services->3))));
  approved:=(result->>'id')::uuid;
  result:=public.crm_set_proposal_status(approved,1,'accepted','Confirmed manually by email');
  assert (result->>'trip_id')::uuid=trip and result->>'operational_imported_at' is not null;
  assert public.crm_proposal_to_trip(approved,1)=trip;
  assert (select count(*)=2 from public.crm_trip_services where trip_id=trip and service_type='accommodation');
  assert (select count(*)=1 from public.crm_trip_proposal_documents where trip_id=trip);
  assert not has_table_privilege('anon','public.crm_trip_proposal_documents','select');
  assert not has_function_privilege('authenticated','public.crm_import_trip_services(uuid,jsonb)','execute');
end; $$;
rollback;
