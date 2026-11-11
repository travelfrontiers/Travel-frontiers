begin;

alter table public.crm_leads
  add column archived_at timestamptz,
  add column travel_period text check (char_length(btrim(travel_period)) between 3 and 120);
alter table public.crm_trips add column archived_at timestamptz;

-- Keep the proposal link intact even if it is created while a deletion is in progress.
alter table public.crm_proposals
  drop constraint crm_proposals_lead_id_fkey,
  add constraint crm_proposals_lead_id_fkey foreign key (lead_id)
    references public.crm_leads(id) on delete restrict;

create function public.crm_guard_record_deletion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'crm_leads' then
    if exists (select 1 from public.crm_trips where lead_id = old.id)
       or exists (select 1 from public.crm_proposals where lead_id = old.id) then
      raise exception 'lead_has_links';
    end if;
  elsif exists (select 1 from public.crm_payment_schedule where trip_id = old.id)
     or exists (select 1 from public.crm_payment_receipts where trip_id = old.id)
     or exists (select 1 from public.crm_trip_finance where trip_id = old.id and commission_snapshot is not null) then
    raise exception 'trip_has_finance';
  end if;
  return old;
end;
$$;

revoke all on function public.crm_guard_record_deletion() from public, anon, authenticated;

create trigger crm_guard_lead_deletion before delete on public.crm_leads
  for each row execute function public.crm_guard_record_deletion();
create trigger crm_guard_trip_deletion before delete on public.crm_trips
  for each row execute function public.crm_guard_record_deletion();

create or replace function public.crm_submit_public_request(p_client_hash text, p_request_hash text, p_lead jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare limits public.crm_form_limits%rowtype; total_limits public.crm_form_limits%rowtype;
begin
 if p_client_hash !~ '^[a-f0-9]{64}$' or p_request_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('crm-form-global',0));
 delete from public.crm_form_limits where day_start < now()-interval '2 days';
 delete from public.crm_form_dedup where created_at < now()-interval '10 minutes';
 if exists(select 1 from public.crm_form_dedup where request_hash=p_request_hash) then return jsonb_build_object('duplicate',true); end if;
 insert into public.crm_form_limits(bucket) values(p_client_hash),('global') on conflict do nothing;
 select * into limits from public.crm_form_limits where bucket=p_client_hash for update;
 select * into total_limits from public.crm_form_limits where bucket='global' for update;
 if limits.hour_start <= now()-interval '1 hour' then limits.hour_start:=now(); limits.hour_count:=0; end if;
 if limits.day_start <= now()-interval '1 day' then limits.day_start:=now(); limits.day_count:=0; end if;
 if total_limits.day_start <= now()-interval '1 day' then total_limits.day_start:=now(); total_limits.day_count:=0; end if;
 if limits.hour_count >= 5 or limits.day_count >= 15 or total_limits.day_count >= 250 then raise exception 'rate_limited'; end if;
 if coalesce((p_lead->>'consent_privacy')::boolean,false) <> true or
    p_lead->>'budget' not in ('under_500','500_1000','1000_1500','1500_2000','over_2000','undecided') then raise exception 'invalid_request'; end if;
 insert into public.crm_leads(full_name,email,language,phone,destination,departure_date,return_date,date_flexible,travel_period,adults,children_ages,travel_style,budget,notes,consent_privacy,privacy_consent_at,status,source)
 values(p_lead->>'full_name',p_lead->>'email',p_lead->>'language',p_lead->>'phone',p_lead->>'destination',
 nullif(p_lead->>'departure_date','')::date,nullif(p_lead->>'return_date','')::date,
 (p_lead->>'date_flexible')::boolean,nullif(btrim(p_lead->>'travel_period'),''),(p_lead->>'adults')::smallint,
 array(select jsonb_array_elements_text(p_lead->'children_ages')::smallint),
 p_lead->>'travel_style',p_lead->>'budget',p_lead->>'notes',true,now(),'new','public_form');
 update public.crm_form_limits set hour_start=limits.hour_start,hour_count=limits.hour_count+1,
 day_start=limits.day_start,day_count=limits.day_count+1 where bucket=p_client_hash;
 update public.crm_form_limits set day_start=total_limits.day_start,day_count=total_limits.day_count+1 where bucket='global';
 insert into public.crm_form_dedup(request_hash) values(p_request_hash);
 return jsonb_build_object('duplicate',false);
end; $$;

create or replace function public.crm_delete_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_trip record;
  replacement_client_id uuid;
begin
  if not exists (select 1 from public.crm_clients where id = p_client_id) then
    raise exception 'client_not_found';
  end if;

  -- Keep each trip's primary client when another traveller remains linked.
  for linked_trip in
    select id from public.crm_trips where client_id = p_client_id
  loop
    select relation.client_id into replacement_client_id
    from public.crm_trip_clients as relation
    where relation.trip_id = linked_trip.id and relation.client_id <> p_client_id
    order by relation.created_at asc, relation.client_id asc
    limit 1;

    update public.crm_trips
    set client_id = replacement_client_id, updated_at = now()
    where id = linked_trip.id;
  end loop;

  -- Retain an anonymous opportunity record while removing its personal details.
  update public.crm_leads
  set client_id = null,
      full_name = 'Cliente removido',
      email = 'removed-' || id::text || '@privacy.invalid',
      phone = null,
      destination = null,
      departure_date = null,
      return_date = null,
      date_flexible = false,
      travel_period = null,
      adults = 1,
      children_ages = '{}',
      travel_style = null,
      budget = null,
      notes = null,
      internal_notes = null,
      follow_up_date = null,
      lost_reason = null,
      status = 'lost',
      updated_at = now()
  where client_id = p_client_id;

  -- Documents and client links cascade; trip records/tasks stay operational.
  delete from public.crm_clients where id = p_client_id;
end;
$$;


create or replace function public.crm_claim_checkin_reminders(p_token uuid)
returns table(id uuid, title text, trip_id uuid, destination text, due_at timestamptz)
language sql security definer set search_path=public,pg_temp as $$
 with selected as (
  select task.id from public.crm_trip_tasks task
  join public.crm_trips trip on trip.id=task.trip_id
  join public.crm_trip_services service on service.id=task.source_service_id
  where not task.completed and task.reminder_sent_at is null and task.due_at<=now()
   and (task.reminder_claimed_at is null or task.reminder_claimed_at < now()-interval '30 minutes')
   and trip.archived_at is null and trip.status in ('planning','confirmed','travelling') and service.starts_on >= current_date
  order by task.due_at limit 50 for update of task skip locked
 ), claimed as (
  update public.crm_trip_tasks task set reminder_claimed_at=now(),reminder_claim_token=p_token
  from selected where task.id=selected.id returning task.*
 )
 select claimed.id,claimed.title,claimed.trip_id,trip.destination,claimed.due_at
 from claimed join public.crm_trips trip on trip.id=claimed.trip_id;
$$;

create or replace view public.crm_payment_deadlines as
 with net as(
 select trip_id,sum(case when kind='customer_payment' then amount when kind='customer_refund' then -amount else 0 end) as paid
 from public.crm_payment_receipts group by trip_id
 ), planned as(
 select s.*,coalesce(sum(s.amount) over(partition by s.trip_id order by s.due_on,s.sort_order,s.created_at,s.id rows between unbounded preceding and 1 preceding),0) as previous_amount
 from public.crm_payment_schedule s
 )
 select p.*,t.destination,t.reference,t.status,t.currency,t.client_id,
 array(select tc.client_id from public.crm_trip_clients tc where tc.trip_id=p.trip_id) as client_ids,
 greatest(0,p.amount-greatest(0,coalesce(n.paid,0)-p.previous_amount)) as amount_remaining, t.archived_at
 from planned p join public.crm_trips t on t.id=p.trip_id left join net n on n.trip_id=p.trip_id;

create or replace view public.crm_trip_finance_overview as
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
 coalesce(f.version,0) as version, t.archived_at
 from public.crm_trips t left join receipts r on r.trip_id=t.id left join plan p on p.trip_id=t.id
 left join public.crm_trip_finance f on f.trip_id=t.id left join public.crm_clients c on c.id=t.client_id;

commit;
