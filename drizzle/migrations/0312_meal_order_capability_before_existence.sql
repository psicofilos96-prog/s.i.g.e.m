-- Defeito de enumeração: conta sem permissão na escola recebia 'window-not-open'/'order-exists-use-base' antes da recusa
-- de capability, revelando janela e pedido de outra escola. A capability da escola passa a ser conferida primeiro.
DO $m$
DECLARE src text; anchor text := '    w := public.meal_order_window_for(_competence, _school);';
BEGIN
  SELECT pg_get_functiondef('public.record_meal_order(uuid,integer,text,text,text,jsonb,text)'::regprocedure) INTO src;
  IF position(anchor in src) = 0 THEN RAISE EXCEPTION 'âncora ausente em record_meal_order'; END IF;
  src := replace(src, anchor, '    IF _school IS NULL THEN RAISE EXCEPTION ''meal:school-required''; END IF;' || chr(10)
    || '    PERFORM public.meal_grant_on(''submeter-pedido-alimentar'', _school, (now() AT TIME ZONE ''America/Sao_Paulo'')::date);' || chr(10) || anchor);
  EXECUTE src;
END $m$;