begin;
do $$
declare
 t uuid:=gen_random_uuid(); other_trip uuid:=gen_random_uuid(); doc uuid:=gen_random_uuid(); other_doc uuid:=gen_random_uuid();
 today date:=(now() at time zone 'Europe/Lisbon')::date;
 receipt_data jsonb:=jsonb_build_object('kind','commission_payment','amount',180,'paid_on',today,'received_by','agency','method','transfer');
 event_data jsonb:=jsonb_build_object('amount',220,'effective_on',today,'reference','MAPA-FICTICIO','notes','Acerto de cálculo','document_id',doc);
 rev integer; movement uuid;
begin
 insert into public.crm_trips(id,destination,total_amount,currency) values(t,'Viagem fictícia',1500,'EUR'),(other_trip,'Outra viagem',null,'USD');
 insert into public.crm_drive_files(id,trip_id,drive_file_id,file_name,mime_type)
 values(doc,t,'fixture-commission-01','Mapa fictício.pdf','application/pdf'),(other_doc,other_trip,'fixture-commission-02','Outro mapa.pdf','application/pdf');
 assert (select commission_state='uncalculated' from public.crm_commission_overview where trip_id=t);
 perform public.crm_finance_mutate(t,0,'commission_save',jsonb_build_object('apply_to_total',false,'snapshot',
   jsonb_build_object('rules_version','tf-commission-v2','inputs','{}'::jsonb,'result',jsonb_build_object('netCommission',240,'totalCollected',1400))));
 select version into rev from public.crm_commission_overview where trip_id=t;
 assert (select commission_state='awaiting' and commission_to_receive is null from public.crm_commission_overview where trip_id=t);
 begin
  perform public.crm_review_commission(t,rev,'commission_confirm',event_data || jsonb_build_object('document_id',other_doc));
  raise exception 'expected isolation rejection';
 exception when others then assert sqlerrm='document_mismatch',sqlerrm; end;
 perform public.crm_review_commission(t,rev,'commission_confirm',event_data);
 begin
  perform public.crm_review_commission(t,rev,'commission_confirm',event_data);
  raise exception 'expected stale revision rejection';
 exception when others then assert sqlerrm='finance_stale_version',sqlerrm; end;
 select version into rev from public.crm_commission_overview where trip_id=t;
 assert (select commission_state='confirmed' and commission_has_discrepancy from public.crm_commission_overview where trip_id=t);
 perform public.crm_finance_mutate(t,rev,'receipt_save',receipt_data);
 select version into rev from public.crm_commission_overview where trip_id=t;
 assert (select total_amount=1500 and commission_discrepancy=20 and commission_to_receive=40 and commission_balance=60
  and commission_state='partial' from public.crm_commission_overview where trip_id=t);
 assert public.crm_finance_reconciled_detail(t)->'reviews'->0->'document'->>'file_name' = 'Mapa fictício.pdf';
 begin
  perform public.crm_review_commission(t,rev,'commission_settle',event_data);
  raise exception 'expected outstanding confirmation rejection';
 exception when others then assert sqlerrm='commission_not_settled',sqlerrm; end;
 select id into movement from public.crm_payment_receipts where trip_id=t;
 begin
  perform public.crm_finance_mutate(t,rev,'receipt_delete',jsonb_build_object('id',movement));
  raise exception 'expected preserved movement';
 exception when others then assert sqlerrm='commission_movement_locked',sqlerrm; end;
 perform public.crm_finance_mutate(t,rev,'receipt_save',receipt_data || '{"amount":40}');
 select version into rev from public.crm_commission_overview where trip_id=t;
 assert (select commission_state='received' and commission_has_discrepancy from public.crm_commission_overview where trip_id=t);
 perform public.crm_review_commission(t,rev,'commission_settle',event_data);
 select version into rev from public.crm_commission_overview where trip_id=t;
 assert (select commission_state='settled' and commission_has_discrepancy from public.crm_commission_overview where trip_id=t);
 perform public.crm_finance_mutate(t,rev,'receipt_save',receipt_data || '{"kind":"commission_refund","amount":10,"notes":"Estorno de teste"}');
 assert (select commission_state='partial' and commission_to_receive=10 from public.crm_commission_overview where trip_id=t);
 assert (select count(*)=2 from public.crm_commission_reviews where trip_id=t);
 assert not has_table_privilege('anon','public.crm_commission_overview','select');
 assert not has_function_privilege('authenticated','public.crm_review_commission(uuid,integer,text,jsonb)','execute');
 set local role service_role;
 assert (select commission_net=210 from public.crm_commission_overview where trip_id=t);
end; $$;
rollback;
