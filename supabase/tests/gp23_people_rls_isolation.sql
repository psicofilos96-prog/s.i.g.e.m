-- Gestão de Pessoas L23 — RLS sintético: pessoa com dois vínculos em duas escolas, transferência temporal.
-- Termina em RAISE: nada persiste (rollback). Prova 0383: leitor da escola A vê só vínculo/lotação da A.
DO $t$
DECLARE
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); un uuid := gen_random_uuid();
  pp uuid; sa text; sb text; n_links int; n_post int; ok text := '';
BEGIN
  SET LOCAL statement_timeout = '30s';
  SELECT s.id INTO sa FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  SELECT s.id INTO sb FROM public.institutional_schools s WHERE s.id <> sa ORDER BY s.id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('GP23 Professora Sintética', 'pessoa-natural') RETURNING id INTO pp;
  -- dois vínculos da mesma pessoa
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, link_nature_id, link_nature_version, valid_from)
    VALUES ('gp23-v1', 1, pp, 'gp23-natureza', 1, '2026-01-01'), ('gp23-v2', 1, pp, 'gp23-natureza', 1, '2026-01-01');
  -- v1 na escola A até 31/05 e transferido para B a partir de 01/06; v2 só na B
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, valid_until) VALUES
    ('gp23-p1', 1, 'gp23-v1', sa, '2026-01-01', '2026-05-31'),
    ('gp23-p2', 1, 'gp23-v1', sb, '2026-06-01', NULL),
    ('gp23-p3', 1, 'gp23-v2', sb, '2026-01-01', NULL);
  -- capacidade sintética: ua só na A, ub só na B, un nenhuma
  ALTER FUNCTION public.has_school_capability(text, text) RENAME TO hsc_gp23_original;
  EXECUTE format($s$CREATE FUNCTION public.has_school_capability(_capability text, _school text) RETURNS boolean
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT _capability = 'consultar-registro-funcional' AND ((auth.uid() = %L::uuid AND _school = %L) OR (auth.uid() = %L::uuid AND _school = %L)) $b$$s$, ua, sa, ub, sb);
  GRANT EXECUTE ON FUNCTION public.has_school_capability(text, text) TO authenticated;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n_links FROM public.professional_functional_links WHERE logical_id LIKE 'gp23-%';
  SELECT count(*) INTO n_post FROM public.professional_postings WHERE logical_id LIKE 'gp23-%';
  IF n_links <> 1 OR n_post <> 1 THEN RAISE EXCEPTION 'gp23-fail leitor A viu % vínculos/% lotações (esperado 1/1)', n_links, n_post; END IF;
  ok := ok || 'A:1/1 ';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n_links FROM public.professional_functional_links WHERE logical_id LIKE 'gp23-%';
  SELECT count(*) INTO n_post FROM public.professional_postings WHERE logical_id LIKE 'gp23-%';
  IF n_links <> 2 OR n_post <> 2 THEN RAISE EXCEPTION 'gp23-fail leitor B viu % vínculos/% lotações (esperado 2/2)', n_links, n_post; END IF;
  ok := ok || 'B:2/2 ';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', un, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n_links FROM public.professional_functional_links WHERE logical_id LIKE 'gp23-%';
  IF n_links <> 0 THEN RAISE EXCEPTION 'gp23-fail sem capacidade viu % vínculos', n_links; END IF;
  ok := ok || 'sem-cap:0 ';

  BEGIN
    INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from) VALUES ('gp23-x', 1, 'gp23-v1', sa, '2026-07-01');
    RAISE EXCEPTION 'gp23-fail escrita direta aceita';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok || 'escrita-direta:negada ';
  END;
  RESET ROLE;
  RAISE EXCEPTION 'gp23-ok %', ok;
END $t$;
