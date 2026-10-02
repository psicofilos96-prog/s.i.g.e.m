-- B3 — Inscrição letiva (AcademicCycleEnrollment) → Participação (CycleParticipation)
-- → Alocação (ClassAllocation) → Turma; capacidade temporal própria; ocupação derivada.
-- Nenhum valor de catálogo, política ou dado oficial é semeado.

-- 1. Inscrição letiva: evolução de school_enrollments (mesma tabela, sem segunda verdade).
ALTER TABLE public.school_enrollments
  ADD COLUMN IF NOT EXISTS logical_id text,
  ADD COLUMN IF NOT EXISTS academic_year_id text REFERENCES public.institutional_academic_years(id),
  ADD COLUMN IF NOT EXISTS educational_offer_scheme_id text,
  ADD COLUMN IF NOT EXISTS educational_offer_value_id text,
  ADD COLUMN IF NOT EXISTS educational_offer_value_version integer;
UPDATE public.school_enrollments SET logical_id = id WHERE logical_id IS NULL;
COMMENT ON COLUMN public.school_enrollments.cycle_id IS 'DEPRECATED (B3): texto livre; o ano oficial é academic_year_id.';
COMMENT ON TABLE public.school_enrollment_endings IS 'DEPRECATED (B3): término não corrigível; substituído por cycle_enrollment_ending_versions.';
CREATE INDEX IF NOT EXISTS school_enrollments_logical_idx ON public.school_enrollments(logical_id);

-- 2. Alocação: evolução de class_enrollment_episodes (aponta para a participação).
ALTER TABLE public.class_enrollment_episodes
  ADD COLUMN IF NOT EXISTS logical_id text,
  ADD COLUMN IF NOT EXISTS participation_logical_id text;
UPDATE public.class_enrollment_episodes SET logical_id = id WHERE logical_id IS NULL;
COMMENT ON COLUMN public.class_enrollment_episodes.class_label_snapshot IS 'Evidência histórica do nome no registro; nunca fonte governante (usar class_at).';
COMMENT ON COLUMN public.class_enrollment_episodes.cycle_id IS 'DEPRECATED (B3): o ano vem da inscrição (academic_year_id).';
COMMENT ON TABLE public.class_enrollment_episode_endings IS 'DEPRECATED (B3): substituído por class_allocation_ending_versions.';
CREATE INDEX IF NOT EXISTS class_enrollment_episodes_logical_idx ON public.class_enrollment_episodes(logical_id);
CREATE INDEX IF NOT EXISTS class_enrollment_episodes_participation_idx ON public.class_enrollment_episodes(participation_logical_id);

-- A sobreposição deixa de ser regra do gatilho (ela dependia do término antigo);
-- cardinalidade é decidida no escritor, que falha fechado sem política.
CREATE OR REPLACE FUNCTION public.guard_class_enrollment_episode() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM school_enrollments e WHERE e.id = NEW.enrollment_id AND e.student_id = NEW.student_id AND e.school_id = NEW.school_id) THEN
    RAISE EXCEPTION 'Vínculo não corresponde à matrícula (estudante/escola)';
  END IF;
  RETURN NEW;
END $$;

-- 3. Términos versionados (retificáveis por nova versão).
CREATE TABLE public.cycle_enrollment_ending_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_logical_id text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.cycle_enrollment_ending_versions(id),
  ended_on date,
  annulled boolean NOT NULL DEFAULT false,
  bond_status_value_id text,
  bond_status_version integer,
  reason_text text,
  originating_act_ref text,
  correction_reason text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_logical_id, version),
  CHECK (annulled OR ended_on IS NOT NULL)
);
CREATE TABLE public.class_allocation_ending_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_logical_id text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.class_allocation_ending_versions(id),
  ended_on date,
  annulled boolean NOT NULL DEFAULT false,
  reason_text text,
  originating_act_ref text,
  correction_reason text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (allocation_logical_id, version),
  CHECK (annulled OR ended_on IS NOT NULL)
);

-- 4. Participação educacional (natureza configurada; nenhum valor semeado).
CREATE TABLE public.cycle_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id text NOT NULL,
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.cycle_participations(id),
  enrollment_logical_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  nature_scheme_id text NOT NULL DEFAULT 'natureza-da-participacao-educacional',
  nature_value_id text NOT NULL,
  nature_version integer NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  annulled boolean NOT NULL DEFAULT false,
  change_reason text,
  originating_act_ref text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- 5. Capacidade de referência: entidade temporal própria, nunca campo da turma.
CREATE TABLE public.class_capacity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id text NOT NULL,
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.class_capacity_records(id),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  reference_limit integer CHECK (reference_limit IS NULL OR reference_limit >= 0),
  valid_from date NOT NULL,
  valid_until date,
  annulled boolean NOT NULL DEFAULT false,
  basis_text text,
  originating_act_ref text,
  change_reason text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (annulled OR reference_limit IS NOT NULL),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

GRANT SELECT ON public.cycle_enrollment_ending_versions, public.class_allocation_ending_versions, public.cycle_participations, public.class_capacity_records TO authenticated;
GRANT ALL ON public.cycle_enrollment_ending_versions, public.class_allocation_ending_versions, public.cycle_participations, public.class_capacity_records TO service_role;
ALTER TABLE public.cycle_enrollment_ending_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_allocation_ending_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_capacity_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER immutable_cycle_enrollment_endings BEFORE UPDATE OR DELETE ON public.cycle_enrollment_ending_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_class_allocation_endings BEFORE UPDATE OR DELETE ON public.class_allocation_ending_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_cycle_participations BEFORE UPDATE OR DELETE ON public.cycle_participations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_class_capacity_records BEFORE UPDATE OR DELETE ON public.class_capacity_records FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE POLICY "enrollment ending versions by capability" ON public.cycle_enrollment_ending_versions FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id)
    OR EXISTS (SELECT 1 FROM public.school_enrollments e JOIN public.class_enrollment_episodes p ON p.enrollment_id = e.id
      WHERE e.logical_id = enrollment_logical_id AND public.can_read_class_roster(p.class_id)));
CREATE POLICY "allocation ending versions by capability" ON public.class_allocation_ending_versions FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id) OR public.can_read_class_roster(class_id));
CREATE POLICY "participations by capability" ON public.cycle_participations FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id)
    OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.participation_logical_id = logical_id AND public.can_read_class_roster(p.class_id)));
CREATE POLICY "capacity by capability" ON public.class_capacity_records FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id)
    OR public.has_school_capability('manter-cadastro-de-turmas', school_id));

-- 6. Auxiliares internos (cabeças conhecidas agora).
CREATE OR REPLACE FUNCTION public.b3_enrollment_head(_logical text) RETURNS public.school_enrollments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.* FROM school_enrollments e WHERE e.logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM school_enrollments s WHERE s.supersedes_id = e.id) LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.b3_enrollment_ending_head(_logical text) RETURNS public.cycle_enrollment_ending_versions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.* FROM cycle_enrollment_ending_versions x WHERE x.enrollment_logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM cycle_enrollment_ending_versions s WHERE s.supersedes_id = x.id) LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.b3_participation_head(_logical text) RETURNS public.cycle_participations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM cycle_participations p WHERE p.logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM cycle_participations s WHERE s.supersedes_id = p.id) LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.b3_allocation_ended_on(_logical text) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN x.annulled THEN NULL ELSE x.ended_on END FROM class_allocation_ending_versions x WHERE x.allocation_logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM class_allocation_ending_versions s WHERE s.supersedes_id = x.id) LIMIT 1
$$;

-- 7. Escritores.
CREATE OR REPLACE FUNCTION public.constitute_cycle_enrollment(_id text, _student text, _school text, _academic_year text, _opened_on date,
  _institutional_number text, _act_ref text, _supersedes text, _correction_reason text, _offer_value text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prev school_enrollments; _logical text := _id; _ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'enrollment:session-required'; END IF;
  IF _opened_on IS NULL THEN RAISE EXCEPTION 'enrollment:opened-on-required'; END IF;
  IF _offer_value IS NOT NULL THEN RAISE EXCEPTION 'enrollment:offer-designation-not-homologated'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'enrollment:capability-missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM institutional_students WHERE id = _student) THEN RAISE EXCEPTION 'enrollment:student-unknown'; END IF;
  SELECT v.active INTO _ok FROM institutional_school_record_versions v
    WHERE v.school_id = _school AND v.valid_from <= _opened_on ORDER BY v.valid_from DESC, v.version_number DESC LIMIT 1;
  IF _ok IS NOT TRUE THEN RAISE EXCEPTION 'enrollment:school-inactive-on-date'; END IF;
  _ok := NULL;
  SELECT v.is_active INTO _ok FROM institutional_academic_year_versions v
    WHERE v.academic_year_id = _academic_year AND v.valid_from <= _opened_on
      AND NOT EXISTS (SELECT 1 FROM institutional_academic_year_versions s WHERE s.supersedes_id = v.id)
    ORDER BY v.valid_from DESC LIMIT 1;
  IF _ok IS NOT TRUE THEN RAISE EXCEPTION 'enrollment:academic-year-inactive-on-date'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('enrollment:' || _student || '|' || _school || '|' || _academic_year));
  IF _supersedes IS NOT NULL THEN
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'enrollment:correction-reason-required'; END IF;
    SELECT * INTO _prev FROM school_enrollments WHERE id = _supersedes FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'enrollment:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM school_enrollments WHERE supersedes_id = _supersedes) THEN RAISE EXCEPTION 'enrollment:base-superseded'; END IF;
    IF _prev.student_id <> _student OR _prev.school_id <> _school OR _prev.academic_year_id IS DISTINCT FROM _academic_year THEN
      RAISE EXCEPTION 'enrollment:identity-immutable';
    END IF;
    _logical := coalesce(_prev.logical_id, _prev.id);
  ELSE
    IF EXISTS (SELECT 1 FROM school_enrollments e
      WHERE e.student_id = _student AND e.school_id = _school AND e.academic_year_id = _academic_year
        AND NOT EXISTS (SELECT 1 FROM school_enrollments s WHERE s.supersedes_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM cycle_enrollment_ending_versions x WHERE x.enrollment_logical_id = e.logical_id AND NOT x.annulled
          AND x.ended_on < _opened_on AND NOT EXISTS (SELECT 1 FROM cycle_enrollment_ending_versions y WHERE y.supersedes_id = x.id))) THEN
      RAISE EXCEPTION 'enrollment:coexistence-policy-absent';
    END IF;
  END IF;
  INSERT INTO school_enrollments(id, logical_id, student_id, school_id, academic_year_id, cycle_id, opened_on, institutional_number,
    originating_act_ref, supersedes_id, correction_reason, recorded_by)
  VALUES (_id, _logical, _student, _school, _academic_year, _academic_year, _opened_on, _institutional_number,
    _act_ref, _supersedes, _correction_reason, auth.uid());
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_cycle_enrollment_ending(_enrollment_logical text, _base_version_id uuid, _ended_on date,
  _bond_status_value text, _bond_status_version integer, _reason text, _act_ref text, _correction_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e school_enrollments; _prev cycle_enrollment_ending_versions; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ending:session-required'; END IF;
  _e := public.b3_enrollment_head(_enrollment_logical);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'ending:enrollment-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _e.school_id) THEN RAISE EXCEPTION 'ending:capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('enrollment-ending:' || _enrollment_logical));
  _prev := public.b3_enrollment_ending_head(_enrollment_logical);
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'ending:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'ending:correction-reason-required'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'ending:base-unknown';
  ELSIF _annul THEN RAISE EXCEPTION 'ending:nothing-to-annul';
  END IF;
  IF NOT _annul THEN
    IF _ended_on IS NULL THEN RAISE EXCEPTION 'ending:date-required'; END IF;
    IF _ended_on < _e.opened_on THEN RAISE EXCEPTION 'ending:before-start'; END IF;
    IF _bond_status_value IS NULL OR NOT public.attribute_value_homologated('situacao-do-vinculo', _bond_status_value, _bond_status_version, _ended_on) THEN
      RAISE EXCEPTION 'ending:bond-status-not-homologated';
    END IF;
  END IF;
  INSERT INTO cycle_enrollment_ending_versions(enrollment_logical_id, school_id, version, supersedes_id, ended_on, annulled,
    bond_status_value_id, bond_status_version, reason_text, originating_act_ref, correction_reason, recorded_by)
  VALUES (_enrollment_logical, _e.school_id, _v, _prev.id, CASE WHEN _annul THEN NULL ELSE _ended_on END, _annul,
    CASE WHEN _annul THEN NULL ELSE _bond_status_value END, CASE WHEN _annul THEN NULL ELSE _bond_status_version END,
    _reason, _act_ref, CASE WHEN _v > 1 THEN _correction_reason END, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.declare_cycle_participation(_logical text, _base_version_id uuid, _enrollment_logical text,
  _nature_value text, _nature_version integer, _valid_from date, _valid_until date, _act_ref text, _change_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e school_enrollments; _end cycle_enrollment_ending_versions; _prev cycle_participations; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'participation:session-required'; END IF;
  _e := public.b3_enrollment_head(_enrollment_logical);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'participation:enrollment-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _e.school_id) THEN RAISE EXCEPTION 'participation:capability-missing'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'participation:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'participation:ends-before-start'; END IF;
  IF NOT public.attribute_value_homologated('natureza-da-participacao-educacional', _nature_value, _nature_version, _valid_from) THEN
    RAISE EXCEPTION 'participation:nature-not-homologated';
  END IF;
  IF _valid_from < _e.opened_on THEN RAISE EXCEPTION 'participation:outside-enrollment'; END IF;
  _end := public.b3_enrollment_ending_head(_enrollment_logical);
  IF _end.id IS NOT NULL AND NOT _end.annulled AND (_valid_from > _end.ended_on OR _valid_until IS NULL OR _valid_until > _end.ended_on) THEN
    RAISE EXCEPTION 'participation:outside-enrollment';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('participation-enrollment:' || _enrollment_logical));
  _prev := public.b3_participation_head(_logical);
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'participation:base-superseded'; END IF;
    IF coalesce(btrim(_change_reason), '') = '' THEN RAISE EXCEPTION 'participation:correction-reason-required'; END IF;
    IF _prev.enrollment_logical_id <> _enrollment_logical THEN RAISE EXCEPTION 'participation:enrollment-immutable'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'participation:base-unknown';
  END IF;
  IF NOT _annul AND EXISTS (SELECT 1 FROM cycle_participations p
    WHERE p.enrollment_logical_id = _enrollment_logical AND p.logical_id <> _logical AND NOT p.annulled
      AND NOT EXISTS (SELECT 1 FROM cycle_participations s WHERE s.supersedes_id = p.id)
      AND p.valid_from <= coalesce(_valid_until, 'infinity'::date) AND coalesce(p.valid_until, 'infinity'::date) >= _valid_from) THEN
    RAISE EXCEPTION 'participation:coexistence-policy-absent';
  END IF;
  INSERT INTO cycle_participations(logical_id, version, supersedes_id, enrollment_logical_id, student_id, school_id,
    nature_value_id, nature_version, valid_from, valid_until, annulled, change_reason, originating_act_ref, recorded_by)
  VALUES (_logical, _v, _prev.id, _enrollment_logical, _e.student_id, _e.school_id, _nature_value, _nature_version,
    _valid_from, _valid_until, _annul, CASE WHEN _v > 1 THEN _change_reason END, _act_ref, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_class_allocation(_id text, _participation_logical text, _class text, _valid_from date,
  _act_ref text, _supersedes text, _correction_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p cycle_participations; _e school_enrollments; _c institutional_classes; _rec record; _prev class_enrollment_episodes; _logical text := _id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'allocation:session-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'allocation:valid-from-required'; END IF;
  _p := public.b3_participation_head(_participation_logical);
  IF _p.id IS NULL OR _p.annulled THEN RAISE EXCEPTION 'allocation:participation-unknown'; END IF;
  _e := public.b3_enrollment_head(_p.enrollment_logical_id);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'allocation:enrollment-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _e.school_id) THEN RAISE EXCEPTION 'allocation:capability-missing'; END IF;
  SELECT * INTO _c FROM institutional_classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'allocation:class-unknown'; END IF;
  IF _c.school_id <> _e.school_id THEN RAISE EXCEPTION 'allocation:class-other-school'; END IF;
  IF _c.academic_year_id IS DISTINCT FROM _e.academic_year_id THEN RAISE EXCEPTION 'allocation:academic-year-mismatch'; END IF;
  SELECT * INTO _rec FROM public.class_at(_class, _valid_from, NULL);
  IF _rec.id IS NULL OR _rec.administrative_status <> 'ativa' THEN RAISE EXCEPTION 'allocation:class-inactive-on-date'; END IF;
  IF _valid_from < _p.valid_from OR (_p.valid_until IS NOT NULL AND _valid_from > _p.valid_until) THEN
    RAISE EXCEPTION 'allocation:outside-participation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('allocation-participation:' || _participation_logical));
  IF _supersedes IS NOT NULL THEN
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'allocation:correction-reason-required'; END IF;
    SELECT * INTO _prev FROM class_enrollment_episodes WHERE id = _supersedes FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'allocation:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM class_enrollment_episodes WHERE supersedes_id = _supersedes) THEN RAISE EXCEPTION 'allocation:base-superseded'; END IF;
    IF _prev.participation_logical_id IS DISTINCT FROM _participation_logical THEN RAISE EXCEPTION 'allocation:participation-immutable'; END IF;
    _logical := coalesce(_prev.logical_id, _prev.id);
  END IF;
  IF EXISTS (SELECT 1 FROM class_enrollment_episodes a
    WHERE a.participation_logical_id = _participation_logical AND a.logical_id <> _logical
      AND NOT EXISTS (SELECT 1 FROM class_enrollment_episodes s WHERE s.supersedes_id = a.id)
      AND (public.b3_allocation_ended_on(a.logical_id) IS NULL OR public.b3_allocation_ended_on(a.logical_id) >= _valid_from)) THEN
    RAISE EXCEPTION 'allocation:cardinality-policy-absent';
  END IF;
  INSERT INTO class_enrollment_episodes(id, logical_id, participation_logical_id, enrollment_id, student_id, school_id, class_id,
    class_label_snapshot, cycle_id, valid_from, originating_act_ref, supersedes_id, correction_reason, recorded_by)
  VALUES (_id, _logical, _participation_logical, _e.id, _e.student_id, _e.school_id, _class, _rec.name, _e.academic_year_id,
    _valid_from, _act_ref, _supersedes, _correction_reason, auth.uid());
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_class_allocation_ending(_allocation_logical text, _base_version_id uuid, _ended_on date,
  _reason text, _act_ref text, _correction_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a class_enrollment_episodes; _prev class_allocation_ending_versions; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'allocation-ending:session-required'; END IF;
  SELECT a.* INTO _a FROM class_enrollment_episodes a WHERE a.logical_id = _allocation_logical
    AND NOT EXISTS (SELECT 1 FROM class_enrollment_episodes s WHERE s.supersedes_id = a.id) LIMIT 1;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'allocation-ending:allocation-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _a.school_id) THEN RAISE EXCEPTION 'allocation-ending:capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('allocation-ending:' || _allocation_logical));
  SELECT x.* INTO _prev FROM class_allocation_ending_versions x WHERE x.allocation_logical_id = _allocation_logical
    AND NOT EXISTS (SELECT 1 FROM class_allocation_ending_versions s WHERE s.supersedes_id = x.id) LIMIT 1;
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'allocation-ending:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'allocation-ending:correction-reason-required'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'allocation-ending:base-unknown';
  ELSIF _annul THEN RAISE EXCEPTION 'allocation-ending:nothing-to-annul';
  END IF;
  IF NOT _annul THEN
    IF _ended_on IS NULL THEN RAISE EXCEPTION 'allocation-ending:date-required'; END IF;
    IF _ended_on < _a.valid_from THEN RAISE EXCEPTION 'allocation-ending:before-start'; END IF;
  END IF;
  INSERT INTO class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, supersedes_id, ended_on, annulled,
    reason_text, originating_act_ref, correction_reason, recorded_by)
  VALUES (_allocation_logical, _a.school_id, _a.class_id, _v, _prev.id, CASE WHEN _annul THEN NULL ELSE _ended_on END, _annul,
    _reason, _act_ref, CASE WHEN _v > 1 THEN _correction_reason END, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_class_capacity(_logical text, _base_version_id uuid, _class text, _reference_limit integer,
  _valid_from date, _valid_until date, _basis text, _act_ref text, _change_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c institutional_classes; _prev class_capacity_records; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'capacity:session-required'; END IF;
  SELECT * INTO _c FROM institutional_classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'capacity:class-unknown'; END IF;
  IF NOT public.has_school_capability('manter-cadastro-de-turmas', _c.school_id) THEN RAISE EXCEPTION 'capacity:capability-missing'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'capacity:valid-from-required'; END IF;
  IF NOT _annul AND (_reference_limit IS NULL OR _reference_limit < 0) THEN RAISE EXCEPTION 'capacity:limit-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('capacity-class:' || _class));
  SELECT r.* INTO _prev FROM class_capacity_records r WHERE r.logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM class_capacity_records s WHERE s.supersedes_id = r.id) LIMIT 1;
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'capacity:base-superseded'; END IF;
    IF coalesce(btrim(_change_reason), '') = '' THEN RAISE EXCEPTION 'capacity:correction-reason-required'; END IF;
    IF _prev.class_id <> _class THEN RAISE EXCEPTION 'capacity:class-immutable'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'capacity:base-unknown';
  END IF;
  IF NOT _annul AND EXISTS (SELECT 1 FROM class_capacity_records r
    WHERE r.class_id = _class AND r.logical_id <> _logical AND NOT r.annulled
      AND NOT EXISTS (SELECT 1 FROM class_capacity_records s WHERE s.supersedes_id = r.id)
      AND r.valid_from <= coalesce(_valid_until, 'infinity'::date) AND coalesce(r.valid_until, 'infinity'::date) >= _valid_from) THEN
    RAISE EXCEPTION 'capacity:overlapping-record';
  END IF;
  INSERT INTO class_capacity_records(logical_id, version, supersedes_id, class_id, school_id, reference_limit, valid_from, valid_until,
    annulled, basis_text, originating_act_ref, change_reason, recorded_by)
  VALUES (_logical, _v, _prev.id, _class, _c.school_id, CASE WHEN _annul THEN NULL ELSE _reference_limit END, _valid_from, _valid_until,
    _annul, _basis, _act_ref, CASE WHEN _v > 1 THEN _change_reason END, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_movement_type_definition(_id text, _base_version integer, _label text, _status text,
  _valid_from date, _act_ref text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _current integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'movement-type:session-required'; END IF;
  IF NOT public.has_network_capability('manter-catalogos-institucionais') THEN RAISE EXCEPTION 'movement-type:capability-missing'; END IF;
  IF coalesce(btrim(_id), '') = '' OR coalesce(btrim(_label), '') = '' THEN RAISE EXCEPTION 'movement-type:id-and-label-required'; END IF;
  IF _status NOT IN ('rascunho', 'homologada') THEN RAISE EXCEPTION 'movement-type:status-invalid'; END IF;
  IF _status = 'homologada' AND (coalesce(btrim(_act_ref), '') = '' OR _valid_from IS NULL) THEN RAISE EXCEPTION 'movement-type:homologation-act-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('movement-type:' || _id));
  SELECT max(version) INTO _current FROM movement_type_definitions WHERE id = _id;
  IF _current IS DISTINCT FROM _base_version THEN RAISE EXCEPTION 'movement-type:base-superseded'; END IF;
  INSERT INTO movement_type_definitions(id, version, label, status, homologation_act_ref, valid_from)
  VALUES (_id, coalesce(_current, 0) + 1, _label, _status, _act_ref, _valid_from);
  RETURN coalesce(_current, 0) + 1;
END $$;

-- 8. Readers bitemporais (SECURITY INVOKER: RLS da sessão se aplica).
CREATE OR REPLACE FUNCTION public.cycle_enrollments_at(_school text, _valid_on date DEFAULT NULL, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(id text, logical_id text, student_id text, school_id text, academic_year_id text, opened_on date,
  institutional_number text, originating_act_ref text, created_at timestamptz, ending_version_id uuid, ended_on date,
  bond_status_value_id text, bond_status_version integer, ending_reason text)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF _school IS NULL THEN RAISE EXCEPTION 'enrollment:query-arguments-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollments e
      WHERE e.school_id = _school AND (_known_at IS NULL OR e.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY e.logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions x
      WHERE x.school_id = _school AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY x.enrollment_logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'enrollment:ambiguous-temporal-state';
  END IF;
  RETURN QUERY
  WITH heads AS (
    SELECT e.* FROM public.school_enrollments e
    WHERE e.school_id = _school AND (_known_at IS NULL OR e.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), ends AS (
    SELECT x.* FROM public.cycle_enrollment_ending_versions x
    WHERE x.school_id = _school AND (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  )
  SELECT h.id, h.logical_id, h.student_id, h.school_id, h.academic_year_id, h.opened_on, h.institutional_number, h.originating_act_ref,
    h.created_at, x.id, CASE WHEN x.annulled THEN NULL ELSE x.ended_on END, CASE WHEN x.annulled THEN NULL ELSE x.bond_status_value_id END,
    CASE WHEN x.annulled THEN NULL ELSE x.bond_status_version END, x.reason_text
  FROM heads h LEFT JOIN ends x ON x.enrollment_logical_id = h.logical_id
  WHERE _valid_on IS NULL OR (h.opened_on IS NOT NULL AND h.opened_on <= _valid_on
    AND (x.id IS NULL OR x.annulled OR x.ended_on >= _valid_on));
END $$;

CREATE OR REPLACE FUNCTION public.cycle_participations_at(_school text, _valid_on date DEFAULT NULL, _known_at timestamptz DEFAULT NULL)
RETURNS SETOF public.cycle_participations
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF _school IS NULL THEN RAISE EXCEPTION 'participation:query-arguments-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.cycle_participations p
      WHERE p.school_id = _school AND (_known_at IS NULL OR p.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s WHERE s.supersedes_id = p.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY p.logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'participation:ambiguous-temporal-state';
  END IF;
  RETURN QUERY
  SELECT p.* FROM public.cycle_participations p
  WHERE p.school_id = _school AND NOT p.annulled AND (_known_at IS NULL OR p.created_at <= _known_at)
    AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s WHERE s.supersedes_id = p.id AND (_known_at IS NULL OR s.created_at <= _known_at))
    AND (_valid_on IS NULL OR (p.valid_from <= _valid_on AND (p.valid_until IS NULL OR p.valid_until >= _valid_on)));
END $$;

CREATE OR REPLACE FUNCTION public.class_allocations_at(_school text, _class text, _valid_on date DEFAULT NULL, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(id text, logical_id text, participation_logical_id text, enrollment_id text, student_id text, school_id text, class_id text,
  valid_from date, ended_on date, ending_version_id uuid, ending_reason text, originating_act_ref text, class_label_snapshot text, created_at timestamptz)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF _school IS NULL AND _class IS NULL THEN RAISE EXCEPTION 'allocation:query-arguments-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_allocation_ending_versions x
      WHERE (_school IS NULL OR x.school_id = _school) AND (_class IS NULL OR x.class_id = _class)
        AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY x.allocation_logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes a
      WHERE (_school IS NULL OR a.school_id = _school) AND (_known_at IS NULL OR a.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY a.logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'allocation:ambiguous-temporal-state';
  END IF;
  RETURN QUERY
  WITH heads AS (
    SELECT a.* FROM public.class_enrollment_episodes a
    WHERE (_school IS NULL OR a.school_id = _school) AND (_class IS NULL OR a.class_id = _class)
      AND (_known_at IS NULL OR a.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), ends AS (
    SELECT x.* FROM public.class_allocation_ending_versions x
    WHERE (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  )
  SELECT h.id, h.logical_id, h.participation_logical_id, h.enrollment_id, h.student_id, h.school_id, h.class_id, h.valid_from,
    CASE WHEN x.annulled THEN NULL ELSE x.ended_on END, x.id, x.reason_text, h.originating_act_ref, h.class_label_snapshot, h.created_at
  FROM heads h LEFT JOIN ends x ON x.allocation_logical_id = h.logical_id
  WHERE _valid_on IS NULL OR (h.valid_from <= _valid_on AND (x.id IS NULL OR x.annulled OR x.ended_on >= _valid_on));
END $$;

CREATE OR REPLACE FUNCTION public.student_movements_known(_school text, _known_at timestamptz DEFAULT NULL)
RETURNS SETOF public.student_movement_events
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF _school IS NULL THEN RAISE EXCEPTION 'movement:query-arguments-required'; END IF;
  RETURN QUERY
  SELECT m.* FROM public.student_movement_events m
  WHERE _school = ANY (m.school_scope_ids) AND (_known_at IS NULL OR m.created_at <= _known_at)
    AND NOT EXISTS (SELECT 1 FROM public.student_movement_events s WHERE s.supersedes_id = m.id AND (_known_at IS NULL OR s.created_at <= _known_at));
END $$;

CREATE OR REPLACE FUNCTION public.class_capacity_at(_class text, _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS SETOF public.class_capacity_records
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE _count integer;
BEGIN
  IF _class IS NULL OR _valid_on IS NULL THEN RAISE EXCEPTION 'capacity:query-arguments-required'; END IF;
  SELECT count(*)::integer INTO _count FROM public.class_capacity_records r
  WHERE r.class_id = _class AND NOT r.annulled AND (_known_at IS NULL OR r.created_at <= _known_at)
    AND NOT EXISTS (SELECT 1 FROM public.class_capacity_records s WHERE s.supersedes_id = r.id AND (_known_at IS NULL OR s.created_at <= _known_at))
    AND r.valid_from <= _valid_on AND (r.valid_until IS NULL OR r.valid_until >= _valid_on);
  IF _count > 1 THEN RAISE EXCEPTION 'capacity:ambiguous-temporal-state'; END IF;
  RETURN QUERY
  SELECT r.* FROM public.class_capacity_records r
  WHERE r.class_id = _class AND NOT r.annulled AND (_known_at IS NULL OR r.created_at <= _known_at)
    AND NOT EXISTS (SELECT 1 FROM public.class_capacity_records s WHERE s.supersedes_id = r.id AND (_known_at IS NULL OR s.created_at <= _known_at))
    AND r.valid_from <= _valid_on AND (r.valid_until IS NULL OR r.valid_until >= _valid_on);
END $$;

-- Ocupação: derivada das alocações vigentes; nunca persistida.
CREATE OR REPLACE FUNCTION public.class_occupancy_at(_class text, _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT count(*)::integer FROM public.class_allocations_at(NULL, _class, _valid_on, _known_at)
$$;

-- 9. ACL: escrita só pelos escritores; anon/PUBLIC sem EXECUTE; sem DML direto.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.school_enrollments, public.school_enrollment_endings, public.class_enrollment_episodes,
  public.class_enrollment_episode_endings, public.student_movement_events, public.movement_type_definitions,
  public.cycle_enrollment_ending_versions, public.class_allocation_ending_versions, public.cycle_participations, public.class_capacity_records
  FROM anon, authenticated;
REVOKE ALL ON public.school_enrollments, public.school_enrollment_endings, public.class_enrollment_episodes,
  public.class_enrollment_episode_endings, public.student_movement_events, public.movement_type_definitions,
  public.cycle_enrollment_ending_versions, public.class_allocation_ending_versions, public.cycle_participations, public.class_capacity_records
  FROM anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.school_enrollments, public.school_enrollment_endings, public.class_enrollment_episodes, public.class_enrollment_episode_endings, public.student_movement_events, public.movement_type_definitions, public.cycle_enrollment_ending_versions, public.class_allocation_ending_versions, public.cycle_participations, public.class_capacity_records FROM sandbox_exec';
  END IF;
END $$;

-- Escritores antigos (sem as validações B3) ficam fora de uso.
REVOKE EXECUTE ON FUNCTION public.register_school_enrollment(text,text,text,text,date,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_school_enrollment_ending(text,date,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_class_enrollment_episode(text,text,text,date,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_class_episode_ending(text,date,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_student_movement(text,uuid,text,text,text,integer,date,jsonb,jsonb,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_movement(text,uuid,text,text,text,integer,date,jsonb,jsonb,text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_class_roster(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_class_roster(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.b3_enrollment_head(text), public.b3_enrollment_ending_head(text), public.b3_participation_head(text),
  public.b3_allocation_ended_on(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION
  public.constitute_cycle_enrollment(text,text,text,text,date,text,text,text,text,text),
  public.record_cycle_enrollment_ending(text,uuid,date,text,integer,text,text,text,boolean),
  public.declare_cycle_participation(text,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_class_allocation(text,text,text,date,text,text,text),
  public.record_class_allocation_ending(text,uuid,date,text,text,text,boolean),
  public.record_class_capacity(text,uuid,text,integer,date,date,text,text,text,boolean),
  public.record_movement_type_definition(text,integer,text,text,date,text),
  public.cycle_enrollments_at(text,date,timestamptz),
  public.cycle_participations_at(text,date,timestamptz),
  public.class_allocations_at(text,text,date,timestamptz),
  public.student_movements_known(text,timestamptz),
  public.class_capacity_at(text,date,timestamptz),
  public.class_occupancy_at(text,date,timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.constitute_cycle_enrollment(text,text,text,text,date,text,text,text,text,text),
  public.record_cycle_enrollment_ending(text,uuid,date,text,integer,text,text,text,boolean),
  public.declare_cycle_participation(text,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_class_allocation(text,text,text,date,text,text,text),
  public.record_class_allocation_ending(text,uuid,date,text,text,text,boolean),
  public.record_class_capacity(text,uuid,text,integer,date,date,text,text,text,boolean),
  public.record_movement_type_definition(text,integer,text,text,date,text),
  public.cycle_enrollments_at(text,date,timestamptz),
  public.cycle_participations_at(text,date,timestamptz),
  public.class_allocations_at(text,text,date,timestamptz),
  public.student_movements_known(text,timestamptz),
  public.class_capacity_at(text,date,timestamptz),
  public.class_occupancy_at(text,date,timestamptz)
  TO authenticated;
