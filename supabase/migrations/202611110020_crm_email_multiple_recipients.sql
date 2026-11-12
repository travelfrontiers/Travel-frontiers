begin;

alter table public.crm_emails
  drop constraint crm_emails_recipient_check,
  add constraint crm_emails_recipient_check check (char_length(recipient) between 1 and 7680),
  add column recipient_addresses text[] generated always as (string_to_array(recipient, ', ')) stored;

create index crm_emails_recipient_addresses_idx on public.crm_emails using gin (recipient_addresses);

commit;
