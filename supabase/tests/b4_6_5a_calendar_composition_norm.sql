-- B4.6.5a — Estrutura da norma de seleção/composição de calendários (0030).
-- Fixtures 100% sintéticas inseridas pelo dono (não há writer); termina em RAISE ⇒ rollback total.
DO $t$
DECLARE
  u uuid := '00000000-0000-0000-0000-00000b465a01'; p uuid := '00000000-0000-0000-0000-00000b465a91'; e uuid;
  v1 uuid; v2 uuid; v3 uuid; vb uuid; vc uuid; vd uuid; h1 uuid; h2 uuid; k0 timestamptz; k1 timestamptz;
  ok text := ''; s text; n integer; _v1 integer; _v2 integer;
  tbls text[] := ARRAY['calendar_composition_norms','calendar_composition_norm_versions','calendar_composition_norm_multiplicity',
    'calendar_composition_norm_dimension_rules','calendar_composition_norm_configuration_records','calendar_composition_norm_homologations'];
  fns text[] := ARRAY['public.calendar_composition_norm_configuration_issue(uuid,timestamptz)','public.calendar_composition_norm_versions_at(date,timestamptz)',
    'public.calendar_composition_norm_homologation_state_at(uuid,date,timestamptz)','public.calendar_composition_norm_state_at(date,timestamptz)'];
  x text; r text; want_state text;
BEGIN
  -- ACL: tabelas sem privilégio nem policy para clientes; helpers sem EXECUTE, INVOKER, search_path vazio.
  FOREACH x IN ARRAY tbls LOOP
    FOREACH r IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('authenticated', 'public.' || x, r) OR has_table_privilege('anon', 'public.' || x, r) THEN
        RAISE EXCEPTION 'acl % %', x, r; END IF;
    END LOOP;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || x)::regclass)
      OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = x) THEN RAISE EXCEPTION 'rls %', x; END IF;
  END LOOP;
  FOREACH x IN ARRAY fns LOOP
    IF has_function_privilege('authenticated', x, 'EXECUTE') OR has_function_privilege('anon', x, 'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = x::regprocedure AND (prosecdef OR NOT coalesce(proconfig @> ARRAY['search_path=""'], false)))
    THEN RAISE EXCEPTION 'fn-acl %', x; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
             WHERE ns.nspname = 'public' AND pr.proname ~ 'composition_norm' AND pr.proname ~ '^(record|homologate|register)')
    OR EXISTS (SELECT 1 FROM capability_policy_rules WHERE capability_id ~ '(^|-)composicao|composition|norma-de-selecao')
  THEN RAISE EXCEPTION 'writer-or-capability-invented'; END IF;
  SELECT count(*) INTO _v1 FROM capability_policy_rules rr JOIN capability_policies cp ON cp.id = rr.policy_id
    WHERE cp.logical_policy_id = 'politica-capacidades-diario' AND cp.version = 1;
  SELECT count(*) INTO _v2 FROM capability_policy_rules rr JOIN capability_policies cp ON cp.id = rr.policy_id
    WHERE cp.logical_policy_id = 'politica-capacidades-diario' AND cp.version = 2;
  IF _v1 <> 108 OR _v2 <> 119 OR EXISTS (SELECT 1 FROM capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND status <> 'draft')
  THEN RAISE EXCEPTION 'policy-state'; END IF;
  IF EXISTS (SELECT 1 FROM calendar_composition_norms) THEN RAISE EXCEPTION 'seeded'; END IF;
  ok := ok || 'acl rls-no-policy helpers-private no-writer no-capability policy-draft no-seed ';

  -- Ausência: nenhuma norma.
  SELECT state INTO s FROM public.calendar_composition_norm_state_at('2026-04-01', clock_timestamp()) WHERE norm_id IS NULL;
  IF s <> 'sem-norma' THEN RAISE EXCEPTION 'absent %', s; END IF;
  BEGIN PERFORM * FROM public.calendar_composition_norm_state_at(NULL, clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:snapshot-required' THEN RAISE; END IF; END;

  INSERT INTO institutional_persons(id, display_name) VALUES (p, 'Pessoa ficticia');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from)
    VALUES (p, 'teste-b465a', 'rede', NULL, '2020-01-01') RETURNING id INTO e;

  -- Versão sem marcador ⇒ configuração não registrada (nunca default).
  INSERT INTO calendar_composition_norms(id) VALUES ('ccn-b465a-a');
  INSERT INTO calendar_composition_norm_versions(norm_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ('ccn-b465a-a', 1, 'constituicao', '2026-01-01', 'ato-sintetico', u, p, e) RETURNING id INTO v1;
  SELECT state INTO s FROM public.calendar_composition_norm_state_at('2026-04-01', clock_timestamp()) WHERE norm_id IS NULL;
  IF s <> 'configuracao-nao-registrada' THEN RAISE EXCEPTION 'unrecorded %', s; END IF;
  BEGIN INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (v1, 1, 'homologada', '2026-01-01', 'ato-h', 'capacidade-sintetica', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:configuration-nao-registrada' THEN RAISE EXCEPTION 'h-unrec %', SQLERRM; END IF; END;

  -- Configuração incompleta: composição sem dimensão; marcador sem multiplicidade.
  INSERT INTO calendar_composition_norm_multiplicity VALUES (v1, 'compor-por-dimensao');
  INSERT INTO calendar_composition_norm_configuration_records(version_id) VALUES (v1);
  IF public.calendar_composition_norm_configuration_issue(v1, clock_timestamp()) <> 'incompleta:composicao-sem-dimensao' THEN RAISE EXCEPTION 'incomplete-dim'; END IF;
  BEGIN INSERT INTO calendar_composition_norm_dimension_rules VALUES (v1, 'efeito-dia-letivo', 'exigir-concordancia', 'indeterminado'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:configuration-already-recorded' THEN RAISE EXCEPTION 'late-child %', SQLERRM; END IF; END;
  BEGIN INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (v1, 1, 'homologada', '2026-01-01', 'ato-h', 'capacidade-sintetica', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:configuration-incompleta:composicao-sem-dimensao' THEN RAISE EXCEPTION 'h-inc %', SQLERRM; END IF; END;
  INSERT INTO calendar_composition_norms(id) VALUES ('ccn-b465a-b');
  INSERT INTO calendar_composition_norm_versions(norm_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ('ccn-b465a-b', 1, 'constituicao', '2030-01-01', 'ato', u, p, e) RETURNING id INTO vb;
  INSERT INTO calendar_composition_norm_configuration_records(version_id) VALUES (vb);
  IF public.calendar_composition_norm_configuration_issue(vb, clock_timestamp()) <> 'incompleta:multiplicidade-nao-declarada' THEN RAISE EXCEPTION 'incomplete-mult'; END IF;
  INSERT INTO calendar_composition_norms(id) VALUES ('ccn-b465a-c');
  INSERT INTO calendar_composition_norm_versions(norm_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ('ccn-b465a-c', 1, 'constituicao', '2030-01-01', 'ato', u, p, e) RETURNING id INTO vc;
  INSERT INTO calendar_composition_norm_multiplicity VALUES (vc, 'exigir-exclusividade');
  INSERT INTO calendar_composition_norm_dimension_rules VALUES (vc, 'eventos', 'uniao-com-diagnostico', 'indeterminado');
  INSERT INTO calendar_composition_norm_configuration_records(version_id) VALUES (vc);
  IF public.calendar_composition_norm_configuration_issue(vc, clock_timestamp()) <> 'incoerente:exclusividade-com-regras-de-dimensao' THEN RAISE EXCEPTION 'incoherent'; END IF;
  -- Versão de outra transação (created_at anterior ao início desta) não aceita filhos.
  INSERT INTO calendar_composition_norms(id) VALUES ('ccn-b465a-d');
  INSERT INTO calendar_composition_norm_versions(norm_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES ('ccn-b465a-d', 1, 'constituicao', '2030-01-01', 'ato', u, p, e, now() - interval '1 hour') RETURNING id INTO vd;
  BEGIN INSERT INTO calendar_composition_norm_multiplicity VALUES (vd, 'exigir-exclusividade'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:version-closed' THEN RAISE EXCEPTION 'closed %', SQLERRM; END IF; END;
  ok := ok || 'absent unrecorded incomplete incoherent closed-version no-homologation-without-config ';

  -- Cadeia de versões incorreta.
  BEGIN INSERT INTO calendar_composition_norm_versions(norm_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES ('ccn-b465a-a', 1, 'constituicao', '2026-01-01', 'ato', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN unique_violation THEN NULL; WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:second-root' THEN RAISE EXCEPTION 'root2 %', SQLERRM; END IF; END;
  BEGIN INSERT INTO calendar_composition_norm_versions(norm_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES ('ccn-b465a-a', 3, v1, 'retificacao', '2026-01-01', 'ato', 'motivo', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:version-gap' THEN RAISE EXCEPTION 'gap %', SQLERRM; END IF; END;
  BEGIN INSERT INTO calendar_composition_norm_versions(norm_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES ('ccn-b465a-b', 2, v1, 'retificacao', '2026-01-01', 'ato', 'motivo', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:predecessor-other-norm' THEN RAISE EXCEPTION 'other %', SQLERRM; END IF; END;
  BEGIN INSERT INTO calendar_composition_norm_versions(norm_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES ('ccn-b465a-a', 2, v1, 'retificacao', '2026-01-01', 'ato', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO calendar_composition_norm_versions(norm_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES ('ccn-b465a-a', 2, v1, 'sucessao', '2025-12-31', 'ato', 'motivo', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:succession-must-start-later' THEN RAISE EXCEPTION 'succ %', SQLERRM; END IF; END;
  ok := ok || 'version-chain ';

  -- Retificação VÁLIDA (sintética) conhecida só depois: k0 lê v1, k1 lê v2.
  k0 := clock_timestamp();
  INSERT INTO calendar_composition_norm_versions(norm_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES ('ccn-b465a-a', 2, v1, 'retificacao', '2026-01-01', 'ato-r', 'configuracao completada', u, p, e, now() + interval '1 hour') RETURNING id INTO v2;
  INSERT INTO calendar_composition_norm_multiplicity VALUES (v2, 'compor-por-dimensao');
  INSERT INTO calendar_composition_norm_dimension_rules VALUES
    (v2, 'efeito-dia-letivo', 'exigir-concordancia', 'indeterminado'),
    (v2, 'eventos', 'uniao-com-diagnostico', 'desconsiderar-candidato-sem-declaracao');
  INSERT INTO calendar_composition_norm_configuration_records(version_id, created_at) VALUES (v2, now() + interval '1 hour');
  k1 := now() + interval '2 hours';
  IF (SELECT version_id FROM public.calendar_composition_norm_state_at('2026-04-01', k0) WHERE norm_id = 'ccn-b465a-a') <> v1
    OR (SELECT version_id FROM public.calendar_composition_norm_state_at('2026-04-01', k1) WHERE norm_id = 'ccn-b465a-a') <> v2
    OR public.calendar_composition_norm_configuration_issue(v2, k0) <> 'nao-registrada'
    OR public.calendar_composition_norm_configuration_issue(v2, k1) IS NOT NULL
  THEN RAISE EXCEPTION 'knownat-versions'; END IF;
  SELECT state INTO s FROM public.calendar_composition_norm_state_at('2026-04-01', k1) WHERE norm_id IS NULL;
  IF s <> 'norma-nao-homologada' THEN RAISE EXCEPTION 'valid-unhomologated %', s; END IF;

  -- Homologação: cadeia, vigência, revogação, conhecimento.
  BEGIN INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (v2, 1, 'homologada', '2025-12-31', 'ato-h', 'capacidade-sintetica', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:outside-version-validity' THEN RAISE EXCEPTION 'h-out %', SQLERRM; END IF; END;
  BEGIN INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (v2, 2, 'homologada', '2026-01-01', 'ato-h', 'capacidade-sintetica', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:root-must-be-sequence-1' THEN RAISE EXCEPTION 'h-root %', SQLERRM; END IF; END;
  INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES (v2, 1, 'homologada', '2026-02-01', 'ato-h', 'capacidade-sintetica', u, p, e, now() + interval '1 hour') RETURNING id INTO h1;
  BEGIN INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (v2, 1, 'homologada', '2026-02-01', 'ato-h2', 'capacidade-sintetica', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN unique_violation THEN NULL; WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:second-root' THEN RAISE EXCEPTION 'h-root2 %', SQLERRM; END IF; END;
  BEGIN INSERT INTO calendar_composition_norm_homologations(version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (v2, 3, h1, 'revogada', '2026-06-01', 'ato-rev', 'motivo', 'capacidade-sintetica', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:sequence-gap' THEN RAISE EXCEPTION 'h-gap %', SQLERRM; END IF; END;
  BEGIN INSERT INTO calendar_composition_norm_homologations(version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (v2, 2, h1, 'homologada', '2026-06-01', 'ato-rep', 'motivo', 'capacidade-sintetica', u, p, e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:repeated-decision' THEN RAISE EXCEPTION 'h-rep %', SQLERRM; END IF; END;
  INSERT INTO calendar_composition_norm_homologations(version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES (v2, 2, h1, 'revogada', '2026-06-01', 'ato-rev', 'revogacao sintetica', 'capacidade-sintetica', u, p, e, now() + interval '1 hour') RETURNING id INTO h2;
  FOR s, x, r IN SELECT * FROM (VALUES
    ('2026-04-01', 'k1', 'norma-homologada'), ('2026-01-15', 'k1', 'norma-nao-homologada'),
    ('2026-06-01', 'k1', 'norma-nao-homologada'), ('2026-05-31', 'k1', 'norma-homologada'),
    ('2026-04-01', 'k0', 'configuracao-incompleta:composicao-sem-dimensao')) q(d, k, w) LOOP
    SELECT state INTO want_state FROM public.calendar_composition_norm_state_at(s::date, CASE x WHEN 'k0' THEN k0 ELSE k1 END) WHERE norm_id IS NULL;
    IF want_state IS DISTINCT FROM r THEN RAISE EXCEPTION 'homologation-state % % expected % got %', s, x, r, want_state; END IF;
  END LOOP;
  IF public.calendar_composition_norm_homologation_state_at(v2, '2026-06-01', k1) <> 'revogada'
    OR public.calendar_composition_norm_homologation_state_at(v2, '2026-04-01', clock_timestamp()) <> 'nao-homologada'
  THEN RAISE EXCEPTION 'h-knownat'; END IF;
  ok := ok || 'valid-synthetic-config knownat-past-no-future homologation-chain revocation ';

  -- Ambiguidade explícita: duas normas homologadas aplicáveis ⇒ ambígua, sem dominante.
  INSERT INTO calendar_composition_norms(id) VALUES ('ccn-b465a-e');
  INSERT INTO calendar_composition_norm_versions(norm_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ('ccn-b465a-e', 1, 'constituicao', '2026-01-01', 'ato', u, p, e) RETURNING id INTO v3;
  INSERT INTO calendar_composition_norm_multiplicity VALUES (v3, 'exigir-exclusividade');
  INSERT INTO calendar_composition_norm_configuration_records(version_id) VALUES (v3);
  INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (v3, 1, 'homologada', '2026-01-01', 'ato-h', 'capacidade-sintetica', u, p, e);
  SELECT state INTO s FROM public.calendar_composition_norm_state_at('2026-04-01', k1) WHERE norm_id IS NULL;
  SELECT count(*) INTO n FROM public.calendar_composition_norm_state_at('2026-04-01', k1) WHERE state = 'homologada';
  IF s <> 'ambigua:multiplas-normas-homologadas' OR n <> 2 THEN RAISE EXCEPTION 'ambiguous % %', s, n; END IF;
  -- Sucessão: predecessora encerrada na véspera do início da sucessora (conhecida).
  INSERT INTO calendar_composition_norm_versions(norm_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ('ccn-b465a-e', 2, v3, 'sucessao', '2026-09-01', 'ato-s', 'nova vigencia', u, p, e);
  IF (SELECT count(*) FROM public.calendar_composition_norm_versions_at('2026-08-31', clock_timestamp()) WHERE norm_id = 'ccn-b465a-e' AND version_id = v3) <> 1
    OR (SELECT count(*) FROM public.calendar_composition_norm_versions_at('2026-09-01', clock_timestamp()) WHERE norm_id = 'ccn-b465a-e' AND version_id = v3) <> 0
  THEN RAISE EXCEPTION 'succession-window'; END IF;
  SELECT state INTO s FROM public.calendar_composition_norm_state_at('2026-09-02', k1) WHERE norm_id = 'ccn-b465a-e';
  IF s <> 'configuracao-nao-registrada' THEN RAISE EXCEPTION 'succession-config %', s; END IF;
  ok := ok || 'ambiguity-explicit no-dominant succession ';

  -- Imutabilidade.
  FOREACH x IN ARRAY tbls LOOP
    BEGIN EXECUTE format('UPDATE public.%I SET version_id = version_id', x); GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN RAISE EXCEPTION 'mutable-u %', x; END IF;
    EXCEPTION WHEN undefined_column THEN
      BEGIN EXECUTE format('UPDATE public.%I SET created_at = created_at', x); GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN RAISE EXCEPTION 'mutable-u %', x; END IF;
      EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'mutable%' THEN RAISE; END IF; END;
    WHEN raise_exception THEN IF SQLERRM LIKE 'mutable%' THEN RAISE; END IF; END;
    BEGIN EXECUTE format('DELETE FROM public.%I', x); RAISE EXCEPTION 'mutable %', x;
    EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'mutable%' THEN RAISE; END IF; END;
  END LOOP;
  IF (SELECT count(*) FROM calendar_composition_norm_versions) <> 7 THEN RAISE EXCEPTION 'rows-changed'; END IF;
  ok := ok || 'immutable ';

  -- Cliente autenticado: nada legível, nada executável; leitores de calendário intactos.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000b465a01","role":"authenticated"}', true);
  BEGIN PERFORM * FROM public.calendar_composition_norm_versions; RAISE EXCEPTION 'table-open';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.calendar_composition_norm_state_at('2026-04-01', clock_timestamp()); RAISE EXCEPTION 'helper-open';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.calendar_composition_norms(id) VALUES ('ccn-cliente'); RAISE EXCEPTION 'insert-open';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT result_kind INTO s FROM public.calendar_day_at('cal-inexistente', '2026-04-01', clock_timestamp()) LIMIT 1;
  IF s IS DISTINCT FROM 'access-denied' THEN RAISE EXCEPTION 'day-at %', s; END IF;
  SELECT result_kind INTO s FROM public.calendar_at('cal-inexistente', '2026-04-01', clock_timestamp()) LIMIT 1;
  IF s IS DISTINCT FROM 'access-denied' THEN RAISE EXCEPTION 'calendar-at %', s; END IF;
  RESET ROLE;
  ok := ok || 'client-denied readers-denied';
  RAISE EXCEPTION 'b465a-tests-ok: %', ok;
END $t$;
