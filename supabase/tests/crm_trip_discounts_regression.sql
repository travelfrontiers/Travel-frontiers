begin;
do $$
declare
 client uuid:=gen_random_uuid();
 trip uuid;
 schedule_source uuid;
 receipt_source uuid;
 discount uuid;
 version integer;
 detail jsonb;
 rejected boolean:=false;
begin
 insert into public.crm_clients(id,full_name,language,source) values(client,'Synthetic discounts','pt','manual');
 insert into public.crm_trips(client_id,destination,total_amount,currency)
 values(client,'Synthetic discounts trip',1988,'EUR') returning id into trip;
 insert into public.crm_payment_schedule(trip_id,label,amount,due_on,sort_order)
 values(trip,'Sinal',270.26,current_date,10),(trip,'Restante valor',1675.40,current_date+7,30);
 insert into public.crm_payment_schedule(trip_id,label,amount,due_on,sort_order)
 values(trip,'Desconto',42.34,current_date,20) returning id into schedule_source;
 insert into public.crm_payment_receipts(trip_id,kind,amount,paid_on,received_by,method)
 values(trip,'customer_payment',312.60,current_date,'agency','transfer') returning id into receipt_source;
 assert (select balance=1675.40 and customer_net=312.60 from public.crm_commission_overview where trip_id=trip);

 perform public.crm_mutate_trip_discount(trip,0,'discount_save',jsonb_build_object(
  'kind','participant','amount',42.34,'source_schedule_id',schedule_source,'source_receipt_id',receipt_source
 ));
 assert (select participant_discount=42.34 and total_amount=1988 and payable_total=1945.66
   and customer_net=270.26 and balance=1675.40 and unscheduled_amount=0 from public.crm_commission_overview where trip_id=trip);
 assert not exists(select 1 from public.crm_payment_schedule where id=schedule_source);
 assert (select count(*)=1 from public.crm_trip_discounts where trip_id=trip);
 version:=(select f.version from public.crm_trip_finance f where trip_id=trip);

 perform public.crm_finance_mutate(trip,version,'commission_save','{"snapshot":{"inputs":{},"rules_version":"tf-commission-v2","result":{"netCommission":180,"totalCollected":1988}}}');
 version:=(select f.version from public.crm_trip_finance f where trip_id=trip);
 perform public.crm_mutate_trip_discount(trip,version,'discount_save','{"kind":"customer","amount":100,"charge_commission":true}');
 version:=(select f.version from public.crm_trip_finance f where trip_id=trip);
 perform public.crm_mutate_trip_discount(trip,version,'discount_save','{"kind":"customer","amount":50,"charge_commission":false}');
 version:=(select f.version from public.crm_trip_finance f where trip_id=trip);
 perform public.crm_mutate_trip_discount(trip,version,'discount_save','{"kind":"customer","amount":12,"included_in_total":true}');
 assert (select customer_discount=162 and applied_discount=192.34 and commission_discount=100 and commission_expected=80
   and payable_total=1795.66 and customer_net=270.26 and balance=1525.40 and unscheduled_amount=0
   from public.crm_commission_overview where trip_id=trip);
 assert (select amount_remaining=1525.40 and amount_after_discount=1525.40 and amount=1675.40
   from public.crm_payment_deadlines where trip_id=trip and label='Restante valor');
 detail:=public.crm_finance_reconciled_detail(trip);
 assert jsonb_array_length(detail->'discounts')=4;

 begin
  perform public.crm_mutate_trip_discount(trip,0,'discount_save','{"kind":"customer","amount":25}');
 exception when others then rejected:=sqlerrm='finance_stale_version'; end;
 assert rejected;
 version:=(select f.version from public.crm_trip_finance f where trip_id=trip);
 rejected:=false;
 begin
  perform public.crm_finance_mutate(trip,version,'commission_save','{"apply_to_total":true,"snapshot":{"inputs":{},"rules_version":"tf-commission-v2","result":{"netCommission":100,"totalCollected":1900,"potentialSaving":88}}}');
 exception when others then rejected:=sqlerrm='discount_calculator_overlap'; end;
 assert rejected;

 select id into discount from public.crm_trip_discounts where trip_id=trip and charge_commission;
 perform public.crm_mutate_trip_discount(trip,version,'discount_reverse',jsonb_build_object('id',discount));
 assert (select commission_expected=180 and customer_discount=62 and balance=1625.40
   from public.crm_commission_overview where trip_id=trip);
 assert not has_table_privilege('anon','public.crm_trip_discounts','select');
 assert not has_function_privilege('authenticated','public.crm_mutate_trip_discount(uuid,integer,text,jsonb)','execute');
end; $$;
rollback;
