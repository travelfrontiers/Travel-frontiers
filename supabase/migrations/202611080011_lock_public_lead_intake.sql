-- Apply AFTER deployment of the server-only, rate-limited intake route.
begin;
drop policy if exists "public may submit leads" on public.crm_leads;
revoke insert on public.crm_leads from anon, authenticated;
commit;
