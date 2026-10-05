-- 0115 — Fechamento S.1: cadastro de aluno com autorização escolar, lotação escolar separada do registro funcional,
-- consulta do quadro da escola, política v6 append-only (decisão do proprietário 2026-10-05). v1–v5 intactas.

CREATE TABLE public.student_registration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  purpose text NOT NULL CHECK (purpose = 'matricula-na-escola'),
  person_reused boolean NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.student_registration_events IS 'Autoria e finalidade do cadastro de aluno pela escola. Identidade é global; autorização nasce do caso de uso da escola. Sem identificadores.';
GRANT ALL ON public.student_registration_events TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.student_registration_events FROM service_role;
ALTER TABLE public.student_registration_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER student_registration_events_immutable BEFORE UPDATE OR DELETE ON public.student_registration_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.school_staff_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  functional_link_logical_id uuid NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  academic_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  status text NOT NULL CHECK (status IN ('confirmada','encerrada')),
  declared_on date,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (functional_link_logical_id, school_id, academic_year_id, sequence)
);
COMMENT ON TABLE public.school_staff_presence IS 'Lotação/presença escolar do servidor no ano, mantida pela escola. Não é registro funcional central (contrato, cargo, jornada, vínculo) e nunca cria regência. Append-only.';
GRANT SELECT ON public.school_staff_presence TO authenticated;
GRANT ALL ON public.school_staff_presence TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.school_staff_presence FROM authenticated, service_role;
ALTER TABLE public.school_staff_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_staff_presence_read ON public.school_staff_presence FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-lotacao-da-escola', school_id) OR public.has_school_capability('consultar-quadro-profissional-da-escola', school_id));
CREATE TRIGGER school_staff_presence_immutable BEFORE UPDATE OR DELETE ON public.school_staff_presence FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Cadastro de aluno pela escola (substitui o caminho de rede da 0113).
CREATE OR REPLACE FUNCTION public.register_student_for_school(_school text, _display_name text, _cpf text, _inep text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c text := pg_catalog.regexp_replace(coalesce(_cpf,''), '[^0-9]', '', 'g'); i text := pg_catalog.regexp_replace(coalesce(_inep,''), '[^0-9]', '', 'g');
  me uuid := public.s_current_person(); h text; p1 uuid; p2 uuid; pid uuid; sid text; reused boolean := false;
BEGIN
  IF auth.uid() IS NULL OR me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('cadastrar-estudante-na-escola', _school) THEN RAISE EXCEPTION 'student:capability-missing'; END IF;
  IF coalesce(pg_catalog.btrim(_display_name),'') = '' THEN RAISE EXCEPTION 'student:name-required'; END IF;
  IF c = '' AND i = '' THEN RAISE EXCEPTION 'student:exact-identifier-required'; END IF;
  IF c <> '' AND NOT public.technical_cpf_valid(c) THEN RAISE EXCEPTION 'student:cpf-invalid'; END IF;
  IF i <> '' AND i !~ '^[0-9]{12}$' THEN RAISE EXCEPTION 'student:inep-invalid'; END IF;
  IF c <> '' THEN h := public.technical_cpf_hmac(c); PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:' || h)); SELECT person_id INTO p1 FROM public.institutional_person_identifiers WHERE identifier_kind = 'cpf-hmac' AND value = h; END IF;
  IF i <> '' THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:' || i)); SELECT person_id INTO p2 FROM public.institutional_person_identifiers WHERE identifier_kind = 'inep-pessoa' AND value = i; END IF;
  IF p1 IS NOT NULL AND p2 IS NOT NULL AND p1 <> p2 THEN RAISE EXCEPTION 'identity:conflict'; END IF;
  pid := coalesce(p1, p2);
  IF pid IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_student_persons sp WHERE sp.person_id = pid) THEN RAISE EXCEPTION 'identity:already-registered-use-search'; END IF;
  IF pid IS NULL THEN INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES (pg_catalog.btrim(_display_name), 'pessoa-natural') RETURNING id INTO pid;
  ELSE reused := true; END IF;
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
  INSERT INTO public.student_registration_events(student_id, person_id, school_id, purpose, person_reused, author_user_id, author_person_id)
  VALUES (sid, pid, _school, 'matricula-na-escola', reused, auth.uid(), me);
  RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.register_student_for_school(text, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_student_for_school(text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.register_student_with_exact_identity(text, text, text) FROM authenticated;
COMMENT ON FUNCTION public.register_student_with_exact_identity(text, text, text) IS 'DEPRECATED: substituída por register_student_for_school (autorização escolar). Sem EXECUTE para app roles.';

-- Lotação/presença escolar no ano (não toca registro funcional; não cria regência).
CREATE OR REPLACE FUNCTION public.record_school_staff_presence(_link uuid, _school text, _year text, _status text, _expected_sequence integer, _declared_on date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.s_current_person(); cur record; nid uuid;
BEGIN
  IF auth.uid() IS NULL OR me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('manter-lotacao-da-escola', _school) THEN RAISE EXCEPTION 'presence:capability-missing'; END IF;
  IF _status NOT IN ('confirmada','encerrada') THEN RAISE EXCEPTION 'presence:status-invalid'; END IF;
  IF NOT public.s_year_open_for_operation(_year) THEN RAISE EXCEPTION 'presence:year-not-open'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.professional_functional_links l WHERE l.logical_id = _link) THEN RAISE EXCEPTION 'presence:functional-link-not-found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('presence:' || _link || ':' || _school || ':' || _year));
  SELECT * INTO cur FROM public.school_staff_presence WHERE functional_link_logical_id = _link AND school_id = _school AND academic_year_id = _year ORDER BY sequence DESC LIMIT 1;
  IF coalesce(cur.sequence, 0) IS DISTINCT FROM coalesce(_expected_sequence, 0) THEN RAISE EXCEPTION 'presence:stale-base'; END IF;
  IF cur.id IS NULL AND _status <> 'confirmada' THEN RAISE EXCEPTION 'presence:nothing-to-end'; END IF;
  IF cur.status = _status THEN RETURN cur.id; END IF;
  IF cur.id IS NOT NULL AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'presence:reason-required'; END IF;
  INSERT INTO public.school_staff_presence(functional_link_logical_id, school_id, academic_year_id, sequence, status, declared_on, reason, author_user_id, author_person_id)
  VALUES (_link, _school, _year, coalesce(cur.sequence, 0) + 1, _status, _declared_on, nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), me)
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_school_staff_presence(uuid, text, text, text, integer, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_staff_presence(uuid, text, text, text, integer, date, text) TO authenticated;

-- Baseline 2026 e indicadores: leitura do quadro pela escola (Direção consulta; Secretaria mantém).
CREATE OR REPLACE FUNCTION public.professional_school_observations_2026(_school text)
RETURNS TABLE(person_id uuid, display_name text, school_id text, declaration_count bigint, known_at timestamptz, start_known boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT (public.has_school_capability('manter-lotacao-da-escola', _school) OR public.has_school_capability('consultar-quadro-profissional-da-escola', _school)) THEN RAISE EXCEPTION 'baseline:capability-missing'; END IF;
  RETURN QUERY SELECT d.person_id, p.display_name, d.school_id, count(*), max(d.known_at), false
  FROM public.professional_census_declarations d JOIN public.institutional_persons p ON p.id = d.person_id
  WHERE d.school_id = _school GROUP BY d.person_id, p.display_name, d.school_id ORDER BY p.display_name;
END $$;

CREATE OR REPLACE FUNCTION public.year_preparation_summary(_school text, _from_year text, _to_year text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
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
    'alunos_sem_turma', (SELECT count(*) FROM t WHERE NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes ep WHERE ep.enrollment_id = t.id)),
    'servidores_lotados_ano_destino', (SELECT count(*) FROM sp WHERE status = 'confirmada'),
    'servidores_observados_baseline', (SELECT count(DISTINCT x.person_id) FROM public.professional_census_declarations x WHERE x.school_id = _school)
  ) INTO r;
  RETURN r;
END $$;

-- Política v6 = v5 + delta explícito, sem curinga.
INSERT INTO public.sigem_master_reserved_capabilities(capability_id, origin, decided_on)
VALUES ('preparar-ano-letivo','decisao-do-proprietario',DATE '2026-10-05');

DO $do$
DECLARE _v5 uuid; _v6 uuid; _issue text; _delta int; _n5 int;
BEGIN
  SELECT id INTO _v5 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 5 AND status = 'homologated' FOR UPDATE;
  IF _v5 IS NULL OR EXISTS (SELECT 1 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version > 5) THEN RAISE EXCEPTION 'v6:v5-not-head'; END IF;
  SELECT count(*) INTO _n5 FROM public.capability_policy_rules WHERE policy_id = _v5;
  IF _n5 <> 239 THEN RAISE EXCEPTION 'v6:v5-shape-divergent'; END IF;
  INSERT INTO public.capability_policies(logical_policy_id, version, supersedes_version_id, status)
  VALUES ('politica-capacidades-diario', 6, _v5, 'draft') RETURNING id INTO _v6;
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v6, engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id = _v5;
  WITH d(kind, cap, dims) AS (VALUES
    ('administrador-geral-do-sigem','preparar-ano-letivo',ARRAY['network']),
    ('administrador-geral-do-sigem','cadastrar-estudante-na-escola',ARRAY['network']),
    ('administrador-geral-do-sigem','localizar-servidor-por-identificador',ARRAY['network']),
    ('administrador-geral-do-sigem','manter-lotacao-da-escola',ARRAY['network']),
    ('administrador-geral-do-sigem','consultar-quadro-profissional-da-escola',ARRAY['network']),
    ('secretaria-escolar','cadastrar-estudante-na-escola',ARRAY['school']),
    ('secretaria-escolar','localizar-servidor-por-identificador',ARRAY['school']),
    ('secretaria-escolar','manter-lotacao-da-escola',ARRAY['school']),
    ('secretaria-escolar','consultar-quadro-profissional-da-escola',ARRAY['school']),
    ('direcao-escolar','consultar-quadro-profissional-da-escola',ARRAY['school'])
  )
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v6, kind, cap, dims FROM d;
  GET DIAGNOSTICS _delta = ROW_COUNT;
  IF _delta <> 10
     OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v6) <> _n5 + 10
     OR (SELECT count(DISTINCT (engagement_kind_id, capability_id, scope_dimensions)) FROM public.capability_policy_rules WHERE policy_id = _v6) <> _n5 + 10
     OR EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _v6 AND (capability_id ~ '[*%]' OR engagement_kind_id ~ '[*%]'))
     OR EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _v6 AND engagement_kind_id IN ('secretaria-escolar','direcao-escolar')
          AND capability_id IN ('manter-registro-funcional','preparar-ano-letivo','cadastrar-estudante-na-rede'))
  THEN RAISE EXCEPTION 'v6:shape-divergent'; END IF;
  _issue := public.capability_policy_homologation_issues(_v6, DATE '2026-10-05');
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'v6:%', _issue; END IF;
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = NULL,
    homologation_origin = 'decisao-do-proprietario', valid_from = DATE '2026-10-05' WHERE id = _v6;
END $do$;