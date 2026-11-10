-- Fictitious data only. The entire test is reverted.
begin;
do $$
declare
  customer_id uuid:=gen_random_uuid();
  other_customer_id uuid:=gen_random_uuid();
  trip uuid:=gen_random_uuid();
  foreign_file uuid:=gen_random_uuid();
  revision integer:=0;
  initial_timestamp timestamptz;
  saved jsonb;
  first_document uuid;
  failed boolean;
  today date:=(now() at time zone 'Europe/Lisbon')::date;
begin
  insert into public.crm_clients(id,full_name,language,source) values
    (customer_id,'Synthetic finance test','pt','manual'),(other_customer_id,'Synthetic other client','pt','manual');
  insert into public.crm_trips(id,client_id,destination,total_amount,currency)
  values(trip,customer_id,'Synthetic travel test',3000,'EUR');
  insert into public.crm_drive_files(id,client_id,drive_file_id,file_name,mime_type)
  values(foreign_file,other_customer_id,'synthetic-file-'||foreign_file,'Synthetic.pdf','application/pdf');

  saved:=public.crm_finance_mutate(trip,revision,'build_plan',jsonb_build_object('deposit_amount',900,'deposit_due_on',today-1,'balance_due_on',today+2));
  revision:=(saved->>'version')::integer;
  assert (select scheduled_total=3000 and overdue_amount=900 and due_soon_amount=2100 from public.crm_trip_finance_overview where trip_id=trip),'deposit and balance';
  saved:=public.crm_finance_mutate(trip,revision,'receipt_save',jsonb_build_object('kind','customer_payment','amount',600,'paid_on',today,'received_by','agency','method','transfer'));
  revision:=(saved->>'version')::integer;
  assert (select balance=2400 and overdue_amount=300 and customer_net=600 from public.crm_trip_finance_overview where trip_id=trip),'partial payment allocation';
  failed:=false;
  begin
    perform public.crm_finance_mutate(trip,revision-1,'receipt_save',jsonb_build_object('kind','customer_payment','amount',600,'paid_on',today,'received_by','agency','method','transfer'));
  exception when others then failed:=sqlerrm='finance_stale_version'; end;
  assert failed,'stale payment replay rejected';

  failed:=false;
  begin
    perform public.crm_finance_mutate(trip,revision,'receipt_save',jsonb_build_object('kind','customer_payment','amount',100,'paid_on',today,'received_by','agency','method','transfer','document_id',foreign_file));
  exception when others then failed:=sqlerrm='document_mismatch'; end;
  assert failed,'receipt belongs to the trip or its clients';

  saved:=public.crm_finance_mutate(trip,revision,'commission_save',jsonb_build_object('apply_to_total',false,'snapshot',
    jsonb_build_object('rules_version','tf-commission-v1','inputs','{}'::jsonb,'result',jsonb_build_object('netCommission',188,'totalCollected',2900))));
  revision:=(saved->>'version')::integer;
  saved:=public.crm_finance_mutate(trip,revision,'receipt_save',jsonb_build_object('kind','commission_payment','amount',100,'paid_on',today,'received_by','agency','method','transfer'));
  revision:=(saved->>'version')::integer;
  assert (select total_amount=3000 and customer_net=600 and commission_balance=88 from public.crm_trip_finance_overview where trip_id=trip),'separate commission balance and explicit price updates';

  failed:=false;
  begin
    perform public.crm_finance_mutate(trip,revision,'commission_save',jsonb_build_object('apply_to_total',true,'snapshot',
      jsonb_build_object('rules_version','tf-commission-v1','inputs','{}'::jsonb,'result',jsonb_build_object('netCommission',99,'totalCollected',2900))));
  exception when others then failed:=sqlerrm='payment_plan_exceeds_total'; end;
  assert failed,'price cannot undercut agreed schedule';
  assert (select total_amount=3000 and commission_expected=188 and version=revision from public.crm_trip_finance_overview where trip_id=trip),'invalid price and calculation both rolled back';

  saved:=public.crm_finance_mutate(trip,revision,'receipt_save',jsonb_build_object('kind','customer_refund','amount',200,'paid_on',today,'received_by','agency','method','transfer'));
  revision:=(saved->>'version')::integer;
  assert (select customer_net=400 and overdue_amount=500 and balance=2600 from public.crm_trip_finance_overview where trip_id=trip),'refund reopens unpaid balance';
  failed:=false;
  begin
    perform public.crm_finance_mutate(trip,revision,'receipt_save',jsonb_build_object('kind','customer_refund','amount',401,'paid_on',today,'received_by','agency','method','transfer'));
  exception when others then failed:=sqlerrm='refund_exceeds_received'; end;
  assert failed,'excess refund rejected';
  assert (select count(*)=3 from public.crm_payment_receipts where trip_id=trip),'failed payments left no rows';
  failed:=false;
  begin update public.crm_trips set currency='USD' where id=trip;
  exception when others then failed:=sqlerrm='finance_currency_locked'; end;
  assert failed,'currency cannot change under a ledger';
  update public.crm_trips set total_amount=3100 where id=trip;
  assert (select version>revision and balance=2700 from public.crm_trip_finance_overview where trip_id=trip),'external price edit invalidates finance revision';
  assert jsonb_array_length(public.crm_finance_detail(trip)->'schedule')=2,'detail includes schedule';

  select updated_at into initial_timestamp from public.crm_clients where id=customer_id;
  saved:=public.crm_save_scanned_document(customer_id,initial_timestamp,'passport','SYNTHETIC-ID-ONLY','2032-05-01','Synthetic full name','1990-02-15');
  first_document:=(saved->'document'->>'id')::uuid;
  saved:=public.crm_save_scanned_document(customer_id,(saved->'client'->>'updated_at')::timestamptz,'passport','SYNTHETIC-ID-ONLY','2033-05-01','Synthetic full name','1990-02-15');
  assert (saved->'document'->>'id')::uuid=first_document,'same document updates rather than duplicates';
  assert (select birth_date='1990-02-15' and full_name='Synthetic full name' from public.crm_clients where id=customer_id),'confirmed client identity saved';
  failed:=false;
  begin
    perform public.crm_save_scanned_document(customer_id,initial_timestamp-interval '1 second','identity_card','SYNTHETIC-STALE','2032-05-01','Synthetic stale name','1990-02-15');
  exception when others then failed:=sqlerrm='client_identity_stale'; end;
  assert failed,'stale OCR review cannot overwrite client';
  assert (select count(*)=1 from public.crm_client_documents where client_id=customer_id),'no stale document inserted';
  assert not exists(select 1 from public.crm_activity where label like '%SYNTHETIC-ID-ONLY%' or details::text like '%SYNTHETIC-ID-ONLY%'),'audit excludes document value';
  assert not has_table_privilege('anon','public.crm_payment_deadlines','select'),'finance views private';
  assert not has_function_privilege('authenticated','public.crm_save_scanned_document(uuid,timestamptz,text,text,date,text,date)','execute'),'scan save private';
  assert not has_table_privilege('service_role','public.crm_payment_receipts','insert'),'ledger writes restricted to RPC';
  delete from public.crm_trips where id=trip;
  assert not exists(select 1 from public.crm_payment_receipts where trip_id=trip),'trip cascade succeeds with finance audit';
end; $$;
rollback;
select 'PASS: prestações, recebimentos, reembolsos, comissão, concorrência, OCR e permissões. Dados fictícios revertidos.' as result;
