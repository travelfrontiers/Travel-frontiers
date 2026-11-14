begin;
do $$
declare
  customer uuid:=gen_random_uuid();
  no_email uuid:=gen_random_uuid();
  due_doc uuid:=gen_random_uuid();
  missing_doc uuid:=gen_random_uuid();
  today date:=(now() at time zone 'Europe/Lisbon')::date;
  expiry date:=(today+interval '1 month')::date;
  job jsonb;
  customer_delivery uuid;
begin
  insert into public.crm_clients(id,full_name,email,language,source) values
    (customer,'Cliente fictício','renewal@example.invalid','fr','manual'),
    (no_email,'Outro cliente fictício',null,'pt','manual');
  insert into public.crm_client_documents(id,client_id,document_type,document_number,expires_on)
    values(due_doc,customer,'passport','DEMO123',expiry),
          (missing_doc,no_email,'identity_card','DEMO456',expiry),
          (gen_random_uuid(),customer,'other','DEMO-FUTURE',today+45),
          (gen_random_uuid(),customer,'other','DEMO-PAST',today-1);
  for i in 1..3 loop
    job:=public.crm_claim_document_renewal();
    assert job is not null and not job ? 'document_number';
    if job->>'audience'='customer' then
      assert job->>'email'='renewal@example.invalid' and job->>'language'='fr';
      customer_delivery:=(job->>'id')::uuid;
      perform public.crm_finish_document_renewal(customer_delivery,'failed');
    else
      perform public.crm_finish_document_renewal((job->>'id')::uuid,'sent');
    end if;
  end loop;
  assert customer_delivery is not null;
  assert public.crm_claim_document_renewal() is null,'no duplicate or same-day retry';
  assert (select count(*)=1 from public.crm_document_renewal_deliveries where document_id=missing_doc and audience='internal');
  update public.crm_document_renewal_deliveries set attempted_at=now()-interval '2 days' where id=customer_delivery;
  job:=public.crm_claim_document_renewal();
  assert (job->>'id')::uuid=customer_delivery,'retry preserves delivery identity';
  perform public.crm_finish_document_renewal(customer_delivery,'uncertain');
  update public.crm_document_renewal_deliveries set attempted_at=now()-interval '2 days' where id=customer_delivery;
  assert public.crm_claim_document_renewal() is null,'ambiguous send is protected from duplicate';
  update public.crm_client_documents set expires_on=today+1 where id=due_doc;
  job:=public.crm_claim_document_renewal();
  assert job->>'expires_on'=(today+1)::text,'updated expiry is a separate renewal';
  assert not has_table_privilege('anon','public.crm_document_renewal_deliveries','select');
  assert not has_function_privilege('authenticated','public.crm_claim_document_renewal()','execute');
end; $$;
rollback;
