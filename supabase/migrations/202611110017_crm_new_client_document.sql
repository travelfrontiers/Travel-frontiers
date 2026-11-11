begin;

create function public.crm_create_client_with_document(
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
  insert into public.crm_clients(full_name,email,phone,language,internal_notes,source)
  values(p_client->>'full_name',p_client->>'email',p_client->>'phone',p_client->>'language',p_client->>'internal_notes','manual')
  returning * into customer;

  return public.crm_save_scanned_document(
    customer.id,customer.updated_at,p_document_type,p_document_number,p_expires_on,
    customer.full_name,(p_client->>'birth_date')::date
  );
end;
$$;

revoke all on function public.crm_create_client_with_document(jsonb,text,text,date) from public, anon, authenticated;
grant execute on function public.crm_create_client_with_document(jsonb,text,text,date) to service_role;

commit;
