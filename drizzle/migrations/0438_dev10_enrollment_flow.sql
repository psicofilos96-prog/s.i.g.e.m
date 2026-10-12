-- SIGEM Desenvolvimento L10: inscrição individual/institucional → análise → confirmação | espera, sem extrapolar vagas.
-- Pedido nunca ocupa vaga; só a confirmação ocupa, sob lock da turma.

-- Critério de lista de espera: versões append-only, aprovadas por pessoa ≠ autor. Primitivas fechadas, ordem declarada.
CREATE TABLE public.dev_waitlist_criteria_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  keys text[] NOT NULL CHECK (cardinality(keys) BETWEEN 1 AND 4 AND keys <@ ARRAY['prioridade-da-analise','data-do-pedido','pedido-institucional']::text[]),
  legal_basis text NOT NULL CHECK (length(btrim(legal_basis)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE TABLE public.dev_waitlist_criteria_approvals (
  criteria_version_id uuid PRIMARY KEY REFERENCES public.dev_waitlist_criteria_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Turma adota um critério aprovado (uma vez). Sem critério, a lista de espera não ordena.
CREATE TABLE public.dev_class_waitlist_criteria (
  class_id uuid PRIMARY KEY REFERENCES public.dev_classes(id),
  criteria_version_id uuid NOT NULL REFERENCES public.dev_waitlist_criteria_approvals(criteria_version_id),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Modo do pedido e elegibilidade conferida no ato (vínculo vigente no início da turma).
CREATE TABLE public.dev_enrollment_requests (
  enrollment_id uuid PRIMARY KEY REFERENCES public.dev_enrollments(id),
  mode text NOT NULL CHECK (mode IN ('individual','institucional')),
  requesting_school_id text REFERENCES public.institutional_schools(id),
  link_valid_from date NOT NULL,
  link_valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mode = 'individual' OR requesting_school_id IS NOT NULL)
);
-- Análise: ledger próprio por pedido; analista ≠ quem pediu.
CREATE TABLE public.dev_enrollment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  seq int NOT NULL CHECK (seq >= 1),
  decision text NOT NULL CHECK (decision IN ('deferida','indeferida')),
  priority int CHECK (priority IS NULL OR priority BETWEEN 0 AND 100),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  reviewer_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, seq)
);
GRANT SELECT ON public.dev_waitlist_criteria_versions, public.dev_waitlist_criteria_approvals, public.dev_class_waitlist_criteria, public.dev_enrollment_requests, public.dev_enrollment_reviews TO authenticated;
GRANT ALL ON public.dev_waitlist_criteria_versions, public.dev_waitlist_criteria_approvals, public.dev_class_waitlist_criteria, public.dev_enrollment_requests, public.dev_enrollment_reviews TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_waitlist_criteria_versions, public.dev_waitlist_criteria_approvals, public.dev_class_waitlist_criteria, public.dev_enrollment_requests, public.dev_enrollment_reviews FROM authenticated, anon;
ALTER TABLE public.dev_waitlist_criteria_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_waitlist_criteria_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_class_waitlist_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_enrollment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_enrollment_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev wl criteria read" ON public.dev_waitlist_criteria_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev wl approvals read" ON public.dev_waitlist_criteria_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev class wl read" ON public.dev_class_waitlist_criteria FOR SELECT TO authenticated USING (true);
-- Pedido e análise: a própria pessoa ou quem gere turmas de formação.
CREATE POLICY "dev requests read" ON public.dev_enrollment_requests FOR SELECT TO authenticated USING (
  public.has_network_capability('gerir-turmas-de-formacao')
  OR EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND e.person_id = public.current_person_id()));
CREATE POLICY "dev reviews read" ON public.dev_enrollment_reviews FOR SELECT TO authenticated USING (
  public.has_network_capability('gerir-turmas-de-formacao')
  OR EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND e.person_id = public.current_person_id()));
CREATE TRIGGER devwlv_immutable BEFORE UPDATE OR DELETE ON public.dev_waitlist_criteria_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devwla_immutable BEFORE UPDATE OR DELETE ON public.dev_waitlist_criteria_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcwl_immutable BEFORE UPDATE OR DELETE ON public.dev_class_waitlist_criteria FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devreq_immutable BEFORE UPDATE OR DELETE ON public.dev_enrollment_requests FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devrev_immutable BEFORE UPDATE OR DELETE ON public.dev_enrollment_reviews FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_dev_waitlist_criteria(_logical uuid, _expected_version int, _keys text[], _basis text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_waitlist_criteria_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('definir-criterios-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF (SELECT count(DISTINCT k) FROM unnest(_keys) k) <> cardinality(_keys) THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  _logical := coalesce(_logical, gen_random_uuid());
  PERFORM pg_advisory_xact_lock(hashtext('dev-wl:' || _logical::text));
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_waitlist_criteria_versions WHERE logical_id = _logical;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_waitlist_criteria_versions(logical_id, version, keys, legal_basis, author_person, idempotency_key)
  VALUES (_logical, _last + 1, _keys, btrim(_basis), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_waitlist_criteria(_version uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_waitlist_criteria_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_waitlist_criteria_approvals WHERE criteria_version_id = _version AND approver_person = _p) THEN RETURN; END IF;
  IF NOT public.has_network_capability('aprovar-criterios-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _v FROM public.dev_waitlist_criteria_versions WHERE id = _version;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_waitlist_criteria_approvals(criteria_version_id, approver_person, reason) VALUES (_version, _p, btrim(_reason));
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
END $$;

CREATE OR REPLACE FUNCTION public.adopt_dev_class_waitlist_criteria(_class uuid, _version uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_class_waitlist_criteria WHERE class_id = _class AND criteria_version_id = _version) THEN RETURN; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_class_waitlist_criteria(class_id, criteria_version_id, author_person) VALUES (_class, _version, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:criteria-already-adopted';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'dev:criteria-not-approved';
END $$;

-- Pedido: turma com inscrições abertas, vínculo da pessoa vigente no início e cabeça da cadeia, pré-requisitos concluídos.
CREATE OR REPLACE FUNCTION public.request_dev_enrollment(_class uuid, _person uuid, _link uuid, _mode text, _school text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c public.dev_classes; _state text; _l public.professional_functional_links;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_enrollments WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _mode = 'individual' AND _person IS DISTINCT FROM _p THEN RAISE EXCEPTION 'dev:individual-is-self'; END IF;
  IF _mode = 'institucional' AND NOT public.has_capability('indicar-para-formacao', _school) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _mode NOT IN ('individual','institucional') THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _c FROM public.dev_classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT status INTO _state FROM public.dev_class_status_events WHERE class_id = _class ORDER BY seq DESC LIMIT 1;
  IF _state IS DISTINCT FROM 'inscricoes-abertas' THEN RAISE EXCEPTION 'dev:enrollment-closed'; END IF;
  SELECT * INTO _l FROM public.professional_functional_links WHERE id = _link AND person_id = _person;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM public.professional_functional_links WHERE supersedes_id = _link)
     OR _l.valid_from > _c.starts_on OR (_l.valid_until IS NOT NULL AND _l.valid_until < _c.starts_on) THEN RAISE EXCEPTION 'dev:not-eligible-link'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_course_prerequisites q WHERE q.course_version_id = _c.course_version_id
     AND NOT EXISTS (SELECT 1 FROM public.dev_enrollments e JOIN public.dev_classes k ON k.id = e.class_id
       JOIN public.dev_course_versions v ON v.id = k.course_version_id JOIN public.dev_participation_events x ON x.enrollment_id = e.id
       WHERE e.person_id = _person AND v.course_id = q.prerequisite_course_id AND x.kind = 'conclusao')) THEN RAISE EXCEPTION 'dev:prerequisite-missing'; END IF;
  INSERT INTO public.dev_enrollments(class_id, person_id, functional_link_id, author_person, idempotency_key) VALUES (_class, _person, _link, _p, _key) RETURNING id INTO _id;
  INSERT INTO public.dev_enrollment_requests(enrollment_id, mode, requesting_school_id, link_valid_from, link_valid_until)
  VALUES (_id, _mode, CASE WHEN _mode = 'institucional' THEN _school END, _l.valid_from, _l.valid_until);
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-enrolled';
  WHEN foreign_key_violation OR check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.review_dev_enrollment(_enrollment uuid, _expected_seq int, _decision text, _priority int, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _e public.dev_enrollments; _last int; _seq int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT seq INTO _seq FROM public.dev_enrollment_reviews WHERE idempotency_key = _key AND enrollment_id = _enrollment;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.dev_enrollment_requests WHERE enrollment_id = _enrollment) THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _p IN (_e.person_id, _e.author_person) THEN RAISE EXCEPTION 'dev:self-review'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment) THEN RAISE EXCEPTION 'dev:already-placed'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_enrollment_reviews WHERE enrollment_id = _enrollment;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_enrollment_reviews(enrollment_id, seq, decision, priority, reason, reviewer_person, idempotency_key)
  VALUES (_enrollment, _last + 1, _decision, _priority, btrim(_reason), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Ocupação = confirmações sem evento terminal. Função auxiliar só leitura interna.
CREATE OR REPLACE FUNCTION public.dev_class_occupied(_class uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::int FROM public.dev_enrollments e WHERE e.class_id = _class
    AND EXISTS (SELECT 1 FROM public.dev_participation_events x WHERE x.enrollment_id = e.id AND x.kind = 'confirmacao')
    AND NOT EXISTS (SELECT 1 FROM public.dev_participation_events x WHERE x.enrollment_id = e.id AND x.kind IN ('desistencia','cancelamento'))
$$;
REVOKE EXECUTE ON FUNCTION public.dev_class_occupied(uuid) FROM PUBLIC, anon, authenticated;

-- Colocação: lock da turma, vaga relida; com vaga ⇒ confirmação; sem vaga ⇒ espera. Da espera só sai quem é o primeiro pelo critério.
CREATE OR REPLACE FUNCTION public.place_dev_enrollment(_enrollment uuid, _key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _e public.dev_enrollments; _c public.dev_classes; _dec text; _last int; _kind text;
  _keys text[]; _first uuid; _waiting boolean;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT kind INTO _kind FROM public.dev_participation_events WHERE idempotency_key = _key AND enrollment_id = _enrollment;
  IF _kind IS NOT NULL THEN RETURN _kind; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _c FROM public.dev_classes WHERE id = _e.class_id FOR UPDATE;
  IF _c.seats IS NULL THEN RAISE EXCEPTION 'dev:seats-not-configured'; END IF;
  SELECT decision INTO _dec FROM public.dev_enrollment_reviews WHERE enrollment_id = _enrollment ORDER BY seq DESC LIMIT 1;
  IF _dec IS DISTINCT FROM 'deferida' THEN RAISE EXCEPTION 'dev:not-approved'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind IN ('confirmacao','desistencia','cancelamento','conclusao','nao-conclusao')) THEN RAISE EXCEPTION 'dev:terminal'; END IF;
  _waiting := EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind = 'espera');
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_participation_events WHERE enrollment_id = _enrollment;
  IF public.dev_class_occupied(_c.id) >= _c.seats THEN
    IF _waiting THEN RAISE EXCEPTION 'dev:no-seats'; END IF;
    _kind := 'espera';
  ELSE
    -- Havendo fila, a vaga é de quem o critério aprovado põe em primeiro; sem critério adotado, fila não se resolve sozinha.
    IF EXISTS (SELECT 1 FROM public.dev_enrollments w JOIN public.dev_participation_events x ON x.enrollment_id = w.id AND x.kind = 'espera'
               WHERE w.class_id = _c.id AND NOT EXISTS (SELECT 1 FROM public.dev_participation_events y WHERE y.enrollment_id = w.id AND y.seq > x.seq)) THEN
      SELECT v.keys INTO _keys FROM public.dev_class_waitlist_criteria cw JOIN public.dev_waitlist_criteria_versions v ON v.id = cw.criteria_version_id WHERE cw.class_id = _c.id;
      IF _keys IS NULL THEN RAISE EXCEPTION 'dev:waitlist-criteria-missing'; END IF;
      SELECT w.id INTO _first FROM public.dev_enrollments w
        JOIN public.dev_participation_events x ON x.enrollment_id = w.id AND x.kind = 'espera'
        JOIN public.dev_enrollment_requests r ON r.enrollment_id = w.id
        LEFT JOIN LATERAL (SELECT priority FROM public.dev_enrollment_reviews rv WHERE rv.enrollment_id = w.id ORDER BY seq DESC LIMIT 1) rv ON true
        WHERE w.class_id = _c.id AND NOT EXISTS (SELECT 1 FROM public.dev_participation_events y WHERE y.enrollment_id = w.id AND y.seq > x.seq)
        ORDER BY
          CASE WHEN _keys[1] = 'prioridade-da-analise' THEN -coalesce(rv.priority,0) WHEN _keys[1] = 'pedido-institucional' THEN (r.mode <> 'institucional')::int END NULLS LAST,
          CASE WHEN _keys[1] = 'data-do-pedido' THEN w.created_at END NULLS LAST,
          CASE WHEN _keys[2] = 'prioridade-da-analise' THEN -coalesce(rv.priority,0) WHEN _keys[2] = 'pedido-institucional' THEN (r.mode <> 'institucional')::int END NULLS LAST,
          CASE WHEN _keys[2] = 'data-do-pedido' THEN w.created_at END NULLS LAST,
          CASE WHEN _keys[3] = 'prioridade-da-analise' THEN -coalesce(rv.priority,0) WHEN _keys[3] = 'pedido-institucional' THEN (r.mode <> 'institucional')::int END NULLS LAST,
          CASE WHEN _keys[3] = 'data-do-pedido' THEN w.created_at END NULLS LAST,
          w.id
        LIMIT 1;
      IF _first IS DISTINCT FROM _enrollment THEN
        IF _waiting THEN RAISE EXCEPTION 'dev:not-first-in-waitlist'; END IF;
        _kind := 'espera';
      ELSE _kind := 'confirmacao'; END IF;
    ELSE _kind := 'confirmacao'; END IF;
  END IF;
  INSERT INTO public.dev_participation_events(enrollment_id, seq, kind, actor_person, idempotency_key) VALUES (_enrollment, _last + 1, _kind, _p, _key);
  RETURN _kind;
END $$;

-- Writer de participação deixa de aceitar confirmação/espera (só por place_dev_enrollment, que relê a vaga).
CREATE OR REPLACE FUNCTION public.record_dev_participation(_enrollment uuid, _expected_seq int, _kind text, _pct numeric, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _e public.dev_enrollments; _last int; _seq int; _min numeric;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF _kind IN ('confirmacao','espera') THEN RAISE EXCEPTION 'dev:use-place'; END IF;
  SELECT seq INTO _seq FROM public.dev_participation_events WHERE idempotency_key = _key AND enrollment_id = _enrollment;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR (_kind = 'desistencia' AND _e.person_id = _p)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind IN ('desistencia','cancelamento','conclusao','nao-conclusao')) THEN
    RAISE EXCEPTION 'dev:terminal'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_participation_events WHERE enrollment_id = _enrollment;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  IF _kind IN ('conclusao','nao-conclusao') AND NOT EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind = 'confirmacao') THEN
    RAISE EXCEPTION 'dev:not-confirmed'; END IF;
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

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_waitlist_criteria(uuid,int,text[],text,text)','approve_dev_waitlist_criteria(uuid,text)',
    'adopt_dev_class_waitlist_criteria(uuid,uuid)','request_dev_enrollment(uuid,uuid,uuid,text,text,text)',
    'review_dev_enrollment(uuid,int,text,int,text,text)','place_dev_enrollment(uuid,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.enroll_dev_class(uuid,uuid,uuid,text) FROM authenticated;
COMMENT ON FUNCTION public.enroll_dev_class(uuid,uuid,uuid,text) IS 'DEPRECATED for clients: use request_dev_enrollment + review + place (L10)';