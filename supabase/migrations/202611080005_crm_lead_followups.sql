-- Scheduled next contact for sales leads, surfaced in the CRM dashboard and calendar.
alter table public.crm_leads
  add column if not exists follow_up_date date,
  add column if not exists lost_reason text check (lost_reason is null or char_length(lost_reason) <= 500);
