-- SIGEM Desenvolvimento L02: necessidade → plano (versões) → programa → curso (versões) → turma;
-- pessoa → vínculo → inscrição → participação (eventos) → conclusão → certificação.
-- Tudo append-only; escrita só por writers DEFINER com pessoa da sessão e capacidade; aprovação por pessoa ≠ autor.

CREATE TABLE public.dev_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text REFERENCES public.institutional_schools(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dev_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cycle_label text NOT NULL CHECK (length(btrim(cycle_label)) BETWEEN 4 AND 40), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.dev_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.dev_plans(id),
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  need_ids uuid[] NOT NULL DEFAULT '{}',
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);

CREATE TABLE public.dev_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.dev_plan_versions(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dev_courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL REFERENCES public.dev_programs(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.dev_course_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.dev_courses(id),
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  hours_minutes int CHECK (hours_minutes IS NULL OR hours_minutes > 0),
  min_attendance_pct numeric(5,2) CHECK (min_attendance_pct IS NULL OR min_attendance_pct BETWEEN 0 AND 100),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);

-- Aprovação de versão (plano ou curso): pessoa ≠ autor, decisão fundamentada, uma por versão.
CREATE TABLE public.dev_version_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (subject IN ('plano','curso')),
  version_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('aprovada','recusada')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  approver_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject, version_id)
);

CREATE TABLE public.dev_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL REFERENCES public.dev_course_versions(id),
  school_id text REFERENCES public.institutional_schools(id),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 80),
  seats int CHECK (seats IS NULL OR seats > 0),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE public.dev_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  functional_link_id uuid REFERENCES public.professional_functional_links(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, person_id)
);

CREATE TABLE public.dev_participation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('confirmacao','espera','desistencia','cancelamento','conclusao','nao-conclusao')),
  attendance_pct numeric(5,2) CHECK (attendance_pct IS NULL OR attendance_pct BETWEEN 0 AND 100),
  note text CHECK (note IS NULL OR length(btrim(note)) >= 10),
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, seq),
  CHECK (kind NOT IN ('desistencia','cancelamento','nao-conclusao') OR note IS NOT NULL),
  CHECK (kind <> 'conclusao' OR attendance_pct IS NOT NULL)
);

CREATE TABLE public.dev_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.dev_enrollments(id),
  conclusion_event_id uuid NOT NULL REFERENCES public.dev_participation_events(id),
  verification_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),
  document_version_ref uuid NOT NULL REFERENCES public.docserv_document_versions(id),
  issuer_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants: leitura por tabela; nenhuma DML direta.
GRANT SELECT ON public.dev_needs, public.dev_plans, public.dev_plan_versions, public.dev_programs, public.dev_courses,
  public.dev_course_versions, public.dev_version_approvals, public.dev_classes, public.dev_enrollments,
  public.dev_participation_events, public.dev_certifications TO authenticated;
GRANT ALL ON public.dev_needs, public.dev_plans, public.dev_plan_versions, public.dev_programs, public.dev_courses,
  public.dev_course_versions, public.dev_version_approvals, public.dev_classes, public.dev_enrollments,
  public.dev_participation_events, public.dev_certifications TO service_role;
REVOKE SELECT ON public.dev_certifications FROM authenticated;
GRANT SELECT (id, enrollment_id, conclusion_event_id, verification_code, issuer_person, created_at) ON public.dev_certifications TO authenticated;

ALTER TABLE public.dev_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_course_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_version_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_participation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_certifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dev_can_manage() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.has_network_capability('planejar-formacao') OR public.has_network_capability('acompanhar-formacao')
$$;
REVOKE EXECUTE ON FUNCTION public.dev_can_manage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_can_manage() TO authenticated, service_role;

-- Necessidades e planejamento: só gestão. Catálogo (cursos/turmas) legível por autenticados.
CREATE POLICY "dev needs managers" ON public.dev_needs FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev plans managers" ON public.dev_plans FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev plan versions managers" ON public.dev_plan_versions FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev approvals managers" ON public.dev_version_approvals FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev programs read" ON public.dev_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev courses read" ON public.dev_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev course versions read" ON public.dev_course_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev classes read" ON public.dev_classes FOR SELECT TO authenticated USING (true);
-- Inscrição/participação/certificado: titular ou gestão.
CREATE POLICY "dev enrollments own or manager" ON public.dev_enrollments FOR SELECT TO authenticated
  USING (person_id = public.current_person_id() OR public.dev_can_manage());
CREATE POLICY "dev participation follows enrollment" ON public.dev_participation_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND (e.person_id = public.current_person_id() OR public.dev_can_manage())));
CREATE POLICY "dev certifications follow enrollment" ON public.dev_certifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND (e.person_id = public.current_person_id() OR public.dev_can_manage())));

CREATE TRIGGER devn_immutable BEFORE UPDATE OR DELETE ON public.dev_needs FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devp_immutable BEFORE UPDATE OR DELETE ON public.dev_plans FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devpv_immutable BEFORE UPDATE OR DELETE ON public.dev_plan_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devpg_immutable BEFORE UPDATE OR DELETE ON public.dev_programs FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devc_immutable BEFORE UPDATE OR DELETE ON public.dev_courses FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcv_immutable BEFORE UPDATE OR DELETE ON public.dev_course_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER deva_immutable BEFORE UPDATE OR DELETE ON public.dev_version_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcl_immutable BEFORE UPDATE OR DELETE ON public.dev_classes FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER deve_immutable BEFORE UPDATE OR DELETE ON public.dev_enrollments FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devpe_immutable BEFORE UPDATE OR DELETE ON public.dev_participation_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcert_immutable BEFORE UPDATE OR DELETE ON public.dev_certifications FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
REVOKE TRUNCATE ON public.dev_needs, public.dev_plans, public.dev_plan_versions, public.dev_programs, public.dev_courses,
  public.dev_course_versions, public.dev_version_approvals, public.dev_classes, public.dev_enrollments,
  public.dev_participation_events, public.dev_certifications FROM authenticated, anon;

-- Versão utilizável = última versão do sujeito com aprovação "aprovada".
CREATE OR REPLACE FUNCTION public.dev_version_usable(_subject text, _version uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_version_approvals a WHERE a.subject = _subject AND a.version_id = _version AND a.decision = 'aprovada')
    AND CASE _subject
      WHEN 'plano' THEN NOT EXISTS (SELECT 1 FROM public.dev_plan_versions v JOIN public.dev_plan_versions w ON w.plan_id = v.plan_id AND w.version > v.version WHERE v.id = _version)
      WHEN 'curso' THEN NOT EXISTS (SELECT 1 FROM public.dev_course_versions v JOIN public.dev_course_versions w ON w.course_id = v.course_id AND w.version > v.version WHERE v.id = _version)
      ELSE false END
$$;
REVOKE EXECUTE ON FUNCTION public.dev_version_usable(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_version_usable(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_dev_need(_school text, _title text, _evidence text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_needs WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_needs(school_id, title, evidence, author_person, idempotency_key) VALUES (_school, btrim(_title), btrim(_evidence), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- _plan NULL ⇒ novo plano (v1); senão nova versão com base esperada.
CREATE OR REPLACE FUNCTION public.record_dev_plan_version(_plan uuid, _expected_version int, _cycle text, _title text, _needs uuid[], _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_plan_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_needs, '{}')) n WHERE NOT EXISTS (SELECT 1 FROM public.dev_needs d WHERE d.id = n)) THEN RAISE EXCEPTION 'dev:invalid-need'; END IF;
  IF _plan IS NULL THEN
    INSERT INTO public.dev_plans(cycle_label) VALUES (btrim(_cycle)) RETURNING id INTO _plan; _last := 0;
    IF coalesce(_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'dev:stale'; END IF;
  ELSE
    PERFORM 1 FROM public.dev_plans WHERE id = _plan FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
    SELECT coalesce(max(version), 0) INTO _last FROM public.dev_plan_versions WHERE plan_id = _plan;
    IF _last <> _expected_version THEN RAISE EXCEPTION 'dev:stale'; END IF;
  END IF;
  INSERT INTO public.dev_plan_versions(plan_id, version, title, need_ids, reason, author_person, idempotency_key)
  VALUES (_plan, _last + 1, btrim(_title), coalesce(_needs, '{}'), nullif(btrim(coalesce(_reason, '')), ''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.decide_dev_version(_subject text, _version uuid, _decision text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_version_approvals WHERE idempotency_key = _key AND approver_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('aprovar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _subject = 'plano' THEN SELECT author_person INTO _author FROM public.dev_plan_versions WHERE id = _version;
  ELSIF _subject = 'curso' THEN SELECT author_person INTO _author FROM public.dev_course_versions WHERE id = _version;
  ELSE RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _author IS NULL THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_version_approvals(subject, version_id, decision, reason, approver_person, idempotency_key)
  VALUES (_subject, _version, _decision, btrim(_reason), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_program(_plan_version uuid, _title text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_programs WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT public.dev_version_usable('plano', _plan_version) THEN RAISE EXCEPTION 'dev:plan-not-approved'; END IF;
  INSERT INTO public.dev_programs(plan_version_id, title, author_person, idempotency_key) VALUES (_plan_version, btrim(_title), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_course_version(_program uuid, _course uuid, _expected_version int, _title text, _minutes int, _min_pct numeric, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_course_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _course IS NULL THEN
    IF coalesce(_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'dev:stale'; END IF;
    INSERT INTO public.dev_courses(program_id) VALUES (_program) RETURNING id INTO _course; _last := 0;
  ELSE
    PERFORM 1 FROM public.dev_courses WHERE id = _course FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
    SELECT coalesce(max(version), 0) INTO _last FROM public.dev_course_versions WHERE course_id = _course;
    IF _last <> _expected_version THEN RAISE EXCEPTION 'dev:stale'; END IF;
  END IF;
  INSERT INTO public.dev_course_versions(course_id, version, title, hours_minutes, min_attendance_pct, reason, author_person, idempotency_key)
  VALUES (_course, _last + 1, btrim(_title), _minutes, _min_pct, nullif(btrim(coalesce(_reason, '')), ''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_class(_course_version uuid, _school text, _label text, _seats int, _starts date, _ends date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_classes WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT public.dev_version_usable('curso', _course_version) THEN RAISE EXCEPTION 'dev:course-not-approved'; END IF;
  INSERT INTO public.dev_classes(course_version_id, school_id, label, seats, starts_on, ends_on, author_person, idempotency_key)
  VALUES (_course_version, _school, btrim(_label), _seats, _starts, _ends, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Inscrição: a própria pessoa da sessão, ou gestão com capacidade inscrevendo outra pessoa canônica.
-- Vínculo (opcional) precisa pertencer à pessoa. Vaga: sem número configurado ⇒ recusa.
CREATE OR REPLACE FUNCTION public.enroll_dev_class(_class uuid, _person uuid, _link uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c public.dev_classes; _taken int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_enrollments WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _person IS DISTINCT FROM _p AND NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _c FROM public.dev_classes WHERE id = _class FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _c.seats IS NULL THEN RAISE EXCEPTION 'dev:seats-not-configured'; END IF;
  IF _link IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.professional_functional_links l WHERE l.id = _link AND l.person_id = _person) THEN
    RAISE EXCEPTION 'dev:link-not-of-person'; END IF;
  SELECT count(*) INTO _taken FROM public.dev_enrollments e WHERE e.class_id = _class
    AND NOT EXISTS (SELECT 1 FROM public.dev_participation_events x WHERE x.enrollment_id = e.id AND x.kind IN ('desistencia','cancelamento'));
  IF _taken >= _c.seats THEN RAISE EXCEPTION 'dev:no-seats'; END IF;
  INSERT INTO public.dev_enrollments(class_id, person_id, functional_link_id, author_person, idempotency_key)
  VALUES (_class, _person, _link, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-enrolled';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Participação: desistência pelo titular ou gestão; demais eventos só gestão. Terminal não reabre.
-- Conclusão exige frequência mínima configurada no curso (ausente ⇒ recusa) e frequência ≥ mínimo.
CREATE OR REPLACE FUNCTION public.record_dev_participation(_enrollment uuid, _expected_seq int, _kind text, _pct numeric, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _e public.dev_enrollments; _last int; _seq int; _min numeric;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT seq INTO _seq FROM public.dev_participation_events WHERE idempotency_key = _key AND enrollment_id = _enrollment;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR (_kind = 'desistencia' AND _e.person_id = _p)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind IN ('desistencia','cancelamento','conclusao','nao-conclusao')) THEN
    RAISE EXCEPTION 'dev:terminal'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_participation_events WHERE enrollment_id = _enrollment;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  IF _kind = 'conclusao' THEN
    SELECT v.min_attendance_pct INTO _min FROM public.dev_classes c JOIN public.dev_course_versions v ON v.id = c.course_version_id WHERE c.id = _e.class_id;
    IF _min IS NULL THEN RAISE EXCEPTION 'dev:min-attendance-not-configured'; END IF;
    IF _pct IS NULL OR _pct < _min THEN RAISE EXCEPTION 'dev:attendance-below-min'; END IF;
  END IF;
  INSERT INTO public.dev_participation_events(enrollment_id, seq, kind, attendance_pct, note, actor_person, idempotency_key)
  VALUES (_enrollment, _last + 1, _kind, _pct, nullif(btrim(coalesce(_note, '')), ''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Certificação: só sobre conclusão registrada, com documento já existente no SIGEM Documentos, emissor ≠ quem registrou a conclusão e ≠ titular.
CREATE OR REPLACE FUNCTION public.issue_dev_certification(_enrollment uuid, _document_version uuid, _key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _code text; _ev public.dev_participation_events; _e public.dev_enrollments;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT verification_code INTO _code FROM public.dev_certifications WHERE idempotency_key = _key AND issuer_person = _p;
  IF _code IS NOT NULL THEN RETURN _code; END IF;
  IF NOT public.has_network_capability('certificar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _ev FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind = 'conclusao';
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:not-concluded'; END IF;
  IF _ev.actor_person = _p OR _e.person_id = _p THEN RAISE EXCEPTION 'dev:segregation'; END IF;
  INSERT INTO public.dev_certifications(enrollment_id, conclusion_event_id, document_version_ref, issuer_person, idempotency_key)
  VALUES (_enrollment, _ev.id, _document_version, _p, _key) RETURNING verification_code INTO _code;
  RETURN _code;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-certified';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid-document';
END $$;

-- Verificação pública: só código → situação, curso e data; nunca pessoa, CPF ou matrícula.
CREATE OR REPLACE FUNCTION public.verify_dev_certification(_code text)
RETURNS TABLE(status text, course_title text, hours_minutes int, issued_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'emitido', v.title, v.hours_minutes, c.created_at::date
  FROM public.dev_certifications c JOIN public.dev_enrollments e ON e.id = c.enrollment_id
  JOIN public.dev_classes k ON k.id = e.class_id JOIN public.dev_course_versions v ON v.id = k.course_version_id
  WHERE c.verification_code = upper(btrim(_code))
  UNION ALL SELECT 'nao-encontrado', NULL, NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM public.dev_certifications WHERE verification_code = upper(btrim(_code)))
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_need(text,text,text,text)','record_dev_plan_version(uuid,int,text,text,uuid[],text,text)',
    'decide_dev_version(text,uuid,text,text,text)','record_dev_program(uuid,text,text)','record_dev_course_version(uuid,uuid,int,text,int,numeric,text,text)',
    'record_dev_class(uuid,text,text,int,date,date,text)','enroll_dev_class(uuid,uuid,uuid,text)','record_dev_participation(uuid,int,text,numeric,text,text)',
    'issue_dev_certification(uuid,uuid,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_dev_certification(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_dev_certification(text) TO anon, authenticated;