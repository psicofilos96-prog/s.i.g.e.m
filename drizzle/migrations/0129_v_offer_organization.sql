-- Frente V (V.0–V.7) — organização da oferta 2027: jornada, grade, atribuição docente, substituição,
-- horário projetado, carga (sem fonte inventada) e prontidão do Diário. Aditivo; 0018–0128 intactas.

-- ===== V.0.1 Privilégios: nenhuma role de app (nem service_role) faz DML direto =====
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  public.class_journeys, public.class_journey_versions, public.class_journey_intervals,
  public.class_schedules, public.class_schedule_versions, public.class_schedule_blocks, public.class_schedule_block_engagements,
  public.teaching_assignments, public.teaching_assignment_versions
FROM PUBLIC, anon, authenticated, service_role;

-- ===== V.0.2/V.0.3 Estado anual + data-alvo (nunca CURRENT_DATE) =====
CREATE FUNCTION public.class_time_writable_target(_class_id text, _valid_from date, _valid_until date, _domain text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; _year text; _state text; _s date; _e date;
BEGIN
  SELECT c.school_id, c.academic_year_id INTO _school, _year FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _school IS NULL THEN RAISE EXCEPTION '%:class-not-found', _domain; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION '%:valid-from-required', _domain; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION '%:invalid-window', _domain; END IF;
  SELECT s.state INTO _state FROM public.academic_year_operational_state_at(_year) s;
  IF _state IS NULL THEN RAISE EXCEPTION '%:year-without-state', _domain; END IF;
  IF _state NOT IN ('em-preparacao','operacional') THEN RAISE EXCEPTION '%:year-not-writable', _domain; END IF;
  SELECT v.starts_on, v.ends_on INTO _s, _e FROM public.institutional_academic_year_versions v
   WHERE v.academic_year_id = _year ORDER BY v.version DESC LIMIT 1;
  IF _s IS NULL OR _e IS NULL THEN RAISE EXCEPTION '%:year-without-dates', _domain; END IF;
  IF _valid_from < _s OR _valid_from > _e OR (_valid_until IS NOT NULL AND _valid_until > _e) THEN
    RAISE EXCEPTION '%:window-outside-year', _domain; END IF;
  RETURN _school;
END $fn$;
REVOKE ALL ON FUNCTION public.class_time_writable_target(text, date, date, text) FROM PUBLIC, anon, authenticated, service_role;

-- Capacidade avaliada na data-alvo; só escopo da própria escola (decisão do proprietário: Direção executa).
CREATE FUNCTION public.class_time_capability_grant(_capability text, _school text, _on date)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF public.current_person_id() IS NULL THEN RAISE EXCEPTION 'person-required'; END IF;
  IF _capability NOT IN ('manter-jornada-da-turma','manter-grade-da-turma','manter-atribuicao-docente') THEN
    RAISE EXCEPTION 'class-time:capability-not-allowed'; END IF;
  IF _school IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'class-time:target-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.class_time_capability_grant(text, text, date) FROM PUBLIC, anon, authenticated, service_role;

-- ===== V.0.4 Cadeia da atribuição protegida pelo banco =====
ALTER TABLE public.teaching_assignment_versions
  ADD CONSTRAINT teaching_assignment_versions_root_check CHECK ((version = 1) = (supersedes_id IS NULL)),
  ADD CONSTRAINT teaching_assignment_versions_kind_root_check CHECK ((change_kind = 'constituicao') = (supersedes_id IS NULL));
ALTER TABLE public.teaching_assignment_versions
  ADD COLUMN functional_link_logical_id uuid,
  ADD COLUMN posting_logical_id uuid;
COMMENT ON COLUMN public.teaching_assignment_versions.functional_link_logical_id IS 'V.3: vínculo funcional explicitamente usado (null só em versões anteriores à V).';

CREATE FUNCTION public.guard_teaching_assignment_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _p public.teaching_assignment_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 OR EXISTS (SELECT 1 FROM public.teaching_assignment_versions v WHERE v.assignment_id = NEW.assignment_id) THEN
      RAISE EXCEPTION 'assignment:invalid-chain'; END IF;
  ELSE
    SELECT * INTO _p FROM public.teaching_assignment_versions WHERE id = NEW.supersedes_id;
    IF _p.id IS NULL OR _p.assignment_id <> NEW.assignment_id OR NEW.version <> _p.version + 1 THEN
      RAISE EXCEPTION 'assignment:invalid-chain'; END IF;
    IF NEW.change_kind = 'sucessao' AND NEW.valid_from <= _p.valid_from THEN
      RAISE EXCEPTION 'assignment:succession-must-start-later'; END IF;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_teaching_assignment_version() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER teaching_assignment_version_guard BEFORE INSERT ON public.teaching_assignment_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_teaching_assignment_version();

-- Jornada/grade: raiz única e sucessor único já garantidos (UNIQUE(entidade,version), UNIQUE(supersedes_id),
-- CHECK version=1 ⇔ raiz, guard same-entity/+1). Reforço: raiz só se a entidade não tem versão alguma.
CREATE FUNCTION public.guard_class_time_root() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF TG_TABLE_NAME = 'class_journey_versions' AND EXISTS (SELECT 1 FROM public.class_journey_versions v WHERE v.journey_id = NEW.journey_id)
    THEN RAISE EXCEPTION 'journey:invalid-chain'; END IF;
    IF TG_TABLE_NAME = 'class_schedule_versions' AND EXISTS (SELECT 1 FROM public.class_schedule_versions v WHERE v.schedule_id = NEW.schedule_id)
    THEN RAISE EXCEPTION 'schedule:invalid-chain'; END IF;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_time_root() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER class_journey_version_root_guard BEFORE INSERT ON public.class_journey_versions FOR EACH ROW EXECUTE FUNCTION public.guard_class_time_root();
CREATE TRIGGER class_schedule_version_root_guard BEFORE INSERT ON public.class_schedule_versions FOR EACH ROW EXECUTE FUNCTION public.guard_class_time_root();

-- ===== V.1 Writer de jornada (estado anual, data-alvo, pessoa, lock, cabeça esperada) =====
CREATE OR REPLACE FUNCTION public.record_class_journey_version(_class_id text, _expected_head_id uuid, _change_kind text,
  _valid_from date, _valid_until date, _source_ref text, _reason text, _intervals jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _jid text; _head uuid; _hver integer; _vid uuid; _n integer; i jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  _school := public.class_time_writable_target(_class_id, _valid_from, _valid_until, 'journey');
  g := public.class_time_capability_grant('manter-jornada-da-turma', _school, _valid_from);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'journey:invalid-change-kind'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'journey:reason-required'; END IF;
  IF _intervals IS NULL OR pg_catalog.jsonb_typeof(_intervals) <> 'array' OR pg_catalog.jsonb_array_length(_intervals) = 0 THEN
    RAISE EXCEPTION 'journey:intervals-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('journey:' || _class_id, 0));
  SELECT j.id INTO _jid FROM public.class_journeys j WHERE j.class_id = _class_id;
  IF _jid IS NOT NULL THEN
    SELECT v.id, v.version INTO _head, _hver FROM public.class_journey_versions v WHERE v.journey_id = _jid ORDER BY v.version DESC LIMIT 1;
  END IF;
  IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'journey:stale-head'; END IF;
  IF (_head IS NULL) <> (_change_kind = 'constituicao') THEN RAISE EXCEPTION 'journey:invalid-change-kind'; END IF;
  IF _jid IS NULL THEN
    _jid := 'cj-' || gen_random_uuid()::text;
    INSERT INTO public.class_journeys(id, class_id) VALUES (_jid, _class_id);
  END IF;
  INSERT INTO public.class_journey_versions(journey_id, version, supersedes_id, change_kind, valid_from, valid_until,
      originating_act_ref, change_reason, recorded_by, recorded_by_person_id)
    VALUES (_jid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until,
      coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'decisao-interna-sem-documento-fonte'),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id())
    RETURNING id INTO _vid;
  _n := 0;
  FOR i IN SELECT * FROM pg_catalog.jsonb_array_elements(_intervals) LOOP
    IF NOT (i ? 'weekday' AND i ? 'starts_at' AND i ? 'ends_at') THEN RAISE EXCEPTION 'journey:invalid-interval'; END IF;
    INSERT INTO public.class_journey_intervals(version_id, weekday, starts_at, ends_at)
      VALUES (_vid, (i->>'weekday')::smallint, (i->>'starts_at')::time, (i->>'ends_at')::time);
    _n := _n + 1;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('journey_id', _jid, 'version_id', _vid, 'version', coalesce(_hver,0)+1,
    'intervals', _n, 'engagement_id', g);
END $fn$;
REVOKE ALL ON FUNCTION public.record_class_journey_version(text, uuid, text, date, date, text, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_class_journey_version(text, uuid, text, date, date, text, text, jsonb) TO authenticated;

-- ===== V.2 Grade: referência curricular tipada (versão de matriz + item), aditiva =====
ALTER TABLE public.class_schedule_blocks
  ADD COLUMN matrix_version_id uuid REFERENCES public.curricular_matrix_versions(id),
  ADD COLUMN item_key text,
  ADD CONSTRAINT class_schedule_blocks_item_pair_check CHECK ((matrix_version_id IS NULL) = (item_key IS NULL));
ALTER TABLE public.class_schedule_blocks DROP CONSTRAINT class_schedule_blocks_check2;
ALTER TABLE public.class_schedule_blocks ADD CONSTRAINT class_schedule_blocks_reference_check
  CHECK (component_id IS NOT NULL OR nature_value_id IS NOT NULL OR matrix_version_id IS NOT NULL);
COMMENT ON TABLE public.class_schedule_block_engagements IS
  'DEPRECATED (V.2): responsáveis pelo bloco derivam só de teaching_assignments/teaching_substitutions; nenhum writer grava aqui.';

-- Pontos da janela em que a jornada muda (para provar encaixe em toda a janela).
CREATE OR REPLACE FUNCTION public.record_class_schedule_version(_class_id text, _expected_head_id uuid, _change_kind text,
  _valid_from date, _valid_until date, _source_ref text, _reason text, _blocks jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _sid text; _head uuid; _hver integer; _vid uuid; _n integer; b jsonb; _mv uuid; _ik text;
  _comp text; _pt date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  _school := public.class_time_writable_target(_class_id, _valid_from, _valid_until, 'schedule');
  g := public.class_time_capability_grant('manter-grade-da-turma', _school, _valid_from);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'schedule:invalid-change-kind'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'schedule:reason-required'; END IF;
  IF _blocks IS NULL OR pg_catalog.jsonb_typeof(_blocks) <> 'array' OR pg_catalog.jsonb_array_length(_blocks) = 0 THEN
    RAISE EXCEPTION 'schedule:blocks-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:' || _class_id, 0));
  SELECT s.id INTO _sid FROM public.class_schedules s WHERE s.class_id = _class_id;
  IF _sid IS NOT NULL THEN
    SELECT v.id, v.version INTO _head, _hver FROM public.class_schedule_versions v WHERE v.schedule_id = _sid ORDER BY v.version DESC LIMIT 1;
  END IF;
  IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'schedule:stale-head'; END IF;
  IF (_head IS NULL) <> (_change_kind = 'constituicao') THEN RAISE EXCEPTION 'schedule:invalid-change-kind'; END IF;
  IF _sid IS NULL THEN
    _sid := 'csch-' || gen_random_uuid()::text;
    INSERT INTO public.class_schedules(id, class_id) VALUES (_sid, _class_id);
  END IF;
  INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until,
      originating_act_ref, change_reason, recorded_by, recorded_by_person_id)
    VALUES (_sid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until,
      coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'decisao-interna-sem-documento-fonte'),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id())
    RETURNING id INTO _vid;
  _n := 0;
  FOR b IN SELECT * FROM pg_catalog.jsonb_array_elements(_blocks) LOOP
    IF b ? 'engagement_ids' THEN RAISE EXCEPTION 'schedule:responsibles-come-from-teaching-assignments'; END IF;
    _mv := nullif(b->>'matrix_version_id','')::uuid; _ik := nullif(b->>'item_key','');
    IF (_mv IS NULL) <> (_ik IS NULL) THEN RAISE EXCEPTION 'schedule:curricular-reference-incomplete'; END IF;
    _comp := NULL;
    IF _mv IS NOT NULL THEN
      SELECT i.component_id INTO _comp FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _mv AND i.item_key = _ik;
      IF NOT FOUND THEN RAISE EXCEPTION 'schedule:element-not-in-matrix'; END IF;
      FOR _pt IN SELECT _valid_from UNION SELECT _valid_until WHERE _valid_until IS NOT NULL LOOP
        IF NOT EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_school, _class_id, _pt, now()) m
                       WHERE m.result_kind IN ('matrix','specific-link') AND m.matrix_version_id = _mv)
        THEN RAISE EXCEPTION 'schedule:matrix-not-applicable'; END IF;
      END LOOP;
      IF b ? 'component_id' AND (b->>'component_id') IS DISTINCT FROM _comp THEN RAISE EXCEPTION 'schedule:component-contradicts-item'; END IF;
    ELSIF b ? 'component_id' THEN
      RAISE EXCEPTION 'schedule:component-without-matrix-item';
    ELSIF NOT (b ? 'nature_value_id') THEN
      RAISE EXCEPTION 'schedule:curricular-reference-required';
    END IF;
    IF b ? 'nature_value_id' AND NOT public.attribute_value_homologated(b->>'nature_scheme_id', b->>'nature_value_id',
         (b->>'nature_value_version')::integer, _valid_from) THEN RAISE EXCEPTION 'schedule:nature-not-homologated'; END IF;
    INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id,
        nature_scheme_id, nature_value_id, nature_value_version, matrix_version_id, item_key)
      VALUES (_vid, b->>'block_key', (b->>'weekday')::smallint, (b->>'starts_at')::time, (b->>'ends_at')::time,
        _comp, b->>'nature_scheme_id', b->>'nature_value_id', (b->>'nature_value_version')::integer, _mv, _ik);
    _n := _n + 1;
  END LOOP;
  -- Sobreposição sem norma de paralelismo: recusada (nenhuma nova inconsistência nasce).
  IF EXISTS (SELECT 1 FROM public.class_schedule_blocks x JOIN public.class_schedule_blocks y
             ON x.version_id = _vid AND y.version_id = _vid AND x.id < y.id AND x.weekday = y.weekday
            AND x.starts_at < y.ends_at AND y.starts_at < x.ends_at) THEN RAISE EXCEPTION 'schedule:block-overlap'; END IF;
  -- Encaixe na jornada em cada ponto relevante da janela (início, fim e início de cada versão de jornada).
  FOR _pt IN
    SELECT _valid_from UNION SELECT _valid_until WHERE _valid_until IS NOT NULL
    UNION SELECT jv.valid_from FROM public.class_journey_versions jv JOIN public.class_journeys j ON j.id = jv.journey_id
      WHERE j.class_id = _class_id AND jv.valid_from > _valid_from AND (_valid_until IS NULL OR jv.valid_from <= _valid_until)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_journey_at(_class_id, _pt, now()) j WHERE j.result_kind = 'interval') THEN
      RAISE EXCEPTION 'schedule:journey-absent'; END IF;
    IF EXISTS (SELECT 1 FROM public.class_schedule_blocks x WHERE x.version_id = _vid AND NOT EXISTS (
        SELECT 1 FROM public.class_journey_at(_class_id, _pt, now()) j
        WHERE j.result_kind = 'interval' AND j.weekday = x.weekday AND j.starts_at <= x.starts_at AND x.ends_at <= j.ends_at))
    THEN RAISE EXCEPTION 'schedule:block-outside-journey'; END IF;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('schedule_id', _sid, 'version_id', _vid, 'version', coalesce(_hver,0)+1,
    'blocks', _n, 'engagement_id', g);
END $fn$;
REVOKE ALL ON FUNCTION public.record_class_schedule_version(text, uuid, text, date, date, text, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_class_schedule_version(text, uuid, text, date, date, text, text, jsonb) TO authenticated;

-- ===== V.4 Substituição temporária (relação dedicada sobre a atribuição canônica) =====
CREATE TABLE public.teaching_substitutions (
  id text PRIMARY KEY CHECK (id ~ '^tsub-[0-9a-f-]{36}$'),
  assignment_id text NOT NULL REFERENCES public.teaching_assignments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.teaching_substitution_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substitution_id text NOT NULL REFERENCES public.teaching_substitutions(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.teaching_substitution_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  withdrawn boolean NOT NULL DEFAULT false,
  substitute_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  functional_link_logical_id uuid NOT NULL,
  posting_logical_id uuid NOT NULL,
  source_ref text,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (substitution_id, version),
  CHECK (valid_until >= valid_from),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((change_kind = 'constituicao') = (supersedes_id IS NULL)),
  CHECK (NOT withdrawn OR change_kind = 'retificacao')
);
GRANT SELECT ON public.teaching_substitutions, public.teaching_substitution_versions TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teaching_substitutions, public.teaching_substitution_versions
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.teaching_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_substitution_versions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER teaching_substitutions_immutable BEFORE UPDATE OR DELETE ON public.teaching_substitutions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER teaching_substitution_versions_immutable BEFORE UPDATE OR DELETE ON public.teaching_substitution_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE FUNCTION public.guard_teaching_substitution_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _p public.teaching_substitution_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 OR EXISTS (SELECT 1 FROM public.teaching_substitution_versions v WHERE v.substitution_id = NEW.substitution_id) THEN
      RAISE EXCEPTION 'substitution:invalid-chain'; END IF;
  ELSE
    SELECT * INTO _p FROM public.teaching_substitution_versions WHERE id = NEW.supersedes_id;
    IF _p.id IS NULL OR _p.substitution_id <> NEW.substitution_id OR NEW.version <> _p.version + 1 THEN
      RAISE EXCEPTION 'substitution:invalid-chain'; END IF;
    IF NEW.change_kind = 'sucessao' AND NEW.valid_from <= _p.valid_from THEN RAISE EXCEPTION 'substitution:succession-must-start-later'; END IF;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_teaching_substitution_version() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER teaching_substitution_version_guard BEFORE INSERT ON public.teaching_substitution_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_teaching_substitution_version();

-- Pessoa é docente da turma (titular ou substituta, qualquer versão) — base da leitura pelo professor.
CREATE FUNCTION public.teaches_class(_class_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT public.current_person_id() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.teaching_assignment_versions v JOIN public.teaching_assignments a ON a.id = v.assignment_id
            JOIN public.institutional_engagements e ON e.id = v.engagement_id
            WHERE a.class_id = _class_id AND e.person_id = public.current_person_id())
    OR EXISTS (SELECT 1 FROM public.teaching_substitution_versions sv JOIN public.teaching_substitutions s ON s.id = sv.substitution_id
            JOIN public.teaching_assignments a ON a.id = s.assignment_id
            JOIN public.institutional_engagements e ON e.id = sv.substitute_engagement_id
            WHERE a.class_id = _class_id AND e.person_id = public.current_person_id()))
$fn$;
REVOKE ALL ON FUNCTION public.teaches_class(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.teaches_class(text) TO authenticated;

CREATE FUNCTION public.can_read_offer_organization(_class_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class_id AND (
    public.can_read_institutional_class(c.id, c.school_id)
    OR public.has_school_capability('consultar-organizacao-da-oferta', c.school_id)
    OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id)
    OR public.teaches_class(c.id)))
$fn$;
REVOKE ALL ON FUNCTION public.can_read_offer_organization(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_offer_organization(text) TO authenticated;

CREATE POLICY "teacher reads own assignments" ON public.teaching_assignments FOR SELECT TO authenticated
  USING (public.teaches_class(class_id) OR public.can_read_offer_organization(class_id));
CREATE POLICY "read substitutions of readable class" ON public.teaching_substitutions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.id = assignment_id AND public.can_read_offer_organization(a.class_id)));
CREATE POLICY "read substitution versions of readable class" ON public.teaching_substitution_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teaching_substitutions s JOIN public.teaching_assignments a ON a.id = s.assignment_id
                 WHERE s.id = substitution_id AND public.can_read_offer_organization(a.class_id)));

CREATE FUNCTION public.teaching_substitution_effective_versions(_known_at timestamptz)
RETURNS TABLE(version_id uuid, substitution_id text, effective_from date, effective_until date)
LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT v.id, v.substitution_id, v.valid_from,
    CASE WHEN s.change_kind = 'sucessao' THEN least(v.valid_until, s.valid_from - 1) ELSE v.valid_until END
  FROM public.teaching_substitution_versions v
  LEFT JOIN public.teaching_substitution_versions s ON s.supersedes_id = v.id AND s.created_at <= _known_at
  WHERE v.created_at <= _known_at AND NOT v.withdrawn AND (s.id IS NULL OR s.change_kind = 'sucessao')
$fn$;
REVOKE ALL ON FUNCTION public.teaching_substitution_effective_versions(timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.teaching_substitution_effective_versions(timestamptz) TO authenticated;

-- ===== V.3 Cadeia Pessoa → vínculo → lotação → atuação, comum a titular e substituto =====
CREATE FUNCTION public.teaching_staff_fit(_domain text, _engagement_id uuid, _school text, _functional_link uuid,
  _from date, _until date) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _e record; _l record; _post uuid;
BEGIN
  SELECT * INTO _e FROM public.institutional_engagements e WHERE e.id = _engagement_id;
  IF _e.id IS NULL OR _e.school_id IS DISTINCT FROM _school THEN RAISE EXCEPTION '%:engagement-outside-school', _domain; END IF;
  IF _e.valid_from > _from OR (_e.valid_until IS NOT NULL AND (_until IS NULL OR _e.valid_until < _until))
     OR EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = _e.id AND (_until IS NULL OR x.ended_on < _until))
  THEN RAISE EXCEPTION '%:engagement-not-valid-throughout', _domain; END IF;
  IF _functional_link IS NULL THEN RAISE EXCEPTION '%:functional-link-required', _domain; END IF;
  SELECT * INTO _l FROM public.professional_functional_links l WHERE l.logical_id = _functional_link ORDER BY l.version DESC LIMIT 1;
  IF _l.id IS NULL OR _l.person_id IS DISTINCT FROM _e.person_id THEN RAISE EXCEPTION '%:functional-link-not-of-person', _domain; END IF;
  IF _l.valid_from > _from OR (_l.valid_until IS NOT NULL AND (_until IS NULL OR _l.valid_until < _until)) THEN
    RAISE EXCEPTION '%:functional-link-not-valid-throughout', _domain; END IF;
  SELECT p.logical_id INTO _post FROM (
      SELECT DISTINCT ON (pp.logical_id) pp.* FROM public.professional_postings pp
      WHERE pp.functional_link_logical_id = _functional_link ORDER BY pp.logical_id, pp.version DESC) p
   WHERE p.school_id = _school AND p.valid_from <= _from AND (p.valid_until IS NULL OR (_until IS NOT NULL AND p.valid_until >= _until))
   ORDER BY p.valid_from DESC LIMIT 1;
  IF _post IS NULL THEN RAISE EXCEPTION '%:no-school-posting-throughout', _domain; END IF;
  RETURN _post;
END $fn$;
REVOKE ALL ON FUNCTION public.teaching_staff_fit(text, uuid, text, uuid, date, date) FROM PUBLIC, anon, authenticated, service_role;

-- Writer antigo (0063/0064) aposentado: não sabia vínculo/lotação nem estado anual.
CREATE OR REPLACE FUNCTION public.record_teaching_assignment_version(_class_id text, _assignment_id text, _expected_head_id uuid,
  _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _matrix_version_id uuid, _item_key text,
  _role_scheme_id text, _role_value_id text, _role_value_version integer, _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN RAISE EXCEPTION 'assignment:superseded-writer'; END $fn$;
REVOKE ALL ON FUNCTION public.record_teaching_assignment_version(text, text, uuid, text, date, date, uuid, uuid, text, text, text, integer, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.teaching_assignment_grant(text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.teaching_assignment_grant(text) IS 'DEPRECATED (V.0): usava CURRENT_DATE; substituído por class_time_capability_grant.';

CREATE FUNCTION public.record_teaching_assignment_version_v2(_class_id text, _assignment_id text, _expected_head_id uuid,
  _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _functional_link_logical_id uuid,
  _matrix_version_id uuid, _item_key text, _role_scheme_id text, _role_value_id text, _role_value_version integer,
  _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _aid text; _head uuid; _hver integer; _vid uuid; _mid text; _pt date; _post uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  _school := public.class_time_writable_target(_class_id, _valid_from, _valid_until, 'assignment');
  g := public.class_time_capability_grant('manter-atribuicao-docente', _school, _valid_from);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'assignment:reason-required'; END IF;
  IF _engagement_id IS NULL OR _matrix_version_id IS NULL OR coalesce(_item_key,'') = '' THEN RAISE EXCEPTION 'assignment:target-required'; END IF;
  IF _role_value_id IS NOT NULL AND NOT public.attribute_value_homologated(_role_scheme_id, _role_value_id, _role_value_version, _valid_from) THEN
    RAISE EXCEPTION 'assignment:role-not-homologated'; END IF;
  _post := public.teaching_staff_fit('assignment', _engagement_id, _school, _functional_link_logical_id, _valid_from, _valid_until);
  SELECT v.matrix_id INTO _mid FROM public.curricular_matrix_versions v WHERE v.id = _matrix_version_id;
  IF _mid IS NULL OR NOT EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _matrix_version_id AND i.item_key = _item_key)
  THEN RAISE EXCEPTION 'assignment:element-not-in-matrix'; END IF;
  FOR _pt IN SELECT _valid_from UNION SELECT _valid_until WHERE _valid_until IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_school, _class_id, _pt, now()) m
                   WHERE m.result_kind IN ('matrix','specific-link') AND m.matrix_version_id = _matrix_version_id)
    THEN RAISE EXCEPTION 'assignment:matrix-not-applicable'; END IF;
  END LOOP;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assignment:' || _class_id, 0));
  IF _assignment_id IS NULL THEN
    IF _change_kind <> 'constituicao' OR _expected_head_id IS NOT NULL THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.id = _assignment_id AND a.class_id = _class_id)
    THEN RAISE EXCEPTION 'assignment:not-found'; END IF;
    SELECT v.id, v.version INTO _head, _hver FROM public.teaching_assignment_versions v WHERE v.assignment_id = _assignment_id ORDER BY v.version DESC LIMIT 1;
    IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'assignment:stale-head'; END IF;
    IF _change_kind = 'constituicao' THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  END IF;
  -- Mesma atuação no mesmo elemento em outra atribuição sobreposta = duplicidade (co-responsabilidade = atuações distintas).
  IF EXISTS (SELECT 1 FROM public.teaching_assignment_effective_versions(now()) w
             JOIN public.teaching_assignment_versions v ON v.id = w.version_id
             JOIN public.teaching_assignments a ON a.id = v.assignment_id AND a.class_id = _class_id
             WHERE v.assignment_id IS DISTINCT FROM _assignment_id AND v.engagement_id = _engagement_id
               AND v.matrix_version_id = _matrix_version_id AND v.item_key = _item_key
               AND w.effective_from <= coalesce(_valid_until, 'infinity'::date)
               AND coalesce(w.effective_until, 'infinity'::date) >= _valid_from)
  THEN RAISE EXCEPTION 'assignment:overlap'; END IF;
  IF _assignment_id IS NULL THEN
    _aid := 'ta-' || gen_random_uuid()::text;
    INSERT INTO public.teaching_assignments(id, class_id) VALUES (_aid, _class_id);
  ELSE _aid := _assignment_id; END IF;
  INSERT INTO public.teaching_assignment_versions(assignment_id, version, supersedes_id, change_kind, valid_from, valid_until,
      engagement_id, matrix_id, matrix_version_id, item_key, role_scheme_id, role_value_id, role_value_version,
      source_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id,
      functional_link_logical_id, posting_logical_id)
    VALUES (_aid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until, _engagement_id, _mid, _matrix_version_id,
      _item_key, _role_scheme_id, _role_value_id, _role_value_version, nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g,
      _functional_link_logical_id, _post)
    RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('assignment_id', _aid, 'version_id', _vid, 'version', coalesce(_hver,0)+1);
END $fn$;
REVOKE ALL ON FUNCTION public.record_teaching_assignment_version_v2(text, text, uuid, text, date, date, uuid, uuid, uuid, text, text, text, integer, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_teaching_assignment_version_v2(text, text, uuid, text, date, date, uuid, uuid, uuid, text, text, text, integer, text, text)
  TO authenticated;

CREATE FUNCTION public.record_teaching_substitution_version(_assignment_id text, _substitution_id text, _expected_head_id uuid,
  _change_kind text, _valid_from date, _valid_until date, _substitute_engagement_id uuid, _functional_link_logical_id uuid,
  _withdrawn boolean, _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _class text; _school text; g uuid; _sid text; _head uuid; _hver integer; _vid uuid; _post uuid; _tit uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT a.class_id INTO _class FROM public.teaching_assignments a WHERE a.id = _assignment_id;
  IF _class IS NULL THEN RAISE EXCEPTION 'substitution:assignment-not-found'; END IF;
  IF _valid_until IS NULL THEN RAISE EXCEPTION 'substitution:end-required'; END IF;
  _school := public.class_time_writable_target(_class, _valid_from, _valid_until, 'substitution');
  g := public.class_time_capability_grant('manter-atribuicao-docente', _school, _valid_from);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'substitution:invalid-change-kind'; END IF;
  IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'substitution:reason-required'; END IF;
  IF coalesce(_withdrawn,false) AND _change_kind <> 'retificacao' THEN RAISE EXCEPTION 'substitution:withdraw-only-by-rectification'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assignment:' || _class, 0));
  -- Titular vigente em toda a janela (não é encerrado nem alterado).
  SELECT v.engagement_id INTO _tit FROM public.teaching_assignment_effective_versions(now()) w
    JOIN public.teaching_assignment_versions v ON v.id = w.version_id
   WHERE w.assignment_id = _assignment_id AND w.effective_from <= _valid_from AND (w.effective_until IS NULL OR w.effective_until >= _valid_until);
  IF _tit IS NULL THEN RAISE EXCEPTION 'substitution:outside-titular-window'; END IF;
  IF _tit = _substitute_engagement_id THEN RAISE EXCEPTION 'substitution:substitute-is-titular'; END IF;
  _post := public.teaching_staff_fit('substitution', _substitute_engagement_id, _school, _functional_link_logical_id, _valid_from, _valid_until);
  IF _substitution_id IS NULL THEN
    IF _change_kind <> 'constituicao' OR _expected_head_id IS NOT NULL THEN RAISE EXCEPTION 'substitution:invalid-change-kind'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.teaching_substitutions s WHERE s.id = _substitution_id AND s.assignment_id = _assignment_id)
    THEN RAISE EXCEPTION 'substitution:not-found'; END IF;
    SELECT v.id, v.version INTO _head, _hver FROM public.teaching_substitution_versions v WHERE v.substitution_id = _substitution_id ORDER BY v.version DESC LIMIT 1;
    IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'substitution:stale-head'; END IF;
    IF _change_kind = 'constituicao' THEN RAISE EXCEPTION 'substitution:invalid-change-kind'; END IF;
  END IF;
  IF NOT coalesce(_withdrawn,false) AND EXISTS (
      SELECT 1 FROM public.teaching_substitution_effective_versions(now()) w
      JOIN public.teaching_substitutions s ON s.id = w.substitution_id
      WHERE s.assignment_id = _assignment_id AND s.id IS DISTINCT FROM _substitution_id
        AND w.effective_from <= _valid_until AND w.effective_until >= _valid_from)
  THEN RAISE EXCEPTION 'substitution:overlap'; END IF;
  IF _substitution_id IS NULL THEN
    _sid := 'tsub-' || gen_random_uuid()::text;
    INSERT INTO public.teaching_substitutions(id, assignment_id) VALUES (_sid, _assignment_id);
  ELSE _sid := _substitution_id; END IF;
  INSERT INTO public.teaching_substitution_versions(substitution_id, version, supersedes_id, change_kind, valid_from, valid_until,
      withdrawn, substitute_engagement_id, functional_link_logical_id, posting_logical_id, source_ref, reason,
      recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_sid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until, coalesce(_withdrawn,false),
      _substitute_engagement_id, _functional_link_logical_id, _post, nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''),
      pg_catalog.btrim(_reason), auth.uid(), public.current_person_id(), g)
    RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('substitution_id', _sid, 'version_id', _vid, 'version', coalesce(_hver,0)+1);
END $fn$;
REVOKE ALL ON FUNCTION public.record_teaching_substitution_version(text, text, uuid, text, date, date, uuid, uuid, boolean, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_teaching_substitution_version(text, text, uuid, text, date, date, uuid, uuid, boolean, text, text)
  TO authenticated;

CREATE FUNCTION public.teaching_substitutions_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(substitution_id text, assignment_id text, version_id uuid, version integer, effective_from date, effective_until date,
  substitute_engagement_id uuid, substitute_person_id uuid, titular_engagement_id uuid, functional_link_logical_id uuid,
  reason text, source_ref text, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT s.id, s.assignment_id, v.id, v.version, w.effective_from, w.effective_until, v.substitute_engagement_id, e.person_id,
    (SELECT tv.engagement_id FROM public.teaching_assignment_effective_versions(_known_at) tw
       JOIN public.teaching_assignment_versions tv ON tv.id = tw.version_id
      WHERE tw.assignment_id = s.assignment_id AND tw.effective_from <= _on AND (tw.effective_until IS NULL OR tw.effective_until >= _on) LIMIT 1),
    v.functional_link_logical_id, v.reason, v.source_ref, v.created_at
  FROM public.teaching_substitution_effective_versions(_known_at) w
  JOIN public.teaching_substitution_versions v ON v.id = w.version_id
  JOIN public.teaching_substitutions s ON s.id = v.substitution_id
  JOIN public.teaching_assignments a ON a.id = s.assignment_id AND a.class_id = _class_id
  LEFT JOIN public.institutional_engagements e ON e.id = v.substitute_engagement_id
  WHERE w.effective_from <= _on AND w.effective_until >= _on
  ORDER BY s.assignment_id, w.effective_from
$fn$;
REVOKE ALL ON FUNCTION public.teaching_substitutions_at(text, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.teaching_substitutions_at(text, date, timestamptz) TO authenticated;

-- ===== Fonte única de regência para blocos: atribuições + substituições (nunca block_engagements) =====
CREATE FUNCTION public.class_block_teaching_engagements(_class_id text, _matrix_version_id uuid, _item_key text, _on date, _known_at timestamptz)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT CASE WHEN NOT public.can_read_offer_organization(_class_id) THEN NULL
              WHEN _matrix_version_id IS NULL THEN '{}'::uuid[] ELSE ARRAY(
    SELECT DISTINCT x FROM (
      SELECT v.engagement_id AS x FROM public.teaching_assignment_effective_versions(_known_at) w
        JOIN public.teaching_assignment_versions v ON v.id = w.version_id
        JOIN public.teaching_assignments a ON a.id = v.assignment_id AND a.class_id = _class_id
       WHERE v.matrix_version_id = _matrix_version_id AND v.item_key = _item_key
         AND w.effective_from <= _on AND (w.effective_until IS NULL OR w.effective_until >= _on)
      UNION
      SELECT sv.substitute_engagement_id FROM public.teaching_substitution_effective_versions(_known_at) sw
        JOIN public.teaching_substitution_versions sv ON sv.id = sw.version_id
        JOIN public.teaching_substitutions s ON s.id = sv.substitution_id
        JOIN public.teaching_assignment_versions tv ON tv.assignment_id = s.assignment_id
        JOIN public.teaching_assignments a ON a.id = s.assignment_id AND a.class_id = _class_id
       WHERE tv.matrix_version_id = _matrix_version_id AND tv.item_key = _item_key
         AND sw.effective_from <= _on AND sw.effective_until >= _on) q ORDER BY x) END
$fn$;
REVOKE ALL ON FUNCTION public.class_block_teaching_engagements(text, uuid, text, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.class_block_teaching_engagements(text, uuid, text, date, timestamptz) TO authenticated;

-- class_journey_at: mesmo corpo, fronteira de leitura amplia-se só a quem lê a organização da oferta.
CREATE OR REPLACE FUNCTION public.class_journey_at(_class_id text, _on date, _known_at timestamp with time zone)
 RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamp with time zone, journey_id text, version_id uuid, version integer, change_kind text, valid_from date, effective_until date, originating_act_ref text, change_reason text, recorded_at timestamp with time zone, weekday smallint, starts_at time without time zone, ends_at time without time zone, day_first_start time without time zone, day_last_end time without time zone, day_minutes integer, week_minutes integer)
 LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
DECLARE _school text; _count integer; _jid text;
BEGIN
  IF _class_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'journey:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'journey:known-at-required'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _school IS NULL OR NOT public.can_read_offer_organization(_class_id) THEN
    RETURN QUERY SELECT 'access-denied'::text, _class_id, _on, _known_at, NULL::text, NULL::uuid, NULL::integer, NULL::text, NULL::date,
      NULL::date, NULL::text, NULL::text, NULL::timestamptz, NULL::smallint, NULL::time, NULL::time, NULL::time, NULL::time, NULL::integer, NULL::integer;
    RETURN;
  END IF;
  SELECT j.id INTO _jid FROM public.class_journeys j WHERE j.class_id = _class_id AND j.created_at <= _known_at;
  IF _jid IS NOT NULL AND EXISTS (
    WITH k AS (SELECT v.* FROM public.class_journey_versions v WHERE v.journey_id = _jid AND v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1) OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR k.version <> p.version + 1))
       OR NOT EXISTS (SELECT 1 FROM public.class_journey_intervals i WHERE i.version_id = k.id)
  ) THEN RAISE EXCEPTION 'journey:invalid-chain'; END IF;
  SELECT count(*)::integer INTO _count FROM public.class_journey_effective_versions(_jid, _on, _known_at);
  IF _count > 1 THEN RAISE EXCEPTION 'journey:ambiguous-temporal-state'; END IF;
  IF _count = 1 AND NOT EXISTS (SELECT 1 FROM public.class_at(_class_id, _on, _known_at)) THEN
    RAISE EXCEPTION 'journey:outside-class-validity';
  END IF;
  IF _count = 0 THEN
    RETURN QUERY SELECT 'absent'::text, _class_id, _on, _known_at, NULL::text, NULL::uuid, NULL::integer, NULL::text, NULL::date,
      NULL::date, NULL::text, NULL::text, NULL::timestamptz, NULL::smallint, NULL::time, NULL::time, NULL::time, NULL::time, NULL::integer, NULL::integer;
    RETURN;
  END IF;
  RETURN QUERY
  WITH iv AS (SELECT i.* FROM public.class_journey_intervals i JOIN public.class_journey_effective_versions(_jid, _on, _known_at) e ON e.id = i.version_id),
  d AS (SELECT iv.weekday wd, min(iv.starts_at) fs, max(iv.ends_at) le,
          sum((extract(epoch FROM iv.ends_at - iv.starts_at) / 60)::integer)::integer mins FROM iv GROUP BY iv.weekday)
  SELECT 'interval'::text, _class_id, _on, _known_at, _jid, e.id, e.version, e.change_kind, e.valid_from, e.eu, e.act, e.reason, e.created,
    iv.weekday, iv.starts_at, iv.ends_at, d.fs, d.le, d.mins, (SELECT sum(d2.mins)::integer FROM d d2)
  FROM iv JOIN public.class_journey_effective_versions(_jid, _on, _known_at) e ON e.id = iv.version_id JOIN d ON d.wd = iv.weekday
  ORDER BY iv.weekday, iv.starts_at;
END $function$;

-- class_schedule_at: responsáveis derivados da atribuição canônica; referência por item de matriz validada.
CREATE OR REPLACE FUNCTION public.class_schedule_at(_class_id text, _on date, _known_at timestamp with time zone)
 RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamp with time zone, schedule_state text, schedule_id text, version_id uuid, version integer, change_kind text, valid_from date, effective_until date, originating_act_ref text, change_reason text, recorded_at timestamp with time zone, block_id uuid, block_key text, weekday smallint, starts_at time without time zone, ends_at time without time zone, block_minutes integer, component_id text, component_version integer, component_name text, nature_scheme_id text, nature_value_id text, nature_value_version integer, nature_label text, engagement_ids uuid[], block_state text, block_issues text[], overlapping_block_keys text[], coverage_state text, coverage_matrix_ids text[], day_minutes integer, week_minutes integer)
 LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
#variable_conflict use_column
DECLARE _school text; _count integer; _sid text; _jabsent boolean; _covm text[] := '{}'; _covc text[] := '{}'; _covfail boolean := false;
  _rv uuid[] := '{}'; _rm text[] := '{}';
BEGIN
  IF _class_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'schedule:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'schedule:known-at-required'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _school IS NULL OR NOT public.can_read_offer_organization(_class_id) THEN
    result_kind := 'access-denied'; class_id := _class_id; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;
  SELECT s.id INTO _sid FROM public.class_schedules s WHERE s.class_id = _class_id AND s.created_at <= _known_at;
  IF _sid IS NOT NULL AND EXISTS (
    WITH k AS (SELECT v.* FROM public.class_schedule_versions v WHERE v.schedule_id = _sid AND v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1) OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR k.version <> p.version + 1))
       OR NOT EXISTS (SELECT 1 FROM public.class_schedule_blocks b WHERE b.version_id = k.id)
  ) THEN RAISE EXCEPTION 'schedule:invalid-chain'; END IF;
  SELECT count(*)::integer INTO _count FROM public.class_schedule_effective_versions(_sid, _on, _known_at);
  IF _count > 1 THEN RAISE EXCEPTION 'schedule:ambiguous-temporal-state'; END IF;
  IF _count = 1 AND NOT EXISTS (SELECT 1 FROM public.class_at(_class_id, _on, _known_at)) THEN
    RAISE EXCEPTION 'schedule:outside-class-validity';
  END IF;
  IF _count = 0 THEN
    result_kind := 'absent'; class_id := _class_id; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;
  _jabsent := NOT EXISTS (SELECT 1 FROM public.class_journey_at(_class_id, _on, _known_at) j WHERE j.result_kind = 'interval');
  BEGIN
    SELECT coalesce(array_agg(x.mid), '{}'), coalesce(array_agg(x.cid), '{}') INTO _covm, _covc FROM (
      SELECT DISTINCT m.matrix_id AS mid, it.component_id AS cid
      FROM public.class_curricular_matrices_at(_school, _class_id, _on, _known_at) m
      CROSS JOIN LATERAL public.curricular_matrix_items_at(m.matrix_id, _on, _known_at) it
      WHERE m.matrix_version_id IS NOT NULL AND it.version_id = m.matrix_version_id AND it.component_id IS NOT NULL
        AND ((m.result_kind = 'matrix' AND m.state = 'resolvida-por-posicao')
          OR (m.result_kind = 'specific-link' AND m.state = 'vinculo-especifico-vigente'))) x;
    SELECT coalesce(array_agg(y.v), '{}'), coalesce(array_agg(y.m), '{}') INTO _rv, _rm FROM (
      SELECT DISTINCT m.matrix_version_id AS v, m.matrix_id AS m
      FROM public.class_curricular_matrices_at(_school, _class_id, _on, _known_at) m
      WHERE m.matrix_version_id IS NOT NULL
        AND ((m.result_kind = 'matrix' AND m.state = 'resolvida-por-posicao')
          OR (m.result_kind = 'specific-link' AND m.state = 'vinculo-especifico-vigente'))) y;
  EXCEPTION WHEN OTHERS THEN _covfail := true; _covm := '{}'; _covc := '{}'; _rv := '{}'; _rm := '{}';
  END;

  RETURN QUERY
  WITH ev AS (SELECT * FROM public.class_schedule_effective_versions(_sid, _on, _known_at)),
  jv AS (SELECT j.weekday AS wd, j.starts_at AS js, j.ends_at AS je FROM public.class_journey_at(_class_id, _on, _known_at) j WHERE j.result_kind = 'interval'),
  cov AS (SELECT x.mid, x.cid FROM unnest(_covm, _covc) AS x(mid, cid)),
  rvm AS (SELECT r.v, r.m FROM unnest(_rv, _rm) AS r(v, m)),
  b AS (SELECT bl.* FROM public.class_schedule_blocks bl JOIN ev ON ev.id = bl.version_id),
  bx AS (
    SELECT b.*, cv.cver, cv.cname, cv.cact, ad.nlabel,
      public.class_block_teaching_engagements(_class_id, b.matrix_version_id, b.item_key, _on, _known_at) AS engs,
      EXISTS (SELECT 1 FROM jv WHERE jv.wd = b.weekday AND jv.js <= b.starts_at AND b.ends_at <= jv.je) AS fits,
      (SELECT array_agg(o.block_key ORDER BY o.block_key) FROM b o WHERE o.id <> b.id AND o.weekday = b.weekday
         AND o.starts_at < b.ends_at AND b.starts_at < o.ends_at) AS ovl,
      CASE WHEN b.matrix_version_id IS NOT NULL
           THEN (SELECT array_agg(DISTINCT rvm.m ORDER BY rvm.m) FROM rvm WHERE rvm.v = b.matrix_version_id)
           ELSE (SELECT array_agg(DISTINCT cov.mid ORDER BY cov.mid) FROM cov WHERE cov.cid = b.component_id) END AS covmx
    FROM b
    LEFT JOIN LATERAL (SELECT v.version AS cver, v.official_name AS cname, v.is_active AS cact FROM public.curricular_component_versions v
      WHERE v.component_id = b.component_id AND v.valid_from <= _on AND v.created_at <= _known_at ORDER BY v.version DESC LIMIT 1) cv ON true
    LEFT JOIN LATERAL (SELECT d.label AS nlabel FROM public.attribute_value_definitions d
      WHERE d.scheme_id = b.nature_scheme_id AND d.value_id = b.nature_value_id AND d.version = b.nature_value_version
        AND d.status = 'homologada' AND (d.valid_from IS NULL OR d.valid_from <= _on) AND d.created_at <= _known_at LIMIT 1) ad ON true
  ),
  bi AS (
    SELECT bx.*, (extract(epoch FROM bx.ends_at - bx.starts_at) / 60)::integer AS mins,
      array_remove(ARRAY[
        CASE WHEN _jabsent THEN 'bloqueada:jornada-ausente' END,
        CASE WHEN bx.component_id IS NOT NULL AND bx.cact IS NOT TRUE THEN 'bloqueada:componente-inexistente-ou-inativo' END,
        CASE WHEN bx.nature_value_id IS NOT NULL AND bx.nlabel IS NULL THEN 'bloqueada:tipo-nao-homologado' END,
        CASE WHEN bx.matrix_version_id IS NOT NULL AND bx.covmx IS NULL AND NOT _covfail THEN 'bloqueada:referencia-curricular-nao-aplicavel' END,
        CASE WHEN NOT _jabsent AND NOT bx.fits THEN 'bloqueada:bloco-fora-da-jornada' END,
        CASE WHEN bx.ovl IS NOT NULL THEN 'inconsistente:sobreposicao-de-blocos' END
      ]::text[], NULL) AS issues
    FROM bx
  ),
  bj AS (SELECT bi.*, EXISTS (SELECT 1 FROM unnest(bi.issues) z WHERE z LIKE 'bloqueada:%') AS blk FROM bi)
  SELECT 'block'::text, _class_id, _on, _known_at,
    CASE WHEN _jabsent THEN 'bloqueada:jornada-ausente'
         WHEN bool_or(bj.blk) OVER () THEN 'bloqueada:blocos-com-pendencia'
         WHEN bool_or(cardinality(bj.issues) > 0) OVER () THEN 'inconsistente:sobreposicao-de-blocos'
         ELSE 'utilizavel' END,
    _sid, ev.id, ev.version, ev.change_kind, ev.valid_from, ev.eu, ev.act, ev.reason, ev.created,
    bj.id, bj.block_key, bj.weekday, bj.starts_at, bj.ends_at, bj.mins, bj.component_id, bj.cver, bj.cname,
    bj.nature_scheme_id, bj.nature_value_id, bj.nature_value_version, bj.nlabel, coalesce(bj.engs, '{}'::uuid[]),
    coalesce(bj.issues[1], 'utilizavel'), bj.issues, coalesce(bj.ovl, '{}'::text[]),
    CASE WHEN bj.component_id IS NULL AND bj.matrix_version_id IS NULL THEN 'nao-aplicavel'
         WHEN bj.covmx IS NOT NULL THEN 'comprovada'
         WHEN _covfail THEN 'nao-comprovada:leitura-curricular-interrompida'
         ELSE 'nao-comprovada' END,
    coalesce(bj.covmx, '{}'::text[]),
    (sum(bj.mins) OVER (PARTITION BY bj.weekday))::integer, (sum(bj.mins) OVER ())::integer
  FROM bj CROSS JOIN ev
  ORDER BY bj.weekday, bj.starts_at, bj.block_key;
END $function$;

-- ===== V.6 Horário do profissional = atribuições/substituições → blocos (sem persistência) =====
CREATE OR REPLACE FUNCTION public.person_schedule_at(_person_id uuid, _on date, _known_at timestamp with time zone)
 RETURNS TABLE(result_kind text, valid_on date, known_at timestamp with time zone, class_id text, school_id text, source_state text, source_issue text, schedule_id text, version_id uuid, version integer, block_id uuid, block_key text, weekday smallint, starts_at time without time zone, ends_at time without time zone, block_minutes integer, component_id text, component_name text, nature_label text, own_engagement_ids uuid[], block_state text, operational boolean, other_block_id uuid, other_class_id text, overlap_starts_at time without time zone, overlap_ends_at time without time zone, operational_block_count integer, unavailable_block_count integer, week_minutes integer, conflict_count integer)
 LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
#variable_conflict use_column
DECLARE _me uuid;
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'person-schedule:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'person-schedule:known-at-required'; END IF;
  _me := public.current_person_id();
  IF _me IS NULL OR _person_id IS NULL OR _person_id <> _me THEN
    result_kind := 'access-denied'; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;

  RETURN QUERY
  WITH me_e AS (
    SELECT e.id, e.class_id FROM public.institutional_engagements e
    WHERE e.person_id = _me AND e.created_at <= _known_at
      AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
      AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.created_at <= _known_at AND x.ended_on < _on)),
  cls AS (
    SELECT a.class_id AS cid FROM public.teaching_assignment_versions v JOIN public.teaching_assignments a ON a.id = v.assignment_id
      JOIN me_e ON me_e.id = v.engagement_id WHERE v.created_at <= _known_at
    UNION SELECT a.class_id FROM public.teaching_substitution_versions sv JOIN public.teaching_substitutions s ON s.id = sv.substitution_id
      JOIN public.teaching_assignments a ON a.id = s.assignment_id JOIN me_e ON me_e.id = sv.substitute_engagement_id
      WHERE sv.created_at <= _known_at),
  src AS (SELECT x.* FROM cls CROSS JOIN LATERAL public.person_schedule_class_source(cls.cid, _on, _known_at) x),
  own AS (
    SELECT src.*, ARRAY(SELECT u FROM (SELECT unnest(src.engagement_ids) INTERSECT SELECT me_e.id FROM me_e) t(u) ORDER BY u) AS mine
    FROM src WHERE src.result_kind = 'block'),
  blk AS (
    SELECT own.*, (own.schedule_state = 'utilizavel' AND own.block_state = 'utilizavel') AS op,
      (SELECT c.school_id FROM public.institutional_classes c WHERE c.id = own.class_id) AS sch
    FROM own WHERE cardinality(own.mine) > 0),
  cf AS (
    SELECT a.*, b.block_id AS ob, b.class_id AS oc, GREATEST(a.starts_at, b.starts_at) AS os, LEAST(a.ends_at, b.ends_at) AS oe
    FROM blk a JOIN blk b ON a.op AND b.op AND a.weekday = b.weekday AND a.block_id < b.block_id
      AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at),
  unav AS (
    SELECT src.class_id, CASE WHEN src.result_kind = 'access-denied' THEN 'turma-nao-legivel' ELSE 'erro-de-leitura' END AS st, src.issue
    FROM src WHERE src.result_kind IN ('access-denied', 'source-error')),
  tot AS (
    SELECT (SELECT count(*) FROM blk WHERE op)::integer AS nop, (SELECT count(*) FROM blk WHERE NOT op)::integer AS nun,
      (SELECT coalesce(sum(block_minutes), 0) FROM blk WHERE op)::integer AS wm, (SELECT count(*) FROM cf)::integer AS nc,
      (SELECT count(*) FROM unav)::integer AS nu)
  SELECT * FROM (
    SELECT 'block'::text AS rk, _on AS von, _known_at AS kat, blk.class_id AS cid, blk.sch AS sid, blk.schedule_state AS sst, NULL::text AS sis,
      blk.schedule_id AS schid, blk.version_id AS vid, blk.version AS ver, blk.block_id AS bid, blk.block_key AS bkey, blk.weekday AS wd,
      blk.starts_at AS sa, blk.ends_at AS ea, blk.block_minutes AS bm, blk.component_id AS compid, blk.component_name AS compname,
      blk.nature_label AS nlabel, blk.mine AS mine, blk.block_state AS bst, blk.op AS op, NULL::uuid AS obid, NULL::text AS ocid,
      NULL::time AS os, NULL::time AS oe, NULL::integer AS nop, NULL::integer AS nun, NULL::integer AS wm, NULL::integer AS nc
    FROM blk
    UNION ALL
    SELECT 'conflict', _on, _known_at, cf.class_id, cf.sch, 'conflito-temporal-potencial', NULL, cf.schedule_id, cf.version_id, cf.version,
      cf.block_id, cf.block_key, cf.weekday, cf.starts_at, cf.ends_at, cf.block_minutes, cf.component_id, cf.component_name,
      cf.nature_label, cf.mine, cf.block_state, cf.op, cf.ob, cf.oc, cf.os, cf.oe, NULL, NULL, NULL, NULL
    FROM cf
    UNION ALL
    SELECT 'source-unavailable', _on, _known_at, unav.class_id, NULL, unav.st, unav.issue, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM unav
    UNION ALL
    SELECT CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN 'absent' ELSE 'summary' END, _on, _known_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.nop END, CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.nun END,
      CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.wm END, CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.nc END
    FROM tot
  ) z
  ORDER BY CASE z.rk WHEN 'summary' THEN 0 WHEN 'absent' THEN 0 WHEN 'source-unavailable' THEN 1 WHEN 'block' THEN 2 ELSE 3 END,
    z.wd NULLS FIRST, z.sa NULLS FIRST, z.cid NULLS FIRST, z.bid NULLS FIRST, z.obid NULLS FIRST;
END $function$;

-- Visão gerencial escolar (Direção/Secretaria na escola; Supervisão na rede via capability de consulta).
CREATE FUNCTION public.school_teaching_schedule_at(_school_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, person_id uuid, engagement_id uuid, origin text, assignment_id text, substitution_id text,
  class_id text, class_name text, block_id uuid, block_key text, weekday smallint, starts_at time, ends_at time, block_minutes integer,
  matrix_version_id uuid, item_key text, component_label text, conflict_with_block_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  IF _school_id IS NULL OR _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'school-schedule:target-required'; END IF;
  IF NOT (public.has_school_capability('consultar-organizacao-da-oferta', _school_id)
       OR public.has_school_capability('manter-atribuicao-docente', _school_id)
       OR public.has_school_capability('manter-grade-da-turma', _school_id)) THEN
    result_kind := 'access-denied'; RETURN NEXT; RETURN;
  END IF;
  RETURN QUERY
  WITH sv AS (
    SELECT c.id AS cid, c.name AS cname, ev.id AS vid
    FROM public.institutional_classes c
    JOIN public.class_schedules s ON s.class_id = c.id AND s.created_at <= _known_at
    CROSS JOIN LATERAL public.class_schedule_effective_versions(s.id, _on, _known_at) ev
    WHERE c.school_id = _school_id),
  bl AS (SELECT sv.cid, sv.cname, b.* FROM sv JOIN public.class_schedule_blocks b ON b.version_id = sv.vid WHERE b.matrix_version_id IS NOT NULL),
  tit AS (
    SELECT bl.*, v.engagement_id AS eid, 'titular'::text AS org, v.assignment_id AS aid, NULL::text AS subid
    FROM bl JOIN public.teaching_assignments a ON a.class_id = bl.cid
    JOIN public.teaching_assignment_versions v ON v.assignment_id = a.id AND v.matrix_version_id = bl.matrix_version_id AND v.item_key = bl.item_key
    JOIN public.teaching_assignment_effective_versions(_known_at) w ON w.version_id = v.id
    WHERE w.effective_from <= _on AND (w.effective_until IS NULL OR w.effective_until >= _on)),
  sub AS (
    SELECT bl.*, x.substitute_engagement_id AS eid, 'substituicao'::text AS org, s.assignment_id AS aid, s.id AS subid
    FROM bl JOIN public.teaching_assignments a ON a.class_id = bl.cid
    JOIN public.teaching_assignment_versions tv ON tv.assignment_id = a.id AND tv.matrix_version_id = bl.matrix_version_id AND tv.item_key = bl.item_key
    JOIN public.teaching_substitutions s ON s.assignment_id = a.id
    JOIN public.teaching_substitution_versions x ON x.substitution_id = s.id
    JOIN public.teaching_substitution_effective_versions(_known_at) sw ON sw.version_id = x.id
    WHERE sw.effective_from <= _on AND sw.effective_until >= _on),
  al AS (SELECT DISTINCT ON (q.id, q.eid) q.* FROM (SELECT * FROM tit UNION ALL SELECT * FROM sub) q ORDER BY q.id, q.eid, q.org),
  pe AS (SELECT al.*, e.person_id AS pid FROM al JOIN public.institutional_engagements e ON e.id = al.eid)
  SELECT 'block'::text, pe.pid, pe.eid, pe.org, pe.aid, pe.subid, pe.cid, pe.cname, pe.id, pe.block_key, pe.weekday, pe.starts_at, pe.ends_at,
    (extract(epoch FROM pe.ends_at - pe.starts_at) / 60)::integer, pe.matrix_version_id, pe.item_key,
    (SELECT i.component_label_snapshot FROM public.curricular_matrix_items i WHERE i.matrix_version_id = pe.matrix_version_id AND i.item_key = pe.item_key),
    ARRAY(SELECT o.id FROM pe o WHERE o.pid = pe.pid AND o.id <> pe.id AND o.weekday = pe.weekday
          AND o.starts_at < pe.ends_at AND pe.starts_at < o.ends_at ORDER BY o.id)
  FROM pe ORDER BY pe.pid, pe.weekday, pe.starts_at, pe.cid;
END $fn$;
REVOKE ALL ON FUNCTION public.school_teaching_schedule_at(text, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_teaching_schedule_at(text, date, timestamptz) TO authenticated;

-- ===== V.5 Carga: atribuída derivada; contratual sem fonte canônica ⇒ saldo não calculável =====
CREATE FUNCTION public.school_teaching_load_at(_school_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, person_id uuid, engagement_id uuid, class_count integer, block_count integer, assigned_block_minutes integer,
  conflict_block_count integer, contractual_load_state text, balance_state text, balance_reason text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  WITH s AS (SELECT * FROM public.school_teaching_schedule_at(_school_id, _on, _known_at))
  SELECT 'access-denied'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::text
   WHERE EXISTS (SELECT 1 FROM s WHERE s.result_kind = 'access-denied')
  UNION ALL
  SELECT 'load', s.person_id, s.engagement_id, count(DISTINCT s.class_id)::integer, count(*)::integer, sum(s.block_minutes)::integer,
    count(*) FILTER (WHERE cardinality(s.conflict_with_block_ids) > 0)::integer,
    'nao-informado', 'nao-calculavel', 'carga-contratual-sem-fonte-canonica'
  FROM s WHERE s.result_kind = 'block' GROUP BY s.person_id, s.engagement_id
$fn$;
REVOKE ALL ON FUNCTION public.school_teaching_load_at(text, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_teaching_load_at(text, date, timestamptz) TO authenticated;

-- ===== V.7 Prontidão para o Diário (somente leitura, explicável) =====
CREATE FUNCTION public.class_diary_readiness_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(scope text, subject_ref text, code text, state text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE _school text; _year text; _ystate text; _n integer; _sst text; _blocked boolean := false; _unav boolean := false; r record;
BEGIN
  IF _class_id IS NULL OR _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'readiness:target-required'; END IF;
  SELECT c.school_id, c.academic_year_id INTO _school, _year FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _school IS NULL OR NOT public.can_read_offer_organization(_class_id) THEN
    scope := 'turma'; subject_ref := _class_id; code := 'acesso-negado'; state := 'unavailable'; RETURN NEXT; RETURN;
  END IF;
  SELECT s.state INTO _ystate FROM public.academic_year_operational_state_at(_year) s;
  scope := 'turma'; subject_ref := _class_id;
  IF _ystate IS NULL THEN code := 'ano-sem-estado'; state := 'blocked'; _blocked := true; RETURN NEXT;
  ELSIF _ystate = 'em-preparacao' THEN code := 'ano-em-preparacao:organizacao-permitida-diario-nao'; state := 'blocked'; _blocked := true; RETURN NEXT;
  ELSIF _ystate <> 'operacional' THEN code := 'ano-nao-operacional:' || _ystate; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_at(_class_id, _on, _known_at)) THEN code := 'turma-nao-vigente'; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.class_period_organization_at(_class_id, _on, _known_at)) THEN
      code := 'organizacao-de-periodos-ausente'; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
  EXCEPTION WHEN OTHERS THEN code := 'fonte-indisponivel:periodos'; state := 'unavailable'; _unav := true; RETURN NEXT; END;
  BEGIN
    SELECT count(*) INTO _n FROM public.class_curricular_matrices_at(_school, _class_id, _on, _known_at) m
     WHERE m.matrix_version_id IS NOT NULL AND ((m.result_kind = 'matrix' AND m.state = 'resolvida-por-posicao')
        OR (m.result_kind = 'specific-link' AND m.state = 'vinculo-especifico-vigente'));
    IF _n = 0 THEN code := 'matriz-nao-resolvida'; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
  EXCEPTION WHEN OTHERS THEN code := 'fonte-indisponivel:matriz'; state := 'unavailable'; _unav := true; RETURN NEXT; END;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.class_journey_at(_class_id, _on, _known_at) j WHERE j.result_kind = 'interval') THEN
      code := 'jornada-ausente'; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
  EXCEPTION WHEN OTHERS THEN code := 'fonte-indisponivel:jornada'; state := 'unavailable'; _unav := true; RETURN NEXT; END;
  BEGIN
    SELECT min(s.schedule_state) INTO _sst FROM public.class_schedule_at(_class_id, _on, _known_at) s WHERE s.result_kind = 'block';
    IF _sst IS NULL THEN code := 'grade-ausente'; state := 'blocked'; _blocked := true; RETURN NEXT;
    ELSIF _sst <> 'utilizavel' THEN code := 'grade-nao-utilizavel:' || _sst; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
    FOR r IN SELECT s.block_key, s.coverage_state, s.engagement_ids, b.matrix_version_id
               FROM public.class_schedule_at(_class_id, _on, _known_at) s
               JOIN public.class_schedule_blocks b ON b.id = s.block_id WHERE s.result_kind = 'block' AND b.matrix_version_id IS NOT NULL LOOP
      scope := 'bloco'; subject_ref := r.block_key;
      IF r.coverage_state <> 'comprovada' THEN code := 'referencia-curricular-nao-comprovada'; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
      IF cardinality(r.engagement_ids) = 0 THEN code := 'bloco-sem-atribuicao-docente'; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN scope := 'turma'; subject_ref := _class_id; code := 'fonte-indisponivel:grade'; state := 'unavailable'; _unav := true; RETURN NEXT; END;
  BEGIN
    FOR r IN SELECT t.assignment_id, t.assignment_state FROM public.teaching_assignments_at(_class_id, _on, _known_at) t LOOP
      scope := 'atribuicao'; subject_ref := r.assignment_id;
      IF r.assignment_state <> 'vigente' THEN code := 'atribuicao-' || r.assignment_state; state := 'blocked'; _blocked := true; RETURN NEXT; END IF;
    END LOOP;
    FOR r IN SELECT x.substitution_id FROM public.teaching_substitutions_at(_class_id, _on, _known_at) x LOOP
      scope := 'substituicao'; subject_ref := r.substitution_id; code := 'substituicao-vigente'; state := 'info'; RETURN NEXT;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN scope := 'turma'; subject_ref := _class_id; code := 'fonte-indisponivel:atribuicoes'; state := 'unavailable'; _unav := true; RETURN NEXT; END;
  scope := 'resultado'; subject_ref := _class_id; code := 'resultado';
  state := CASE WHEN _unav THEN 'unavailable' WHEN _blocked THEN 'blocked' ELSE 'ready' END; RETURN NEXT;
END $fn$;
REVOKE ALL ON FUNCTION public.class_diary_readiness_at(text, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.class_diary_readiness_at(text, date, timestamptz) TO authenticated;

-- ===== V.8 Governança: política v7 = v6 + delta (decisão do proprietário de 05/10/2026), sem curinga =====
DO $do$
DECLARE _v6 uuid; _v7 uuid; _issue text; _delta int; _n6 int;
BEGIN
  SELECT id INTO _v6 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 6 AND status = 'homologated' FOR UPDATE;
  IF _v6 IS NULL OR EXISTS (SELECT 1 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version > 6) THEN RAISE EXCEPTION 'v7:v6-not-head'; END IF;
  SELECT count(*) INTO _n6 FROM public.capability_policy_rules WHERE policy_id = _v6;
  INSERT INTO public.capability_policies(logical_policy_id, version, supersedes_version_id, status)
  VALUES ('politica-capacidades-diario', 7, _v6, 'draft') RETURNING id INTO _v7;
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v7, engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id = _v6;
  WITH d(kind, cap, dims) AS (VALUES
    ('direcao-escolar','manter-jornada-da-turma',ARRAY['school']),
    ('direcao-escolar','manter-grade-da-turma',ARRAY['school']),
    ('direcao-escolar','manter-atribuicao-docente',ARRAY['school']),
    ('direcao-escolar','consultar-organizacao-da-oferta',ARRAY['school']),
    ('secretaria-escolar','consultar-organizacao-da-oferta',ARRAY['school']),
    ('gestao-pedagogica-da-rede','consultar-organizacao-da-oferta',ARRAY['network']),
    ('administrador-geral-do-sigem','manter-jornada-da-turma',ARRAY['network']),
    ('administrador-geral-do-sigem','manter-grade-da-turma',ARRAY['network']),
    ('administrador-geral-do-sigem','manter-atribuicao-docente',ARRAY['network']),
    ('administrador-geral-do-sigem','consultar-organizacao-da-oferta',ARRAY['network'])
  )
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v7, kind, cap, dims FROM d
  WHERE NOT EXISTS (SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id = _v7 AND r.engagement_kind_id = d.kind AND r.capability_id = d.cap AND r.scope_dimensions = d.dims);
  GET DIAGNOSTICS _delta = ROW_COUNT;
  IF _delta <> 10
     OR EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _v7 AND (capability_id ~ '[*%]' OR engagement_kind_id ~ '[*%]'))
     OR EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _v7 AND engagement_kind_id IN ('secretaria-escolar','gestao-pedagogica-da-rede','professor')
          AND capability_id IN ('manter-jornada-da-turma','manter-grade-da-turma','manter-atribuicao-docente'))
  THEN RAISE EXCEPTION 'v7:shape-divergent'; END IF;
  _issue := public.capability_policy_homologation_issues(_v7, DATE '2026-10-05');
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'v7:%', _issue; END IF;
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = NULL,
    homologation_origin = 'decisao-do-proprietario', valid_from = DATE '2026-10-05' WHERE id = _v7;
END $do$;
