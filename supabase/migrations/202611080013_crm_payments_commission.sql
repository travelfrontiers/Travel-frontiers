begin;
create table public.crm_trip_finance(
 trip_id uuid primary key references public.crm_trips(id) on delete cascade,
 version integer not null default 0 check(version>=0),
 commission_snapshot jsonb, updated_at timestamptz not null default now()
);
create table public.crm_payment_schedule(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.crm_trips(id) on delete cascade,
 label text not null check(char_length(btrim(label)) between 1 and 160),
 amount numeric(12,2) not null check(amount between 0.01 and 9999999999.99),
 due_on date not null,sort_order integer not null default 100,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index crm_payment_schedule_trip_idx on public.crm_payment_schedule(trip_id,due_on);
create table public.crm_payment_receipts(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.crm_trips(id) on delete cascade,
 kind text not null check(kind in('customer_payment','customer_refund','commission_payment','commission_refund')),
 amount numeric(12,2) not null check(amount between 0.01 and 9999999999.99),paid_on date not null,
 received_by text not null check(received_by in('agency','consultant')),
 method text not null check(method in('transfer','card','cash','other')),
 reference text check(char_length(reference)<=160),notes text check(char_length(notes)<=2000),
 document_id uuid references public.crm_drive_files(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index crm_payment_receipts_trip_idx on public.crm_payment_receipts(trip_id,paid_on);
alter table public.crm_trip_finance enable row level security;
alter table public.crm_payment_schedule enable row level security;
alter table public.crm_payment_receipts enable row level security;
revoke all on public.crm_trip_finance,public.crm_payment_schedule,public.crm_payment_receipts from public,anon,authenticated,service_role;
grant select on public.crm_trip_finance,public.crm_payment_schedule,public.crm_payment_receipts to service_role;

create view public.crm_payment_deadlines as
 with net as(
 select trip_id,sum(case when kind='customer_payment' then amount when kind='customer_refund' then -amount else 0 end) as paid
 from public.crm_payment_receipts group by trip_id
 ), planned as(
 select s.*,coalesce(sum(s.amount) over(partition by s.trip_id order by s.due_on,s.sort_order,s.created_at,s.id rows between unbounded preceding and 1 preceding),0) as previous_amount
 from public.crm_payment_schedule s
 )
 select p.*,t.destination,t.reference,t.status,t.currency,t.client_id,
 array(select tc.client_id from public.crm_trip_clients tc where tc.trip_id=p.trip_id) as client_ids,
 greatest(0,p.amount-greatest(0,coalesce(n.paid,0)-p.previous_amount)) as amount_remaining
 from planned p join public.crm_trips t on t.id=p.trip_id left join net n on n.trip_id=p.trip_id;

create view public.crm_trip_finance_overview as
 with receipts as(
 select trip_id,
 sum(case when kind='customer_payment' then amount else 0 end) as customer_received,
 sum(case when kind='customer_refund' then amount else 0 end) as customer_refunded,
 sum(case when kind='commission_payment' then amount else 0 end) as commission_received,
 sum(case when kind='commission_refund' then amount else 0 end) as commission_refunded
 from public.crm_payment_receipts group by trip_id
 ), plan as(
 select trip_id,sum(amount) as scheduled_total,
 sum(case when due_on<(now() at time zone 'Europe/Lisbon')::date then amount_remaining else 0 end) as overdue_amount,
 count(*) filter(where amount_remaining>0 and due_on<(now() at time zone 'Europe/Lisbon')::date) as overdue_count,
 sum(case when due_on between (now() at time zone 'Europe/Lisbon')::date and (now() at time zone 'Europe/Lisbon')::date+7 then amount_remaining else 0 end) as due_soon_amount,
 min(due_on) filter(where amount_remaining>0) as next_due_on
 from public.crm_payment_deadlines group by trip_id
 )
 select t.id as trip_id,t.destination,t.reference,t.status,t.currency,t.total_amount,t.client_id,c.full_name as client_name,
 coalesce(r.customer_received,0) as customer_received,coalesce(r.customer_refunded,0) as customer_refunded,
 coalesce(r.customer_received,0)-coalesce(r.customer_refunded,0) as customer_net,
 t.total_amount-(coalesce(r.customer_received,0)-coalesce(r.customer_refunded,0)) as balance,
 coalesce(p.scheduled_total,0) as scheduled_total,t.total_amount-coalesce(p.scheduled_total,0) as unscheduled_amount,
 coalesce(p.overdue_amount,0) as overdue_amount,coalesce(p.overdue_count,0) as overdue_count,
 coalesce(p.due_soon_amount,0) as due_soon_amount,p.next_due_on,
 coalesce(r.commission_received,0)-coalesce(r.commission_refunded,0) as commission_net,
 (f.commission_snapshot->'result'->>'netCommission')::numeric as commission_expected,
 (f.commission_snapshot->'result'->>'netCommission')::numeric-(coalesce(r.commission_received,0)-coalesce(r.commission_refunded,0)) as commission_balance,
 coalesce(f.version,0) as version
 from public.crm_trips t left join receipts r on r.trip_id=t.id left join plan p on p.trip_id=t.id
 left join public.crm_trip_finance f on f.trip_id=t.id left join public.crm_clients c on c.id=t.client_id;
revoke all on public.crm_payment_deadlines,public.crm_trip_finance_overview from public,anon,authenticated;
grant select on public.crm_payment_deadlines,public.crm_trip_finance_overview to service_role;

create function public.crm_guard_trip_finance()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.currency is distinct from old.currency and (
 exists(select 1 from public.crm_payment_receipts where trip_id=new.id) or
 exists(select 1 from public.crm_payment_schedule where trip_id=new.id) or
 exists(select 1 from public.crm_trip_finance where trip_id=new.id and commission_snapshot is not null))
 then raise exception 'finance_currency_locked'; end if;
 if exists(select 1 from public.crm_payment_schedule where trip_id=new.id) and
 (new.total_amount is null or new.total_amount<(select sum(amount) from public.crm_payment_schedule where trip_id=new.id))
 then raise exception 'payment_plan_exceeds_total'; end if;
 if new.total_amount is null and exists(select 1 from public.crm_payment_receipts where trip_id=new.id and kind in('customer_payment','customer_refund')) then raise exception 'payment_total_required'; end if;
 return new;
end; $$;
create trigger crm_trip_finance_guard before update of total_amount,currency on public.crm_trips for each row execute function public.crm_guard_trip_finance();

create function public.crm_invalidate_finance_version()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.total_amount,new.currency,new.adults,new.children_count) is distinct from
    (old.total_amount,old.currency,old.adults,old.children_count) then
   insert into public.crm_trip_finance(trip_id,version) values(new.id,1)
   on conflict(trip_id) do update set version=crm_trip_finance.version+1,updated_at=now();
 end if;
 return new;
end; $$;
create trigger crm_trip_finance_version after update of total_amount,currency,adults,children_count on public.crm_trips
for each row execute function public.crm_invalidate_finance_version();

create function public.crm_finance_mutate(p_trip_id uuid,p_expected_version integer,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare tr public.crm_trips%rowtype; finance public.crm_trip_finance%rowtype;
 rid uuid; deposit numeric; total_planned numeric; customer_net numeric; commission_net numeric; doc_id uuid;
begin
 select * into tr from public.crm_trips where id=p_trip_id for update;
 if not found then raise exception 'trip_not_found'; end if;
 insert into public.crm_trip_finance(trip_id) values(p_trip_id) on conflict do nothing;
 select * into finance from public.crm_trip_finance where trip_id=p_trip_id for update;
 if finance.version is distinct from p_expected_version then raise exception 'finance_stale_version'; end if;
 rid:=nullif(p_data->>'id','')::uuid;
 if p_action='total_save' then
  update public.crm_trips set total_amount=(p_data->>'amount')::numeric,updated_at=now()
  where id=p_trip_id returning * into tr;
 elsif p_action='schedule_save' then
  if tr.total_amount is null or tr.total_amount<=0 then raise exception 'payment_total_required'; end if;
  if rid is null then
   insert into public.crm_payment_schedule(trip_id,label,amount,due_on) values(p_trip_id,btrim(p_data->>'label'),(p_data->>'amount')::numeric,(p_data->>'due_on')::date);
  else
   update public.crm_payment_schedule set label=btrim(p_data->>'label'),amount=(p_data->>'amount')::numeric,due_on=(p_data->>'due_on')::date,updated_at=now() where id=rid and trip_id=p_trip_id;
   if not found then raise exception 'payment_not_found'; end if;
  end if;
 elsif p_action='schedule_delete' then
  delete from public.crm_payment_schedule where id=rid and trip_id=p_trip_id;
  if not found then raise exception 'payment_not_found'; end if;
 elsif p_action='build_plan' then
  if exists(select 1 from public.crm_payment_schedule where trip_id=p_trip_id) then raise exception 'payment_plan_exists'; end if;
  deposit:=(p_data->>'deposit_amount')::numeric;
  if tr.total_amount is null or tr.total_amount<=0 then raise exception 'payment_total_required'; end if;
  if deposit is null or deposit<0 or deposit>tr.total_amount then raise exception 'invalid_deposit'; end if;
  if deposit>0 then insert into public.crm_payment_schedule(trip_id,label,amount,due_on,sort_order) values(p_trip_id,'Sinal',deposit,(p_data->>'deposit_due_on')::date,10); end if;
  if deposit<tr.total_amount then insert into public.crm_payment_schedule(trip_id,label,amount,due_on,sort_order) values(p_trip_id,case when deposit=0 then 'Pagamento total' else 'Restante valor' end,tr.total_amount-deposit,(p_data->>'balance_due_on')::date,20); end if;
  if deposit>0 and deposit<tr.total_amount and (p_data->>'balance_due_on')::date<(p_data->>'deposit_due_on')::date then raise exception 'invalid_payment_dates'; end if;
 elsif p_action='receipt_save' then
  if (p_data->>'paid_on')::date>(now() at time zone 'Europe/Lisbon')::date then raise exception 'payment_future_receipt'; end if;
  if p_data->>'kind' in('customer_payment','customer_refund') and tr.total_amount is null then raise exception 'payment_total_required'; end if;
  doc_id:=nullif(p_data->>'document_id','')::uuid;
  if doc_id is not null and not exists(select 1 from public.crm_drive_files d where d.id=doc_id and (d.trip_id=p_trip_id or d.client_id=tr.client_id or d.client_id in(select client_id from public.crm_trip_clients where trip_id=p_trip_id))) then raise exception 'document_mismatch'; end if;
  if rid is null then
   insert into public.crm_payment_receipts(trip_id,kind,amount,paid_on,received_by,method,reference,notes,document_id)
   values(p_trip_id,p_data->>'kind',(p_data->>'amount')::numeric,(p_data->>'paid_on')::date,p_data->>'received_by',p_data->>'method',nullif(btrim(p_data->>'reference'),''),nullif(btrim(p_data->>'notes'),''),doc_id);
  else
   update public.crm_payment_receipts set kind=p_data->>'kind',amount=(p_data->>'amount')::numeric,paid_on=(p_data->>'paid_on')::date,received_by=p_data->>'received_by',method=p_data->>'method',reference=nullif(btrim(p_data->>'reference'),''),notes=nullif(btrim(p_data->>'notes'),''),document_id=doc_id,updated_at=now() where id=rid and trip_id=p_trip_id;
   if not found then raise exception 'payment_not_found'; end if;
  end if;
 elsif p_action='receipt_delete' then
  delete from public.crm_payment_receipts where id=rid and trip_id=p_trip_id;
  if not found then raise exception 'payment_not_found'; end if;
 elsif p_action='commission_save' then
  if tr.currency<>'EUR' then raise exception 'commission_eur_only'; end if;
  if p_data->'snapshot'->>'rules_version' is distinct from 'tf-commission-v1'
    or jsonb_typeof(p_data->'snapshot'->'inputs') is distinct from 'object'
    or not coalesce((p_data->'snapshot'->'result'->>'netCommission')::numeric between 0 and 9999999999.99,false)
    or not coalesce((p_data->'snapshot'->'result'->>'totalCollected')::numeric between 0 and 9999999999.99,false)
  then raise exception 'invalid_commission'; end if;
  if coalesce((p_data->>'apply_to_total')::boolean,false) then
   update public.crm_trips set total_amount=(p_data->'snapshot'->'result'->>'totalCollected')::numeric,updated_at=now() where id=p_trip_id returning * into tr;
  end if;
  update public.crm_trip_finance set commission_snapshot=(p_data->'snapshot')||jsonb_build_object('saved_at',now(),'source',jsonb_build_object('total_amount',tr.total_amount,'currency',tr.currency,'adults',tr.adults,'children_count',tr.children_count)) where trip_id=p_trip_id;
 elsif p_action='commission_clear' then
  update public.crm_trip_finance set commission_snapshot=null where trip_id=p_trip_id;
 else raise exception 'invalid_finance_action';
 end if;
 select coalesce(sum(amount),0) into total_planned from public.crm_payment_schedule where trip_id=p_trip_id;
 if total_planned>coalesce(tr.total_amount,0) then raise exception 'payment_plan_exceeds_total'; end if;
 select coalesce(sum(case when kind='customer_payment' then amount when kind='customer_refund' then -amount else 0 end),0),
 coalesce(sum(case when kind='commission_payment' then amount when kind='commission_refund' then -amount else 0 end),0)
 into customer_net,commission_net from public.crm_payment_receipts where trip_id=p_trip_id;
 if customer_net<0 or commission_net<0 then raise exception 'refund_exceeds_received'; end if;
 update public.crm_trip_finance set version=version+1,updated_at=now() where trip_id=p_trip_id returning * into finance;
 return to_jsonb(finance);
end; $$;
revoke all on function public.crm_finance_mutate(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_finance_mutate(uuid,integer,text,jsonb) to service_role;

create function public.crm_record_finance_activity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare data jsonb;old_data jsonb:='{}'; fields text[]:='{}'; tid uuid;cid uuid;lid uuid; eid uuid;
begin
 if tg_op<>'INSERT' then old_data:=to_jsonb(old); end if;
 data:=case when tg_op='DELETE' then old_data else to_jsonb(new) end;
 if tg_op='UPDATE' then
 select coalesce(array_agg(key),'{}') into fields from jsonb_object_keys(data) as key where data->key is distinct from old_data->key and key not in('updated_at','version');
 if cardinality(fields)=0 then return new; end if;
 end if;
 tid:=(data->>'trip_id')::uuid;eid:=coalesce((data->>'id')::uuid,tid);
 select client_id,lead_id into cid,lid from public.crm_trips where id=tid;
 if not found then tid:=null; end if;
 if cid is not null and not exists(select 1 from public.crm_clients where id=cid) then cid:=null;end if;
 if lid is not null and not exists(select 1 from public.crm_leads where id=lid) then lid:=null;end if;
 insert into public.crm_activity(entity_type,entity_id,client_id,lead_id,trip_id,actor,action,label,changed_fields)
 values('payment',eid,cid,lid,tid,'admin',lower(tg_op),
 case tg_table_name when 'crm_trip_finance' then 'Cálculo de comissão' when 'crm_payment_schedule' then 'Prestação' else 'Movimento de pagamento' end ||
 case tg_op when 'INSERT' then ' registado' when 'UPDATE' then ' alterado' else ' removido' end,fields);
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger crm_finance_activity after update on public.crm_trip_finance for each row execute function public.crm_record_finance_activity();
create trigger crm_payment_schedule_activity after insert or update or delete on public.crm_payment_schedule for each row execute function public.crm_record_finance_activity();
create trigger crm_payment_receipt_activity after insert or update or delete on public.crm_payment_receipts for each row execute function public.crm_record_finance_activity();

create function public.crm_finance_detail(p_trip_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'summary',to_jsonb(o),
  'adults',t.adults,'children_count',t.children_count,
  'traveler_count',(select count(*) from public.crm_trip_clients tc where tc.trip_id=t.id),
  'commission',f.commission_snapshot,
  'schedule',coalesce((select jsonb_agg(to_jsonb(s) order by s.due_on,s.sort_order,s.created_at,s.id) from public.crm_payment_deadlines s where s.trip_id=t.id),'[]'::jsonb),
  'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.paid_on desc,r.created_at desc,r.id) from public.crm_payment_receipts r where r.trip_id=t.id),'[]'::jsonb),
  'files',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'file_name',d.file_name,'drive_file_id',d.drive_file_id) order by d.created_at desc)
   from public.crm_drive_files d where d.trip_id=t.id or d.client_id=t.client_id
   or d.client_id in(select tc.client_id from public.crm_trip_clients tc where tc.trip_id=t.id)
   or d.id in(select r.document_id from public.crm_payment_receipts r where r.trip_id=t.id)),'[]'::jsonb)
 )
 from public.crm_trips t join public.crm_trip_finance_overview o on o.trip_id=t.id
 left join public.crm_trip_finance f on f.trip_id=t.id where t.id=p_trip_id;
$$;
revoke all on function public.crm_finance_detail(uuid) from public,anon,authenticated;
grant execute on function public.crm_finance_detail(uuid) to service_role;
commit;
