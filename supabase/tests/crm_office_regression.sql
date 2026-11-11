-- Synthetic transactional checks. Every mutation is rolled back, including on assertion failure.
begin;
do $$
declare c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); lead uuid:=gen_random_uuid();
 unlinked uuid:=gen_random_uuid(); proposal jsonb; pid uuid; tid uuid; tid2 uuid; template uuid; item uuid; task uuid; completed_task uuid;
 doc uuid:=gen_random_uuid(); drive uuid:=gen_random_uuid(); before_due timestamptz; n integer; failed boolean;
 snapshot jsonb; name text:='Synthetic Office Test '||gen_random_uuid()::text;
begin
 insert into public.crm_clients(id,full_name,email,phone,language,source) values
 (c1,name,'office-'||c1::text||'@example.invalid','+351 912 000 999','pt','manual'),
 (c2,name,null,'912000999','pt','manual');
 insert into public.crm_leads(id,full_name,email,client_id,source,adults,consent_privacy)
 values(lead,name,'office-'||c1::text||'@example.invalid',c1,'manual',2,true);
 snapshot:=jsonb_build_object('title','Synthetic quote v1','total_amount',1234.56,'currency','EUR','destination','Synthetic destination','departure_date','2027-04-06','return_date','2027-04-17','conditions','Synthetic conditions');
 proposal:=public.crm_save_proposal(null,c1,lead,null,0,snapshot);pid:=(proposal->>'id')::uuid;
 proposal:=public.crm_save_proposal(pid,c1,lead,null,1,snapshot||jsonb_build_object('title','Synthetic quote v2','total_amount',1500));
 assert (proposal->>'current_version')::integer=2,'version increment';
 failed:=false;
 begin
   delete from public.crm_leads where id=lead;
 exception when others then failed:=sqlerrm='lead_has_links';end;
 assert failed,'proposal link prevents lead deletion';
 update public.crm_leads set archived_at=now() where id=lead;
 assert (select archived_at is not null and status='new' from public.crm_leads where id=lead),'archive preserves phase';
 update public.crm_leads set archived_at=null where id=lead;
 insert into public.crm_leads(id,full_name,email) values(unlinked,'Synthetic unlinked','archive-'||unlinked||'@example.invalid');
 delete from public.crm_leads where id=unlinked;
 assert not exists(select 1 from public.crm_leads where id=unlinked),'unlinked lead can be deleted';
 assert (select total_amount=1234.56 from public.crm_proposal_versions where proposal_id=pid and version=1),'v1 immutable';
 failed:=false;begin perform public.crm_save_proposal(pid,c1,lead,null,1,snapshot);exception when others then failed:=sqlerrm='stale_version';end;
 assert failed,'reject stale version';assert (select count(*)=2 from public.crm_proposal_versions where proposal_id=pid),'no partial version';
 failed:=false;begin perform public.crm_set_proposal_status(pid,2,'accepted','');exception when others then failed:=sqlerrm='manual_confirmation_required';end;
 assert failed,'manual acceptance evidence required';
 perform public.crm_set_proposal_status(pid,2,'accepted','Synthetic confirmation by email');
 assert (select status='won' from public.crm_leads where id=lead),'accepted quote updates lead';
 tid:=public.crm_proposal_to_trip(pid,2);tid2:=public.crm_proposal_to_trip(pid,2);
 assert tid=tid2,'idempotent quote conversion';
 assert (select total_amount=1500 and departure_date='2027-04-06' and return_date='2027-04-17' from public.crm_trips where id=tid),'trip snapshot';
 assert exists(select 1 from public.crm_trip_clients where trip_id=tid and client_id=c1),'traveler relation';
 -- Templates: idempotency, moving dates, completed/manual tasks and explicit removal.
 template:=public.crm_save_checklist_template(null,'Synthetic workflow '||c1::text,'custom',true,false,
 jsonb_build_array(jsonb_build_object('title','Synthetic before','anchor','departure','offset_days',-3,'phase','before','sort_order',10),
 jsonb_build_object('title','Synthetic after','anchor','return','offset_days',2,'phase','after','sort_order',20)));
 perform public.crm_sync_trip_checklists(tid,template);perform public.crm_sync_trip_checklists(tid,template);
 select i.id,t.id,t.due_at into item,task,before_due from public.crm_checklist_items i join public.crm_trip_tasks t on t.template_item_id=i.id where i.template_id=template and i.anchor='departure' and t.trip_id=tid;
 assert (select count(*)=2 from public.crm_trip_tasks where trip_id=tid and template_item_id in(select id from public.crm_checklist_items where template_id=template)),'no duplicate checklist';
 assert (before_due at time zone 'Europe/Lisbon')::date='2027-04-03','relative deadline';
 update public.crm_trips set departure_date='2027-04-08' where id=tid;
 assert (select (due_at at time zone 'Europe/Lisbon')::date='2027-04-05' from public.crm_trip_tasks where id=task),'reschedule';
 update public.crm_trip_tasks set title='Synthetic manual title',template_override=true,due_at='2027-04-01T12:00:00Z' where id=task;
 update public.crm_trips set departure_date='2027-04-09' where id=tid;
 assert (select title='Synthetic manual title' and due_at='2027-04-01T12:00:00Z' from public.crm_trip_tasks where id=task),'manual override';
 perform public.crm_reset_template_task(task);
 assert (select title='Synthetic before' and (due_at at time zone 'Europe/Lisbon')::date='2027-04-06' from public.crm_trip_tasks where id=task),'reset override';
 update public.crm_trip_tasks set completed=true where id=task;
 update public.crm_trips set departure_date='2027-04-10' where id=tid;
 assert (select (due_at at time zone 'Europe/Lisbon')::date='2027-04-06' from public.crm_trip_tasks where id=task),'completed preserved';
 perform public.crm_delete_task(task);perform public.crm_sync_trip_checklists(tid);
 assert not exists(select 1 from public.crm_trip_tasks where trip_id=tid and template_item_id=item),'deleted template task stays removed';
 assert exists(select 1 from public.crm_checklist_skips where trip_id=tid and item_id=item),'skip recorded';
 -- All relationships follow a reviewed client merge.
 insert into public.crm_trip_clients(trip_id,client_id) values(tid,c2) on conflict do nothing;
 insert into public.crm_client_documents(id,client_id,document_type,document_number,expires_on) values(doc,c1,'passport','SYNTHETIC-ID-DO-NOT-AUDIT','2028-04-01');
 insert into public.crm_drive_files(id,client_id,drive_file_id,file_name,mime_type) values(drive,c1,'synthetic-file-'||drive::text,'Synthetic.pdf','application/pdf');
 assert exists(select 1 from jsonb_array_elements(public.crm_duplicate_candidates()) p where p->'left'->>'id' in(c1::text,c2::text) and p->'right'->>'id' in(c1::text,c2::text)),'duplicate candidate';
 perform public.crm_add_activity_note('trip',tid,'Synthetic operational note');
 perform public.crm_merge_clients(c1,c2,jsonb_build_object('full_name',name,'email','office-'||c1::text||'@example.invalid','phone','912000999','language','pt','internal_notes','Synthetic merged notes'));
 assert not exists(select 1 from public.crm_clients where id=c1),'source removed';
 assert (select client_id=c2 from public.crm_trips where id=tid),'primary client moved';
 assert (select client_id=c2 from public.crm_leads where id=lead),'lead moved';
 assert (select client_id=c2 from public.crm_proposals where id=pid),'proposal moved';
 assert (select client_id=c2 from public.crm_client_documents where id=doc),'document moved';
 assert (select client_id=c2 from public.crm_drive_files where id=drive),'Drive metadata moved';
 assert (select count(*)=1 from public.crm_trip_clients where trip_id=tid),'travelers deduped';
 assert not exists(select 1 from public.crm_activity where client_id=c1),'history moved';
 assert not exists(select 1 from public.crm_activity where details::text like '%SYNTHETIC-ID-DO-NOT-AUDIT%' or label like '%SYNTHETIC-ID-DO-NOT-AUDIT%'),'document number excluded from audit';
 -- Cascade deletes must not break the audit FK relationships.
 delete from public.crm_trips where id=tid;
 assert (select trip_id is null from public.crm_proposals where id=pid),'proposal survives trip deletion';
 delete from public.crm_client_documents where id=doc;
 delete from public.crm_clients where id=c2;
 assert (select client_id is null from public.crm_proposals where id=pid),'proposal survives client deletion';
 -- New tables and RPCs are private; service role cannot rewrite version snapshots.
 assert not has_table_privilege('anon','public.crm_proposals','select'),'anonymous proposal read denied';
 assert not has_table_privilege('authenticated','public.crm_activity','select'),'non-admin audit read denied';
 assert not has_function_privilege('anon','public.crm_merge_clients(uuid,uuid,jsonb)','execute'),'anonymous merge denied';
 assert not has_function_privilege('authenticated','public.crm_save_proposal(uuid,uuid,uuid,uuid,integer,jsonb)','execute'),'non-admin proposal write denied';
 assert not has_table_privilege('service_role','public.crm_proposal_versions','update'),'version updates denied';
end; $$;
rollback;
select 'PASS: proposal snapshots/conflicts/acceptance/conversion; checklist idempotency/rescheduling/overrides/completed/removal; reviewed merge preserves all links; audit privacy/cascades; role restrictions. Synthetic data rolled back.' as result;
