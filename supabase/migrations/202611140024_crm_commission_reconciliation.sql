begin;

create table public.crm_commission_reviews(
 id bigint generated always as identity primary key,
 trip_id uuid not null references public.crm_trips(id) on delete restrict,
 kind text not null check(kind in('confirmation','settlement')),
 amount numeric(12,2) not null check(amount>=0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 effective_on date not null,
 reference text not null check(char_length(btrim(reference)) between 1 and 160),
 notes text check(char_length(notes)<=2000),
 document_id uuid references public.crm_drive_files(id) on delete restrict,
 estimated_at_settlement numeric(12,2),
 received_at_settlement numeric,
 movement_count_at_settlement bigint,
 created_at timestamptz not null default now(),
 check(kind<>'settlement' or (document_id is not null and nullif(btrim(notes),'') is not null and received_at_settlement is not distinct from amount and movement_count_at_settlement is not null))
);
create index crm_commission_reviews_trip_kind_idx on public.crm_commission_reviews(trip_id,kind,id desc);
alter table public.crm_commission_reviews enable row level security;
revoke all on public.crm_commission_reviews from public,anon,authenticated,service_role;
grant select on public.crm_commission_reviews to service_role;

create view public.crm_commission_overview with(security_invoker=true) as
 select f.*,t.operator,t.departure_date,t.return_date,t.client_id as traveler_id,
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
  end as commission_state
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

create function public.crm_finance_reconciled_detail(p_trip_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.crm_finance_detail(p_trip_id) || jsonb_build_object(
  'summary',to_jsonb(o),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('document',
    case when d.id is not null then jsonb_build_object('file_name',d.file_name,'drive_file_id',d.drive_file_id) end) order by r.id desc)
    from public.crm_commission_reviews r left join public.crm_drive_files d on d.id=r.document_id where r.trip_id=p_trip_id),'[]'::jsonb)
 ) from public.crm_commission_overview o where o.trip_id=p_trip_id;
$$;
revoke all on function public.crm_finance_reconciled_detail(uuid) from public,anon,authenticated;
grant execute on function public.crm_finance_reconciled_detail(uuid) to service_role;

create function public.crm_review_commission(p_trip_id uuid,p_version integer,p_action text,p_data jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.crm_trips; overview public.crm_commission_overview; doc uuid; kind text; amount numeric; event_id bigint;
begin
 select * into t from public.crm_trips where id=p_trip_id for update;
 if not found or t.archived_at is not null then raise exception 'trip_not_found'; end if;
 select * into overview from public.crm_commission_overview where trip_id=p_trip_id;
 if overview.version is distinct from p_version then raise exception 'finance_stale_version'; end if;
 doc:=nullif(p_data->>'document_id','')::uuid;
 if doc is not null and not exists (
  select 1 from public.crm_drive_files d where d.id=doc and
   (d.trip_id=p_trip_id or d.client_id=t.client_id or exists(select 1 from public.crm_trip_clients c where c.trip_id=p_trip_id and c.client_id=d.client_id))
 ) then raise exception 'document_mismatch'; end if;
 if (p_data->>'effective_on')::date>(now() at time zone 'Europe/Lisbon')::date then raise exception 'payment_future_receipt'; end if;
 if p_action='commission_confirm' then
  kind:='confirmation';
  amount:=(p_data->>'amount')::numeric;
  if overview.commission_confirmed is not null and nullif(btrim(p_data->>'notes'),'') is null then raise exception 'commission_reason_required'; end if;
 elsif p_action='commission_settle' then
  kind:='settlement';amount:=overview.commission_confirmed;
  if amount is null or overview.commission_to_receive<>0 or overview.commission_state='settled' then raise exception 'commission_not_settled'; end if;
 else raise exception 'invalid_finance_action';
 end if;
 insert into public.crm_commission_reviews(trip_id,kind,amount,currency,effective_on,reference,notes,document_id,estimated_at_settlement,received_at_settlement,movement_count_at_settlement)
 values(p_trip_id,kind,amount,t.currency,(p_data->>'effective_on')::date,btrim(p_data->>'reference'),
  nullif(btrim(p_data->>'notes'),''),doc,
  case when kind='settlement' then overview.commission_expected end,
  case when kind='settlement' then overview.commission_net end,
  case when kind='settlement' then (select count(*) from public.crm_payment_receipts r where r.trip_id=p_trip_id and r.kind in('commission_payment','commission_refund')) end)
 returning id into event_id;
 insert into public.crm_trip_finance(trip_id,version) values(p_trip_id,1)
 on conflict(trip_id) do update set version=crm_trip_finance.version+1,updated_at=now();
 insert into public.crm_activity(entity_type,entity_id,client_id,lead_id,trip_id,actor,action,label,details)
 values('payment',p_trip_id,t.client_id,t.lead_id,p_trip_id,'admin',kind,
  case when kind='confirmation' then 'Confirmação de comissão da agência' else 'Regularização de comissão' end,
  jsonb_build_object('review_id',event_id));
end; $$;
revoke all on function public.crm_review_commission(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_review_commission(uuid,integer,text,jsonb) to service_role;

create function public.crm_keep_commission_movement()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.kind in('commission_payment','commission_refund') then raise exception 'commission_movement_locked'; end if;
 if tg_op='UPDATE' and new.kind in('commission_payment','commission_refund') then raise exception 'commission_movement_locked'; end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function public.crm_keep_commission_movement() from public,anon,authenticated;
create trigger crm_commission_movement_immutable before update or delete on public.crm_payment_receipts
 for each row execute function public.crm_keep_commission_movement();

create function public.crm_guard_commission_review()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and old.currency is not distinct from new.currency then return new; end if;
 if exists(select 1 from public.crm_commission_reviews where trip_id=old.id) then
  if tg_op='DELETE' then raise exception 'trip_has_finance'; end if;
  raise exception 'finance_currency_locked';
 end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function public.crm_guard_commission_review() from public,anon,authenticated;
create trigger crm_commission_review_trip_guard before delete or update of currency on public.crm_trips
 for each row execute function public.crm_guard_commission_review();

commit;
