begin;
do $$
declare
 t uuid:=gen_random_uuid(); other_trip uuid:=gen_random_uuid(); s uuid:=gen_random_uuid();
 data jsonb:='{"service_status":"confirmed","sale_price":100,"net_cost":80,"service_commission":12,"finance_currency":"EUR","finance_basis":"person","finance_quantity":2,"finance_source":"Orçamento fictício","commission_method":"included","service_adjustment":-5}';
begin
 insert into public.crm_trips(id,destination,total_amount,currency) values(t,'Viagem de teste',300,'EUR'),(other_trip,'Outra viagem',null,'EUR');
 insert into public.crm_trip_services(id,trip_id,service_type,title) values(s,t,'accommodation','Hotel de teste');
 assert (select sale_price is null and finance_version=0 from public.crm_trip_services where id=s),'legacy/imported service keeps unknown values';
 perform public.crm_save_service_finance(s,t,0,data);
 assert (select sale_price=100 and finance_version=1 and finance_quantity=2 from public.crm_trip_services where id=s),'service saved';
 assert (select total_amount=300 from public.crm_trips where id=t),'contracted total independent';
 begin
  perform public.crm_save_service_finance(s,other_trip,1,data);
  raise exception 'expected foreign service rejection';
 exception when others then assert sqlerrm='service_not_found',sqlerrm; end;
 begin
  perform public.crm_save_service_finance(s,t,0,data);
  raise exception 'expected optimistic conflict';
 exception when others then assert sqlerrm='finance_stale_version',sqlerrm; end;
 begin
  perform public.crm_save_service_finance(s,t,1,data || '{"finance_source":null}');
  raise exception 'expected incomplete prices rejection';
 exception when check_violation then null; end;
 delete from public.crm_trip_services where id=s;
 assert (select count(*)=2 from public.crm_service_finance_history where service_id=s),'amounts kept in history';
 assert not has_table_privilege('anon','public.crm_service_finance_history','select');
 assert not has_function_privilege('authenticated','public.crm_save_service_finance(uuid,uuid,integer,jsonb)','execute');
end; $$;
rollback;
