-- NCONC.2 (D) — corrida em regras institucionais: duas sessões criam a 1ª versão (cabeça 0), duas homologam a
-- mesma versão e duas sucedem a v1. Núcleo com autoria sintética explícita (mesmo padrão de bt_institutional_rule_writers).
-- Termina em RAISE: nada persiste; nenhuma regra real é criada ou homologada.
DO $t$
DECLARE
  ua constant uuid := '00000000-b7b7-4e11-8000-0000000000a1'; ub constant uuid := '00000000-b7b7-4e11-8000-0000000000b2';
  pa uuid; pb uuid; ea uuid; eb uuid; v int; ok text := '';
  dp jsonb := '{"familyId":"aula","appliesWhenOfficialClosing":"any","outcome":"admissible","requiredCapabilities":["registrar-aula"],"requirementCodes":["motivo"],"definition":{"label":"teste NCONC2"}}';
BEGIN
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('TESTE SINTÉTICO NCONC2 A — revertido','orgao-institucional') RETURNING id INTO pa;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('TESTE SINTÉTICO NCONC2 B — revertido','orgao-institucional') RETURNING id INTO pb;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ua, pa), (ub, pb);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from, originating_act_ref)
    VALUES (pa, 'autoridade-calendario-da-rede', 'rede', CURRENT_DATE - 1, 'fixture NCONC2 (ROLLBACK)') RETURNING id INTO ea;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from, originating_act_ref)
    VALUES (pb, 'autoridade-calendario-da-rede', 'rede', CURRENT_DATE - 1, 'fixture NCONC2 (ROLLBACK)') RETURNING id INTO eb;
  v := public.institutional_rule_record_draft_core('correcao-diario','nconc2-diario',0,CURRENT_DATE,NULL, dp, 'Sessão 1', NULL, ua, pa, ea);
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','nconc2-diario',0,CURRENT_DATE,NULL, dp || '{"outcome":"forbidden"}', 'Sessão 2', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: 2ª v1';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:stale-head%' THEN RAISE; END IF; END;
  ok := ok || 'rascunho-v1:institutional-rule:stale-head ';
  PERFORM public.institutional_rule_homologate_core('correcao-diario','nconc2-diario',1,'Sessão 1',NULL, ub, pb, eb);
  BEGIN PERFORM public.institutional_rule_homologate_core('correcao-diario','nconc2-diario',1,'Sessão 2',NULL, ub, pb, eb); RAISE EXCEPTION 'FALHA: 2ª homologação';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:already-homologated%' THEN RAISE; END IF; END;
  ok := ok || 'homologacao:institutional-rule:already-homologated ';
  v := public.institutional_rule_record_draft_core('correcao-diario','nconc2-diario',1,CURRENT_DATE,NULL, dp, 'Sessão 1 v2', NULL, ua, pa, ea);
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','nconc2-diario',1,CURRENT_DATE,NULL, dp, 'Sessão 2 v2', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: 2ª v2';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:stale-head%' THEN RAISE; END IF; END;
  IF v <> 2 OR (SELECT count(*) FROM public.institutional_rule_versions_core('correcao-diario', CURRENT_DATE, now()) WHERE logical_id='nconc2-diario') <> 2 THEN RAISE EXCEPTION 'FALHA: versões'; END IF;
  ok := ok || 'sucessao-v2:institutional-rule:stale-head';
  RAISE EXCEPTION 'NCONC2-REGRAS-PASS %', ok;
END $t$;
