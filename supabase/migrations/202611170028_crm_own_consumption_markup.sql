begin;

do $$
declare
  definition text := pg_get_functiondef('public.crm_finance_mutate(uuid,integer,text,jsonb)'::regprocedure);
  previous text := $rule$coalesce(p_data->'snapshot'->>'rules_version','') not in ('tf-commission-v1','tf-commission-v2')$rule$;
  current_rule text := $rule$coalesce(p_data->'snapshot'->>'rules_version','') not in ('tf-commission-v1','tf-commission-v2','tf-commission-v3')$rule$;
begin
  if position(current_rule in definition) > 0 then return; end if;
  if position(previous in definition) = 0 then
    raise exception 'commission_rules_version_check_not_found';
  end if;
  execute replace(definition, previous, current_rule);
end;
$$;

commit;
