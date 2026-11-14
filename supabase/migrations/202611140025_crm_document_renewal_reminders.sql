begin;

create table public.crm_document_renewal_deliveries (
  id uuid not null unique default gen_random_uuid(),
  document_id uuid not null references public.crm_client_documents(id) on delete cascade,
  expires_on date not null,
  audience text not null check (audience in ('customer','internal')),
  state text not null check (state in ('sending','sent','failed','uncertain')),
  attempts integer not null check (attempts between 1 and 3),
  attempted_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (document_id,expires_on,audience)
);
alter table public.crm_document_renewal_deliveries enable row level security;
revoke all on public.crm_document_renewal_deliveries from public,anon,authenticated,service_role;
grant select on public.crm_document_renewal_deliveries to service_role;

create function public.crm_claim_document_renewal()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  today date := (now() at time zone 'Europe/Lisbon')::date;
  candidate record;
  delivery_id uuid;
begin
  select d.id,d.document_type,d.expires_on,c.full_name,c.language,a.audience,contact.email
    into candidate
  from public.crm_client_documents d
  join public.crm_clients c on c.id=d.client_id
  cross join lateral (
    select case when length(btrim(c.email))<=254 and btrim(c.email) ~*
      '^[A-Z0-9_.!#$%&''*+/=?^`{|}~-]+@([A-Z0-9]([A-Z0-9-]*[A-Z0-9])?\.)+[A-Z0-9]([A-Z0-9-]*[A-Z0-9])?$'
      then lower(btrim(c.email)) end as email
  ) contact
  cross join (values ('customer'),('internal')) a(audience)
  left join public.crm_document_renewal_deliveries delivery
    on delivery.document_id=d.id and delivery.expires_on=d.expires_on and delivery.audience=a.audience
  where d.expires_on between today+1 and today+31
    and (d.expires_on-interval '1 month')::date<=today
    and (a.audience='internal' or contact.email is not null)
    and (delivery.id is null or (delivery.state='failed' and delivery.attempts<3
      and (delivery.attempted_at at time zone 'Europe/Lisbon')::date<today))
  order by d.expires_on,d.id,a.audience
  limit 1
  for update of d skip locked;
  if not found then return null; end if;

  insert into public.crm_document_renewal_deliveries as delivery(document_id,expires_on,audience,state,attempts)
  values(candidate.id,candidate.expires_on,candidate.audience,'sending',1)
  on conflict(document_id,expires_on,audience) do update
    set state='sending',attempts=delivery.attempts+1,attempted_at=now(),finished_at=null
    where delivery.state='failed' and delivery.attempts<3
      and (delivery.attempted_at at time zone 'Europe/Lisbon')::date<today
  returning id into delivery_id;
  if delivery_id is null then return null; end if;

  return jsonb_build_object('id',delivery_id,'document_type',candidate.document_type,'expires_on',candidate.expires_on,
    'full_name',candidate.full_name,'language',candidate.language,'audience',candidate.audience,'email',candidate.email);
end; $$;

create function public.crm_finish_document_renewal(p_id uuid,p_state text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_state is null or p_state not in ('sent','failed','uncertain') then raise exception 'invalid_email_state'; end if;
  update public.crm_document_renewal_deliveries set state=p_state,finished_at=now() where id=p_id and state='sending';
  if not found then raise exception 'email_not_pending'; end if;
end; $$;

revoke all on function public.crm_claim_document_renewal(),public.crm_finish_document_renewal(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.crm_claim_document_renewal(),public.crm_finish_document_renewal(uuid,text) to service_role;

commit;
