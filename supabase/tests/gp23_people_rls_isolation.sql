-- Gestão de Pessoas L23 — RLS sintético: pessoa com dois vínculos em duas escolas, transferência temporal.
-- Termina em RAISE: nada persiste (rollback). Prova 0383: leitor da escola A vê só vínculo/lotação da A.
DO $t$
DECLARE
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); un uuid := gen_random_uuid();
  v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid();
  pp uuid; sa text; sb text; n_links int; n_post int; ok text := '';
BEGIN
  SET LOCAL statement_timeout = '30s';
  SELECT s.id INTO sa FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  SELECT s.id INTO sb FROM public.institutional_schools s WHERE s.id <> sa ORDER BY s.id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('GP23 Professora Sintética', 'pessoa-natural') RETURNING id INTO pp;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, link_nature_id, link_nature_version, valid_from)
    VALUES (v1, 1, pp, 'gp23-natureza', 1, '2026-01-01'), (v2, 1, pp, 'gp23-natureza', 1, '2026-01-01');
  -- v1 na escola A até 31/05 e transferido para B em 01/06; v2 só na B
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, valid_until) VALUES
    (gen_random_uuid(), 1, v1, sa, '2026-01-01', '2026-05-31'),
    (gen_random_uuid(), 1, v1, sb, '2026-06-01', NULL),
    (gen_random_uuid(), 1, v2, sb, '2026-01-01', NULL);
  -- políticas guardam a identidade de has_school_capability; ela resolve school_capability_grant por nome ⇒ stub sintético aqui
  ALTER FUNCTION public.school_capability_grant(text, text) RENAME TO scg_gp23_original;
  EXECUTE format($s$CREATE FUNCTION public.school_capability_grant(_capability text, _school text)
    RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT gen_random_uuid(), gen_random_uuid(), 1
       WHERE _capability = 'consultar-registro-funcional' AND ((auth.uid() = %L::uuid AND _school = %L) OR (auth.uid() = %L::uuid AND _school = %L)) $b$$s$, ua, sa, ub, sb);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n_links FROM public.professional_functional_links WHERE person_id = pp;
  SELECT count(*) INTO n_post FROM public.professional_postings WHERE functional_link_logical_id IN (v1, v2);
  IF n_links <> 1 OR n_post <> 1 THEN RAISE EXCEPTION 'gp23-fail leitor A viu % vínculos/% lotações (esperado 1/1)', n_links, n_post; END IF;
  ok := ok || 'A:1/1 ';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n_links FROM public.professional_functional_links WHERE person_id = pp;
  SELECT count(*) INTO n_post FROM public.professional_postings WHERE functional_link_logical_id IN (v1, v2);
  IF n_links <> 2 OR n_post <> 2 THEN RAISE EXCEPTION 'gp23-fail leitor B viu % vínculos/% lotações (esperado 2/2)', n_links, n_post; END IF;
  ok := ok || 'B:2/2 ';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', un, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n_links FROM public.professional_functional_links WHERE person_id = pp;
  IF n_links <> 0 THEN RAISE EXCEPTION 'gp23-fail sem capacidade viu % vínculos', n_links; END IF;
  ok := ok || 'sem-cap:0 ';
  BEGIN
    INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from) VALUES (gen_random_uuid(), 1, v1, sa, '2026-07-01');
    RAISE EXCEPTION 'gp23-fail escrita direta aceita';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok || 'escrita-direta:negada ';
  END;
  RESET ROLE;
  RAISE EXCEPTION 'gp23-ok %', ok;
END $t$;
