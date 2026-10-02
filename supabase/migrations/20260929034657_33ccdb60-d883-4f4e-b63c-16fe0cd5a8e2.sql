-- 14.5 — Matrícula, enturmação e movimentação como fatos institucionais versionados.

-- Matrícula: data de abertura deixa de ser obrigatória (não se inventa data).
ALTER TABLE public.school_enrollments
  ALTER COLUMN opened_on DROP NOT NULL,
  ADD COLUMN cycle_id text,
  ADD COLUMN institutional_number text,
  ADD COLUMN supersedes_id text UNIQUE REFERENCES public.school_enrollments(id),
  ADD COLUMN correction_reason text,
  ADD COLUMN recorded_by uuid;

ALTER TABLE public.class_enrollment_episodes
  ADD COLUMN supersedes_id text UNIQUE REFERENCES public.class_enrollment_episodes(id),
  ADD COLUMN correction_reason text,
  ADD COLUMN recorded_by uuid;

-- Sobreposição ignora a versão substituída e versões já superadas.
CREATE OR REPLACE FUNCTION public.guard_class_enrollment_episode() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM school_enrollments e WHERE e.id = NEW.enrollment_id AND e.student_id = NEW.student_id AND e.school_id = NEW.school_id) THEN
    RAISE EXCEPTION 'Vínculo não corresponde à matrícula (estudante/escola)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM class_enrollment_episodes o
    LEFT JOIN class_enrollment_episode_endings x ON x.episode_id = o.id
    WHERE o.student_id = NEW.student_id AND o.class_id = NEW.class_id
      AND o.id IS DISTINCT FROM NEW.supersedes_id
      AND NOT EXISTS (SELECT 1 FROM class_enrollment_episodes s WHERE s.supersedes_id = o.id)
      AND (x.ended_on IS NULL OR x.ended_on >= NEW.valid_from)
  ) THEN
    RAISE EXCEPTION 'Sobreposição de vigência do estudante na mesma turma';
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE public.school_enrollment_endings (
  enrollment_id text PRIMARY KEY REFERENCES public.school_enrollments(id),
  ended_on date NOT NULL,
  bond_status_id text NOT NULL,
  reason_text text,
  originating_act_ref text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.movement_type_definitions (
  id text NOT NULL,
  version integer NOT NULL,
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('rascunho','homologada')),
  homologation_act_ref text,
  valid_from date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
CREATE TABLE public.student_movement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id text NOT NULL,
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.student_movement_events(id),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  enrollment_id text REFERENCES public.school_enrollments(id),
  movement_type_id text NOT NULL,
  movement_type_version integer NOT NULL,
  effective_on date,
  origin jsonb,
  destination jsonb,
  reason_code text,
  reason_text text,
  originating_act_ref text,
  correction_reason text,
  recorded_by uuid NOT NULL,
  school_scope_ids text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  FOREIGN KEY (movement_type_id, movement_type_version) REFERENCES public.movement_type_definitions(id, version)
);

GRANT SELECT ON public.school_enrollment_endings, public.movement_type_definitions, public.student_movement_events TO authenticated;
GRANT ALL ON public.school_enrollment_endings, public.movement_type_definitions, public.student_movement_events TO service_role;
ALTER TABLE public.school_enrollment_endings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_movement_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER immutable_enrollment_endings BEFORE UPDATE OR DELETE ON public.school_enrollment_endings FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_movement_events BEFORE UPDATE OR DELETE ON public.student_movement_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER homologated_movement_types BEFORE UPDATE OR DELETE ON public.movement_type_definitions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Capacidade na escola (leitura e escrita separadas; nenhuma concedida).
CREATE OR REPLACE FUNCTION public.has_school_capability(_capability text, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _school IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_capabilities(current_date) c
    WHERE c.capability_id = _capability AND c.school_id = _school AND c.class_id IS NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.has_school_capability(text, text) FROM anon, public;

CREATE POLICY "movement types readable" ON public.movement_type_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "enrollment endings by capability" ON public.school_enrollment_endings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.id = enrollment_id AND
    (public.has_school_capability('consultar-matricula-e-movimentacao', e.school_id)
     OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.can_read_class_roster(p.class_id)))));
CREATE POLICY "movements by capability" ON public.student_movement_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM unnest(school_scope_ids) s WHERE public.has_school_capability('consultar-matricula-e-movimentacao', s)));
CREATE POLICY "enrollments by school capability" ON public.school_enrollments FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id));
CREATE POLICY "episodes by school capability" ON public.class_enrollment_episodes FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id));

-- Gravação: matrícula (nova ou correção).
CREATE OR REPLACE FUNCTION public.register_school_enrollment(_id text, _student text, _school text, _cycle text, _opened_on date,
  _institutional_number text, _act_ref text, _supersedes text, _correction_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'Capacidade manter-matricula-e-enturmacao ausente na escola'; END IF;
  IF NOT EXISTS (SELECT 1 FROM institutional_schools WHERE id = _school) THEN RAISE EXCEPTION 'Escola inexistente'; END IF;
  IF _supersedes IS NOT NULL THEN
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    PERFORM 1 FROM school_enrollments WHERE id = _supersedes AND student_id = _student FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Versão substituída inexistente para este estudante'; END IF;
    IF EXISTS (SELECT 1 FROM school_enrollments WHERE supersedes_id = _supersedes) THEN RAISE EXCEPTION 'Versão já substituída'; END IF;
  END IF;
  INSERT INTO school_enrollments(id, student_id, school_id, cycle_id, opened_on, institutional_number, originating_act_ref, supersedes_id, correction_reason, recorded_by)
  VALUES (_id, _student, _school, _cycle, _opened_on, _institutional_number, _act_ref, _supersedes, _correction_reason, auth.uid());
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_school_enrollment_ending(_enrollment text, _ended_on date, _bond_status text, _reason text, _act_ref text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT school_id INTO _school FROM school_enrollments WHERE id = _enrollment FOR UPDATE;
  IF _school IS NULL THEN RAISE EXCEPTION 'Matrícula inexistente'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'Capacidade ausente'; END IF;
  IF coalesce(btrim(_bond_status), '') = '' THEN RAISE EXCEPTION 'Situação do vínculo não declarada'; END IF;
  INSERT INTO school_enrollment_endings(enrollment_id, ended_on, bond_status_id, reason_text, originating_act_ref, recorded_by)
  VALUES (_enrollment, _ended_on, _bond_status, _reason, _act_ref, auth.uid());
  RETURN _enrollment;
END $$;

CREATE OR REPLACE FUNCTION public.register_class_enrollment_episode(_id text, _enrollment text, _class text, _valid_from date,
  _act_ref text, _supersedes text, _correction_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; c record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT * INTO e FROM school_enrollments WHERE id = _enrollment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula inexistente'; END IF;
  SELECT * INTO c FROM institutional_classes WHERE id = _class;
  IF NOT FOUND OR c.school_id <> e.school_id THEN RAISE EXCEPTION 'Turma inexistente ou de outra escola'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id) THEN RAISE EXCEPTION 'Capacidade ausente'; END IF;
  IF _supersedes IS NOT NULL THEN
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    PERFORM 1 FROM class_enrollment_episodes WHERE id = _supersedes AND student_id = e.student_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Versão substituída inexistente'; END IF;
    IF EXISTS (SELECT 1 FROM class_enrollment_episodes WHERE supersedes_id = _supersedes) THEN RAISE EXCEPTION 'Versão já substituída'; END IF;
  END IF;
  INSERT INTO class_enrollment_episodes(id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, cycle_id, valid_from, originating_act_ref, supersedes_id, correction_reason, recorded_by)
  VALUES (_id, _enrollment, e.student_id, e.school_id, _class, c.name, e.cycle_id, _valid_from, _act_ref, _supersedes, _correction_reason, auth.uid());
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_class_episode_ending(_episode text, _ended_on date, _reason text, _act_ref text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT school_id INTO _school FROM class_enrollment_episodes WHERE id = _episode FOR UPDATE;
  IF _school IS NULL THEN RAISE EXCEPTION 'Episódio inexistente'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'Capacidade ausente'; END IF;
  INSERT INTO class_enrollment_episode_endings(episode_id, ended_on, reason_label, originating_act_ref) VALUES (_episode, _ended_on, _reason, _act_ref);
  RETURN _episode;
END $$;

-- Movimentação: evento; nunca deduzido de término.
CREATE OR REPLACE FUNCTION public.record_student_movement(_logical text, _base_version_id uuid, _student text, _enrollment text,
  _type text, _type_version integer, _effective_on date, _origin jsonb, _destination jsonb,
  _reason_code text, _reason_text text, _act_ref text, _correction_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _schools text[]; _s text; _prev record; _id uuid; _v integer := 1;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM movement_type_definitions WHERE id = _type AND version = _type_version AND status = 'homologada') THEN
    RAISE EXCEPTION 'Tipo de movimentação não homologado';
  END IF;
  _schools := array_remove(ARRAY[_origin->>'schoolId', _destination->>'schoolId'], NULL);
  IF array_length(_schools, 1) IS NULL THEN RAISE EXCEPTION 'Nenhuma escola da rede na origem ou no destino'; END IF;
  -- Capacidade exigida em ao menos uma escola da rede envolvida, e somente nela.
  IF NOT EXISTS (SELECT 1 FROM unnest(_schools) s WHERE public.has_school_capability('registrar-movimentacao-escolar', s)) THEN
    RAISE EXCEPTION 'Capacidade registrar-movimentacao-escolar ausente';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('movement:' || _logical));
  SELECT * INTO _prev FROM student_movement_events m WHERE m.logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM student_movement_events n WHERE n.supersedes_id = m.id);
  IF FOUND THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'Base superada'; END IF;
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    IF _prev.student_id <> _student THEN RAISE EXCEPTION 'Correção não troca o estudante'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente';
  END IF;
  INSERT INTO student_movement_events(logical_id, version, supersedes_id, student_id, enrollment_id, movement_type_id, movement_type_version,
    effective_on, origin, destination, reason_code, reason_text, originating_act_ref, correction_reason, recorded_by, school_scope_ids)
  VALUES (_logical, _v, CASE WHEN _v > 1 THEN _prev.id END, _student, _enrollment, _type, _type_version, _effective_on, _origin, _destination,
    _reason_code, _reason_text, _act_ref, CASE WHEN _v > 1 THEN _correction_reason END, auth.uid(), _schools)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.register_school_enrollment(text,text,text,text,date,text,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_school_enrollment_ending(text,date,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.register_class_enrollment_episode(text,text,text,date,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_class_episode_ending(text,date,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_student_movement(text,uuid,text,text,text,integer,date,jsonb,jsonb,text,text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_school_enrollment(text,text,text,text,date,text,text,text,text),
  public.record_school_enrollment_ending(text,date,text,text,text),
  public.register_class_enrollment_episode(text,text,text,date,text,text,text),
  public.record_class_episode_ending(text,date,text,text),
  public.record_student_movement(text,uuid,text,text,text,integer,date,jsonb,jsonb,text,text,text,text),
  public.has_school_capability(text,text) TO authenticated;