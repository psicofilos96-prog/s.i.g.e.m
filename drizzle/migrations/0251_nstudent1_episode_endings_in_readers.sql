-- NSTUDENT.1: leituras de enturmação que ignoravam remanejamento/saída/transferência.
-- Só passam a considerar término (b3_allocation_ended_on) e versão substituída; nenhum fato alterado, nenhum acesso ampliado.
-- 1) ocorrência de frequência: aluno precisa estar na turma em algum dia do intervalo (antes: qualquer passagem, mesmo encerrada).
-- 2) carteirinha: aluno precisa ter enturmação não encerrada na escola (antes: aceitava quem já saiu/foi transferido).
-- 3) preparação do ano: "alunos sem turma" conta também quem só tem enturmação encerrada.
CREATE OR REPLACE FUNCTION public.record_attendance_occurrence(_class text, _student text, _type_id text, _type_version integer, _from date, _until date, _document_ref text, _note text, _expected_version_id uuid, _annul boolean, _justification text, _plan_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _cap record; _type record; _prev record; _existing uuid; _new uuid; _logical uuid; _ver int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  SELECT * INTO _cap FROM public.capability_grant('registrar-ocorrencia-no-prontuario', _class);
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_attendance_occurrences WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'plan-conflict'; END IF;
  SELECT id INTO _existing FROM public.student_attendance_occurrences WHERE plan_id = _plan_id AND author_user_id = auth.uid();
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.class_id = _class AND e.student_id = _student
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)
      AND e.valid_from <= _until AND coalesce(public.b3_allocation_ended_on(e.logical_id::text), 'infinity'::date) >= _from) THEN RAISE EXCEPTION 'student-not-in-class'; END IF;
  SELECT * INTO _type FROM public.attendance_occurrence_types WHERE id = _type_id AND version = _type_version AND status = 'homologada'
    AND valid_from <= _from AND (valid_until IS NULL OR valid_until >= _until);
  IF NOT FOUND THEN RAISE EXCEPTION 'occurrence-type-not-homologated'; END IF;
  IF _until < _from THEN RAISE EXCEPTION 'invalid-interval'; END IF;
  IF _type.requires_document AND NOT coalesce(_annul,false) AND coalesce(btrim(_document_ref),'') = '' THEN RAISE EXCEPTION 'document-required'; END IF;
  IF _expected_version_id IS NULL THEN
    IF coalesce(_annul,false) THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
    _logical := gen_random_uuid(); _ver := 1;
  ELSE
    SELECT * INTO _prev FROM public.student_attendance_occurrences WHERE id = _expected_version_id FOR UPDATE;
    IF NOT FOUND OR _prev.class_id <> _class OR _prev.student_id <> _student THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('attendance-occurrence:' || _prev.logical_id));
    IF EXISTS (SELECT 1 FROM public.student_attendance_occurrences WHERE supersedes_id = _prev.id) THEN RAISE EXCEPTION 'concurrent-change'; END IF;
    IF _prev.annulled THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
    IF coalesce(btrim(_justification),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
    _logical := _prev.logical_id; _ver := _prev.version + 1;
  END IF;
  INSERT INTO public.student_attendance_occurrences (logical_id, version, supersedes_id, student_id, class_id, occurrence_type_id,
    occurrence_type_version, from_date, until_date, document_ref, note, annulled, justification, plan_id, author_user_id,
    author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_logical, _ver, _expected_version_id, _student, _class, _type_id, _type_version, _from, _until,
    NULLIF(btrim(coalesce(_document_ref,'')),''), NULLIF(btrim(coalesce(_note,'')),''), coalesce(_annul,false),
    NULLIF(btrim(coalesce(_justification,'')),''), _plan_id, auth.uid(), public.current_person_id(),
    _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _new;
  RETURN _new;
END $function$;

CREATE OR REPLACE FUNCTION public.record_student_card(_public_id text, _expected_version integer, _kind text, _student text, _school text, _year text, _valid_until date, _student_name text, _school_name text, _class_label text, _reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; head public.student_card_issuances; pid text;
BEGIN
  IF _kind NOT IN ('emissao','reemissao','cancelamento') THEN RAISE EXCEPTION 'card:kind-invalid'; END IF;
  IF _kind = 'emissao' THEN
    IF _public_id IS NOT NULL THEN RAISE EXCEPTION 'card:base-not-allowed'; END IF;
    g := public.student_card_grant(_school);
    IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.student_id = _student AND e.school_id = _school
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)
      AND coalesce(public.b3_allocation_ended_on(e.logical_id::text), 'infinity'::date) >= CURRENT_DATE) THEN RAISE EXCEPTION 'card:no-enrollment-at-school'; END IF;
    IF _valid_until IS NULL OR _valid_until < make_date(_year::int, 1, 1) THEN RAISE EXCEPTION 'card:validity-invalid'; END IF;
    pid := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    INSERT INTO public.student_card_issuances(public_id, version, kind, student_id, school_id, academic_year, valid_until, student_name, school_name, class_label, reason, actor_user_id, actor_engagement)
    VALUES (pid, 1, 'emissao', _student, _school, _year, _valid_until, btrim(_student_name), btrim(_school_name), nullif(btrim(_class_label), ''), nullif(btrim(_reason), ''), auth.uid(), g);
    RETURN pid;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('card:' || coalesce(_public_id, '')));
  SELECT * INTO head FROM public.student_card_issuances WHERE public_id = _public_id ORDER BY version DESC LIMIT 1;
  IF head.id IS NULL THEN RAISE EXCEPTION 'card:unknown'; END IF;
  g := public.student_card_grant(head.school_id);
  IF head.version <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'card:head-changed'; END IF;
  IF head.kind = 'cancelamento' THEN RAISE EXCEPTION 'card:already-cancelled'; END IF;
  INSERT INTO public.student_card_issuances(public_id, version, kind, student_id, school_id, academic_year, valid_until, student_name, school_name, class_label, reason, actor_user_id, actor_engagement)
  VALUES (head.public_id, head.version + 1, _kind, head.student_id, head.school_id, head.academic_year,
    CASE WHEN _kind = 'reemissao' THEN coalesce(_valid_until, head.valid_until) ELSE head.valid_until END,
    CASE WHEN _kind = 'reemissao' THEN coalesce(nullif(btrim(_student_name), ''), head.student_name) ELSE head.student_name END,
    CASE WHEN _kind = 'reemissao' THEN coalesce(nullif(btrim(_school_name), ''), head.school_name) ELSE head.school_name END,
    CASE WHEN _kind = 'reemissao' THEN coalesce(nullif(btrim(_class_label), ''), head.class_label) ELSE head.class_label END,
    btrim(_reason), auth.uid(), g);
  RETURN head.public_id;
END $function$;

CREATE OR REPLACE FUNCTION public.year_preparation_summary(_school text, _from_year text, _to_year text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT (public.has_school_capability('manter-matricula-e-enturmacao', _school) OR public.has_school_capability('consultar-matricula-e-movimentacao', _school)) THEN RAISE EXCEPTION 'summary:capability-missing'; END IF;
  WITH c AS (SELECT DISTINCT e.student_id FROM public.school_enrollments e WHERE e.school_id = _school AND e.academic_year_id = _from_year),
  d AS (SELECT DISTINCT ON (y.student_id) y.student_id, y.decision FROM public.year_transition_decisions y WHERE y.school_id = _school AND y.to_year_id = _to_year ORDER BY y.student_id, y.sequence DESC),
  t AS (SELECT DISTINCT e.id, e.student_id FROM public.school_enrollments e WHERE e.school_id = _school AND e.academic_year_id = _to_year
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id)),
  sp AS (SELECT DISTINCT ON (s.functional_link_logical_id) s.functional_link_logical_id, s.status FROM public.school_staff_presence s
        WHERE s.school_id = _school AND s.academic_year_id = _to_year ORDER BY s.functional_link_logical_id, s.sequence DESC)
  SELECT pg_catalog.jsonb_build_object(
    'candidatos', (SELECT count(*) FROM c),
    'renovados', (SELECT count(*) FROM d WHERE decision = 'renovou'),
    'transferidos_saidas', (SELECT count(*) FROM d WHERE decision = 'transferido-saida'),
    'nao_renovados', (SELECT count(*) FROM d WHERE decision = 'nao-renovou'),
    'pendentes', (SELECT count(*) FROM c WHERE NOT EXISTS (SELECT 1 FROM d WHERE d.student_id = c.student_id)),
    'novos_alunos', (SELECT count(*) FROM t WHERE NOT EXISTS (SELECT 1 FROM c WHERE c.student_id = t.student_id)),
    'matriculas_ano_destino', (SELECT count(*) FROM t),
    'turmas_ano_destino', (SELECT count(*) FROM public.institutional_classes k WHERE k.school_id = _school AND k.academic_year_id = _to_year),
    'alunos_sem_turma', (SELECT count(*) FROM t WHERE NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes ep WHERE ep.enrollment_id = t.id
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = ep.id)
      AND public.b3_allocation_ended_on(ep.logical_id::text) IS NULL)),
    'servidores_lotados_ano_destino', (SELECT count(*) FROM sp WHERE status = 'confirmada'),
    'servidores_observados_baseline', (SELECT count(DISTINCT x.person_id) FROM public.professional_census_declarations x WHERE x.school_id = _school)
  ) INTO r;
  RETURN r;
END $function$;
