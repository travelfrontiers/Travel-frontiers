begin;
alter table public.crm_clients add column birth_date date;

create function public.crm_save_scanned_document(
 p_client_id uuid,p_expected_updated_at timestamptz,p_document_type text,
 p_document_number text,p_expires_on date,p_full_name text,p_birth_date date
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare customer public.crm_clients%rowtype; saved_document public.crm_client_documents%rowtype;
 today date:=(now() at time zone 'Europe/Lisbon')::date;
begin
 select * into customer from public.crm_clients where id=p_client_id for update;
 if not found then raise exception 'client_not_found';end if;
 if customer.updated_at is distinct from p_expected_updated_at then raise exception 'client_identity_stale';end if;
 if p_document_type is null or p_document_type not in('passport','identity_card')
    or coalesce(char_length(btrim(p_document_number)),0) not between 1 and 80
    or coalesce(char_length(btrim(p_full_name)),0) not between 2 and 160
    or p_birth_date is null or p_expires_on is null
    or p_birth_date>today or p_birth_date<(today-interval '125 years')::date or p_expires_on<p_birth_date then
   raise exception 'invalid_document_identity';
 end if;

 select * into saved_document from public.crm_client_documents
 where client_id=p_client_id and document_type=p_document_type
 and lower(btrim(document_number))=lower(btrim(p_document_number))
 order by updated_at desc,id limit 1 for update;
 if found then
   update public.crm_client_documents set expires_on=p_expires_on,updated_at=now()
   where id=saved_document.id returning * into saved_document;
 else
   insert into public.crm_client_documents(client_id,document_type,document_number,expires_on)
   values(p_client_id,p_document_type,btrim(p_document_number),p_expires_on) returning * into saved_document;
 end if;
 update public.crm_clients set full_name=btrim(p_full_name),birth_date=p_birth_date,updated_at=now()
 where id=p_client_id returning * into customer;
 return jsonb_build_object('client',to_jsonb(customer),'document',to_jsonb(saved_document));
end; $$;
revoke all on function public.crm_save_scanned_document(uuid,timestamptz,text,text,date,text,date) from public,anon,authenticated;
grant execute on function public.crm_save_scanned_document(uuid,timestamptz,text,text,date,text,date) to service_role;
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
 birth_date=case when p_fields?'birth_date' then nullif(p_fields->>'birth_date','')::date
 else coalesce(birth_date,(select birth_date from public.crm_clients where id=p_source)) end,
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
commit;
