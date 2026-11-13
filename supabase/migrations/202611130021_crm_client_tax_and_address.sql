begin;

alter table public.crm_clients
  add column if not exists nif text check (char_length(nif) between 1 and 32),
  add column if not exists address text check (char_length(address) between 1 and 500);

create or replace function public.crm_create_client_with_document(
  p_client jsonb, p_document_type text, p_document_number text, p_expires_on date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer public.crm_clients%rowtype;
begin
  insert into public.crm_clients(full_name,email,phone,language,internal_notes,source,nif,address)
  values(p_client->>'full_name',p_client->>'email',p_client->>'phone',p_client->>'language',p_client->>'internal_notes','manual',nullif(btrim(p_client->>'nif'),''),nullif(btrim(p_client->>'address'),''))
  returning * into customer;

  return public.crm_save_scanned_document(
    customer.id,customer.updated_at,p_document_type,p_document_number,p_expires_on,
    customer.full_name,(p_client->>'birth_date')::date
  );
end;
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
 birth_date=case when p_fields?'birth_date' then nullif(p_fields->>'birth_date','')::date
 else coalesce(birth_date,(select birth_date from public.crm_clients where id=p_source)) end,
 nif=case when p_fields?'nif' then nullif(btrim(p_fields->>'nif'),'')
 else coalesce(nif,(select nif from public.crm_clients where id=p_source)) end,
 address=case when p_fields?'address' then nullif(btrim(p_fields->>'address'),'')
 else coalesce(address,(select address from public.crm_clients where id=p_source)) end,
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

notify pgrst, 'reload schema';
commit;
