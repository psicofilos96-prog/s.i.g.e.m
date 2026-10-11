-- 0312 inseriu a conferência em todas as ocorrências da âncora (inclusive no ramo de versão existente, onde o Núcleo atua);
-- agora ela fica só no ramo de pedido novo da escola.
DO $m$
DECLARE src text; anchor text := '    w := public.meal_order_window_for(_competence, _school);';
  inj text := '    IF _school IS NULL THEN RAISE EXCEPTION ''meal:school-required''; END IF;' || chr(10)
    || '    PERFORM public.meal_grant_on(''submeter-pedido-alimentar'', _school, (now() AT TIME ZONE ''America/Sao_Paulo'')::date);' || chr(10);
  pos int;
BEGIN
  SELECT pg_get_functiondef('public.record_meal_order(uuid,integer,text,text,text,jsonb,text)'::regprocedure) INTO src;
  src := replace(src, inj || anchor, anchor);
  pos := position(anchor in src);
  IF pos = 0 THEN RAISE EXCEPTION 'âncora ausente'; END IF;
  src := substr(src, 1, pos - 1) || inj || substr(src, pos);
  EXECUTE src;
END $m$;