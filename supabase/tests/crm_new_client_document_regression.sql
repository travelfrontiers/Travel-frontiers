begin;
do $$
declare
  result jsonb;
  test_email text := 'new-client-doc-' || gen_random_uuid() || '@example.invalid';
  fields jsonb;
  rejected boolean := false;
begin
  fields := jsonb_build_object('full_name','Synthetic Client','email',test_email,'language','pt','birth_date','1988-07-01');
  begin
    perform public.crm_create_client_with_document(fields,'invalid','SYNTHETIC','2035-08-01');
  exception when others then
    rejected := sqlerrm='invalid_document_identity';
  end;
  assert rejected, 'invalid document rejected';
  assert not exists(select 1 from public.crm_clients c where c.email=test_email), 'no partial client';
  result := public.crm_create_client_with_document(fields,'passport','SYNTHETIC','2035-08-01');
  assert result->'client'->>'birth_date'='1988-07-01', 'birth date saved';
  assert result->'client'->>'id'=result->'document'->>'client_id', 'document linked to new client';
  assert result->'document'->>'document_number'='SYNTHETIC', 'document ID saved';
  assert not has_function_privilege('authenticated','public.crm_create_client_with_document(jsonb,text,text,date)','execute'), 'non-admin SQL access denied';
end;
$$;
rollback;
