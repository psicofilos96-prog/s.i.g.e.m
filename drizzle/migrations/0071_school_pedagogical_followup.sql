-- Acompanhamento da escola (Orientação Pedagógica / Direção). Registros próprios, versionados, nunca cópia de fatos
-- do Diário/Secretaria e nunca prontuário clínico (sem campos de diagnóstico, saúde ou CID; texto limitado).
-- Capabilities escolares sem regra de política: fechadas até decisão do proprietário.
--   registrar-acompanhamento-pedagogico (escola) · consultar-acompanhamento-pedagogico (escola)
-- Categoria vem de catálogo homologado ('categoria-de-acompanhamento-pedagogico'), sem valor semeado.

CREATE FUNCTION public.school_followup_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('registrar-acompanhamento-pedagogico','consultar-acompanhamento-pedagogico') THEN RAISE EXCEPTION 'followup:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'followup:school-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.school_followup_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.school_pedagogical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.school_pedagogical_records(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','anulacao')),
  school_id text NOT NULL,
  subject_kind text NOT NULL CHECK (subject_kind IN ('estudante','turma','escola')),
  subject_id text NOT NULL,
  category_scheme_id text NOT NULL,
  category_value_id text NOT NULL,
  category_value_version integer NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 4000),
  visibility text NOT NULL CHECK (visibility IN ('autoria','acompanhamento-da-escola')),
  occurred_on date NOT NULL,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id text,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE UNIQUE INDEX spr_one_successor ON public.school_pedagogical_records (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX spr_subject ON public.school_pedagogical_records (school_id, subject_kind, subject_id);
REVOKE ALL ON public.school_pedagogical_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.school_pedagogical_records TO service_role;
ALTER TABLE public.school_pedagogical_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER spr_append_only BEFORE UPDATE OR DELETE ON public.school_pedagogical_records FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE FUNCTION public.record_school_pedagogical_record(_base_id uuid, _kind text, _school text, _subject_kind text, _subject_id text,
  _category_value text, _body text, _visibility text, _occurred_on date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.school_pedagogical_records; cat record; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'followup:kind-invalid'; END IF;
  IF _kind = 'registro' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'followup:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.school_pedagogical_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'followup:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_pedagogical_records WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'followup:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'followup:already-annulled'; END IF;
    IF base.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'followup:only-author-rectifies'; END IF;
    _school := base.school_id; _subject_kind := base.subject_kind; _subject_id := base.subject_id;
    IF _kind = 'anulacao' THEN _category_value := base.category_value_id; _body := base.body; _visibility := base.visibility; _occurred_on := base.occurred_on; END IF;
  END IF;
  g := public.school_followup_grant('registrar-acompanhamento-pedagogico', _school);
  IF _subject_kind = 'estudante' AND NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _subject_id AND e.school_id = _school) THEN
    RAISE EXCEPTION 'followup:subject-not-in-school'; END IF;
  IF _subject_kind = 'turma' AND NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _subject_id AND c.school_id = _school) THEN
    RAISE EXCEPTION 'followup:subject-not-in-school'; END IF;
  IF _subject_kind = 'escola' AND _subject_id <> _school THEN RAISE EXCEPTION 'followup:subject-not-in-school'; END IF;
  SELECT d.value_id, d.version INTO cat FROM public.attribute_value_definitions d
   WHERE d.scheme_id = 'categoria-de-acompanhamento-pedagogico' AND d.value_id = _category_value AND d.status = 'homologado'
   ORDER BY d.version DESC LIMIT 1;
  IF cat.value_id IS NULL THEN RAISE EXCEPTION 'followup:category-not-homologated'; END IF;
  IF _occurred_on IS NULL OR _occurred_on > CURRENT_DATE THEN RAISE EXCEPTION 'followup:occurred-on-invalid'; END IF;
  INSERT INTO public.school_pedagogical_records(logical_id, version, supersedes_id, event_kind, school_id, subject_kind, subject_id,
    category_scheme_id, category_value_id, category_value_version, body, visibility, occurred_on, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _school, _subject_kind, _subject_id,
    'categoria-de-acompanhamento-pedagogico', cat.value_id, cat.version, _body, _visibility, _occurred_on, nullif(btrim(_reason),''),
    auth.uid(), public.current_person_id(), g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_school_pedagogical_record(uuid,text,text,text,text,text,text,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_school_pedagogical_record(uuid,text,text,text,text,text,text,text,date,text) TO authenticated;

-- Leitura: cabeças conhecidas até _known_at (ou histórico completo de um registro lógico). Visibilidade 'autoria' só ao autor.
CREATE FUNCTION public.school_pedagogical_records_at(_school text, _subject_kind text, _subject_id text, _known_at timestamptz, _logical_id uuid)
RETURNS SETOF public.school_pedagogical_records LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.school_followup_grant('consultar-acompanhamento-pedagogico', _school);
  RETURN QUERY SELECT r.* FROM public.school_pedagogical_records r
   WHERE r.school_id = _school AND r.recorded_at <= k
     AND (_subject_kind IS NULL OR r.subject_kind = _subject_kind) AND (_subject_id IS NULL OR r.subject_id = _subject_id)
     AND (r.visibility = 'acompanhamento-da-escola' OR r.author_user_id = auth.uid())
     AND (CASE WHEN _logical_id IS NOT NULL THEN r.logical_id = _logical_id
          ELSE NOT EXISTS (SELECT 1 FROM public.school_pedagogical_records s WHERE s.supersedes_id = r.id AND s.recorded_at <= k) END)
   ORDER BY r.occurred_on DESC, r.recorded_at DESC
   LIMIT 500;
END $fn$;
REVOKE ALL ON FUNCTION public.school_pedagogical_records_at(text,text,text,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_pedagogical_records_at(text,text,text,timestamptz,uuid) TO authenticated;