begin;

alter table public.crm_trip_finance
 add column manual_commission_amount numeric(12,2) check(manual_commission_amount >= 0),
 add column manual_commission_notes text,
 add constraint crm_manual_commission_reason check(
  (manual_commission_amount is null and manual_commission_notes is null)
  or (manual_commission_amount is not null and char_length(btrim(manual_commission_notes)) between 1 and 2000 and manual_commission_notes is not null)
 );

create or replace view public.crm_trip_finance_overview as
 with receipts as(
 select trip_id,
 sum(case when kind='customer_payment' then amount else 0 end) as customer_received,
 sum(case when kind='customer_refund' then amount else 0 end) as customer_refunded,
 sum(case when kind='commission_payment' then amount else 0 end) as commission_received,
 sum(case when kind='commission_refund' then amount else 0 end) as commission_refunded
 from public.crm_payment_receipts group by trip_id
 ), plan as(
 select trip_id,sum(amount_after_discount) as scheduled_total,
 sum(case when due_on<(now() at time zone 'Europe/Lisbon')::date then amount_remaining else 0 end) as overdue_amount,
 count(*) filter(where amount_remaining>0 and due_on<(now() at time zone 'Europe/Lisbon')::date) as overdue_count,
 sum(case when due_on between (now() at time zone 'Europe/Lisbon')::date and (now() at time zone 'Europe/Lisbon')::date+7 then amount_remaining else 0 end) as due_soon_amount,
 min(due_on) filter(where amount_remaining>0) as next_due_on
 from public.crm_payment_deadlines group by trip_id
 )
 select t.id as trip_id,t.destination,t.reference,t.status,t.currency,t.total_amount,t.client_id,c.full_name as client_name,
 coalesce(r.customer_received,0) as customer_received,coalesce(r.customer_refunded,0) as customer_refunded,
 coalesce(r.customer_received,0)-coalesce(r.customer_refunded,0) as customer_net,
 t.total_amount-coalesce(d.applied_total,0)-(coalesce(r.customer_received,0)-coalesce(r.customer_refunded,0)) as balance,
 coalesce(p.scheduled_total,0) as scheduled_total,t.total_amount-coalesce(d.applied_total,0)-coalesce(p.scheduled_total,0) as unscheduled_amount,
 coalesce(p.overdue_amount,0) as overdue_amount,coalesce(p.overdue_count,0) as overdue_count,
 coalesce(p.due_soon_amount,0) as due_soon_amount,p.next_due_on,
 coalesce(r.commission_received,0)-coalesce(r.commission_refunded,0) as commission_net,
 coalesce(f.manual_commission_amount,(f.commission_snapshot->'result'->>'netCommission')::numeric)-coalesce(d.commission_total,0) as commission_expected,
 coalesce(f.manual_commission_amount,(f.commission_snapshot->'result'->>'netCommission')::numeric)-coalesce(d.commission_total,0)-(coalesce(r.commission_received,0)-coalesce(r.commission_refunded,0)) as commission_balance,
 coalesce(f.version,0) as version, t.archived_at,
 t.total_amount-coalesce(d.applied_total,0) as payable_total,
 coalesce(d.participant_total,0) as participant_discount,coalesce(d.customer_total,0) as customer_discount,
 coalesce(d.applied_total,0) as applied_discount,coalesce(d.commission_total,0) as commission_discount
 from public.crm_trips t left join receipts r on r.trip_id=t.id left join plan p on p.trip_id=t.id
 left join public.crm_trip_discount_totals d on d.trip_id=t.id
 left join public.crm_trip_finance f on f.trip_id=t.id left join public.crm_clients c on c.id=t.client_id;


create or replace function public.crm_finance_reconciled_detail(p_trip_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.crm_finance_detail(p_trip_id) || jsonb_build_object(
  'summary',to_jsonb(o),
  'manual_commission',(select case when manual_commission_amount is not null then jsonb_build_object('amount',manual_commission_amount,'notes',manual_commission_notes) end from public.crm_trip_finance where trip_id=p_trip_id),
  'discounts',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc,d.id)
    from public.crm_trip_discounts d where d.trip_id=p_trip_id and d.reversed_at is null),'[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('document',
    case when d.id is not null then jsonb_build_object('file_name',d.file_name,'drive_file_id',d.drive_file_id) end) order by r.id desc)
    from public.crm_commission_reviews r left join public.crm_drive_files d on d.id=r.document_id where r.trip_id=p_trip_id),'[]'::jsonb)
 ) from public.crm_commission_overview o where o.trip_id=p_trip_id;
$$;
revoke all on function public.crm_finance_reconciled_detail(uuid) from public,anon,authenticated;
grant execute on function public.crm_finance_reconciled_detail(uuid) to service_role;


create function public.crm_set_manual_commission(p_trip_id uuid,p_version integer,p_amount numeric,p_notes text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare trip public.crm_trips; finance public.crm_trip_finance;
begin
 select * into trip from public.crm_trips where id=p_trip_id for update;
 if not found or trip.archived_at is not null then raise exception 'trip_not_found'; end if;
 insert into public.crm_trip_finance(trip_id) values(p_trip_id) on conflict do nothing;
 select * into finance from public.crm_trip_finance where trip_id=p_trip_id for update;
 if finance.version is distinct from p_version then raise exception 'finance_stale_version'; end if;
 if p_amount is not null and (
   not coalesce(p_amount between 0 and 9999999999.99,false)
   or p_amount<>round(p_amount,2)
   or nullif(btrim(p_notes),'') is null or char_length(p_notes)>2000
 ) then raise exception 'invalid_commission'; end if;
 update public.crm_trip_finance
 set manual_commission_amount=p_amount,
  manual_commission_notes=case when p_amount is not null then btrim(p_notes) end,
  version=version+1,updated_at=now()
 where trip_id=p_trip_id;
end; $$;
revoke all on function public.crm_set_manual_commission(uuid,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.crm_set_manual_commission(uuid,integer,numeric,text) to service_role;

commit;
