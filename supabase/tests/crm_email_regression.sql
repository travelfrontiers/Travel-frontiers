-- Synthetic email lifecycle with no external delivery. All changes roll back.
begin;
do $$
declare
 c uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); q uuid; t uuid; m uuid:=gen_random_uuid();
 recipient text:='crm-email-test@example.invalid'; snapshot jsonb; message jsonb; rejected boolean:=false;
begin
 insert into public.crm_clients(id,full_name,email) values(c,'Email test',recipient);
 insert into public.crm_leads(id,full_name,email,client_id) values(l,'Email test',recipient,c);
 snapshot:=jsonb_build_object('title','Quote','total_amount',850,'currency','EUR','departure_date','2030-05-01','return_date','2030-05-10',
   'imported',jsonb_build_object('reference','TEST','adults','2','children_count','0','services',
     jsonb_build_array(jsonb_build_object('service_type','flight','title','Sample flight','reference','TF 42','starts_on','2030-05-01'))));
 q:=(public.crm_save_proposal(null,c,l,null,0,snapshot)->>'id')::uuid;
 perform public.crm_save_proposal(q,c,l,null,1,snapshot);
 message:=jsonb_build_object('id',m,'client_id',c,'lead_id',l,'proposal_id',q,'proposal_version',1,'template_key','quote',
   'internet_message_id','<tf-test@example.invalid>','sender','smtp@example.invalid','recipient',recipient||', second@example.invalid','cc','geral@gupitravel.pt',
   'subject','Test message','body','Only synthetic content','attachments','[]'::jsonb);
 begin perform public.crm_begin_email_send(message);
 exception when others then rejected:=sqlerrm='stale_version'; end;
 assert rejected,'cannot send an outdated quote';
 message:=jsonb_set(message,'{proposal_version}','2');
 assert public.crm_begin_email_send(message),'first send reserves an operation';
 assert not public.crm_begin_email_send(message),'duplicate operation suppressed';
 assert (select recipient_addresses=array['crm-email-test@example.invalid','second@example.invalid'] and cc='geral@gupitravel.pt' from public.crm_emails as email where email.id=m),'all recipients and agency copy retained';
 perform public.crm_finish_email_send(m,'sent');
 assert (select status='sent' from public.crm_proposals where id=q),'SMTP confirmation marks quote as sent';
 assert (select status='quote_sent' from public.crm_leads where id=l),'commercial pipeline updated';
 insert into public.crm_emails(client_id,lead_id,proposal_id,proposal_version,direction,state,internet_message_id,sender,recipient,subject,body)
 values(c,l,q,2,'in','received','<reply-test@example.invalid>',recipient,'smtp@example.invalid','Re: Test','Acceptance test');
 assert (select status='sent' from public.crm_proposals where id=q),'inbound email does not accept the quote';
 perform public.crm_set_proposal_status(q,2,'accepted','Explicit manual confirmation');
 t:=public.crm_proposal_to_trip(q,2);
 assert t=public.crm_proposal_to_trip(q,2),'conversion is idempotent';
 assert (select reference='TEST' and adults=2 and children_count=0 from public.crm_trips where id=t),'itinerary metadata copied';
 assert (select count(*)=1 from public.crm_trip_services where trip_id=t and reference='TF 42'),'flight copied once';
 assert (select count(*)=2 from public.crm_emails where trip_id=t and proposal_id=q),'correspondence follows trip';
 assert not has_table_privilege('anon','public.crm_emails','select'),'anonymous history denied';
 assert not has_table_privilege('authenticated','public.crm_email_templates','select'),'non-admin templates denied';
 assert not has_function_privilege('authenticated','public.crm_begin_email_send(jsonb)','execute'),'non-admin send denied';
end $$;
rollback;
