-- SIGEM Desenvolvimento L11: designação temporal de formadores (internos por atuação; externos por pessoa canônica sem atuação)
-- e acesso externo restrito à própria turma durante a vigência. Participação segue a pessoa, nunca a lotação.
CREATE TABLE public.dev_trainer_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  engagement_id uuid REFERENCES public.institutional_engagements(id),
  nature text NOT NULL CHECK (nature IN ('interno','externo')),
  role_label text NOT NULL CHECK (length(btrim(role_label)) BETWEEN 3 AND 80),
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  basis text NOT NULL CHECK (length(btrim(basis)) >= 10),
  designated_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until >= valid_from),
  CHECK ((nature = 'interno') = (engagement_id IS NOT NULL))
);
-- Encerramento antecipado/revogação: registro próprio, uma vez, com motivo; nunca edita a designação.
CREATE TABLE public.dev_trainer_designation_endings (
  designation_id uuid PRIMARY KEY REFERENCES public.dev_trainer_designations(id),
  ended_on date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  ended_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dev_trainer_designations, public.dev_trainer_designation_endings TO authenticated;
GRANT ALL ON public.dev_trainer_designations, public.dev_trainer_designation_endings TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_trainer_designations, public.dev_trainer_designation_endings FROM authenticated, anon;
ALTER TABLE public.dev_trainer_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_trainer_designation_endings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER devtd_immutable BEFORE UPDATE OR DELETE ON public.dev_trainer_designations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devtde_immutable BEFORE UPDATE OR DELETE ON public.dev_trainer_designation_endings FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Formador vigente HOJE na turma (designação não encerrada). DEFINER para uso em políticas sem recursão.
CREATE OR REPLACE FUNCTION public.dev_is_active_trainer(_class uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_trainer_designations d
    LEFT JOIN public.dev_trainer_designation_endings x ON x.designation_id = d.id
    WHERE d.class_id = _class AND d.person_id = public.current_person_id()
      AND current_date BETWEEN d.valid_from AND d.valid_until AND (x.ended_on IS NULL OR current_date < x.ended_on))
$$;
REVOKE EXECUTE ON FUNCTION public.dev_is_active_trainer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_is_active_trainer(uuid) TO authenticated;

CREATE POLICY "dev designations read" ON public.dev_trainer_designations FOR SELECT TO authenticated
  USING (public.dev_can_manage() OR person_id = public.current_person_id() OR public.dev_is_active_trainer(class_id));
CREATE POLICY "dev designation endings read" ON public.dev_trainer_designation_endings FOR SELECT TO authenticated
  USING (public.dev_can_manage() OR EXISTS (SELECT 1 FROM public.dev_trainer_designations d WHERE d.id = designation_id AND d.person_id = public.current_person_id()));
-- Acesso restrito do formador: só participantes e eventos da turma em que está vigente.
CREATE POLICY "dev enrollments active trainer" ON public.dev_enrollments FOR SELECT TO authenticated
  USING (public.dev_is_active_trainer(class_id));
CREATE POLICY "dev participation active trainer" ON public.dev_participation_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND public.dev_is_active_trainer(e.class_id)));

CREATE OR REPLACE FUNCTION public.designate_dev_trainer(_class uuid, _person uuid, _engagement uuid, _role text,
  _from date, _until date, _basis text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c public.dev_classes; _eng public.institutional_engagements; _nature text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_trainer_designations WHERE idempotency_key = _key AND designated_by = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _person = _p THEN RAISE EXCEPTION 'dev:self-designation'; END IF;
  SELECT * INTO _c FROM public.dev_classes WHERE id = _class FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _from < _c.starts_on OR _until > _c.ends_on THEN RAISE EXCEPTION 'dev:outside-class-period'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_persons WHERE id = _person AND actor_nature = 'pessoa-natural') THEN RAISE EXCEPTION 'dev:not-natural-person'; END IF;
  IF _engagement IS NOT NULL THEN
    SELECT * INTO _eng FROM public.institutional_engagements WHERE id = _engagement;
    IF NOT FOUND OR _eng.person_id <> _person OR _eng.valid_from > _from OR (_eng.valid_until IS NOT NULL AND _eng.valid_until < _until) THEN
      RAISE EXCEPTION 'dev:engagement-not-covering'; END IF;
    _nature := 'interno';
  ELSE
    -- Externo: pessoa canônica sem atuação vigente; nunca ganha capacidade, só leitura da própria turma na vigência.
    IF EXISTS (SELECT 1 FROM public.institutional_engagements WHERE person_id = _person AND valid_from <= _until AND (valid_until IS NULL OR valid_until >= _from)) THEN
      RAISE EXCEPTION 'dev:internal-needs-engagement'; END IF;
    _nature := 'externo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dev_trainer_designations d LEFT JOIN public.dev_trainer_designation_endings x ON x.designation_id = d.id
     WHERE d.class_id = _class AND d.person_id = _person AND d.valid_from <= _until AND least(d.valid_until, coalesce(x.ended_on - 1, d.valid_until)) >= _from) THEN
    RAISE EXCEPTION 'dev:overlapping-designation'; END IF;
  INSERT INTO public.dev_trainer_designations(class_id, person_id, engagement_id, nature, role_label, valid_from, valid_until, basis, designated_by, idempotency_key)
  VALUES (_class, _person, _engagement, _nature, btrim(_role), _from, _until, btrim(_basis), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.end_dev_trainer_designation(_designation uuid, _on date, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _d public.dev_trainer_designations;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _d FROM public.dev_trainer_designations WHERE id = _designation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _on <= _d.valid_from OR _on > _d.valid_until THEN RAISE EXCEPTION 'dev:invalid-end'; END IF;
  INSERT INTO public.dev_trainer_designation_endings(designation_id, ended_on, reason, ended_by) VALUES (_designation, _on, btrim(_reason), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-ended';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Histórico do participante: por pessoa, atravessando vínculos/lotações; o vínculo do pedido é só fotografia.
CREATE OR REPLACE FUNCTION public.dev_person_formation_history(_person uuid)
RETURNS TABLE (enrollment_id uuid, class_id uuid, class_label text, course_title text, course_version int,
  functional_link_id uuid, requested_at timestamptz, last_event text, last_event_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT e.id, k.id, k.label, v.title, v.version, e.functional_link_id, e.created_at,
    (SELECT x.kind FROM public.dev_participation_events x WHERE x.enrollment_id = e.id ORDER BY x.seq DESC LIMIT 1),
    (SELECT x.created_at FROM public.dev_participation_events x WHERE x.enrollment_id = e.id ORDER BY x.seq DESC LIMIT 1)
  FROM public.dev_enrollments e JOIN public.dev_classes k ON k.id = e.class_id JOIN public.dev_course_versions v ON v.id = k.course_version_id
  WHERE e.person_id = _person ORDER BY k.starts_on, e.created_at
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['designate_dev_trainer(uuid,uuid,uuid,text,date,date,text,text)','end_dev_trainer_designation(uuid,date,text)','dev_person_formation_history(uuid)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
COMMENT ON TABLE public.dev_class_trainers IS 'Formadores iniciais da turma (L08); designação temporal vigente vive em dev_trainer_designations (L11)';