begin;

create table public.crm_trip_discounts (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.crm_trips(id) on delete restrict,
 kind text not null check(kind in ('participant','customer')),
 amount numeric(12,2) not null check(amount > 0),
 charge_commission boolean not null default false check(kind = 'customer' or not charge_commission),
 included_in_total boolean not null default false,
 notes text check(char_length(notes) <= 2000),
 source_schedule_id uuid,
 source_receipt_id uuid,
 created_at timestamptz not null default now(),
 reversed_at timestamptz
);
create index crm_trip_discounts_trip_idx on public.crm_trip_discounts(trip_id);
alter table public.crm_trip_discounts enable row level security;
revoke all on public.crm_trip_discounts from public,anon,authenticated,service_role;
grant select on public.crm_trip_discounts to service_role;

create view public.crm_trip_discount_totals with(security_invoker=true) as
 select trip_id,
 sum(amount) filter(where kind='participant') as participant_total,
 sum(amount) filter(where kind='customer') as customer_total,
 sum(amount) filter(where not included_in_total) as applied_total,
 sum(amount) filter(where charge_commission) as commission_total
 from public.crm_trip_discounts where reversed_at is null group by trip_id;
revoke all on public.crm_trip_discount_totals from public,anon,authenticated,service_role;
grant select on public.crm_trip_discount_totals to service_role;

create or replace view public.crm_payment_deadlines as
 with net as(
 select trip_id,sum(case when kind='customer_payment' then amount when kind='customer_refund' then -amount else 0 end) as paid
 from public.crm_payment_receipts group by trip_id
 ), planned as(
 select s.*,coalesce(sum(s.amount) over(partition by s.trip_id order by s.due_on,s.sort_order,s.created_at,s.id rows between unbounded preceding and 1 preceding),0) as previous_amount
 from public.crm_payment_schedule s
 )
 , obligations as(
 select p.*,least(p.amount,greatest(0,t.total_amount-coalesce(d.applied_total,0)-p.previous_amount)) as amount_after_discount
 from planned p join public.crm_trips t on t.id=p.trip_id
 left join public.crm_trip_discount_totals d on d.trip_id=t.id
 )
 select p.id,p.trip_id,p.label,p.amount,p.due_on,p.sort_order,p.created_at,p.updated_at,p.previous_amount,t.destination,t.reference,t.status,t.currency,t.client_id,
 array(select tc.client_id from public.crm_trip_clients tc where tc.trip_id=p.trip_id) as client_ids,
 greatest(0,p.amount_after_discount-greatest(0,coalesce(n.paid,0)-p.previous_amount)) as amount_remaining, t.archived_at, p.amount_after_discount
 from obligations p join public.crm_trips t on t.id=p.trip_id left join net n on n.trip_id=p.trip_id;

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
 (f.commission_snapshot->'result'->>'netCommission')::numeric-coalesce(d.commission_total,0) as commission_expected,
 (f.commission_snapshot->'result'->>'netCommission')::numeric-coalesce(d.commission_total,0)-(coalesce(r.commission_received,0)-coalesce(r.commission_refunded,0)) as commission_balance,
 coalesce(f.version,0) as version, t.archived_at,
 t.total_amount-coalesce(d.applied_total,0) as payable_total,
 coalesce(d.participant_total,0) as participant_discount,coalesce(d.customer_total,0) as customer_discount,
 coalesce(d.applied_total,0) as applied_discount,coalesce(d.commission_total,0) as commission_discount
 from public.crm_trips t left join receipts r on r.trip_id=t.id left join plan p on p.trip_id=t.id
 left join public.crm_trip_discount_totals d on d.trip_id=t.id
 left join public.crm_trip_finance f on f.trip_id=t.id left join public.crm_clients c on c.id=t.client_id;


create or replace view public.crm_commission_overview with(security_invoker=true) as
 select f.trip_id,f.destination,f.reference,f.status,f.currency,f.total_amount,f.client_id,f.client_name,
  f.customer_received,f.customer_refunded,f.customer_net,f.balance,f.scheduled_total,f.unscheduled_amount,
  f.overdue_amount,f.overdue_count,f.due_soon_amount,f.next_due_on,f.commission_net,f.commission_expected,
  f.commission_balance,f.version,f.archived_at,t.operator,t.departure_date,t.return_date,t.client_id as traveler_id,
  array(select tc.client_id from public.crm_trip_clients tc where tc.trip_id=t.id) as traveler_ids,
  latest.amount as commission_confirmed,latest.effective_on as commission_confirmed_on,
  latest.amount-f.commission_net as commission_to_receive,
  f.commission_expected-latest.amount as commission_discrepancy,
  ((f.commission_expected is not null and latest.amount is not null and f.commission_expected<>latest.amount)
    or (latest.amount is not null and latest.amount<f.commission_net)) as commission_has_discrepancy,
  case
   when latest.amount is null and f.commission_expected is null then 'uncalculated'
   when latest.amount is null then 'awaiting'
   when settled.id>latest.id and settled.amount=latest.amount
     and settled.received_at_settlement=f.commission_net
     and settled.estimated_at_settlement is not distinct from f.commission_expected
     and settled.movement_count_at_settlement=(select count(*) from public.crm_payment_receipts r where r.trip_id=f.trip_id and r.kind in('commission_payment','commission_refund'))
    then 'settled'
   when f.commission_net>=latest.amount then 'received'
   when f.commission_net>0 then 'partial'
   else 'confirmed'
  end as commission_state,
  f.payable_total,f.participant_discount,f.customer_discount,f.applied_discount,f.commission_discount
 from public.crm_trip_finance_overview f join public.crm_trips t on t.id=f.trip_id
 left join lateral(
  select id,amount,effective_on from public.crm_commission_reviews r
  where r.trip_id=f.trip_id and r.kind='confirmation' order by id desc limit 1
 ) latest on true
 left join lateral(
  select id,amount,estimated_at_settlement,received_at_settlement,movement_count_at_settlement from public.crm_commission_reviews r
  where r.trip_id=f.trip_id and r.kind='settlement' order by id desc limit 1
 ) settled on true;
revoke all on public.crm_commission_overview from public,anon,authenticated,service_role;
grant select on public.crm_commission_overview to service_role;

create or replace function public.crm_finance_reconciled_detail(p_trip_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.crm_finance_detail(p_trip_id) || jsonb_build_object(
  'summary',to_jsonb(o),
  'discounts',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc,d.id)
    from public.crm_trip_discounts d where d.trip_id=p_trip_id and d.reversed_at is null),'[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('document',
    case when d.id is not null then jsonb_build_object('file_name',d.file_name,'drive_file_id',d.drive_file_id) end) order by r.id desc)
    from public.crm_commission_reviews r left join public.crm_drive_files d on d.id=r.document_id where r.trip_id=p_trip_id),'[]'::jsonb)
 ) from public.crm_commission_overview o where o.trip_id=p_trip_id;
$$;
revoke all on function public.crm_finance_reconciled_detail(uuid) from public,anon,authenticated;
grant execute on function public.crm_finance_reconciled_detail(uuid) to service_role;

create function public.crm_guard_trip_discounts()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare applied numeric;
begin
 select applied_total into applied from public.crm_trip_discount_totals where trip_id=new.id;
 if coalesce(applied,0)>0 and (new.total_amount is null or new.total_amount<applied) then
  raise exception 'discount_exceeds_total';
 end if;
 if new.currency is distinct from old.currency and exists(
  select 1 from public.crm_trip_discounts where trip_id=new.id and reversed_at is null
 ) then raise exception 'finance_currency_locked'; end if;
 return new;
end; $$;
create trigger crm_discount_guard before update of total_amount,currency on public.crm_trips
for each row execute function public.crm_guard_trip_discounts();

create function public.crm_mutate_trip_discount(p_trip_id uuid,p_version integer,p_action text,p_data jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
 trip public.crm_trips;
 movement public.crm_payment_receipts;
 discount_id uuid;
 schedule_id uuid:=nullif(p_data->>'source_schedule_id','')::uuid;
 receipt_id uuid:=nullif(p_data->>'source_receipt_id','')::uuid;
 kind text:=p_data->>'kind';
 discount_amount numeric:=(p_data->>'amount')::numeric;
 charge boolean:=coalesce((p_data->>'charge_commission')::boolean,false);
 included boolean:=coalesce((p_data->>'included_in_total')::boolean,false);
begin
 select * into trip from public.crm_trips where id=p_trip_id for update;
 if not found or trip.archived_at is not null then raise exception 'trip_not_found'; end if;
 if p_version is distinct from coalesce((select version from public.crm_trip_finance where trip_id=p_trip_id),0)
 then raise exception 'finance_stale_version'; end if;

 if p_action='discount_reverse' then
  update public.crm_trip_discounts set reversed_at=now()
  where id=(p_data->>'id')::uuid and trip_id=p_trip_id and reversed_at is null returning id into discount_id;
  if not found then raise exception 'discount_not_found'; end if;
 elsif p_action='discount_save' then
  if trip.total_amount is null then raise exception 'payment_total_required'; end if;
  if discount_amount is null or discount_amount<=0 or discount_amount>9999999999.99 or discount_amount<>round(discount_amount,2) or
    kind is null or kind not in ('participant','customer') or (charge and kind<>'customer') then
   raise exception 'invalid_discount';
  end if;
  if not included and discount_amount+coalesce((select applied_total from public.crm_trip_discount_totals where trip_id=p_trip_id),0)>trip.total_amount
  then raise exception 'discount_exceeds_total'; end if;

  if schedule_id is not null then
   delete from public.crm_payment_schedule where id=schedule_id and trip_id=p_trip_id and crm_payment_schedule.amount=discount_amount;
   if not found then raise exception 'discount_source_mismatch'; end if;
  end if;
  if receipt_id is not null then
   select * into movement from public.crm_payment_receipts
   where id=receipt_id and trip_id=p_trip_id and crm_payment_receipts.kind='customer_payment' for update;
   if not found or movement.amount<discount_amount then raise exception 'discount_source_mismatch'; end if;
   if discount_amount>coalesce((select sum(case when r.kind='customer_payment' then r.amount else -r.amount end)
      from public.crm_payment_receipts r where r.trip_id=p_trip_id and r.kind in('customer_payment','customer_refund')),0)
   then raise exception 'refund_exceeds_received'; end if;
   if discount_amount=movement.amount then
    delete from public.crm_payment_receipts where id=receipt_id;
   else
    update public.crm_payment_receipts set amount=movement.amount-discount_amount,updated_at=now() where id=receipt_id;
   end if;
  end if;
  insert into public.crm_trip_discounts(trip_id,kind,amount,charge_commission,included_in_total,notes,source_schedule_id,source_receipt_id)
  values(p_trip_id,kind,discount_amount,charge,included,nullif(btrim(p_data->>'notes'),''),schedule_id,receipt_id)
  returning id into discount_id;
 else raise exception 'invalid_finance_action';
 end if;

 insert into public.crm_trip_finance(trip_id,version) values(p_trip_id,1)
 on conflict(trip_id) do update set version=crm_trip_finance.version+1,updated_at=now();
 insert into public.crm_activity(entity_type,entity_id,client_id,lead_id,trip_id,actor,action,label,details)
 values('payment',discount_id,trip.client_id,trip.lead_id,p_trip_id,'admin',
  case when p_action='discount_reverse' then 'update' else 'insert' end,
  case when p_action='discount_reverse' then 'Desconto anulado'
       when receipt_id is not null or schedule_id is not null then 'Desconto reclassificado'
       when kind='participant' then 'Desconto de participante registado'
       else 'Desconto a clientes registado' end,
  jsonb_strip_nulls(jsonb_build_object('source_schedule_id',schedule_id,'source_receipt_id',receipt_id)));
end; $$;
revoke all on function public.crm_mutate_trip_discount(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_mutate_trip_discount(uuid,integer,text,jsonb) to service_role;

-- The calculator can still save the estimate while separate trip discounts are active.
do $$
declare
 definition text:=pg_get_functiondef('public.crm_finance_mutate(uuid,integer,text,jsonb)'::regprocedure);
 marker text:=$marker$if coalesce((p_data->>'apply_to_total')::boolean,false) then$marker$;
begin
 if position(marker in definition)=0 then raise exception 'commission_total_action_not_found'; end if;
 execute replace(definition,marker,marker || $guard$
  if exists(select 1 from public.crm_trip_discounts where trip_id=p_trip_id and reversed_at is null)
    and (coalesce((p_data->'snapshot'->'result'->>'potentialSaving')::numeric,0)>0
      or coalesce((p_data->'snapshot'->'result'->>'ceded')::numeric,0)>0) then
   raise exception 'discount_calculator_overlap';
  end if;$guard$);
end;
$$;

commit;
