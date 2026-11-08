-- Store document metadata only; do not upload document scans here.
create table if not exists public.crm_client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  document_type text not null check (document_type in ('passport','identity_card','residence_permit','other')),
  document_number text not null check (char_length(btrim(document_number)) between 1 and 80),
  expires_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_client_documents_expiry_idx
  on public.crm_client_documents (expires_on);
create index if not exists crm_client_documents_client_idx
  on public.crm_client_documents (client_id);

alter table public.crm_client_documents enable row level security;
revoke all on public.crm_client_documents from anon, authenticated;
grant all on public.crm_client_documents to service_role;
