begin;
do $$
declare
 client uuid:=gen_random_uuid();
 trip uuid;
 rejected boolean:=false;
 detail jsonb;
begin
 insert into public.crm_clients(id,full_name,language,source) values(client,'Synthetic manual commission','pt','manual');
 insert into public.crm_trips(client_id,destination,total_amount,currency)
 values(client,'Synthetic manual commission trip',1000,'EUR') returning id into trip;
 perform public.crm_set_manual_commission(trip,0,120.50,'Exceptional supplier agreement');
 assert (select commission_expected=120.50 and version=1 and total_amount=1000 from public.crm_commission_overview where trip_id=trip);
 detail:=public.crm_finance_reconciled_detail(trip);
 assert detail->'commission'='null'::jsonb;
 assert (detail->'manual_commission'->>'amount')::numeric=120.50;
 assert detail->'manual_commission'->>'notes'='Exceptional supplier agreement';
 begin
  perform public.crm_set_manual_commission(trip,0,400,'Stale update');
 exception when others then rejected:=sqlerrm='finance_stale_version'; end;
 assert rejected;
 rejected:=false;
 begin
  perform public.crm_set_manual_commission(trip,1,400,' ');
 exception when others then rejected:=sqlerrm='invalid_commission'; end;
 assert rejected;
 perform public.crm_mutate_trip_discount(trip,1,'discount_save','{"kind":"customer","amount":10,"charge_commission":true,"included_in_total":false}');
 assert (select commission_expected=110.50 from public.crm_commission_overview where trip_id=trip);
 perform public.crm_finance_mutate(trip,2,'commission_save','{"snapshot":{"inputs":{},"rules_version":"tf-commission-v3","result":{"netCommission":200,"totalCollected":1000}}}');
 assert (select commission_expected=110.50 from public.crm_commission_overview where trip_id=trip);
 perform public.crm_set_manual_commission(trip,3,null,null);
 assert (select commission_expected=190 and version=4 from public.crm_commission_overview where trip_id=trip);
 assert public.crm_finance_reconciled_detail(trip)->'manual_commission'='null'::jsonb;
 perform public.crm_set_manual_commission(trip,4,0,'No commission on this booking');
 assert (select manual_commission_amount=0 from public.crm_trip_finance where trip_id=trip);
 assert not has_function_privilege('authenticated','public.crm_set_manual_commission(uuid,integer,numeric,text)','execute');
 assert not has_function_privilege('anon','public.crm_set_manual_commission(uuid,integer,numeric,text)','execute');
end;
$$;
rollback;
