-- BQ.1 — prova transacional da matriz real de autoridades (decisão do gestor 2026-10-09).
-- Termina em RAISE (rollback intencional): sucesso = erro "BQ1-AUTHORITY-PASS". Qualquer outro erro = falha.
-- Fixtures efêmeras: principal NEI de prova, estudante de prova, concessão de família e matrículas de prova — nada persiste.
DO $$
DECLARE
  sup uuid; ava uuid; ava_p uuid; cie uuid; cie_p uuid; ali uuid; ali_p uuid; dirA uuid; schA text; schB text;
  adm uuid; nei uuid := gen_random_uuid(); fam uuid := gen_random_uuid(); stu text := 'aluno-bq1-probe-' || gen_random_uuid();
  base uuid; rid uuid; rec record; err text; e1 text := 'bq1-enr-a-' || gen_random_uuid(); e2 text := 'bq1-enr-b-' || gen_random_uuid();
  bond text; a public.guardian_authorizations;
BEGIN
  SELECT auth_user_id INTO sup FROM public.institutional_sector_principals WHERE station_code = 'supervisao';
  SELECT auth_user_id, id INTO ava, ava_p FROM public.institutional_sector_principals WHERE station_code = 'avaliacao';
  SELECT auth_user_id, id INTO cie, cie_p FROM public.institutional_sector_principals WHERE station_code = 'ciece';
  SELECT auth_user_id, id INTO ali, ali_p FROM public.institutional_sector_principals WHERE station_code = 'alimentacao';
  SELECT auth_user_id, school_id INTO dirA, schA FROM public.institutional_sector_principals WHERE station_code = 'direcao_escolar' ORDER BY school_id LIMIT 1;
  SELECT school_id INTO schB FROM public.institutional_sector_principals WHERE station_code = 'direcao_escolar' AND school_id <> schA ORDER BY school_id LIMIT 1;
  SELECT l.user_id INTO adm FROM public.user_person_links l JOIN public.institutional_engagements e ON e.person_id = l.person_id WHERE e.engagement_kind_id = 'administrador-geral-do-sigem' LIMIT 1;
  IF sup IS NULL OR ava IS NULL OR cie IS NULL OR ali IS NULL OR dirA IS NULL OR schB IS NULL OR adm IS NULL THEN RAISE EXCEPTION 'fixtures-missing'; END IF;

  -- Admin cobre o catálogo inteiro e toda regra de estação (sem curinga).
  IF (SELECT count(*) FROM public.sector_admin_coverage_issues()) <> 0 THEN RAISE EXCEPTION 'admin-coverage-incomplete'; END IF;
  IF public.current_sector_rules_version() <> 3 THEN RAISE EXCEPTION 'rules-v3-not-current'; END IF;
  IF EXISTS (SELECT 1 FROM public.sector_station_rules WHERE rules_version = 3 AND capability_id ~ '[*%]') THEN RAISE EXCEPTION 'wildcard'; END IF;

  -- 1) Supervisão: calendário (construir/homologar); demais setores não.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sup, 'role', 'authenticated')::text, true);
  IF NOT public.calendar_has_network_capability('construir-calendario-da-rede') OR NOT public.calendar_has_network_capability('homologar-calendario-da-rede') THEN RAISE EXCEPTION 'supervisao-calendar-denied'; END IF;
  IF public.has_network_capability('manter-cardapio-escolar') THEN RAISE EXCEPTION 'supervisao-has-meal'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cie, 'role', 'authenticated')::text, true);
  IF public.calendar_has_network_capability('homologar-calendario-da-rede') THEN RAISE EXCEPTION 'ciece-can-homologate-calendar'; END IF;

  -- 2) Avaliação: writer do programa avaliativo com autoria = principal; consulta individual permitida.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ava, 'role', 'authenticated')::text, true);
  rid := public.record_assessment_program(NULL, 'registro', 'BQ1 programa de prova', 'rede', 'rede', 'rede', 'rede', 'prova BQ.1', NULL);
  SELECT * INTO rec FROM public.assessment_program_versions WHERE id = rid;
  IF rec.author_principal_id IS DISTINCT FROM ava_p OR rec.author_person_id IS NOT NULL THEN RAISE EXCEPTION 'avaliacao-authorship-wrong'; END IF;
  IF NOT public.has_network_capability('consultar-identidade-cadastral-do-estudante') OR NOT public.has_network_capability('manter-painel-inteligencia')
     OR NOT public.has_network_capability('registrar-resultado-avaliacao-institucional') THEN RAISE EXCEPTION 'avaliacao-caps-missing'; END IF;
  IF public.has_network_capability('manter-cardapio-escolar') OR public.has_network_capability('construir-calendario-da-rede') THEN RAISE EXCEPTION 'avaliacao-cross-station'; END IF;

  -- 3) CIECE: rede + correção cadastral governada (writer oficial, autoria = principal CIECE, histórico preservado).
  INSERT INTO public.institutional_students(id, display_name) VALUES (stu, 'Estudante de prova BQ1');
  INSERT INTO public.student_identity_versions(student_id, version, civil_name, correction_reason, recorded_by) VALUES (stu, 1, 'Nome Original', 'fixture', adm) RETURNING id INTO base;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cie, 'role', 'authenticated')::text, true);
  rid := public.record_student_identity_version(stu, base, 'Nome Corrigido', NULL, NULL, NULL, NULL, 'correção cadastral BQ1', NULL);
  SELECT * INTO rec FROM public.student_identity_versions WHERE id = rid;
  IF rec.recorded_by_principal_id IS DISTINCT FROM cie_p OR rec.recorded_by_person_id IS NOT NULL OR rec.supersedes_id <> base OR rec.version <> 2 THEN RAISE EXCEPTION 'ciece-correction-wrong'; END IF;
  IF NOT public.has_network_capability('conferir-mapa-estatistico') OR NOT public.has_network_capability('oficializar-mapa-estatistico') OR NOT public.has_network_capability('gerir-importacao-de-dados') THEN RAISE EXCEPTION 'ciece-caps-missing'; END IF;

  -- 4) Alimentação: ciclo autônomo (writer de rede sem pessoa; autoaprovação do próprio setor não bloqueia).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ali, 'role', 'authenticated')::text, true);
  rid := public.record_meal_kitchen(NULL, NULL, 'Cozinha de prova BQ1', schA, CURRENT_DATE, NULL, NULL);
  SELECT * INTO rec FROM public.meal_kitchen_versions WHERE id = rid;
  IF rec.id IS NULL THEN SELECT * INTO rec FROM public.meal_kitchen_versions WHERE kitchen_id = rid ORDER BY version DESC LIMIT 1; END IF;
  IF rec.author_principal_id IS DISTINCT FROM ali_p OR rec.author_person_id IS NOT NULL THEN RAISE EXCEPTION 'alimentacao-authorship-wrong'; END IF;
  PERFORM public.meal_network_grant_on('fechar-estoque-alimentar', CURRENT_DATE);
  PERFORM public.meal_network_grant_on('homologar-conteudo-tecnico-alimentar', CURRENT_DATE);
  PERFORM public.meal_grant_on('aprovar-inventario-alimentar', schB, CURRENT_DATE);
  PERFORM public.meal_grant_on('consultar-restricao-alimentar', schB, CURRENT_DATE);
  BEGIN PERFORM public.meal_grant_on('registrar-restricao-alimentar', schB, CURRENT_DATE); err := 'none'; EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'capability:registrar-restricao-alimentar' THEN RAISE EXCEPTION 'central-registers-individual-restriction: %', err; END IF;

  -- 5) Direção: Alimentação da própria escola; nunca outra escola nem rede.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', dirA, 'role', 'authenticated')::text, true);
  PERFORM public.meal_grant_on('submeter-pedido-alimentar', schA, CURRENT_DATE);
  PERFORM public.meal_grant_on('registrar-restricao-alimentar', schA, CURRENT_DATE);
  PERFORM public.meal_grant_on('conferir-recebimento-alimentar', schA, CURRENT_DATE);
  BEGIN PERFORM public.meal_grant_on('submeter-pedido-alimentar', schB, CURRENT_DATE); err := 'none'; EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'capability:submeter-pedido-alimentar' THEN RAISE EXCEPTION 'direcao-A-touches-B: %', err; END IF;
  BEGIN PERFORM public.meal_network_grant_on('manter-catalogo-tecnico-alimentar', CURRENT_DATE); err := 'none'; EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'capability:manter-catalogo-tecnico-alimentar' THEN RAISE EXCEPTION 'direcao-has-network-meal: %', err; END IF;
  BEGIN PERFORM public.record_meal_kitchen(NULL, NULL, 'X', schA, CURRENT_DATE, NULL, NULL); err := 'none'; EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'capability:manter-unidades-de-alimentacao' THEN RAISE EXCEPTION 'direcao-writes-network-meal: %', err; END IF;

  -- 6) Família: acesso acompanha a matrícula ativa; termina na data efetiva e volta no novo vínculo.
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, logical_id) VALUES (e1, stu, schA, CURRENT_DATE - 30, e1);
  INSERT INTO public.guardian_authorizations(logical_id, version, event_kind, student_id, guardian_user_id, school_id, sections, valid_from, recorded_by, recorded_engagement)
  VALUES (gen_random_uuid(), 1, 'concessao', stu, fam, schA, ARRAY['matricula'], CURRENT_DATE - 30, adm, gen_random_uuid());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', fam, 'role', 'authenticated')::text, true);
  a := public.family_authorization(stu);
  IF a.id IS NULL OR a.school_id <> schA THEN RAISE EXCEPTION 'family-no-access-while-enrolled'; END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT bond_status_id INTO bond FROM public.school_enrollment_endings LIMIT 1;
  INSERT INTO public.school_enrollment_endings(enrollment_id, ended_on, bond_status_id) VALUES (e1, CURRENT_DATE, coalesce(bond, 'transferido'));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', fam, 'role', 'authenticated')::text, true);
  a := public.family_authorization(stu);
  IF a.id IS NOT NULL THEN RAISE EXCEPTION 'family-access-after-transfer'; END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, logical_id) VALUES (e2, stu, schB, CURRENT_DATE, e2);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', fam, 'role', 'authenticated')::text, true);
  a := public.family_authorization(stu);
  IF a.id IS NULL OR a.school_id <> schB THEN RAISE EXCEPTION 'family-not-restored-in-new-school'; END IF;

  -- 7) Inclusão/NEI central: estação de rede (principal de prova; conta real com identificador pendente).
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM public.provision_sector_principal(nei, 'inclusao_nei', NULL, 'bq1-probe');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nei, 'role', 'authenticated')::text, true);
  IF NOT public.has_network_capability('acompanhar-educacao-inclusiva-rede') OR NOT public.has_network_capability('revisar-termos-inclusao')
     OR NOT public.has_school_capability('consultar-apoio-inclusivo', schB) THEN RAISE EXCEPTION 'nei-network-missing'; END IF;
  IF public.has_network_capability('manter-cardapio-escolar') OR public.has_network_capability('homologar-calendario-da-rede') THEN RAISE EXCEPTION 'nei-cross-station'; END IF;

  -- 8) Admin (pessoa real): uma ação representativa de cada estação; autoria humana real.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  IF NOT public.calendar_has_network_capability('homologar-calendario-da-rede') THEN RAISE EXCEPTION 'admin-calendar'; END IF;
  IF NOT (public.has_network_capability('exportar-auditoria') AND public.has_network_capability('oficializar-mapa-estatistico')
      AND public.has_network_capability('acompanhar-educacao-inclusiva-rede') AND public.has_network_capability('manter-matricula-e-enturmacao')
      AND public.has_network_capability('realizar-conferencia-escolar') AND public.has_network_capability('registrar-acompanhamento-da-supervisao')) THEN RAISE EXCEPTION 'admin-station-caps'; END IF;
  rid := public.record_assessment_program(NULL, 'registro', 'BQ1 programa admin', 'rede', 'rede', 'rede', 'rede', 'prova BQ.1', NULL);
  SELECT * INTO rec FROM public.assessment_program_versions WHERE id = rid;
  IF rec.author_person_id IS NULL OR rec.author_principal_id IS NOT NULL THEN RAISE EXCEPTION 'admin-authorship-not-human'; END IF;
  rid := public.record_meal_kitchen(NULL, NULL, 'Cozinha admin BQ1', schB, CURRENT_DATE, NULL, NULL);

  -- 9) Nenhum papel do app ganha DML direto nas tabelas tocadas.
  IF has_table_privilege('authenticated', 'public.sigem_capability_catalog', 'INSERT') OR has_table_privilege('authenticated', 'public.sector_station_rules', 'INSERT')
     OR has_table_privilege('authenticated', 'public.meal_kitchen_versions', 'INSERT') OR has_table_privilege('authenticated', 'public.assessment_program_versions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.student_identity_versions', 'INSERT') OR has_table_privilege('anon', 'public.guardian_authorizations', 'SELECT') THEN RAISE EXCEPTION 'app-role-direct-dml'; END IF;

  RAISE EXCEPTION 'BQ1-AUTHORITY-PASS (rollback intencional)';
END $$;
