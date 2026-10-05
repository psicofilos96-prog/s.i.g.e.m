-- Frente W (0135) — prova no banco. Dados SINTÉTICOS; termina em RAISE: nada persiste.
-- Sucesso = 'w-diary-tests-ok: ...'.
DO $t$
DECLARE ok boolean; _ok text := ''; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); p1 uuid; p2 uuid;
  _class text; _year text; _ta text := 'ta-' || gen_random_uuid(); _head uuid; n0 int; n1 int;
BEGIN
  SELECT count(*) INTO n0 FROM public.lesson_record_versions;
  -- ===== ACL =====
  IF has_table_privilege('service_role','public.lesson_record_versions','INSERT') OR has_table_privilege('authenticated','public.attendance_record_versions','INSERT')
     OR has_table_privilege('anon','public.lesson_record_versions','INSERT') OR has_table_privilege('service_role','public.assessment_entry_versions','INSERT')
     OR has_table_privilege('authenticated','public.period_closing_versions','UPDATE') OR has_table_privilege('authenticated','public.lesson_curricular_references','INSERT')
     OR has_function_privilege('service_role','public.record_lesson_version_v2(text,text,text,date,uuid,jsonb,uuid[],uuid[],text,text[],text)','EXECUTE')
     OR has_function_privilege('anon','public.record_attendance_version_v2(text,uuid,jsonb,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.diary_teacher_actor(text,text,date,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.record_lesson_version(text,text,text,text,date,uuid,jsonb,text,text[],text)','EXECUTE')
     OR has_function_privilege('anon','public.diary_roster_at(text,text,date)','EXECUTE')
  THEN RAISE EXCEPTION 'falha: acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('record_lesson_version_v2','record_attendance_version_v2','diary_teacher_actor','my_diaries_at','diary_roster_at','diary_period_at','diary_school_day_issue')
      AND (prosrc ILIKE '%current_date%' OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'falha: current_date/search_path'; END IF;
  _ok := _ok || 'acl ';

  SELECT c.id, c.academic_year_id INTO _class, _year FROM public.institutional_classes c LIMIT 1;
  INSERT INTO public.teaching_assignments(id, class_id) VALUES (_ta, _class);
  INSERT INTO public.institutional_persons(display_name) VALUES ('SINTETICO docente') RETURNING id INTO p1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('SINTETICO orgao', 'orgao-institucional') RETURNING id INTO p2;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (u1, p1), (u2, p2);
  -- lotação/atuação sem regência: nunca concede Diário
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, valid_from, scope_level, school_id)
    SELECT p1, 'professor', '2020-01-01', 'escola', c.school_id FROM public.institutional_classes c WHERE c.id = _class;

  SET LOCAL ROLE authenticated;
  -- sem sessão
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, NULL, '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:session-required'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem sessão'; END IF;
  -- sessão sem pessoa
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, NULL, '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:natural-person-required'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem pessoa'; END IF;
  -- automação/órgão nunca personifica docente
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u2, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, NULL, '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:natural-person-required'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: não natural'; END IF;
  _ok := _ok || 'session-person ';

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u1, 'role','authenticated')::text, true);
  -- 2026 histórico bloqueado
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, NULL, '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'diary:year-not-operational:%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: histórico'; END IF;
  RESET ROLE;
  SELECT id INTO _head FROM public.academic_year_operational_states WHERE academic_year_id = _year ORDER BY sequence DESC LIMIT 1;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT _year, max(sequence)+1, 'em-preparacao', _head, 'SINTETICO', 'teste-w' FROM public.academic_year_operational_states WHERE academic_year_id = _year
    RETURNING id INTO _head;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, NULL, '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:year-not-operational:em-preparacao'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: preparação %', SQLERRM; END IF;
  RESET ROLE;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT _year, max(sequence)+1, 'operacional', _head, 'SINTETICO', 'teste-w' FROM public.academic_year_operational_states WHERE academic_year_id = _year
    RETURNING id INTO _head;
  SET LOCAL ROLE authenticated;
  -- operacional passa o portão anual; sem regência vigente (só lotação) é negado
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, NULL, '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:assignment-not-effective'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: lotação sem regência %', SQLERRM; END IF;
  -- substituição inexistente também negada
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, 'ts-x', '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:assignment-not-effective'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: substituição'; END IF;
  -- meus diários: sem regência ⇒ vazio (lotação não aparece)
  IF EXISTS (SELECT 1 FROM public.my_diaries_at('2026-03-02', now())) THEN RAISE EXCEPTION 'falha: meus diários'; END IF;
  -- lista nominal negada sem regência
  BEGIN PERFORM * FROM public.diary_roster_at(_ta, NULL, '2026-03-02'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: roster'; END IF;
  -- chamada sem aula registrada (grade nunca vira aula)
  BEGIN PERFORM public.record_attendance_version_v2('aula:x', NULL, '{"aula":{"s1":"Presente"}}', NULL, 'c1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:lesson-not-registered'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: chamada sem aula'; END IF;
  -- taxonomia: marcação inexistente e chamada vazia recusadas (ausência ≠ falta)
  BEGIN PERFORM public.record_attendance_version_v2('aula:x', NULL, '{"aula":{"s1":"Falta justificada"}}', NULL, 'c2'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:invalid-mark'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: marcação'; END IF;
  BEGIN PERFORM public.record_attendance_version_v2('aula:x', NULL, '{"aula":{}}', NULL, 'c3'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:empty-attendance'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: vazia'; END IF;
  RESET ROLE;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT _year, max(sequence)+1, 'encerrado', _head, 'SINTETICO', 'teste-w' FROM public.academic_year_operational_states WHERE academic_year_id = _year;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_lesson_version_v2('aula:x', _ta, NULL, '2026-03-02', NULL, '{}', '{}', '{}', NULL, NULL, 'p1'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'diary:year-not-operational:encerrado'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: encerrado'; END IF;
  _ok := _ok || 'year-gate assignment-gate roster attendance-taxonomy ';
  RESET ROLE;
  SELECT count(*) INTO n1 FROM public.lesson_record_versions;
  IF n1 <> n0 THEN RAISE EXCEPTION 'falha: aula gravada'; END IF;
  RAISE EXCEPTION 'w-diary-tests-ok: %', _ok;
END $t$;
