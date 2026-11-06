-- 0616 — Regression: direct RPC without _on must use Brazil's operational day.
-- PostgreSQL ephemeral CI only. No new policy, role or production operation.
BEGIN;
DO $test$
DECLARE fn text; args text;
BEGIN
  SELECT pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
    INTO fn,args
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='followup_seat_authority'
    AND oidvectortypes(p.proargtypes)='date';
  IF fn IS NULL OR position('America/Sao_Paulo' IN fn)=0
    OR position('America/Sao_Paulo' IN coalesce(args,''))=0
    OR position('CURRENT_DATE' IN args)>0
  THEN RAISE EXCEPTION 'followup-0616:utc-default-regression'; END IF;
  IF has_function_privilege('anon','public.followup_seat_authority(date)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.followup_seat_authority(date)','EXECUTE')
  THEN RAISE EXCEPTION 'followup-0616:changed-rpc-access'; END IF;
  RAISE NOTICE 'FOLLOWUP_0616_SAO_PAULO_DEFAULT_OK';
END $test$;
ROLLBACK;
