begin;
create table if not exists public.crm_proposals (
 id uuid primary key default gen_random_uuid(),
 client_id uuid references public.crm_clients(id) on delete set null,
 lead_id uuid references public.crm_leads(id) on delete set null,
 trip_id uuid references public.crm_trips(id) on delete set null,
 title text not null check(char_length(btrim(title)) between 1 and 240),
 status text not null default 'draft' check(status in ('draft','sent','accepted','declined','archived')),
 current_version integer not null default 0,
 confirmation_note text check(char_length(confirmation_note)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.crm_proposal_versions (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null references public.crm_proposals(id) on delete cascade,
 version integer not null check(version>0),
 title text not null check(char_length(btrim(title)) between 1 and 240),
 total_amount numeric(12,2) not null check(total_amount>=0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 valid_until date,
 destination text check(char_length(destination)<=240),
 departure_date date, return_date date,
 operator text check(char_length(operator)<=160),
 conditions text check(char_length(conditions)<=4000),
 inclusions text check(char_length(inclusions)<=4000),
 exclusions text check(char_length(exclusions)<=4000),
 notes text check(char_length(notes)<=4000),
 document_id uuid references public.crm_drive_files(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(proposal_id,version),
 check(return_date is null or departure_date is null or return_date>=departure_date)
);
create index if not exists crm_proposals_client_idx on public.crm_proposals(client_id);
create index if not exists crm_proposals_lead_idx on public.crm_proposals(lead_id);
create index if not exists crm_proposals_trip_idx on public.crm_proposals(trip_id);
create table if not exists public.crm_checklist_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 2 and 160),
 travel_type text not null default 'all' check(char_length(travel_type) between 1 and 80),
 active boolean not null default true, auto_apply boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.crm_checklist_items (
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.crm_checklist_templates(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 240),
 anchor text not null check(anchor in ('departure','return','manual')),
 offset_days integer not null default 0 check(offset_days between -365 and 365),
 phase text not null default 'before' check(phase in ('before','during','after')),
 sort_order integer not null default 100, active boolean not null default true
);
create table if not exists public.crm_trip_checklists (
 trip_id uuid not null references public.crm_trips(id) on delete cascade,
 template_id uuid not null references public.crm_checklist_templates(id) on delete cascade,
 applied_at timestamptz not null default now(), primary key(trip_id,template_id)
);
create table if not exists public.crm_checklist_skips (
 trip_id uuid not null references public.crm_trips(id) on delete cascade,
 item_id uuid not null references public.crm_checklist_items(id) on delete cascade,
 primary key(trip_id,item_id)
);
alter table public.crm_trips add column if not exists travel_type text not null default 'general';
alter table public.crm_trip_tasks add column if not exists template_item_id uuid references public.crm_checklist_items(id) on delete set null;
alter table public.crm_trip_tasks add column if not exists template_override boolean not null default false;
create unique index if not exists crm_trip_tasks_template_unique on public.crm_trip_tasks(trip_id,template_item_id) where template_item_id is not null;
create table if not exists public.crm_activity (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 entity_type text not null, entity_id uuid not null,
 client_id uuid references public.crm_clients(id) on delete set null,
 lead_id uuid references public.crm_leads(id) on delete set null,
 trip_id uuid references public.crm_trips(id) on delete set null,
 proposal_id uuid references public.crm_proposals(id) on delete set null,
 actor text not null default 'admin', action text not null,
 label text not null check(char_length(label) between 1 and 2000),
 changed_fields text[] not null default '{}', details jsonb not null default '{}'
);
create index if not exists crm_activity_created_idx on public.crm_activity(created_at desc,id);
create index if not exists crm_activity_client_idx on public.crm_activity(client_id,created_at desc);
create index if not exists crm_activity_trip_idx on public.crm_activity(trip_id,created_at desc);
create index if not exists crm_activity_lead_idx on public.crm_activity(lead_id,created_at desc);
create index if not exists crm_activity_proposal_idx on public.crm_activity(proposal_id,created_at desc);

do $$ declare t text; begin
 foreach t in array array['crm_proposals','crm_proposal_versions','crm_checklist_templates','crm_checklist_items','crm_trip_checklists','crm_checklist_skips','crm_activity'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end; $$;
revoke update,delete on public.crm_proposal_versions from service_role;
revoke update,delete on public.crm_activity from service_role;

create or replace function public.crm_save_proposal(p_id uuid,p_client_id uuid,p_lead_id uuid,p_trip_id uuid,p_expected_version integer,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prop public.crm_proposals%rowtype; v integer; selected_lead public.crm_leads%rowtype;
begin
 if p_client_id is null or not exists(select 1 from public.crm_clients where id=p_client_id) then raise exception 'client_not_found'; end if;
 perform id from public.crm_clients where id=p_client_id for key share;
 if p_lead_id is not null then
  select * into selected_lead from public.crm_leads where id=p_lead_id for update;
  if not found then raise exception 'lead_not_found'; end if;
  if selected_lead.client_id is not null and selected_lead.client_id<>p_client_id then raise exception 'lead_client_mismatch'; end if;
 end if;
 if p_trip_id is not null then
  perform id from public.crm_trips where id=p_trip_id and (client_id=p_client_id or exists(select 1 from public.crm_trip_clients where trip_id=p_trip_id and client_id=p_client_id)) for update;
  if not found then raise exception 'trip_client_mismatch'; end if;
  if p_lead_id is not null and exists(select 1 from public.crm_trips where id=p_trip_id and lead_id is not null and lead_id<>p_lead_id) then raise exception 'trip_lead_mismatch'; end if;
 end if;
 if nullif(p_data->>'document_id','') is not null and not exists(select 1 from public.crm_drive_files where id=(p_data->>'document_id')::uuid and (client_id=p_client_id or trip_id=p_trip_id)) then raise exception 'document_mismatch'; end if;
 if p_id is null then
  if coalesce(p_expected_version,0)<>0 then raise exception 'stale_version'; end if;
  insert into public.crm_proposals(client_id,lead_id,trip_id,title) values(p_client_id,p_lead_id,p_trip_id,btrim(p_data->>'title')) returning * into prop;
 else
  select * into prop from public.crm_proposals where id=p_id for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if prop.current_version is distinct from p_expected_version then raise exception 'stale_version'; end if;
 end if;
 v:=prop.current_version+1;
 insert into public.crm_proposal_versions(proposal_id,version,title,total_amount,currency,valid_until,destination,departure_date,return_date,operator,conditions,inclusions,exclusions,notes,document_id)
 values(prop.id,v,btrim(p_data->>'title'),(p_data->>'total_amount')::numeric,upper(p_data->>'currency'),nullif(p_data->>'valid_until','')::date,
 nullif(btrim(p_data->>'destination'),''),nullif(p_data->>'departure_date','')::date,nullif(p_data->>'return_date','')::date,
 nullif(btrim(p_data->>'operator'),''),nullif(btrim(p_data->>'conditions'),''),nullif(btrim(p_data->>'inclusions'),''),nullif(btrim(p_data->>'exclusions'),''),nullif(btrim(p_data->>'notes'),''),nullif(p_data->>'document_id','')::uuid);
 update public.crm_proposals set current_version=v,title=btrim(p_data->>'title'),client_id=p_client_id,lead_id=p_lead_id,trip_id=p_trip_id,status='draft',confirmation_note=null,updated_at=now() where id=prop.id returning * into prop;
 if p_lead_id is not null and selected_lead.client_id is null then update public.crm_leads set client_id=p_client_id,updated_at=now() where id=p_lead_id; end if;
 return to_jsonb(prop);
end; $$;

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
 return to_jsonb(prop);
end; $$;

create or replace function public.crm_proposal_to_trip(p_id uuid,p_version integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare prop public.crm_proposals%rowtype; ver public.crm_proposal_versions%rowtype; new_trip uuid;
begin
 select * into prop from public.crm_proposals where id=p_id for update;
 if not found then raise exception 'proposal_not_found'; end if;
 if prop.current_version is distinct from p_version then raise exception 'stale_version'; end if;
 if prop.status<>'accepted' then raise exception 'manual_confirmation_required'; end if;
 if prop.trip_id is not null then return prop.trip_id; end if;
 if prop.client_id is null then raise exception 'client_not_found'; end if;
 if prop.lead_id is not null then
  perform id from public.crm_leads where id=prop.lead_id for update;
  select id into new_trip from public.crm_trips where lead_id=prop.lead_id;
 end if;
 if new_trip is null then
  select * into ver from public.crm_proposal_versions where proposal_id=p_id and version=p_version;
  insert into public.crm_trips(client_id,lead_id,destination,departure_date,return_date,status,operator,total_amount,currency,trip_notes)
  values(prop.client_id,prop.lead_id,ver.destination,ver.departure_date,ver.return_date,'planning',ver.operator,ver.total_amount,ver.currency,ver.notes)
  returning id into new_trip;
 end if;
 update public.crm_proposals set trip_id=new_trip,updated_at=now() where id=p_id;
 return new_trip;
end; $$;

create or replace function public.crm_sync_trip_checklists(p_trip_id uuid,p_template_id uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tr public.crm_trips%rowtype; item record; due_date date; existing_id uuid;
begin
 select * into tr from public.crm_trips where id=p_trip_id for update;
 if not found then raise exception 'trip_not_found'; end if;
 if p_template_id is not null and not exists(select 1 from public.crm_checklist_templates where id=p_template_id and active) then raise exception 'template_not_found'; end if;
 insert into public.crm_trip_checklists(trip_id,template_id)
 select tr.id,t.id from public.crm_checklist_templates t where t.active and
 (t.id=p_template_id or (t.auto_apply and t.travel_type in ('all',tr.travel_type) and tr.status not in ('cancelled','completed')))
 on conflict do nothing;
 for item in select i.* from public.crm_checklist_items i join public.crm_checklist_templates t on t.id=i.template_id
 join public.crm_trip_checklists applied on applied.template_id=t.id and applied.trip_id=tr.id
 where i.active and t.active and (p_template_id is null or t.id=p_template_id)
 loop
  if exists(select 1 from public.crm_checklist_skips where trip_id=tr.id and item_id=item.id) then continue; end if;
  due_date:=case when item.anchor='departure' then tr.departure_date+item.offset_days when item.anchor='return' then tr.return_date+item.offset_days else null end;
  select id into existing_id from public.crm_trip_tasks where trip_id=tr.id and template_item_id=item.id;
  if existing_id is null then
   select id into existing_id from public.crm_trip_tasks where trip_id=tr.id and template_item_id is null and source_service_id is null and lower(btrim(title))=lower(btrim(item.title)) order by created_at limit 1;
   if existing_id is not null then update public.crm_trip_tasks set template_item_id=item.id,template_override=(due_at is not null) where id=existing_id; end if;
  end if;
  insert into public.crm_trip_tasks(trip_id,title,due_at,sort_order,template_item_id)
  values(tr.id,item.title,case when due_date is null then null else ((due_date::timestamp+interval '12 hours') at time zone 'Europe/Lisbon') end,item.sort_order,item.id)
  on conflict(trip_id,template_item_id) where template_item_id is not null do update set
   title=case when crm_trip_tasks.completed or crm_trip_tasks.template_override then crm_trip_tasks.title else excluded.title end,
   due_at=case when crm_trip_tasks.completed or crm_trip_tasks.template_override then crm_trip_tasks.due_at else excluded.due_at end, sort_order=excluded.sort_order;
 end loop;
end; $$;
create or replace function public.crm_trip_checklist_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.crm_sync_trip_checklists(new.id); return new; end; $$;
drop trigger if exists crm_trip_checklist_rules on public.crm_trips;
create trigger crm_trip_checklist_rules after insert or update of departure_date,return_date,travel_type,status on public.crm_trips for each row execute function public.crm_trip_checklist_trigger();

create or replace function public.crm_save_checklist_template(p_id uuid,p_name text,p_travel_type text,p_active boolean,p_auto_apply boolean,p_items jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare tid uuid; item jsonb; iid uuid; ids uuid[]:='{}'; tr record;
begin
 if char_length(btrim(p_name)) not between 2 and 160 or p_travel_type not in ('all','general','beach','circuit','city','honeymoon','family','business','custom') or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'invalid_template'; end if;
 if p_id is null then
  insert into public.crm_checklist_templates(name,travel_type,active,auto_apply) values(btrim(p_name),p_travel_type,p_active,p_auto_apply) returning id into tid;
 else
  perform id from public.crm_checklist_templates where id=p_id for update;
  if not found then raise exception 'template_not_found'; end if;
  tid:=p_id;
  update public.crm_checklist_templates set name=btrim(p_name),travel_type=p_travel_type,active=p_active,auto_apply=p_auto_apply,updated_at=now() where id=tid;
 end if;
 for item in select value from jsonb_array_elements(p_items) loop
  iid:=nullif(item->>'id','')::uuid;
  if iid is not null and not exists(select 1 from public.crm_checklist_items where id=iid and template_id=tid) then raise exception 'item_not_found'; end if;
  if iid is null then iid:=gen_random_uuid(); end if;
  if iid=any(ids) then raise exception 'duplicate_item'; end if;
  ids:=array_append(ids,iid);
  insert into public.crm_checklist_items(id,template_id,title,anchor,offset_days,phase,sort_order,active)
  values(iid,tid,btrim(item->>'title'),item->>'anchor',(item->>'offset_days')::integer,item->>'phase',coalesce((item->>'sort_order')::integer,100),true)
  on conflict(id) do update set title=excluded.title,anchor=excluded.anchor,offset_days=excluded.offset_days,phase=excluded.phase,sort_order=excluded.sort_order,active=true;
 end loop;
 update public.crm_checklist_items set active=false where template_id=tid and not(id=any(ids));
 for tr in select id from public.crm_trips where status not in ('completed','cancelled') loop perform public.crm_sync_trip_checklists(tr.id); end loop;
 return tid;
end; $$;
create or replace function public.crm_delete_task(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare task public.crm_trip_tasks%rowtype;
begin
 select * into task from public.crm_trip_tasks where id=p_id for update;
 if not found then raise exception 'task_not_found'; end if;
 if task.source_service_id is not null then raise exception 'flight_managed_task'; end if;
 if task.template_item_id is not null then insert into public.crm_checklist_skips(trip_id,item_id) values(task.trip_id,task.template_item_id) on conflict do nothing; end if;
 delete from public.crm_trip_tasks where id=p_id;
end; $$;
create or replace function public.crm_reset_template_task(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare task public.crm_trip_tasks%rowtype;
begin
 select * into task from public.crm_trip_tasks where id=p_id for update;
 if not found then raise exception 'task_not_found'; end if;
 if task.template_item_id is null then raise exception 'not_template_task'; end if;
 update public.crm_trip_tasks set template_override=false where id=p_id;
 perform public.crm_sync_trip_checklists(task.trip_id);
end; $$;

do $$ declare tid uuid; begin
 if not exists(select 1 from public.crm_checklist_templates) then
 insert into public.crm_checklist_templates(name,travel_type,auto_apply) values('Acompanhamento Travel Frontiers','all',true) returning id into tid;
 insert into public.crm_checklist_items(template_id,title,anchor,offset_days,phase,sort_order) values
 (tid,'Enviar email com a mensagem para o quarto','departure',-3,'before',10),
 (tid,'Perguntar se está tudo bem','departure',1,'during',30),
 (tid,'Enviar acompanhamento pós-viagem','return',2,'after',40);
 end if;
end; $$;

-- Audits store field names and selected workflow states, never full row snapshots or document IDs.
create or replace function public.crm_record_activity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare old_data jsonb:='{}'; data jsonb; kind text; eid uuid; cid uuid; lid uuid; tid uuid; pid uuid;
 fields text[]; who text:='admin'; info jsonb:='{}'; display text;
begin
 if tg_op<>'INSERT' then old_data:=to_jsonb(old); end if;
 data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op='UPDATE' then
  select coalesce(array_agg(key),'{}') into fields from jsonb_object_keys(data) as key
  where data->key is distinct from old_data->key and key not in ('updated_at','reminder_claimed_at','reminder_claim_token','reminder_sent_at');
  if cardinality(fields)=0 then return new; end if;
 else fields:='{}'; end if;
 kind:=case tg_table_name when 'crm_clients' then 'client' when 'crm_leads' then 'lead' when 'crm_trips' then 'trip' when 'crm_trip_tasks' then 'task' when 'crm_trip_services' then 'service' when 'crm_client_documents' then 'document' when 'crm_proposals' then 'proposal' when 'crm_proposal_versions' then 'proposal' else 'template' end;
 eid:=(data->>'id')::uuid;
 cid:=nullif(data->>'client_id','')::uuid; lid:=nullif(data->>'lead_id','')::uuid; tid:=nullif(data->>'trip_id','')::uuid;
 if kind='client' then cid:=case when tg_op='DELETE' then null else eid end; end if;
 if kind='lead' then lid:=case when tg_op='DELETE' then null else eid end; end if;
 if kind='trip' then tid:=case when tg_op='DELETE' then null else eid end; end if;
 if kind='proposal' then
  pid:=case when tg_table_name='crm_proposal_versions' then (data->>'proposal_id')::uuid else eid end; eid:=pid;
  select client_id,lead_id,trip_id into cid,lid,tid from public.crm_proposals where id=pid;
 end if;
 if tid is not null then select coalesce(cid,client_id),coalesce(lid,lead_id) into cid,lid from public.crm_trips where id=tid; end if;
 if kind='task' and (data->>'source_service_id' is not null or data->>'template_item_id' is not null) and (tg_op='INSERT' or pg_trigger_depth()>1) then who:='automation'; end if;
 if kind='lead' and tg_op='INSERT' and data->>'source'='public_form' then who:='public_form'; end if;
 if data ? 'status' then info:=jsonb_build_object('status',data->>'status','previous_status',old_data->>'status'); end if;
 if data ? 'current_version' then info:=info||jsonb_build_object('version',(data->>'current_version')::integer); end if;
 if tg_table_name='crm_proposal_versions' then info:=jsonb_build_object('version',(data->>'version')::integer); end if;
 display:=case kind when 'client' then 'Cliente' when 'lead' then 'Pedido' when 'trip' then 'Viagem' when 'proposal' then 'Proposta' when 'document' then 'Documento' when 'service' then 'Serviço' when 'task' then 'Tarefa' else 'Template' end;
 if tg_op='DELETE' then
  if kind='proposal' then pid:=null; end if;
  if kind='trip' then tid:=null; end if;
  if kind='lead' then lid:=null; end if;
  if kind='client' then cid:=null; end if;
 end if;
 if cid is not null and not exists(select 1 from public.crm_clients where id=cid) then cid:=null; end if;
 if lid is not null and not exists(select 1 from public.crm_leads where id=lid) then lid:=null; end if;
 if tid is not null and not exists(select 1 from public.crm_trips where id=tid) then tid:=null; end if;
 if pid is not null and not exists(select 1 from public.crm_proposals where id=pid) then pid:=null; end if;
 insert into public.crm_activity(entity_type,entity_id,client_id,lead_id,trip_id,proposal_id,actor,action,label,changed_fields,details)
 values(kind,eid,cid,lid,tid,pid,who,lower(tg_op),case tg_op when 'INSERT' then 'Criação: ' when 'UPDATE' then 'Alteração: ' else 'Eliminação: ' end||display,fields,info);
 return case when tg_op='DELETE' then old else new end;
end; $$;
do $$ declare t text; begin
 foreach t in array array['crm_clients','crm_leads','crm_trips','crm_trip_tasks','crm_trip_services','crm_client_documents','crm_proposals','crm_proposal_versions','crm_checklist_templates'] loop
  execute format('drop trigger if exists crm_activity_capture on public.%I',t);
  execute format('create trigger crm_activity_capture after insert or update or delete on public.%I for each row execute function public.crm_record_activity()',t);
 end loop;
end; $$;

create or replace function public.crm_duplicate_candidates()
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 with normal as (
 select id,full_name,email,phone,
 lower(btrim(coalesce(email,''))) as mail,
 regexp_replace(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),'^00','') as digits,
 regexp_replace(translate(lower(btrim(full_name)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]','','g') as name_key
 from public.crm_clients
 ), normalized as (
 select *,case when char_length(digits)=9 then '351'||digits else digits end as phone_key from normal
 ), pairs as (
 select jsonb_build_object('left',jsonb_build_object('id',a.id,'full_name',a.full_name,'email',a.email,'phone',a.phone),
 'right',jsonb_build_object('id',b.id,'full_name',b.full_name,'email',b.email,'phone',b.phone),
 'reason',case when a.mail<>'' and a.mail=b.mail then 'email' when char_length(a.phone_key)>=7 and a.phone_key=b.phone_key then 'phone' else 'name' end) as value
 from normalized a join normalized b on a.id<b.id
 where (a.mail<>'' and a.mail=b.mail) or (char_length(a.phone_key)>=7 and a.phone_key=b.phone_key) or (char_length(a.name_key)>=5 and a.name_key=b.name_key)
 order by a.full_name,b.full_name limit 100
 ) select coalesce(jsonb_agg(value),'[]'::jsonb) from pairs;
$$;

create or replace function public.crm_merge_clients(p_source uuid,p_target uuid,p_fields jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 if p_source=p_target then raise exception 'same_client'; end if;
 perform id from public.crm_clients where id in(p_source,p_target) order by id for update;
 get diagnostics n=row_count;
 if n<>2 then raise exception 'client_not_found'; end if;
 update public.crm_clients set email=null where id=p_source;
 update public.crm_clients set full_name=btrim(p_fields->>'full_name'),email=nullif(lower(btrim(p_fields->>'email')),''),
 phone=nullif(btrim(p_fields->>'phone'),''),language=p_fields->>'language',internal_notes=nullif(btrim(p_fields->>'internal_notes'),''),updated_at=now() where id=p_target;
 update public.crm_leads set client_id=p_target,updated_at=now() where client_id=p_source;
 update public.crm_trips set client_id=p_target,updated_at=now() where client_id=p_source;
 insert into public.crm_trip_clients(trip_id,client_id) select trip_id,p_target from public.crm_trip_clients where client_id=p_source on conflict do nothing;
 delete from public.crm_trip_clients where client_id=p_source;
 update public.crm_client_documents set client_id=p_target,updated_at=now() where client_id=p_source;
 update public.crm_drive_files set client_id=p_target where client_id=p_source;
 update public.crm_proposals set client_id=p_target,updated_at=now() where client_id=p_source;
 update public.crm_activity set client_id=p_target where client_id=p_source;
 delete from public.crm_clients where id=p_source;
 insert into public.crm_activity(entity_type,entity_id,client_id,actor,action,label,details)
 values('client',p_target,p_target,'admin','merge','Clientes fundidos após revisão manual',jsonb_build_object('source_id',p_source));
 return p_target;
end; $$;

do $$ declare r record; begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('crm_save_proposal','crm_set_proposal_status','crm_proposal_to_trip','crm_sync_trip_checklists','crm_save_checklist_template','crm_delete_task','crm_reset_template_task','crm_duplicate_candidates','crm_merge_clients') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);
 execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end; $$;

-- Existing constructors now rely on the editable template trigger instead of fixed seed tasks.
create or replace function public.crm_convert_lead_to_trip(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_lead public.crm_leads%rowtype;
  selected_client_id uuid;
  created_trip_id uuid;
  inserted_count integer;
begin
  select * into selected_lead from public.crm_leads where id = p_lead_id for update;
  if not found then raise exception 'lead_not_found'; end if;
  if selected_lead.status <> 'won' then raise exception 'lead_not_confirmed'; end if;

  selected_client_id := selected_lead.client_id;
  if selected_client_id is null then
    insert into public.crm_clients (full_name, email, phone, language, source)
    values (selected_lead.full_name, lower(btrim(selected_lead.email)), selected_lead.phone, selected_lead.language, 'lead')
    on conflict do nothing;
    select id into selected_client_id from public.crm_clients
      where lower(btrim(email)) = lower(btrim(selected_lead.email))
      order by created_at asc limit 1;
    if selected_client_id is null then raise exception 'client_create_failed'; end if;
    update public.crm_leads set client_id = selected_client_id where id = selected_lead.id;
  end if;

  insert into public.crm_trips (lead_id, client_id, destination, departure_date, return_date, status)
  values (selected_lead.id, selected_client_id, selected_lead.destination, selected_lead.departure_date, selected_lead.return_date, 'planning')
  on conflict (lead_id) where lead_id is not null do nothing;
  get diagnostics inserted_count = row_count;

  select id into created_trip_id from public.crm_trips where lead_id = selected_lead.id;
  return created_trip_id;
end;
$$;

create or replace function public.crm_create_manual_trip(
  p_client_id uuid,
  p_reference text,
  p_destination text,
  p_departure_date date,
  p_return_date date,
  p_status text
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
  insert into public.crm_trips (client_id, reference, destination, departure_date, return_date, status)
  values (p_client_id, nullif(btrim(p_reference), ''), nullif(btrim(p_destination), ''), p_departure_date, p_return_date, p_status)
  returning id into created_trip_id;
  return created_trip_id;
end;
$$;

-- Create the trip and all reviewed flight/accommodation records in one transaction.
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
  service_row jsonb;
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

  for service_row in select value from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) as items(value)
  loop
    insert into public.crm_trip_services (
      trip_id, service_type, title, provider, reference, starts_on, ends_on, details
    ) values (
      created_trip_id,
      service_row->>'service_type',
      btrim(service_row->>'title'),
      nullif(btrim(service_row->>'provider'), ''),
      nullif(btrim(service_row->>'reference'), ''),
      nullif(service_row->>'starts_on', '')::date,
      nullif(service_row->>'ends_on', '')::date,
      nullif(btrim(service_row->>'details'), '')
    );
  end loop;
  return created_trip_id;
end;
$$;

revoke all on function public.crm_create_trip_with_details(uuid, text, text, date, date, text, text, smallint, smallint, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.crm_create_trip_with_details(uuid, text, text, date, date, text, text, smallint, smallint, numeric, text, text, jsonb) to service_role;
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


create or replace function public.crm_create_typed_trip(p_client_ids uuid[],p_data jsonb,p_services jsonb,p_travel_type text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare tid uuid;
begin
 if p_travel_type not in ('general','beach','circuit','city','honeymoon','family','business','custom') then raise exception 'invalid_travel_type'; end if;
 tid:=public.crm_create_trip_with_clients(p_client_ids,p_data->>'reference',p_data->>'destination',
 nullif(p_data->>'departure_date','')::date,nullif(p_data->>'return_date','')::date,p_data->>'status',
 p_data->>'operator',nullif(p_data->>'adults','')::smallint,nullif(p_data->>'children_count','')::smallint,
 nullif(p_data->>'total_amount','')::numeric,p_data->>'currency',p_data->>'trip_notes',p_services);
 update public.crm_trips set travel_type=p_travel_type where id=tid;
 return tid;
end; $$;
revoke all on function public.crm_create_typed_trip(uuid[],jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.crm_create_typed_trip(uuid[],jsonb,jsonb,text) to service_role;
do $$ declare tr record; begin
 for tr in select id from public.crm_trips where status not in ('completed','cancelled') loop perform public.crm_sync_trip_checklists(tr.id); end loop;
end; $$;
create or replace view public.crm_proposals_overview as
 select p.*,c.full_name as client_name,v.total_amount,v.currency,v.valid_until,v.destination
 from public.crm_proposals p left join public.crm_clients c on c.id=p.client_id
 left join public.crm_proposal_versions v on v.proposal_id=p.id and v.version=p.current_version;
revoke all on public.crm_proposals_overview from public,anon,authenticated;
grant select on public.crm_proposals_overview to service_role;
create or replace function public.crm_add_activity_note(p_type text,p_id uuid,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid;lid uuid;tid uuid;pid uuid;
begin
 if char_length(btrim(p_note)) not between 2 and 2000 then raise exception 'invalid_note'; end if;
 case p_type
 when 'client' then select id into cid from public.crm_clients where id=p_id;
 when 'lead' then select client_id,id into cid,lid from public.crm_leads where id=p_id;
 when 'trip' then select client_id,lead_id,id into cid,lid,tid from public.crm_trips where id=p_id;
 when 'proposal' then select client_id,lead_id,trip_id,id into cid,lid,tid,pid from public.crm_proposals where id=p_id;
 else raise exception 'invalid_entity';
 end case;
 if cid is null and lid is null and tid is null and pid is null then raise exception 'client_not_found'; end if;
 insert into public.crm_activity(entity_type,entity_id,client_id,lead_id,trip_id,proposal_id,actor,action,label)
 values(p_type,p_id,cid,lid,tid,pid,'admin','note',btrim(p_note));
end; $$;
revoke all on function public.crm_add_activity_note(text,uuid,text) from public,anon,authenticated;
grant execute on function public.crm_add_activity_note(text,uuid,text) to service_role;

commit;

