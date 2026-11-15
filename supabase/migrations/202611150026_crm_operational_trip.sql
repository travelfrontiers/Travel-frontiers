begin;

alter table public.crm_trips add column extra_references text
  check (char_length(extra_references) <= 1000);
alter table public.crm_proposals add column operational_imported_at timestamptz;
alter table public.crm_trip_services
  add column booking jsonb not null default '{}' check (jsonb_typeof(booking) = 'object' and octet_length(booking::text) <= 4096),
  add column departure_at timestamptz,
  add column arrival_at timestamptz,
  add column checkin_opens_at timestamptz;
alter table public.crm_trip_services drop constraint crm_trip_services_check;
alter table public.crm_trip_services add constraint crm_service_date_order
  check (service_type = 'flight' or starts_on is null or ends_on is null or ends_on >= starts_on);

create function public.crm_flight_instant(local_value timestamp, zone_name text)
returns timestamptz language plpgsql set search_path=public,pg_temp as $$
declare instant timestamptz;
begin
  if local_value is null or zone_name is null then return null; end if;
  if not exists(select from pg_timezone_names where name=zone_name) then
    raise exception 'invalid_flight_schedule';
  end if;
  instant := local_value at time zone zone_name;
  if instant at time zone zone_name <> local_value then raise exception 'invalid_flight_schedule'; end if;
  return instant;
end;
$$;

create function public.crm_set_flight_instants()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.departure_at := null;
  new.arrival_at := null;
  new.checkin_opens_at := null;
  if new.service_type <> 'flight' then return new; end if;
  new.departure_at := public.crm_flight_instant(new.starts_on + (new.booking->>'departure_time')::time,new.booking->>'departure_zone');
  new.arrival_at := public.crm_flight_instant(new.ends_on + (new.booking->>'arrival_time')::time,new.booking->>'arrival_zone');
  new.checkin_opens_at := public.crm_flight_instant((new.booking->>'checkin_local')::timestamp,new.booking->>'departure_zone');
  if new.arrival_at < new.departure_at or new.checkin_opens_at >= new.departure_at or
    (new.checkin_opens_at is not null and new.departure_at is null and
      new.checkin_opens_at at time zone (new.booking->>'departure_zone') >= (new.starts_on + interval '1 day')) then
    raise exception 'invalid_flight_schedule';
  end if;
  return new;
end;
$$;

create trigger crm_flight_instants before insert or update of booking,starts_on,ends_on,service_type
on public.crm_trip_services for each row execute function public.crm_set_flight_instants();

drop trigger crm_reset_checkin_delivery on public.crm_trip_services;

create or replace function public.crm_sync_flight_checkin_task()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare opening timestamptz;
begin
  if tg_op = 'DELETE' then return old; end if;
  if new.service_type = 'flight' and coalesce(new.booking->>'status','pending') <> 'cancelled' then
    opening := coalesce(new.checkin_opens_at,new.departure_at - interval '48 hours',
      (new.starts_on::timestamp - interval '2 days') at time zone 'Europe/Lisbon');
  end if;
  if opening is null then
    update public.crm_trip_tasks set due_at=null, reminder_sent_at=null,reminder_claimed_at=null,reminder_claim_token=null
    where source_service_id=new.id and due_at is not null;
    return new;
  end if;
  insert into public.crm_trip_tasks as task(trip_id,source_service_id,title,due_at,completed,sort_order)
  values(new.trip_id,new.id,'Check-in · ' || left(new.title,220),opening,false,5)
  on conflict(source_service_id) where source_service_id is not null do update set
    title=excluded.title, due_at=excluded.due_at,
    reminder_sent_at=case when task.due_at is distinct from excluded.due_at then null else task.reminder_sent_at end,
    reminder_claimed_at=case when task.due_at is distinct from excluded.due_at then null else task.reminder_claimed_at end,
    reminder_claim_token=case when task.due_at is distinct from excluded.due_at then null else task.reminder_claim_token end
  where task.title is distinct from excluded.title or task.due_at is distinct from excluded.due_at;
  return new;
end;
$$;

create function public.crm_import_trip_services(p_trip_id uuid,p_services jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare
  item jsonb;
  candidate public.crm_trip_services;
  matches uuid[];
  imported_count integer := 0;
begin
  perform id from public.crm_trips where id=p_trip_id for update;
  if not found then raise exception 'trip_not_found'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) loop
    candidate := jsonb_populate_record(null::public.crm_trip_services,item);
    select array_agg(s.id) into matches from public.crm_trip_services s
    where s.trip_id=p_trip_id and s.service_type=candidate.service_type
      and s.starts_on is not distinct from candidate.starts_on
      and s.ends_on is not distinct from candidate.ends_on
      and lower(btrim(s.title))=lower(btrim(candidate.title))
      and (s.booking->>'departure_time' is null or candidate.booking->>'departure_time' is null or
        s.booking->>'departure_time'=candidate.booking->>'departure_time')
      and (s.booking->>'arrival_time' is null or candidate.booking->>'arrival_time' is null or
        s.booking->>'arrival_time'=candidate.booking->>'arrival_time')
      and (s.reference is null or candidate.reference is null or lower(s.reference)=lower(candidate.reference))
      and (s.booking->>'pnr' is null or candidate.booking->>'pnr' is null or lower(s.booking->>'pnr')=lower(candidate.booking->>'pnr'));
    if cardinality(matches)=1 then
      -- Reviewed data fills blanks but never replaces confirmed operational data.
      update public.crm_trip_services s set
        booking=coalesce(candidate.booking,'{}'::jsonb)||s.booking,
        provider=coalesce(s.provider,nullif(btrim(candidate.provider),'')),
        reference=coalesce(s.reference,nullif(btrim(candidate.reference),'')),
        details=coalesce(s.details,nullif(btrim(candidate.details),'')),updated_at=now()
      where s.id=matches[1] and (
        s.booking is distinct from coalesce(candidate.booking,'{}'::jsonb)||s.booking or
        (s.provider is null and nullif(btrim(candidate.provider),'') is not null) or
        (s.reference is null and nullif(btrim(candidate.reference),'') is not null) or
        (s.details is null and nullif(btrim(candidate.details),'') is not null)
      );
      if found then imported_count:=imported_count+1; end if;
    end if;
    if cardinality(matches)>0 then continue; end if;
    insert into public.crm_trip_services(trip_id,service_type,title,provider,reference,starts_on,ends_on,details,booking)
    values(p_trip_id,candidate.service_type,btrim(candidate.title),nullif(btrim(candidate.provider),''),
      nullif(btrim(candidate.reference),''),candidate.starts_on,candidate.ends_on,nullif(btrim(candidate.details),''),
      coalesce(candidate.booking,'{}'::jsonb));
    imported_count := imported_count + 1;
  end loop;
  return imported_count;
end;
$$;

revoke all on function public.crm_import_trip_services(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.crm_import_trip_services(uuid,jsonb) to service_role;

create or replace function public.crm_create_trip_with_details(
  p_client_id uuid,
  p_reference text,
  p_destination text,
  p_departure_date date,
  p_return_date date,
  p_status text,
  p_operator text,
  p_adults smallint,
  p_children_count smallint,
  p_total_amount numeric,
  p_currency text,
  p_trip_notes text,
  p_services jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_trip_id uuid;
begin
  if not exists (select 1 from public.crm_clients where id = p_client_id) then
    raise exception 'client_not_found';
  end if;
  insert into public.crm_trips (
    client_id, reference, destination, departure_date, return_date, status,
    operator, adults, children_count, total_amount, currency, trip_notes
  ) values (
    p_client_id, nullif(btrim(p_reference), ''), nullif(btrim(p_destination), ''), p_departure_date, p_return_date, p_status,
    nullif(btrim(p_operator), ''), p_adults, p_children_count, p_total_amount, upper(p_currency), nullif(btrim(p_trip_notes), '')
  ) returning id into created_trip_id;

  perform public.crm_import_trip_services(created_trip_id,p_services);
  return created_trip_id;
end;
$$;

create or replace function public.crm_create_typed_trip(p_client_ids uuid[],p_data jsonb,p_services jsonb,p_travel_type text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare tid uuid;
begin
 if p_travel_type not in ('general','beach','circuit','city','honeymoon','family','business','custom') then raise exception 'invalid_travel_type'; end if;
 tid:=public.crm_create_trip_with_clients(p_client_ids,p_data->>'reference',p_data->>'destination',
 nullif(p_data->>'departure_date','')::date,nullif(p_data->>'return_date','')::date,p_data->>'status',
 p_data->>'operator',nullif(p_data->>'adults','')::smallint,nullif(p_data->>'children_count','')::smallint,
 nullif(p_data->>'total_amount','')::numeric,p_data->>'currency',p_data->>'trip_notes',p_services);
 update public.crm_trips set travel_type=p_travel_type,extra_references=nullif(btrim(p_data->>'extra_references'),'') where id=tid;
 return tid;
end; $$;
revoke all on function public.crm_create_typed_trip(uuid[],jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.crm_create_typed_trip(uuid[],jsonb,jsonb,text) to service_role;

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
    client_id = p_client_ids[1],
    reference = case when p_fields ? 'reference' then nullif(btrim(p_fields->>'reference'),'') else reference end,
    extra_references = case when p_fields ? 'extra_references' then p_fields->>'extra_references' else extra_references end,
    status = p_fields->>'status',
    travel_type = coalesce(nullif(p_fields->>'travel_type',''),travel_type),
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



create or replace function public.crm_proposal_to_trip(p_id uuid,p_version integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare prop public.crm_proposals%rowtype; ver public.crm_proposal_versions%rowtype; new_trip uuid;
begin
 select * into prop from public.crm_proposals where id=p_id for update;
 if not found then raise exception 'proposal_not_found'; end if;
 if prop.current_version is distinct from p_version then raise exception 'stale_version'; end if;
 if prop.status<>'accepted' then raise exception 'manual_confirmation_required'; end if;
 if prop.operational_imported_at is not null and prop.trip_id is not null then return prop.trip_id; end if;
 new_trip:=prop.trip_id;
 if prop.client_id is null then raise exception 'client_not_found'; end if;
 if new_trip is null and prop.lead_id is not null then
  perform id from public.crm_leads where id=prop.lead_id for update;
  select id into new_trip from public.crm_trips where lead_id=prop.lead_id;
 end if;
 select * into ver from public.crm_proposal_versions where proposal_id=p_id and version=p_version;
 if new_trip is null then
  insert into public.crm_trips(client_id,lead_id,destination,departure_date,return_date,status,operator,total_amount,currency,trip_notes,reference,adults,children_count)
  values(prop.client_id,prop.lead_id,ver.destination,ver.departure_date,ver.return_date,'planning',ver.operator,ver.total_amount,ver.currency,ver.notes,nullif(ver.imported->>'reference',''),nullif(ver.imported->>'adults','')::integer,nullif(ver.imported->>'children_count','')::integer)
  returning id into new_trip;
 end if;
 perform public.crm_import_trip_services(new_trip,ver.imported->'services');
 insert into public.crm_trip_clients(trip_id,client_id) values(new_trip,prop.client_id) on conflict do nothing;
 update public.crm_proposals set trip_id=new_trip,operational_imported_at=now(),updated_at=now() where id=p_id;
 update public.crm_emails set trip_id=new_trip where proposal_id=p_id and trip_id is null;
 return new_trip;
end; $$;


create or replace function public.crm_claim_checkin_reminders(p_token uuid)
returns table(id uuid, title text, trip_id uuid, destination text, due_at timestamptz)
language sql security definer set search_path=public,pg_temp as $$
 with selected as (
  select task.id from public.crm_trip_tasks task
  join public.crm_trips trip on trip.id=task.trip_id
  join public.crm_trip_services service on service.id=task.source_service_id
  where not task.completed and task.reminder_sent_at is null and task.due_at<=now()
   and (task.reminder_claimed_at is null or task.reminder_claimed_at < now()-interval '30 minutes')
   and trip.archived_at is null and trip.status in ('planning','confirmed','travelling') and coalesce(service.booking->>'status','pending') <> 'cancelled'
   and (service.departure_at>now() or
     (service.departure_at is null and service.starts_on >= (now() at time zone 'Europe/Lisbon')::date))
  order by task.due_at,task.id limit 50 for update of task skip locked
 ), claimed as (
  update public.crm_trip_tasks task set reminder_claimed_at=now(),reminder_claim_token=p_token
  from selected where task.id=selected.id returning task.*
 )
 select claimed.id,claimed.title,claimed.trip_id,trip.destination,claimed.due_at
 from claimed join public.crm_trips trip on trip.id=claimed.trip_id;
$$;


create or replace function public.crm_set_proposal_status(p_id uuid,p_version integer,p_status text,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prop public.crm_proposals%rowtype;
begin
 select * into prop from public.crm_proposals where id=p_id for update;
 if not found then raise exception 'proposal_not_found'; end if;
 if prop.current_version is distinct from p_version then raise exception 'stale_version'; end if;
 if p_status not in ('draft','sent','accepted','declined','archived') then raise exception 'invalid_status'; end if;
 if p_status='accepted' and char_length(btrim(coalesce(p_note,'')))<5 then raise exception 'manual_confirmation_required'; end if;
 if p_status='accepted' and prop.client_id is null then raise exception 'client_not_found'; end if;
 update public.crm_proposals set status=p_status,confirmation_note=nullif(btrim(p_note),''),updated_at=now() where id=p_id returning * into prop;
 if prop.lead_id is not null and p_status in ('sent','accepted') then
  update public.crm_leads set status=case when p_status='accepted' then 'won' else 'quote_sent' end,updated_at=now()
  where id=prop.lead_id and (p_status='accepted' or status not in ('won','lost'));
 end if;
 if p_status='accepted' then
  perform public.crm_proposal_to_trip(p_id,p_version);
  select * into prop from public.crm_proposals where id=p_id;
 end if;
 return to_jsonb(prop);
end; $$;


create view public.crm_trip_proposal_documents with (security_invoker=true) as
select p.trip_id,p.id as proposal_id,v.version,v.title as proposal_title,d.id as document_id,d.file_name,d.drive_file_id
from public.crm_proposals p
join public.crm_proposal_versions v on v.proposal_id=p.id
join public.crm_drive_files d on d.id=v.document_id
where p.trip_id is not null;

revoke all on public.crm_trip_proposal_documents from public,anon,authenticated;
grant select on public.crm_trip_proposal_documents to service_role;

commit;
