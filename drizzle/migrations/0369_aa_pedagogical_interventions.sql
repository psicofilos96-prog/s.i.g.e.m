CREATE TABLE public.aa_intervention_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL DEFAULT gen_random_uuid(), version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.aa_intervention_versions(id),
  school_id text NOT NULL, class_id text, segment text NOT NULL CHECK (length(btrim(segment)) > 0),
  is_infant boolean NOT NULL DEFAULT false,
  origin_kind text NOT NULL CHECK (origin_kind IN ('sia-instrumento-aprovado','avaliacao-externa','frequencia-diario','rendimento-diario','diagnostico-registrado')),
  origin_ref text NOT NULL CHECK (length(btrim(origin_ref)) > 0),
  sipe_plan_version_id uuid,
  objective text NOT NULL CHECK (length(btrim(objective)) >= 5 AND length(objective) <= 4000),
  responsible_label text, due_date date,
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) >= 5)));
COMMENT ON TABLE public.aa_intervention_versions IS 'A&A Lote 6: plano de intervenção pedagógica; nunca decide promoção/retenção (EI ou qualquer etapa).';

CREATE TABLE public.aa_intervention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_logical_id uuid NOT NULL, seq int NOT NULL CHECK (seq >= 1), school_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('acao','evidencia','devolutiva','progresso','reavaliacao','encerramento')),
  body text NOT NULL CHECK (length(btrim(body)) >= 3 AND length(body) <= 4000),
  responsible_label text, due_date date,
  progress text CHECK (progress IN ('nao-avaliado','sem-avanco','avanco-parcial','avancou')),
  reassessment_ref text,
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_logical_id, seq),
  CHECK (kind <> 'progresso' OR progress IS NOT NULL),
  CHECK (kind <> 'reavaliacao' OR length(btrim(coalesce(reassessment_ref,''))) > 0));

GRANT SELECT ON public.aa_intervention_versions, public.aa_intervention_events TO authenticated;
GRANT ALL ON public.aa_intervention_versions, public.aa_intervention_events TO service_role;
ALTER TABLE public.aa_intervention_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_intervention_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_int_v_read ON public.aa_intervention_versions FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-intervencao-pedagogica')
  OR public.has_school_capability('acompanhar-intervencao-pedagogica', school_id)
  OR public.has_school_capability('registrar-intervencao-pedagogica', school_id));
CREATE POLICY aa_int_e_read ON public.aa_intervention_events FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-intervencao-pedagogica')
  OR public.has_school_capability('acompanhar-intervencao-pedagogica', school_id)
  OR public.has_school_capability('registrar-intervencao-pedagogica', school_id));

CREATE FUNCTION public.aa_intervention_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'aa-intervention:append-only'; END $$;
CREATE TRIGGER aa_int_v_ro BEFORE UPDATE OR DELETE ON public.aa_intervention_versions FOR EACH ROW EXECUTE FUNCTION public.aa_intervention_append_only();
CREATE TRIGGER aa_int_e_ro BEFORE UPDATE OR DELETE ON public.aa_intervention_events FOR EACH ROW EXECUTE FUNCTION public.aa_intervention_append_only();

CREATE FUNCTION public.aa_record_intervention(_logical uuid, _expected_version int, _school text, _class text, _segment text, _is_infant boolean,
  _origin_kind text, _origin_ref text, _sipe uuid, _objective text, _responsible text, _due date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.aa_intervention_versions; nid uuid; last_ev text; lid uuid := coalesce(_logical, gen_random_uuid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa-intervention:unauthenticated'; END IF;
  IF NOT public.has_school_capability('registrar-intervencao-pedagogica', _school) THEN RAISE EXCEPTION 'aa-intervention:forbidden'; END IF;
  IF _origin_kind = 'sia-instrumento-aprovado' THEN
    SELECT event INTO last_ev FROM public.teacher_work_review_events
      WHERE subject_kind = 'instrumento' AND subject_version_id::text = _origin_ref AND school_id::text = _school ORDER BY seq DESC LIMIT 1;
    IF last_ev IS DISTINCT FROM 'aprovado' THEN RAISE EXCEPTION 'aa-intervention:sia-not-approved'; END IF;
  END IF;
  IF _sipe IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions WHERE id = _sipe) THEN RAISE EXCEPTION 'aa-intervention:sipe-not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('aaint' || lid::text));
  SELECT * INTO b FROM public.aa_intervention_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
  IF coalesce(b.version, 0) <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'aa-intervention:stale-base'; END IF;
  IF b.id IS NOT NULL AND b.school_id <> _school THEN RAISE EXCEPTION 'aa-intervention:school-immutable'; END IF;
  INSERT INTO public.aa_intervention_versions(logical_id, version, supersedes_id, school_id, class_id, segment, is_infant, origin_kind, origin_ref,
    sipe_plan_version_id, objective, responsible_label, due_date, reason, author_user_id)
  VALUES (lid, coalesce(b.version, 0) + 1, b.id, _school, nullif(btrim(_class),''), btrim(_segment), coalesce(_is_infant,false), _origin_kind, btrim(_origin_ref),
    _sipe, btrim(_objective), nullif(btrim(_responsible),''), _due, nullif(btrim(_reason),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.aa_record_intervention_event(_plan uuid, _expected_seq int, _kind text, _body text, _responsible text, _due date, _progress text, _reassessment text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.aa_intervention_versions; cur int; closed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa-intervention:unauthenticated'; END IF;
  SELECT * INTO p FROM public.aa_intervention_versions WHERE logical_id = _plan ORDER BY version DESC LIMIT 1;
  IF p.id IS NULL THEN RAISE EXCEPTION 'aa-intervention:not-found'; END IF;
  IF NOT public.has_school_capability('registrar-intervencao-pedagogica', p.school_id) THEN RAISE EXCEPTION 'aa-intervention:forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('aaintev' || _plan::text));
  SELECT coalesce(max(seq),0), bool_or(kind = 'encerramento') INTO cur, closed FROM public.aa_intervention_events WHERE plan_logical_id = _plan;
  IF cur <> _expected_seq THEN RAISE EXCEPTION 'aa-intervention:stale-base'; END IF;
  IF coalesce(closed,false) THEN RAISE EXCEPTION 'aa-intervention:closed'; END IF;
  INSERT INTO public.aa_intervention_events(plan_logical_id, seq, school_id, kind, body, responsible_label, due_date, progress, reassessment_ref, author_user_id)
  VALUES (_plan, cur + 1, p.school_id, _kind, btrim(_body), nullif(btrim(_responsible),''), _due, _progress, nullif(btrim(_reassessment),''), auth.uid());
  RETURN cur + 1;
END $$;

REVOKE ALL ON FUNCTION public.aa_record_intervention(uuid,int,text,text,text,boolean,text,text,uuid,text,text,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aa_record_intervention_event(uuid,int,text,text,text,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_record_intervention(uuid,int,text,text,text,boolean,text,text,uuid,text,text,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aa_record_intervention_event(uuid,int,text,text,text,date,text,text) TO authenticated;