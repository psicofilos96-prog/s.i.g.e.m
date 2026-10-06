-- NAE.8 Lote 5 — prova do RESOLVER REAL de capabilities (sem dublê de effective_scope_capabilities).
-- Política sintética NAE8L5 (rascunho → regras → homologada por decisão do proprietário), tipos de atuação
-- sintéticos exclusivos (nae8l5-*) que nenhuma atuação real usa, pessoas/usuários sintéticos.
-- Revogação pelo writer canônico end_engagement durante a "sessão" (sem logout).
-- Termina em RAISE: nada persiste (política homologada é imutável, por isso só existe dentro da transação).
DO $t$
DECLARE _ok text := ''; td date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; tz text := 'America/Sao_Paulo';
  s1 text; s2 text; pol uuid := gen_random_uuid(); j jsonb; n int; n0 int; g uuid;
  pE uuid := gen_random_uuid(); uE uuid := gen_random_uuid(); eE uuid := gen_random_uuid();  -- escola: recebimento+estoque
  pK uuid := gen_random_uuid(); uK uuid := gen_random_uuid(); eK uuid := gen_random_uuid();  -- cozinha sem estoque
  pR uuid := gen_random_uuid(); uR uuid := gen_random_uuid(); eR uuid := gen_random_uuid();  -- núcleo somente leitura
  pM uuid := gen_random_uuid(); uM uuid := gen_random_uuid(); eM uuid := gen_random_uuid();  -- mantenedor de atuações
  pT uuid := gen_random_uuid(); uT uuid := gen_random_uuid(); eT uuid := gen_random_uuid();  -- órgão técnico
BEGIN
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools ORDER BY id OFFSET 1 LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.institutional_engagements WHERE engagement_kind_id LIKE 'nae8l5-%') THEN RAISE EXCEPTION 'pre: tipo sintético em uso'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'esc_nae8_original') THEN RAISE EXCEPTION 'pre: dublê presente'; END IF;

  INSERT INTO public.institutional_persons(id, display_name, actor_nature) VALUES
    (pE,'NAE8L5 Escola','pessoa-natural'),(pK,'NAE8L5 Cozinha','pessoa-natural'),(pR,'NAE8L5 Núcleo leitura','pessoa-natural'),
    (pM,'NAE8L5 Mantenedor','pessoa-natural'),(pT,'NAE8L5 Órgão técnico','orgao-institucional');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (uE,pE),(uK,pK),(uR,pR),(uM,pM),(uT,pT);
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol,'nae8l5-politica-sintetica',1,'draft',td - 30);
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id) VALUES
    (pol,'nae8l5-escola','conferir-recebimento-alimentar'),(pol,'nae8l5-escola','registrar-estoque-alimentar'),(pol,'nae8l5-escola','consultar-alimentacao-escolar'),
    (pol,'nae8l5-cozinha','registrar-execucao-alimentacao'),
    (pol,'nae8l5-rede-leitura','acompanhar-alimentacao-rede'),
    (pol,'nae8l5-mantenedor','manter-atuacoes-institucionais'),
    (pol,'nae8l5-tecnico','registrar-execucao-alimentacao');
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_origin = 'decisao-do-proprietario' WHERE id = pol;
  INSERT INTO public.institutional_engagements(id, person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    (eE,pE,'nae8l5-escola','escola',s1,td - 10),(eK,pK,'nae8l5-cozinha','escola',s1,td - 10),
    (eR,pR,'nae8l5-rede-leitura','rede',NULL,td - 10),(eM,pM,'nae8l5-mantenedor','rede',NULL,td - 10),(eT,pT,'nae8l5-tecnico','escola',s1,td - 10);

  CREATE FUNCTION pg_temp.nae8_as(_u uuid) RETURNS void LANGUAGE sql AS $b$
    SELECT set_config('request.jwt.claims', CASE WHEN _u IS NULL THEN '' ELSE jsonb_build_object('sub', _u, 'role','authenticated')::text END, true) $b$;
  CREATE FUNCTION pg_temp.nae8_fail(_sql text, _pat text) RETURNS void LANGUAGE plpgsql AS $b$
    BEGIN EXECUTE _sql; RAISE EXCEPTION 'nae8-should-fail[%]: %', _pat, left(_sql, 120);
    EXCEPTION WHEN others THEN IF SQLERRM LIKE 'nae8-should-fail%' OR SQLERRM NOT LIKE '%' || _pat || '%' THEN
      RAISE EXCEPTION 'nae8-unexpected[%]: %', _pat, SQLERRM; END IF; END $b$;

  SET LOCAL ROLE authenticated;
  -- 1. resolver real: escopo escola
  PERFORM pg_temp.nae8_as(uE);
  SELECT count(*) INTO n FROM public.effective_scope_capabilities(td) WHERE policy_id = pol AND school_id = s1;
  IF n <> 3 THEN RAISE EXCEPTION 'falha: resolver escola % caps', n; END IF;
  g := public.meal_grant_on('registrar-estoque-alimentar', s1, td);
  IF g <> eE THEN RAISE EXCEPTION 'falha: grant engagement'; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_grant_on(%L,%L,%L)','registrar-estoque-alimentar',s2,td), 'capability:registrar-estoque-alimentar');
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_grant_on(%L,%L,%L)','registrar-estoque-alimentar',s1,td - 11), 'capability:');  -- antes da vigência
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_network_grant_on(%L,%L)','acompanhar-alimentacao-rede',td), 'capability:');
  _ok := _ok || 'resolver-real-escola,outra-escola,vigencia,sem-rede;';

  -- 2. cozinha sem estoque
  PERFORM pg_temp.nae8_as(uK);
  j := public.meal_kitchen_day_at(s1, td);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_kitchen_day_at(%L,%L)',s2,td), 'capability:registrar-execucao-alimentacao');
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_grant_on(%L,%L,%L)','registrar-estoque-alimentar',s1,td), 'capability:registrar-estoque-alimentar');
  _ok := _ok || 'cozinha-real,cozinha-outra-escola,cozinha-sem-estoque;';

  -- 3. núcleo somente leitura: lê rede, não ganha writer
  PERFORM pg_temp.nae8_as(uR);
  PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', td);
  PERFORM public.meal_reporting_summary(NULL, td - 30, td);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_network_grant_on(%L,%L)','fechar-estoque-alimentar',td), 'capability:fechar-estoque-alimentar');
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_grant_on(%L,%L,%L)','registrar-estoque-alimentar',s1,td), 'capability:registrar-estoque-alimentar');
  _ok := _ok || 'rede-leitura,rede-sem-writer;';

  -- 4. ator técnico com capability não vira autor humano
  PERFORM pg_temp.nae8_as(uT);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,true,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,NULL,%L,NULL)','registro',s1,td,'nae8l5-almoco',tz), 'natural-person-required');
  _ok := _ok || 'ator-tecnico;';

  -- 5. revogação durante a sessão pelo writer canônico (sem logout): efeito imediato
  PERFORM pg_temp.nae8_as(uK);
  PERFORM public.meal_kitchen_day_at(s1, td);
  PERFORM pg_temp.nae8_as(uM);
  PERFORM public.end_engagement(eK, td - 1, NULL);
  PERFORM pg_temp.nae8_as(uK);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_kitchen_day_at(%L,%L)',s1,td), 'capability:registrar-execucao-alimentacao');
  PERFORM pg_temp.nae8_as(uE);
  PERFORM pg_temp.nae8_fail(format('SELECT public.end_engagement(%L,%L,NULL)',eE,td), 'capability:manter-atuacoes-institucionais');  -- sem autoatribuição/autorrevogação indevida
  _ok := _ok || 'revogacao-imediata,sem-autogestao;';

  -- 6. papel do app sem DML direto em tabelas NAE e sem escrita em política
  RESET ROLE;
  SELECT count(*) INTO n FROM pg_tables t WHERE t.schemaname = 'public' AND t.tablename LIKE 'meal\_%'
    AND (has_table_privilege('authenticated', format('public.%I', t.tablename), 'INSERT,UPDATE,DELETE')
      OR has_table_privilege('anon', format('public.%I', t.tablename), 'SELECT,INSERT,UPDATE,DELETE'));
  IF n <> 0 THEN RAISE EXCEPTION 'falha: % tabelas meal_* com DML para app', n; END IF;
  IF has_table_privilege('authenticated','public.capability_policy_rules','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'falha: regras graváveis'; END IF;
  SELECT count(*) INTO n FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'record_meal%' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n <> 0 THEN RAISE EXCEPTION 'falha: % writers executáveis por anon', n; END IF;
  _ok := _ok || 'sem-dml-app,regras-protegidas,writers-sem-anon;';

  RAISE EXCEPTION 'nae8-l5-ok: %', _ok;
END $t$;
