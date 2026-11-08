-- Simplify the commercial pipeline and preserve requests already in the two removed stages.
alter table public.crm_leads drop constraint if exists crm_leads_status_check;

update public.crm_leads
set status = case
  when status = 'qualifying' then 'new'
  when status = 'research' then 'quote_preparing'
  else status
end
where status in ('qualifying', 'research');

alter table public.crm_leads
  add constraint crm_leads_status_check
  check (status in ('new','quote_preparing','quote_sent','awaiting_reply','won','lost'));
