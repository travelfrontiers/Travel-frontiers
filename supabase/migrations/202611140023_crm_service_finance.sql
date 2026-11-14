begin;

alter table public.crm_trip_services
 add column service_status text not null default 'unspecified'
  check(service_status in('unspecified','quoted','confirmed','completed','cancelled')),
 add column finance_version integer not null default 0 check(finance_version>=0),
 add column sale_price numeric(12,2) check(sale_price>=0),
 add column net_cost numeric(12,2) check(net_cost>=0),
 add column service_commission numeric(12,2) check(service_commission>=0),
 add column service_adjustment numeric(12,2),
 add column finance_currency text check(finance_currency ~ '^[A-Z]{3}$'),
 add column finance_basis text check(finance_basis in('booking','person')),
 add column finance_quantity integer check(finance_quantity between 1 and 50),
 add column commission_method text check(commission_method in('included','markup','fixed','unknown')),
 add column finance_source text check(char_length(btrim(finance_source)) between 1 and 240),
 add constraint crm_service_finance_context check(
   (num_nonnulls(sale_price,net_cost,service_commission,service_adjustment)=0 or
     num_nonnulls(finance_currency,finance_basis,finance_quantity,finance_source)=4)
   and (finance_basis is distinct from 'booking' or finance_quantity is not distinct from 1)
   and (service_commission is null or commission_method is not null)
   and (service_adjustment is null or (sale_price is not null and sale_price+service_adjustment>=0))
 );

create table public.crm_service_finance_history(
 id bigint generated always as identity primary key,
 trip_id uuid not null,
 service_id uuid not null,
 recorded_at timestamptz not null default now(),
 action text not null check(action in('updated','removed')),
 snapshot jsonb not null
);
create index crm_service_finance_history_trip_idx on public.crm_service_finance_history(trip_id,id desc);
alter table public.crm_service_finance_history enable row level security;
revoke all on public.crm_service_finance_history from public,anon,authenticated,service_role;
grant select on public.crm_service_finance_history to service_role;

create function public.crm_record_service_finance()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.crm_trip_services;
begin
 if tg_op='DELETE' then s:=old; else s:=new; end if;
 if s.finance_version=0 then return null; end if;
 insert into public.crm_service_finance_history(trip_id,service_id,action,snapshot)
 values(s.trip_id,s.id,case when tg_op='DELETE' then 'removed' else 'updated' end,
  jsonb_build_object('title',s.title,'service_status',s.service_status,'version',s.finance_version,
   'sale_price',s.sale_price,'net_cost',s.net_cost,'service_commission',s.service_commission,'service_adjustment',s.service_adjustment,
   'finance_currency',s.finance_currency,'finance_basis',s.finance_basis,'finance_quantity',s.finance_quantity,
   'commission_method',s.commission_method,'finance_source',s.finance_source));
 return null;
end; $$;
revoke all on function public.crm_record_service_finance() from public,anon,authenticated;
create trigger crm_service_finance_revision after update of finance_version on public.crm_trip_services
 for each row when (new.finance_version is distinct from old.finance_version) execute function public.crm_record_service_finance();
create trigger crm_service_finance_removal after delete on public.crm_trip_services
 for each row execute function public.crm_record_service_finance();

create function public.crm_save_service_finance(p_id uuid,p_trip_id uuid,p_version integer,p_data jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.crm_trip_services;
begin
 perform 1 from public.crm_trips where id=p_trip_id and archived_at is null for update;
 if not found then raise exception 'trip_not_found'; end if;
 select * into s from public.crm_trip_services where id=p_id and trip_id=p_trip_id for update;
 if not found then raise exception 'service_not_found'; end if;
 if s.finance_version is distinct from p_version then raise exception 'finance_stale_version'; end if;
 update public.crm_trip_services
 set service_status=p_data->>'service_status',sale_price=(p_data->>'sale_price')::numeric,
     net_cost=(p_data->>'net_cost')::numeric,service_commission=(p_data->>'service_commission')::numeric,
     service_adjustment=(p_data->>'service_adjustment')::numeric,finance_currency=p_data->>'finance_currency',
     finance_basis=p_data->>'finance_basis',finance_quantity=(p_data->>'finance_quantity')::integer,
     commission_method=p_data->>'commission_method',finance_source=p_data->>'finance_source',
     finance_version=finance_version+1,updated_at=now()
 where id=p_id;
end; $$;
revoke all on function public.crm_save_service_finance(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.crm_save_service_finance(uuid,uuid,integer,jsonb) to service_role;

commit;
