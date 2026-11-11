begin;

create table public.crm_email_templates (
  template_key text not null,
  language text not null check (language in ('pt','en','fr')),
  subject text not null check (char_length(btrim(subject)) between 1 and 240),
  body text not null check (char_length(btrim(body)) between 1 and 16000),
  updated_at timestamptz not null default now(),
  primary key(template_key, language)
);

create table public.crm_emails (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.crm_clients(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  proposal_id uuid references public.crm_proposals(id) on delete set null,
  proposal_version integer check (proposal_version > 0),
  trip_id uuid references public.crm_trips(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  state text not null check (state in ('received','sending','sent','uncertain','failed')),
  template_key text,
  internet_message_id text not null unique check (char_length(internet_message_id) between 1 and 500),
  mailbox_key text unique,
  sender text not null check (char_length(sender) between 1 and 254),
  recipient text not null check (char_length(recipient) between 1 and 254),
  cc text check (char_length(cc) <= 254),
  subject text not null check (char_length(subject) <= 240),
  body text not null check (char_length(body) <= 24000),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array'),
  archive_state text not null default 'none' check (archive_state in ('none','saved','unavailable')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index crm_emails_client_idx on public.crm_emails(client_id,occurred_at desc,id);
create index crm_emails_lead_idx on public.crm_emails(lead_id,occurred_at desc,id);
create index crm_emails_proposal_idx on public.crm_emails(proposal_id,occurred_at desc,id);
create index crm_emails_trip_idx on public.crm_emails(trip_id,occurred_at desc,id);

alter table public.crm_email_templates enable row level security;
alter table public.crm_emails enable row level security;
revoke all on public.crm_email_templates,public.crm_emails from public,anon,authenticated;
grant select,insert,update on public.crm_email_templates,public.crm_emails to service_role;

create function public.crm_begin_email_send(p_message jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.crm_proposals%rowtype; inserted uuid;
begin
  if p_message->>'template_key'='quote' then
    select * into p from public.crm_proposals where id=(p_message->>'proposal_id')::uuid for update;
    if not found then raise exception 'proposal_not_found'; end if;
    if p.current_version is distinct from (p_message->>'proposal_version')::integer
       or p.status not in ('draft','sent') then raise exception 'stale_version'; end if;
  end if;
  insert into public.crm_emails(id,client_id,lead_id,proposal_id,proposal_version,trip_id,
    direction,state,template_key,internet_message_id,sender,recipient,cc,subject,body,attachments)
  values((p_message->>'id')::uuid,(p_message->>'client_id')::uuid,(p_message->>'lead_id')::uuid,
    (p_message->>'proposal_id')::uuid,(p_message->>'proposal_version')::integer,(p_message->>'trip_id')::uuid,
    'out','sending',p_message->>'template_key',p_message->>'internet_message_id',p_message->>'sender',
    p_message->>'recipient',p_message->>'cc',p_message->>'subject',p_message->>'body',p_message->'attachments')
  on conflict (id) do nothing returning id into inserted;
  return inserted is not null;
end;
$$;

create function public.crm_finish_email_send(p_id uuid,p_state text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare msg public.crm_emails%rowtype; changed uuid;
begin
  if p_state not in ('sent','failed','uncertain') then raise exception 'invalid_email_state'; end if;
  update public.crm_emails set state=p_state,occurred_at=now()
  where id=p_id and direction='out' and state='sending' returning * into msg;
  if not found then raise exception 'email_not_pending'; end if;

  if p_state='sent' and msg.template_key='quote' then
    update public.crm_proposals set status='sent',updated_at=now()
    where id=msg.proposal_id and current_version=msg.proposal_version and status='draft'
    returning id into changed;
    if changed is not null and msg.lead_id is not null then
      update public.crm_leads set status='quote_sent',updated_at=now()
      where id=msg.lead_id and status in ('new','qualifying','research','quote_preparing');
    end if;
  end if;
  return to_jsonb(msg);
end;
$$;

revoke all on function public.crm_begin_email_send(jsonb),public.crm_finish_email_send(uuid,text) from public,anon,authenticated;
grant execute on function public.crm_begin_email_send(jsonb),public.crm_finish_email_send(uuid,text) to service_role;

-- Remove messages for a lead when its personal details are anonymized.
create function public.crm_clear_anonymized_lead_emails()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.email is distinct from old.email and new.email like 'removed-%@privacy.invalid' then
    delete from public.crm_emails where lead_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.crm_clear_anonymized_lead_emails() from public,anon,authenticated;
create trigger crm_clear_anonymized_lead_emails after update of email on public.crm_leads
for each row execute function public.crm_clear_anonymized_lead_emails();

alter table public.crm_proposal_versions add column imported jsonb check (imported is null or jsonb_typeof(imported)='object');

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
 insert into public.crm_proposal_versions(proposal_id,version,title,total_amount,currency,valid_until,destination,departure_date,return_date,operator,conditions,inclusions,exclusions,notes,document_id,imported)
 values(prop.id,v,btrim(p_data->>'title'),(p_data->>'total_amount')::numeric,upper(p_data->>'currency'),nullif(p_data->>'valid_until','')::date,
 nullif(btrim(p_data->>'destination'),''),nullif(p_data->>'departure_date','')::date,nullif(p_data->>'return_date','')::date,
 nullif(btrim(p_data->>'operator'),''),nullif(btrim(p_data->>'conditions'),''),nullif(btrim(p_data->>'inclusions'),''),nullif(btrim(p_data->>'exclusions'),''),nullif(btrim(p_data->>'notes'),''),nullif(p_data->>'document_id','')::uuid,p_data->'imported');
 update public.crm_proposals set current_version=v,title=btrim(p_data->>'title'),client_id=p_client_id,lead_id=p_lead_id,trip_id=p_trip_id,status='draft',confirmation_note=null,updated_at=now() where id=prop.id returning * into prop;
 if p_lead_id is not null and selected_lead.client_id is null then update public.crm_leads set client_id=p_client_id,updated_at=now() where id=p_lead_id; end if;
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
  insert into public.crm_trips(client_id,lead_id,destination,departure_date,return_date,status,operator,total_amount,currency,trip_notes,reference,adults,children_count)
  values(prop.client_id,prop.lead_id,ver.destination,ver.departure_date,ver.return_date,'planning',ver.operator,ver.total_amount,ver.currency,ver.notes,nullif(ver.imported->>'reference',''),nullif(ver.imported->>'adults','')::integer,nullif(ver.imported->>'children_count','')::integer)
  returning id into new_trip;
  insert into public.crm_trip_services (trip_id,service_type,title,provider,reference,starts_on,ends_on,details,sort_order)
  select new_trip,service->>'service_type',service->>'title',service->>'provider',service->>'reference',
    (service->>'starts_on')::date,(service->>'ends_on')::date,service->>'details',position::integer
  from jsonb_array_elements(coalesce(ver.imported->'services','[]'::jsonb)) with ordinality as imported(service,position);
 end if;
 update public.crm_proposals set trip_id=new_trip,updated_at=now() where id=p_id;
 update public.crm_emails set trip_id=new_trip where proposal_id=p_id and trip_id is null;
 return new_trip;
end; $$;

commit;
