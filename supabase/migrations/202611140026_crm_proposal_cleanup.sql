begin;

alter table public.crm_proposals
  add column status_before_archive text
  check (status_before_archive in ('draft','sent','accepted','declined'));

create function public.crm_manage_proposal(p_id uuid,p_version integer,p_status text,p_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare proposal public.crm_proposals%rowtype;
begin
  select * into proposal from public.crm_proposals where id=p_id for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if proposal.current_version is distinct from p_version or proposal.status is distinct from p_status then
    raise exception 'stale_version';
  end if;

  if p_action='archive' and proposal.status<>'archived' then
    update public.crm_proposals set status='archived',status_before_archive=proposal.status,updated_at=now()
    where id=p_id returning * into proposal;
  elsif p_action='restore' and proposal.status='archived' then
    if proposal.status_before_archive is null then raise exception 'proposal_archive_status_unknown'; end if;
    update public.crm_proposals set status=proposal.status_before_archive,status_before_archive=null,updated_at=now()
    where id=p_id returning * into proposal;
  elsif p_action='delete' then
    if (proposal.status not in ('draft','declined') and
        not (proposal.status='archived' and coalesce(proposal.status_before_archive,'') in ('draft','declined')))
      or proposal.trip_id is not null or proposal.confirmation_note is not null
      or exists(select 1 from public.crm_emails where proposal_id=p_id)
      or exists(select 1 from public.crm_activity where proposal_id=p_id
        and (details->>'status' in ('accepted','sent') or details->>'previous_status' in ('accepted','sent')))
    then raise exception 'proposal_has_history';
    end if;
    delete from public.crm_proposals where id=p_id;
    return jsonb_build_object('deleted',true);
  else
    raise exception 'invalid_status';
  end if;
  return to_jsonb(proposal);
end; $$;

revoke all on function public.crm_manage_proposal(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.crm_manage_proposal(uuid,integer,text,text) to service_role;

commit;
