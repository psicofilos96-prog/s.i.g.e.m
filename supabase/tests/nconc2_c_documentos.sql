-- NCONC.2 (C) — corrida em Documentos da Secretaria: duplo clique/duas abas com a mesma chave, chave reutilizada
-- com outro pedido, retificação dupla e cancelamento duplo da mesma emissão. Conta setorial REAL como sessão;
-- modelo de documento sintético (não há modelo institucional cadastrado). Termina em RAISE: nada persiste.
DO $$
DECLARE
  yr text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831'; dt date := '2026-09-15';
  sa text; ua uuid; ca1 text; ok text := ''; d uuid := gen_random_uuid(); seq int; res jsonb; st1 text; tv uuid;
  em1 jsonb; em1b jsonb; rt jsonb; k text := 'nconc2-doc-' || gen_random_uuid(); n0 int; n1 int;
BEGIN
  SELECT school_id, auth_user_id INTO sa, ua FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    SELECT yr, coalesce(max(sequence), 0) + 1, 'operacional', 'FIXTURE REVERTIDA NCONC.2', 'technical:nconc2-rollback' FROM public.academic_year_operational_states WHERE academic_year_id = yr;
  INSERT INTO public.school_document_templates(id, document_kind, created_by) VALUES ('fixture-nconc2-decl', 'declaracao-escolar', ua);
  INSERT INTO public.school_document_template_versions(template_id, version_no, title, blocks, recorded_by, recorded_by_engagement)
    VALUES ('fixture-nconc2-decl', 1, 'Declaração (FIXTURE)', '[{"kind":"field","label":"Aluno","fact":"aluno.nome"}]', ua, gen_random_uuid()) RETURNING id INTO tv;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  ca1 := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE NCONC2 DOC', '2026-09-01', NULL, NULL, NULL, 5, NULL)->>'class_id';
  seq := public.enrollment_draft_save(d, sa, 0, 8, '{"aluno":{"nome":"FIXTURE NCONC2 DOC"}}'::jsonb, '11144477735', NULL, NULL);
  res := public.enrollment_draft_complete(d, seq, yr, dt, ca1); st1 := res->>'student_id';
  PERFORM set_config('role', 'postgres', true); SELECT count(*) INTO n0 FROM public.school_document_emissions; PERFORM set_config('role', 'authenticated', true);
  em1 := public.emit_school_document_v3(k, tv, sa, st1, dt, NULL, NULL, NULL);
  em1b := public.emit_school_document_v3(k, tv, sa, st1, dt, NULL, NULL, NULL);
  IF em1->>'id' IS DISTINCT FROM em1b->>'id' THEN RAISE EXCEPTION 'DOC: chave repetida gerou 2 emissões'; END IF;
  PERFORM set_config('role', 'postgres', true); SELECT count(*) INTO n1 FROM public.school_document_emissions; PERFORM set_config('role', 'authenticated', true);
  IF n1 - n0 <> 1 THEN RAISE EXCEPTION 'DOC: % emissões', n1 - n0; END IF;
  BEGIN PERFORM public.emit_school_document_v3(k, tv, sa, st1, dt + 1, NULL, NULL, NULL); RAISE EXCEPTION 'DOC: chave reutilizada aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%idempotency:key-reused%' THEN RAISE; END IF; END;
  ok := ok || 'emissao:idempotente(1) chave-reutilizada:idempotency:key-reused ';
  rt := public.emit_school_document_v3('nconc2-rt1-' || gen_random_uuid(), tv, sa, st1, dt, NULL, (em1->>'id')::uuid, 'Sessão 1');
  BEGIN PERFORM public.emit_school_document_v3('nconc2-rt2-' || gen_random_uuid(), tv, sa, st1, dt, NULL, (em1->>'id')::uuid, 'Sessão 2'); RAISE EXCEPTION 'DOC: retificação dupla';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%base-superseded%' THEN RAISE; END IF; END;
  ok := ok || 'retificacao:base-superseded ';
  PERFORM public.cancel_school_document_emission((rt->>'id')::uuid, 'Sessão 1');
  BEGIN PERFORM public.cancel_school_document_emission((rt->>'id')::uuid, 'Sessão 2'); RAISE EXCEPTION 'DOC: cancelamento duplo';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%base-superseded%' THEN RAISE; END IF; END;
  ok := ok || 'cancelamento:base-superseded';
  RAISE EXCEPTION 'NCONC2-DOCUMENTOS-PASS %', ok;
END $$;
