-- SIGEM Desenvolvimento L08: turma formativa = oferta de uma versão de curso (dev_classes), nunca institutional_classes.
CREATE TABLE public.dev_class_details (
  class_id uuid PRIMARY KEY REFERENCES public.dev_classes(id),
  location text NOT NULL CHECK (length(btrim(location)) BETWEEN 3 AND 200),
  audience text NOT NULL CHECK (length(btrim(audience)) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Formador = atuação canônica vigente no início da turma (nunca nome digitado).
CREATE TABLE public.dev_class_trainers (
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  person_id uuid NOT NULL,
  PRIMARY KEY (class_id, engagement_id)
);
-- Estado = último evento (seq contínuo); nunca campo editável.
CREATE TABLE public.dev_class_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  seq int NOT NULL CHECK (seq >= 1),
  status text NOT NULL CHECK (status IN ('planejada','inscricoes-abertas','inscricoes-encerradas','em-andamento','concluida','cancelada')),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, seq),
  CHECK (seq = 1 OR reason IS NOT NULL OR status <> 'cancelada')
);
GRANT SELECT ON public.dev_class_details, public.dev_class_trainers, public.dev_class_status_events TO authenticated;
GRANT ALL ON public.dev_class_details, public.dev_class_trainers, public.dev_class_status_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_class_details, public.dev_class_trainers, public.dev_class_status_events FROM authenticated, anon;
ALTER TABLE public.dev_class_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_class_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_class_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev class details read" ON public.dev_class_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev class trainers read" ON public.dev_class_trainers FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev class status read" ON public.dev_class_status_events FOR SELECT TO authenticated USING (true);
CREATE TRIGGER devcd_immutable BEFORE UPDATE OR DELETE ON public.dev_class_details FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devct_immutable BEFORE UPDATE OR DELETE ON public.dev_class_trainers FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcs_immutable BEFORE UPDATE OR DELETE ON public.dev_class_status_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_dev_formative_class(_course_version uuid, _school text, _label text, _seats int, _starts date, _ends date,
  _location text, _audience text, _trainer_engagements uuid[], _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _e uuid; _eng public.institutional_engagements;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_classes WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _seats IS NULL THEN RAISE EXCEPTION 'dev:seats-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_course_catalog_contents WHERE course_version_id = _course_version) THEN RAISE EXCEPTION 'dev:course-without-catalog'; END IF;
  IF coalesce(cardinality(_trainer_engagements), 0) = 0 THEN RAISE EXCEPTION 'dev:trainer-required'; END IF;
  _id := public.record_dev_class(_course_version, _school, _label, _seats, _starts, _ends, _key);
  INSERT INTO public.dev_class_details(class_id, location, audience) VALUES (_id, btrim(_location), btrim(_audience));
  FOREACH _e IN ARRAY _trainer_engagements LOOP
    SELECT * INTO _eng FROM public.institutional_engagements WHERE id = _e;
    IF NOT FOUND OR _eng.valid_from > _starts OR (_eng.valid_until IS NOT NULL AND _eng.valid_until < _starts) THEN RAISE EXCEPTION 'dev:trainer-not-active'; END IF;
    INSERT INTO public.dev_class_trainers(class_id, engagement_id, person_id) VALUES (_id, _e, _eng.person_id) ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.dev_class_status_events(class_id, seq, status, author_person, idempotency_key) VALUES (_id, 1, 'planejada', _p, _key || ':status:1');
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_class_status(_class uuid, _expected_seq int, _status text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last public.dev_class_status_events;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_class_status_events WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  PERFORM 1 FROM public.dev_classes WHERE id = _class FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _last FROM public.dev_class_status_events WHERE class_id = _class ORDER BY seq DESC LIMIT 1;
  IF _last.id IS NULL THEN RAISE EXCEPTION 'dev:legacy-class'; END IF;
  IF _last.seq <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  IF NOT ((_last.status, _status) IN (('planejada','inscricoes-abertas'),('inscricoes-abertas','inscricoes-encerradas'),
      ('inscricoes-encerradas','inscricoes-abertas'),('inscricoes-encerradas','em-andamento'),('em-andamento','concluida'))
      OR (_status = 'cancelada' AND _last.status NOT IN ('concluida','cancelada'))) THEN RAISE EXCEPTION 'dev:transition'; END IF;
  IF _status IN ('cancelada','inscricoes-abertas') AND _last.status <> 'planejada' AND length(btrim(coalesce(_reason,''))) < 10 THEN RAISE EXCEPTION 'dev:reason-required'; END IF;
  INSERT INTO public.dev_class_status_events(class_id, seq, status, reason, author_person, idempotency_key)
  VALUES (_class, _last.seq + 1, _status, nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

REVOKE EXECUTE ON FUNCTION public.record_dev_formative_class(uuid,text,text,int,date,date,text,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_dev_formative_class(uuid,text,text,int,date,date,text,text,uuid[],text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_dev_class_status(uuid,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_dev_class_status(uuid,int,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_dev_class(uuid,text,text,int,date,date,text) FROM authenticated;
COMMENT ON FUNCTION public.record_dev_class(uuid,text,text,int,date,date,text) IS 'DEPRECATED for clients: use record_dev_formative_class (L08)';