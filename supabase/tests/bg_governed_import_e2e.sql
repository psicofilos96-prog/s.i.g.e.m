-- Frente BG — E2E transacional sintético do pipeline de importação governada. Termina em RAISE: nada persiste.
-- Conteúdo 100% sintético; adaptador de teste "bg-sintetico" (só existe nesta transação, nenhum layout externo presumido).
DO $t$
DECLARE
  u uuid := gen_random_uuid(); us uuid := gen_random_uuid(); p uuid; ps uuid; sch text;
  h text := encode(sha256('bg-sintetico-arquivo'::bytea), 'hex');
  j jsonb; d jsonb; b uuid; b2 uuid; rv uuid; rr uuid; rj uuid; n int; ok text := '';
  rows jsonb := '[
    {"line_ref":"1","raw":{"id":"S-1","nome":"Unidade Sintética A"},"normalized":{"id":"S-1"},"identity_key":"S-1","outcome":"valida"},
    {"line_ref":"2","raw":{"id":"","nome":""},"identity_key":null,"outcome":"rejeitada","reasons":["campo obrigatório ausente: id"]},
    {"line_ref":"3","raw":{"id":"S-1","nome":"Unidade Sintética A"},"identity_key":"S-1","outcome":"duplicada-na-fonte","reasons":["mesma identidade da linha 1"]},
    {"line_ref":"4","raw":{"id":"S-2","nome":"Outro nome"},"identity_key":"S-2","outcome":"conflito","reasons":["mesmo identificador com conteúdo divergente do canônico"]},
    {"line_ref":"5","raw":{"id":"S-3","nome":"Já igual"},"identity_key":"S-3","outcome":"ja-reconciliada"}
  ]';
BEGIN
  SET LOCAL statement_timeout = '50s';
  SELECT id INTO sch FROM public.institutional_schools ORDER BY id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name) VALUES ('BG Operador Sintético') RETURNING id INTO p;
  INSERT INTO public.institutional_persons(display_name) VALUES ('BG Escola Sintética') RETURNING id INTO ps;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (u, p), (us, ps);
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_bg_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT 'gerir-importacao-de-dados', '00000000-0000-0000-0000-0000000000b9'::uuid, '00000000-0000-0000-0000-0000000000b9'::uuid, 1, 'rede', NULL::text WHERE auth.uid() = %L::uuid
      UNION ALL
      SELECT 'gerir-importacao-de-dados', '00000000-0000-0000-0000-0000000000ba'::uuid, '00000000-0000-0000-0000-0000000000b9'::uuid, 1, 'escola', %L WHERE auth.uid() = %L::uuid $b$$s$, u, sch, us);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  j := public.stage_import_batch('bg-sintetico', 1, 'arquivo-sintetico.csv', h, rows, NULL, NULL); b := (j->>'id')::uuid;
  IF (j->>'already_staged')::boolean THEN RAISE EXCEPTION 'primeiro staging'; END IF;
  j := public.stage_import_batch('bg-sintetico', 1, 'arquivo-sintetico.csv', h, rows, NULL, NULL);
  IF NOT (j->>'already_staged')::boolean OR (j->>'id')::uuid <> b THEN RAISE EXCEPTION 'idempotencia: %', j; END IF;
  ok := ok || 'idempotencia-hash; ';
  d := public.import_batch_detail(b) -> 'rows';
  IF jsonb_array_length(d) <> 5 THEN RAISE EXCEPTION 'linhas: %', jsonb_array_length(d); END IF;
  SELECT (x->>'id')::uuid INTO rv FROM jsonb_array_elements(d) x WHERE x->>'outcome' = 'valida';
  SELECT (x->>'id')::uuid INTO rj FROM jsonb_array_elements(d) x WHERE x->>'outcome' = 'rejeitada';
  SELECT (x->>'id')::uuid INTO rr FROM jsonb_array_elements(d) x WHERE x->>'outcome' = 'ja-reconciliada';
  IF (SELECT count(DISTINCT x->>'outcome') FROM jsonb_array_elements(d) x) <> 5 THEN RAISE EXCEPTION 'classes'; END IF;
  BEGIN PERFORM 1 FROM public.import_batch_rows LIMIT 1; RAISE EXCEPTION 'staging legivel direto';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.stage_import_batch('bg-sintetico', 1, 'x', h, '[{"line_ref":"1","outcome":"rejeitada"}]', NULL, NULL); RAISE EXCEPTION 'rejeitada sem motivo';
  EXCEPTION WHEN raise_exception THEN RAISE; WHEN OTHERS THEN NULL; END;
  ok := ok || 'classes(valida,rejeitada,duplicada,conflito,ja-reconciliada)+motivo-obrigatorio; ';

  BEGIN PERFORM public.record_import_event(b, rv, 'aplicada', 'escola:S-1', NULL); RAISE EXCEPTION 'aplicou sem confirmar';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'import:confirmation-required%' THEN RAISE; END IF; END;
  PERFORM public.record_import_event(b, NULL, 'confirmacao', NULL, NULL);
  BEGIN PERFORM public.record_import_event(b, rj, 'aplicada', 'x', NULL); RAISE EXCEPTION 'aplicou rejeitada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'import:row-not-applicable%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_import_event(b, rr, 'aplicada', 'x', NULL); RAISE EXCEPTION 'aplicou reconciliada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'import:row-not-applicable%' THEN RAISE; END IF; END;
  -- falha no meio: aplicação + erro do writer no mesmo bloco ⇒ nada fica
  BEGIN
    PERFORM public.record_import_event(b, rv, 'aplicada', 'escola:S-1', NULL);
    RAISE EXCEPTION 'writer-falhou-simulado';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'writer-falhou-simulado' THEN RAISE; END IF; END;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.import_batch_detail(b)->'events') e WHERE e->>'row_id' = rv::text AND e->>'kind' = 'aplicada') THEN RAISE EXCEPTION 'aplicacao parcial'; END IF;
  PERFORM public.record_import_event(b, rv, 'aplicada', 'escola:S-1', NULL);
  BEGIN PERFORM public.record_import_event(b, rv, 'aplicada', 'escola:S-1', NULL); RAISE EXCEPTION 'aplicou duas vezes';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'import:row-already-applied%' THEN RAISE; END IF; END;
  ok := ok || 'confirmacao-obrigatoria, so-valida-aplica, sem-aplicacao-parcial, aplicacao-unica; ';

  BEGIN PERFORM public.stage_import_batch('bg-sintetico', 1, 'x', h, rows, gen_random_uuid(), NULL); RAISE EXCEPTION 'reprocesso de lote inexistente';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'import:batch-not-found%' THEN RAISE; END IF; END;
  j := public.stage_import_batch('bg-sintetico', 1, 'arquivo-sintetico.csv', h, rows, b, NULL); b2 := (j->>'id')::uuid;
  IF b2 = b THEN RAISE EXCEPTION 'reprocesso reutilizou lote'; END IF;
  ok := ok || 'reprocesso-encadeado/base-inexistente-recusada; ';

  BEGIN UPDATE public.import_batch_rows SET outcome = 'valida' WHERE id = rj; IF FOUND THEN RAISE EXCEPTION 'staging mutavel'; END IF;
  EXCEPTION WHEN raise_exception THEN RAISE; WHEN OTHERS THEN NULL; END;
  BEGIN INSERT INTO public.import_batch_events(batch_id, kind, actor) VALUES (b, 'confirmacao', u); RAISE EXCEPTION 'dml direto aceito';
  EXCEPTION WHEN raise_exception THEN RAISE; WHEN OTHERS THEN NULL; END;
  ok := ok || 'staging-imutavel, sem-dml-direto; ';

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  BEGIN PERFORM public.stage_import_batch('bg-sintetico', 1, 'x', h, rows, NULL, NULL); RAISE EXCEPTION 'escola importou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_import_event(b, NULL, 'descartado', NULL, 'x'); RAISE EXCEPTION 'escola agiu em lote da rede';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  ok := ok || 'escopo-escola/IDOR recusados; ';

  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.stage_import_batch('bg-sintetico', 1, 'x', h, rows, NULL, NULL); RAISE EXCEPTION 'service importou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' AND SQLERRM NOT LIKE 'session-required%' THEN RAISE; END IF;
            WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE anon;
  BEGIN PERFORM public.stage_import_batch('bg-sintetico', 1, 'x', h, rows, NULL, NULL); RAISE EXCEPTION 'anon importou';
  EXCEPTION WHEN raise_exception THEN RAISE; WHEN OTHERS THEN NULL; END;
  RESET ROLE;
  ok := ok || 'service/anon recusados';
  RAISE EXCEPTION 'bg-e2e-ok: %', ok;
END $t$;
