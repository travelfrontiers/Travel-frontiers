-- Atomic trip saves, private Drive metadata, free form limits and check-in notifications.
begin;

create or replace function public.crm_update_trip(p_trip_id uuid, p_client_ids uuid[], p_fields jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare saved_trip public.crm_trips%rowtype; valid_clients integer;
begin
  if p_client_ids is null or cardinality(p_client_ids) not between 1 and 30 then raise exception 'client_required'; end if;
  select * into saved_trip from public.crm_trips where id = p_trip_id for update;
  if not found then raise exception 'trip_not_found'; end if;
  perform id from public.crm_clients where id = any(p_client_ids) for key share;
  get diagnostics valid_clients = row_count;
  if valid_clients <> (select count(distinct id) from unnest(p_client_ids) as id) then raise exception 'client_not_found'; end if;

  update public.crm_trips set
    client_id = p_client_ids[1], status = p_fields->>'status',
    destination = nullif(btrim(p_fields->>'destination'), ''),
    departure_date = nullif(p_fields->>'departure_date', '')::date,
    return_date = nullif(p_fields->>'return_date', '')::date,
    operator = nullif(btrim(p_fields->>'operator'), ''),
    adults = nullif(p_fields->>'adults', '')::smallint,
    children_count = nullif(p_fields->>'children_count', '')::smallint,
    total_amount = nullif(p_fields->>'total_amount', '')::numeric,
    currency = p_fields->>'currency', trip_notes = nullif(btrim(p_fields->>'trip_notes'), ''),
    updated_at = now()
  where id = p_trip_id returning * into saved_trip;
  delete from public.crm_trip_clients where trip_id = p_trip_id;
  insert into public.crm_trip_clients(trip_id, client_id)
    select p_trip_id, id from unnest(p_client_ids) as id on conflict do nothing;
  return to_jsonb(saved_trip) || jsonb_build_object('client_ids', to_jsonb(p_client_ids));
end; $$;
revoke all on function public.crm_update_trip(uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.crm_update_trip(uuid, uuid[], jsonb) to service_role;

create table if not exists public.crm_drive_files (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid references public.crm_trips(id) on delete cascade,
 client_id uuid references public.crm_clients(id) on delete cascade,
 drive_file_id text not null unique check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
 file_name text not null check(char_length(file_name) between 1 and 240),
 mime_type text not null check(char_length(mime_type) between 1 and 120),
 created_at timestamptz not null default now(),
 check ((trip_id is not null)::integer + (client_id is not null)::integer = 1)
);
alter table public.crm_drive_files enable row level security;
revoke all on public.crm_drive_files from anon, authenticated;
grant all on public.crm_drive_files to service_role;

create table if not exists public.crm_form_limits (
 bucket text primary key,
 hour_start timestamptz not null default now(),
 hour_count integer not null default 0,
 day_start timestamptz not null default now(),
 day_count integer not null default 0
);
create table if not exists public.crm_form_dedup (
 request_hash text primary key,
 created_at timestamptz not null default now()
);
alter table public.crm_form_limits enable row level security;
alter table public.crm_form_dedup enable row level security;
revoke all on public.crm_form_limits, public.crm_form_dedup from anon, authenticated;
grant all on public.crm_form_limits, public.crm_form_dedup to service_role;

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
 insert into public.crm_leads(full_name,email,language,phone,destination,departure_date,return_date,date_flexible,adults,children_ages,travel_style,budget,notes,consent_privacy,privacy_consent_at,status,source)
 values(p_lead->>'full_name',p_lead->>'email',p_lead->>'language',p_lead->>'phone',p_lead->>'destination',
 nullif(p_lead->>'departure_date','')::date,nullif(p_lead->>'return_date','')::date,
 (p_lead->>'date_flexible')::boolean,(p_lead->>'adults')::smallint,
 array(select jsonb_array_elements_text(p_lead->'children_ages')::smallint),
 p_lead->>'travel_style',p_lead->>'budget',p_lead->>'notes',true,now(),'new','public_form');
 update public.crm_form_limits set hour_start=limits.hour_start,hour_count=limits.hour_count+1,
 day_start=limits.day_start,day_count=limits.day_count+1 where bucket=p_client_hash;
 update public.crm_form_limits set day_start=total_limits.day_start,day_count=total_limits.day_count+1 where bucket='global';
 insert into public.crm_form_dedup(request_hash) values(p_request_hash);
 return jsonb_build_object('duplicate',false);
end; $$;
revoke all on function public.crm_submit_public_request(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.crm_submit_public_request(text,text,jsonb) to service_role;
-- Public INSERT is revoked by migration 011 after the new server route is live.

alter table public.crm_trip_tasks add column if not exists reminder_sent_at timestamptz;
alter table public.crm_trip_tasks add column if not exists reminder_claimed_at timestamptz;
alter table public.crm_trip_tasks add column if not exists reminder_claim_token uuid;

create or replace function public.crm_claim_checkin_reminders(p_token uuid)
returns table(id uuid, title text, trip_id uuid, destination text, due_at timestamptz)
language sql security definer set search_path=public,pg_temp as $$
 with selected as (
  select task.id from public.crm_trip_tasks task
  join public.crm_trips trip on trip.id=task.trip_id
  join public.crm_trip_services service on service.id=task.source_service_id
  where not task.completed and task.reminder_sent_at is null and task.due_at<=now()
   and (task.reminder_claimed_at is null or task.reminder_claimed_at < now()-interval '30 minutes')
   and trip.status in ('planning','confirmed','travelling') and service.starts_on >= current_date
  order by task.due_at limit 50 for update of task skip locked
 ), claimed as (
  update public.crm_trip_tasks task set reminder_claimed_at=now(),reminder_claim_token=p_token
  from selected where task.id=selected.id returning task.*
 )
 select claimed.id,claimed.title,claimed.trip_id,trip.destination,claimed.due_at
 from claimed join public.crm_trips trip on trip.id=claimed.trip_id;
$$;
create or replace function public.crm_finish_checkin_reminders(p_token uuid,p_sent boolean)
returns void language sql security definer set search_path=public,pg_temp as $$
 update public.crm_trip_tasks set reminder_sent_at=case when p_sent then now() else reminder_sent_at end,
 reminder_claimed_at=null,reminder_claim_token=null where reminder_claim_token=p_token;
$$;
revoke all on function public.crm_claim_checkin_reminders(uuid) from public,anon,authenticated;
revoke all on function public.crm_finish_checkin_reminders(uuid,boolean) from public,anon,authenticated;
grant execute on function public.crm_claim_checkin_reminders(uuid) to service_role;
grant execute on function public.crm_finish_checkin_reminders(uuid,boolean) to service_role;

create or replace function public.crm_reset_checkin_delivery()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.starts_on is distinct from new.starts_on then
  update public.crm_trip_tasks set reminder_sent_at=null,reminder_claimed_at=null,reminder_claim_token=null
  where source_service_id=new.id;
 end if;
 return new;
end; $$;
drop trigger if exists crm_reset_checkin_delivery on public.crm_trip_services;
create trigger crm_reset_checkin_delivery after update of starts_on on public.crm_trip_services
for each row execute function public.crm_reset_checkin_delivery();

commit;
