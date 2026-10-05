-- Frente S partes 3–4: decisão de transição anual, matrícula por ano, busca ativa exata, lotação 2027, baseline profissional observado.
ALTER TABLE public.institutional_person_identifiers DROP CONSTRAINT institutional_person_identifiers_identifier_kind_check;
ALTER TABLE public.institutional_person_identifiers ADD CONSTRAINT institutional_person_identifiers_identifier_kind_check CHECK (identifier_kind IN ('cpf-hmac','inep-pessoa','qp-mec'));

CREATE TABLE public.exact_lookup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('localizar-aluno','localizar-servidor')),
  school_id text NOT NULL,
  identifier_kind text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.exact_lookup_events IS 'Trilha mínima da busca ativa exata: nunca guarda o valor pesquisado. Base do limite anti-enumeração.';
GRANT ALL ON public.exact_lookup_events TO service_role;
ALTER TABLE public.exact_lookup_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER exact_lookup_events_immutable BEFORE UPDATE OR DELETE ON public.exact_lookup_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
REVOKE ALL ON public.exact_lookup_events FROM anon, authenticated;

CREATE TABLE public.year_transition_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  from_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  to_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  decision text NOT NULL CHECK (decision IN ('renovou','transferido-saida','nao-renovou')),
  declared_on date,
  reason text,
  resulting_enrollment_id text REFERENCES public.school_enrollments(id),
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, to_year_id, sequence),
  CHECK (from_year_id <> to_year_id)
);
COMMENT ON TABLE public.year_transition_decisions IS 'Decisão humana explícita da Secretaria sobre candidato do ano anterior. Pendente = ausência de decisão. Append-only; retificação = nova sequência.';
GRANT SELECT ON public.year_transition_decisions TO authenticated;
GRANT ALL ON public.year_transition_decisions TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.year_transition_decisions FROM authenticated, service_role;
ALTER TABLE public.year_transition_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY year_transition_decisions_school_read ON public.year_transition_decisions FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', school_id));
CREATE TRIGGER year_transition_decisions_immutable BEFORE UPDATE OR DELETE ON public.year_transition_decisions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Pessoa do usuário com atuação vigente (mesma regra da 0112).
CREATE OR REPLACE FUNCTION public.s_current_person() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT l.person_id FROM public.user_person_links l WHERE l.user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.s_current_person() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.s_current_person() TO authenticated;

CREATE OR REPLACE FUNCTION public.s_year_open_for_operation(_year text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce((SELECT s.state IN ('em-preparacao','operacional') FROM public.academic_year_operational_states s
    WHERE s.academic_year_id = _year ORDER BY s.sequence DESC LIMIT 1), false)
$$;
REVOKE ALL ON FUNCTION public.s_year_open_for_operation(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.s_year_open_for_operation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.s_active_enrollment(_student text, _year text)
RETURNS TABLE(enrollment_id text, school_id text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT e.id, e.school_id FROM public.school_enrollments e
  WHERE e.student_id = _student AND e.academic_year_id = _year
    AND NOT EXISTS (SELECT 1 FROM public.school_enrollments n WHERE n.supersedes_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id)
$$;
REVOKE ALL ON FUNCTION public.s_active_enrollment(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Núcleo: matrícula do aluno na escola para o ano. Reusa pessoa e aluno; nunca move silenciosamente.
CREATE OR REPLACE FUNCTION public.s_enroll_core(_student text, _school text, _year text, _declared_on date, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record; nid text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enroll-year:' || _student || ':' || _year));
  SELECT * INTO a FROM public.s_active_enrollment(_student, _year) LIMIT 1;
  IF a.enrollment_id IS NOT NULL THEN
    IF a.school_id = _school THEN RETURN a.enrollment_id; END IF;
    RAISE EXCEPTION 'enrollment:active-elsewhere-requires-transfer';
  END IF;
  nid := 'mat-' || pg_catalog.gen_random_uuid();
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, academic_year_id, originating_act_ref, recorded_by, logical_id)
  VALUES (nid, _student, _school, _declared_on, _year, nullif(pg_catalog.btrim(coalesce(_act_ref,'')),''), auth.uid(), nid);
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.s_enroll_core(text, text, text, date, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enroll_student_in_school_year(_student text, _school text, _year text, _declared_on date, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.s_current_person() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'enrollment:capability-missing'; END IF;
  IF NOT public.s_year_open_for_operation(_year) THEN RAISE EXCEPTION 'enrollment:year-not-open'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_students s WHERE s.id = _student) THEN RAISE EXCEPTION 'enrollment:student-not-found'; END IF;
  RETURN public.s_enroll_core(_student, _school, _year, _declared_on, _act_ref);
END $$;
REVOKE ALL ON FUNCTION public.enroll_student_in_school_year(text, text, text, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enroll_student_in_school_year(text, text, text, date, text) TO authenticated;

-- Candidatos: matrícula observada na escola no ano de origem. Pendente = sem decisão.
CREATE OR REPLACE FUNCTION public.year_transition_candidates(_school text, _from_year text, _to_year text)
RETURNS TABLE(student_id text, display_name text, decision text, decision_sequence integer, resulting_enrollment_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'transition:capability-missing'; END IF;
  RETURN QUERY
  SELECT s.id, s.display_name, d.decision, d.sequence, d.resulting_enrollment_id
  FROM (SELECT DISTINCT e.student_id FROM public.school_enrollments e WHERE e.school_id = _school AND e.academic_year_id = _from_year) c
  JOIN public.institutional_students s ON s.id = c.student_id
  LEFT JOIN LATERAL (SELECT y.decision, y.sequence, y.resulting_enrollment_id FROM public.year_transition_decisions y
    WHERE y.school_id = _school AND y.student_id = c.student_id AND y.to_year_id = _to_year ORDER BY y.sequence DESC LIMIT 1) d ON true
  ORDER BY s.display_name, s.id;
END $$;
REVOKE ALL ON FUNCTION public.year_transition_candidates(text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.year_transition_candidates(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_year_transition_decision(_school text, _student text, _from_year text, _to_year text, _decision text, _expected_sequence integer, _declared_on date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE pid uuid := public.s_current_person(); cur record; enr text; nid uuid; a record;
BEGIN
  IF auth.uid() IS NULL OR pid IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'transition:capability-missing'; END IF;
  IF _decision NOT IN ('renovou','transferido-saida','nao-renovou') THEN RAISE EXCEPTION 'transition:decision-invalid'; END IF;
  IF NOT public.s_year_open_for_operation(_to_year) THEN RAISE EXCEPTION 'transition:target-year-not-open'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id = _school AND e.student_id = _student AND e.academic_year_id = _from_year) THEN RAISE EXCEPTION 'transition:not-a-candidate'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('transition:' || _school || ':' || _student || ':' || _to_year));
  SELECT * INTO cur FROM public.year_transition_decisions WHERE school_id = _school AND student_id = _student AND to_year_id = _to_year ORDER BY sequence DESC LIMIT 1;
  IF coalesce(cur.sequence, 0) IS DISTINCT FROM coalesce(_expected_sequence, 0) THEN RAISE EXCEPTION 'transition:stale-base'; END IF;
  IF cur.id IS NOT NULL AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'transition:rectification-reason-required'; END IF;
  IF cur.decision = 'renovou' AND _decision <> 'renovou' THEN
    SELECT * INTO a FROM public.s_active_enrollment(_student, _to_year) WHERE school_id = _school LIMIT 1;
    IF a.enrollment_id IS NOT NULL THEN RAISE EXCEPTION 'transition:renewed-enrollment-must-be-ended-first'; END IF;
  END IF;
  IF _decision = 'renovou' THEN enr := public.s_enroll_core(_student, _school, _to_year, _declared_on, NULL); END IF;
  INSERT INTO public.year_transition_decisions(school_id, student_id, from_year_id, to_year_id, sequence, decision, declared_on, reason, resulting_enrollment_id, author_user_id, author_person_id)
  VALUES (_school, _student, _from_year, _to_year, coalesce(cur.sequence, 0) + 1, _decision, _declared_on, nullif(pg_catalog.btrim(coalesce(_reason,'')),''), enr, auth.uid(), pid)
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_year_transition_decision(text, text, text, text, text, integer, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_year_transition_decision(text, text, text, text, text, integer, date, text) TO authenticated;

-- Limite anti-enumeração: 20 buscas por usuário em 10 minutos.
CREATE OR REPLACE FUNCTION public.s_lookup_guard(_purpose text, _school text, _kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF (SELECT count(*) FROM public.exact_lookup_events e WHERE e.user_id = auth.uid() AND e.created_at > pg_catalog.now() - interval '10 minutes') >= 20 THEN
    RAISE EXCEPTION 'lookup:rate-limited';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.s_lookup_guard(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.locate_student_exact(_school text, _kind text, _value text, _year text)
RETURNS TABLE(outcome text, student_id text, display_name text, active_here boolean, active_elsewhere boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v text := pg_catalog.regexp_replace(coalesce(_value,''), '[^0-9]', '', 'g'); p1 uuid; sids text[]; o text; s record; a record;
BEGIN
  IF auth.uid() IS NULL OR public.s_current_person() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('localizar-estudante-para-matricula', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  PERFORM public.s_lookup_guard('localizar-aluno', _school, _kind);
  IF _kind = 'cpf' AND public.technical_cpf_valid(v) THEN
    SELECT i.person_id INTO p1 FROM public.institutional_person_identifiers i WHERE i.identifier_kind = 'cpf-hmac' AND i.value = public.technical_cpf_hmac(v);
  ELSIF _kind = 'inep' AND v ~ '^[0-9]{12}$' THEN
    SELECT i.person_id INTO p1 FROM public.institutional_person_identifiers i WHERE i.identifier_kind = 'inep-pessoa' AND i.value = v;
  ELSE
    o := 'entrada-invalida';
  END IF;
  IF o IS NULL THEN
    SELECT pg_catalog.array_agg(sp.student_id) INTO sids FROM public.institutional_student_persons sp WHERE sp.person_id = p1;
    o := CASE WHEN p1 IS NULL OR sids IS NULL THEN 'nao-encontrado' WHEN pg_catalog.cardinality(sids) > 1 THEN 'conflito' ELSE 'encontrado' END;
  END IF;
  INSERT INTO public.exact_lookup_events(user_id, purpose, school_id, identifier_kind, outcome) VALUES (auth.uid(), 'localizar-aluno', _school, coalesce(_kind,'?'), o);
  IF o <> 'encontrado' THEN RETURN QUERY SELECT o, NULL::text, NULL::text, NULL::boolean, NULL::boolean; RETURN; END IF;
  SELECT st.id, st.display_name INTO s FROM public.institutional_students st WHERE st.id = sids[1];
  SELECT * INTO a FROM public.s_active_enrollment(s.id, _year) LIMIT 1;
  RETURN QUERY SELECT o, s.id, s.display_name, coalesce(a.school_id = _school, false), coalesce(a.school_id <> _school, false);
END $$;
REVOKE ALL ON FUNCTION public.locate_student_exact(text, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.locate_student_exact(text, text, text, text) TO authenticated;

-- Cadastro de aluno novo com identidade exata; reutiliza pessoa existente; conflito falha fechado.
CREATE OR REPLACE FUNCTION public.register_student_with_exact_identity(_display_name text, _cpf text, _inep text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c text := pg_catalog.regexp_replace(coalesce(_cpf,''), '[^0-9]', '', 'g'); i text := pg_catalog.regexp_replace(coalesce(_inep,''), '[^0-9]', '', 'g');
  h text; p1 uuid; p2 uuid; pid uuid; sid text;
BEGIN
  IF auth.uid() IS NULL OR public.s_current_person() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_network_capability('cadastrar-estudante-na-rede') THEN RAISE EXCEPTION 'student:capability-missing'; END IF;
  IF coalesce(pg_catalog.btrim(_display_name),'') = '' THEN RAISE EXCEPTION 'student:name-required'; END IF;
  IF c = '' AND i = '' THEN RAISE EXCEPTION 'student:exact-identifier-required'; END IF;
  IF c <> '' AND NOT public.technical_cpf_valid(c) THEN RAISE EXCEPTION 'student:cpf-invalid'; END IF;
  IF i <> '' AND i !~ '^[0-9]{12}$' THEN RAISE EXCEPTION 'student:inep-invalid'; END IF;
  IF c <> '' THEN h := public.technical_cpf_hmac(c); PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:' || h)); SELECT person_id INTO p1 FROM public.institutional_person_identifiers WHERE identifier_kind = 'cpf-hmac' AND value = h; END IF;
  IF i <> '' THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:' || i)); SELECT person_id INTO p2 FROM public.institutional_person_identifiers WHERE identifier_kind = 'inep-pessoa' AND value = i; END IF;
  IF p1 IS NOT NULL AND p2 IS NOT NULL AND p1 <> p2 THEN RAISE EXCEPTION 'identity:conflict'; END IF;
  pid := coalesce(p1, p2);
  IF pid IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_student_persons sp WHERE sp.person_id = pid) THEN RAISE EXCEPTION 'identity:already-registered-use-search'; END IF;
  IF pid IS NULL THEN INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES (pg_catalog.btrim(_display_name), 'pessoa-natural') RETURNING id INTO pid; END IF;
  IF h IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.institutional_person_identifiers WHERE person_id = pid AND identifier_kind = 'cpf-hmac' AND value <> h) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
    INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value) VALUES (pid, 'cpf-hmac', h) ON CONFLICT DO NOTHING;
  END IF;
  IF i <> '' THEN
    IF EXISTS (SELECT 1 FROM public.institutional_person_identifiers WHERE person_id = pid AND identifier_kind = 'inep-pessoa' AND value <> i) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
    INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value) VALUES (pid, 'inep-pessoa', i) ON CONFLICT DO NOTHING;
  END IF;
  sid := 'est-' || pg_catalog.gen_random_uuid();
  INSERT INTO public.institutional_students(id, display_name) VALUES (sid, pg_catalog.btrim(_display_name));
  INSERT INTO public.institutional_student_persons(student_id, person_id) VALUES (sid, pid);
  RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.register_student_with_exact_identity(text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_student_with_exact_identity(text, text, text) TO authenticated;

-- Busca exata de servidor: matrícula funcional OU QP-MEC; nunca por nome.
CREATE OR REPLACE FUNCTION public.locate_professional_exact(_school text, _kind text, _value text)
RETURNS TABLE(outcome text, person_id uuid, display_name text, functional_link_logical_ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v text := pg_catalog.btrim(coalesce(_value,'')); pids uuid[]; o text; links uuid[];
BEGIN
  IF auth.uid() IS NULL OR public.s_current_person() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('localizar-servidor-por-identificador', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  PERFORM public.s_lookup_guard('localizar-servidor', _school, _kind);
  IF v = '' OR pg_catalog.length(v) > 40 OR _kind NOT IN ('matricula','qp-mec') THEN o := 'entrada-invalida';
  ELSIF _kind = 'matricula' THEN
    SELECT pg_catalog.array_agg(DISTINCT l.person_id) INTO pids FROM public.professional_functional_links l WHERE l.functional_registration = v;
  ELSE
    SELECT pg_catalog.array_agg(DISTINCT i.person_id) INTO pids FROM public.institutional_person_identifiers i WHERE i.identifier_kind = 'qp-mec' AND i.value = v;
  END IF;
  IF o IS NULL THEN o := CASE WHEN pids IS NULL THEN 'nao-encontrado' WHEN pg_catalog.cardinality(pids) > 1 THEN 'conflito' ELSE 'encontrado' END; END IF;
  INSERT INTO public.exact_lookup_events(user_id, purpose, school_id, identifier_kind, outcome) VALUES (auth.uid(), 'localizar-servidor', _school, coalesce(_kind,'?'), o);
  IF o <> 'encontrado' THEN RETURN QUERY SELECT o, NULL::uuid, NULL::text, NULL::uuid[]; RETURN; END IF;
  SELECT pg_catalog.array_agg(DISTINCT l.logical_id) INTO links FROM public.professional_functional_links l WHERE l.person_id = pids[1];
  RETURN QUERY SELECT o, p.id, p.display_name, links FROM public.institutional_persons p WHERE p.id = pids[1];
END $$;
REVOKE ALL ON FUNCTION public.locate_professional_exact(text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.locate_professional_exact(text, text, text) TO authenticated;

-- Baseline profissional 2026: projeção das declarações censitárias individuais explícitas (sem data inventada, sem regência, sem cargo).
CREATE OR REPLACE FUNCTION public.professional_school_observations_2026(_school text)
RETURNS TABLE(person_id uuid, display_name text, school_id text, declaration_count bigint, known_at timestamptz, start_known boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT (public.has_school_capability('manter-lotacao-da-escola', _school) OR public.has_network_capability('consultar-quadro-profissional-da-rede')) THEN RAISE EXCEPTION 'baseline:capability-missing'; END IF;
  RETURN QUERY SELECT d.person_id, p.display_name, d.school_id, count(*), max(d.known_at), false
  FROM public.professional_census_declarations d JOIN public.institutional_persons p ON p.id = d.person_id
  WHERE d.school_id = _school GROUP BY d.person_id, p.display_name, d.school_id ORDER BY p.display_name;
END $$;
REVOKE ALL ON FUNCTION public.professional_school_observations_2026(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.professional_school_observations_2026(text) TO authenticated;

-- Indicadores da Preparação (somente contagens; nada é inferido).
CREATE OR REPLACE FUNCTION public.year_preparation_summary(_school text, _from_year text, _to_year text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (public.has_school_capability('manter-matricula-e-enturmacao', _school) OR public.has_school_capability('consultar-matricula-e-movimentacao', _school)) THEN RAISE EXCEPTION 'summary:capability-missing'; END IF;
  WITH c AS (SELECT DISTINCT e.student_id FROM public.school_enrollments e WHERE e.school_id = _school AND e.academic_year_id = _from_year),
  d AS (SELECT DISTINCT ON (y.student_id) y.student_id, y.decision FROM public.year_transition_decisions y WHERE y.school_id = _school AND y.to_year_id = _to_year ORDER BY y.student_id, y.sequence DESC),
  t AS (SELECT DISTINCT e.id, e.student_id FROM public.school_enrollments e WHERE e.school_id = _school AND e.academic_year_id = _to_year
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id))
  SELECT pg_catalog.jsonb_build_object(
    'candidatos', (SELECT count(*) FROM c),
    'renovados', (SELECT count(*) FROM d WHERE decision = 'renovou'),
    'transferidos_saidas', (SELECT count(*) FROM d WHERE decision = 'transferido-saida'),
    'nao_renovados', (SELECT count(*) FROM d WHERE decision = 'nao-renovou'),
    'pendentes', (SELECT count(*) FROM c WHERE NOT EXISTS (SELECT 1 FROM d WHERE d.student_id = c.student_id)),
    'novos_alunos', (SELECT count(*) FROM t WHERE NOT EXISTS (SELECT 1 FROM c WHERE c.student_id = t.student_id)),
    'matriculas_ano_destino', (SELECT count(*) FROM t),
    'turmas_ano_destino', (SELECT count(*) FROM public.institutional_classes k WHERE k.school_id = _school AND k.academic_year_id = _to_year),
    'alunos_sem_turma', (SELECT count(*) FROM t WHERE NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes ep WHERE ep.enrollment_id = t.id)),
    'servidores_lotados_ano_destino', (SELECT count(DISTINCT p.functional_link_logical_id) FROM public.professional_postings p WHERE p.school_id = _school AND p.author_user_id IS NOT NULL),
    'servidores_observados_baseline', (SELECT count(DISTINCT x.person_id) FROM public.professional_census_declarations x WHERE x.school_id = _school)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.year_preparation_summary(text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.year_preparation_summary(text, text, text) TO authenticated;