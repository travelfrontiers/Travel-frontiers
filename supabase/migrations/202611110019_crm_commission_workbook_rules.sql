begin;

-- Keep accepting the previous format during rollout. Existing snapshots are untouched.
do $$
declare
  definition text := pg_get_functiondef('public.crm_finance_mutate(uuid,integer,text,jsonb)'::regprocedure);
  previous text := $rule$p_data->'snapshot'->>'rules_version' is distinct from 'tf-commission-v1'$rule$;
  current_rule text := $rule$coalesce(p_data->'snapshot'->>'rules_version','') not in ('tf-commission-v1','tf-commission-v2')$rule$;
begin
  if position(current_rule in definition) > 0 then return; end if;
  if position(previous in definition) = 0 then
    raise exception 'commission_rules_version_check_not_found';
  end if;
  execute replace(definition, previous, current_rule);
end;
$$;

commit;
