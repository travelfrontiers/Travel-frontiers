begin;
do $$
declare
  client uuid:=gen_random_uuid();
  trip uuid:=gen_random_uuid();
  draft uuid:=gen_random_uuid();
  sent uuid:=gen_random_uuid();
  accepted uuid:=gen_random_uuid();
  emailed uuid:=gen_random_uuid();
  item uuid;
begin
  insert into public.crm_clients(id,full_name,language,source) values(client,'Synthetic proposal customer','pt','manual');
  insert into public.crm_trips(id,client_id,destination,currency) values(trip,client,'Synthetic proposal trip','EUR');
  insert into public.crm_proposals(id,client_id,trip_id,title,current_version,status,confirmation_note)
  values(draft,client,null,'Synthetic draft',1,'draft',null),
        (sent,client,null,'Synthetic sent',1,'sent',null),
        (accepted,client,trip,'Synthetic accepted',1,'accepted','Synthetic proof'),
        (emailed,client,null,'Synthetic emailed draft',1,'draft',null);
  insert into public.crm_proposal_versions(proposal_id,version,title,currency,total_amount)
  values(draft,1,'Synthetic draft','EUR',10),(accepted,1,'Synthetic accepted','EUR',40);
  insert into public.crm_emails(client_id,proposal_id,direction,state,internet_message_id,sender,recipient,subject,body)
  values(client,emailed,'out','sent','<synthetic-proposal-cleanup@example.invalid>','office@example.invalid','client@example.invalid','Synthetic mail','Synthetic');
  assert (public.crm_manage_proposal(accepted,1,'accepted','archive')->>'status_before_archive')='accepted';
  assert (select confirmation_note='Synthetic proof' and trip_id=trip from public.crm_proposals where id=accepted);
  assert exists(select 1 from public.crm_proposal_versions where proposal_id=accepted);
  assert (public.crm_manage_proposal(accepted,1,'archived','restore')->>'status')='accepted';
  perform public.crm_set_proposal_status(sent,1,'declined','');
  foreach item in array array[sent,accepted,emailed] loop
    begin
      perform public.crm_manage_proposal(item,1,(select status from public.crm_proposals where id=item),'delete');
      raise exception 'delete should be guarded';
    exception when others then assert sqlerrm='proposal_has_history',sqlerrm; end;
  end loop;
  begin
    perform public.crm_manage_proposal(draft,2,'draft','delete');
    raise exception 'expected stale version';
  exception when others then assert sqlerrm='stale_version',sqlerrm;end;
  perform public.crm_manage_proposal(draft,1,'draft','archive');
  assert (public.crm_manage_proposal(draft,1,'archived','delete')->>'deleted')::boolean;
  assert not exists(select 1 from public.crm_proposals where id=draft);
  assert not exists(select 1 from public.crm_proposal_versions where proposal_id=draft);
  assert exists(select 1 from public.crm_trips where id=trip);
  assert exists(select 1 from public.crm_clients where id=client);
  assert exists(select 1 from public.crm_emails where proposal_id=emailed);
  assert not has_function_privilege('authenticated','public.crm_manage_proposal(uuid,integer,text,text)','execute');
end; $$;
rollback;
