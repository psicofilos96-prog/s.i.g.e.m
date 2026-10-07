-- N10.2.3 — Rascunho EI no servidor (só o autor) + envio/análise OP de plano (SIPE) e prova (SIA).
CREATE TABLE public.infant_experience_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_key uuid NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 200000),
  discarded boolean NOT NULL DEFAULT false,
  author_user_id uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_key, seq)
);
CREATE INDEX infant_experience_drafts_author_idx ON public.infant_experience_drafts (author_user_id, draft_key, seq DESC);
GRANT SELECT, INSERT ON public.infant_experience_drafts TO authenticated;
GRANT ALL ON public.infant_experience_drafts TO service_role;
ALTER TABLE public.infant_experience_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autor lê o próprio rascunho" ON public.infant_experience_drafts FOR SELECT TO authenticated USING (author_user_id = auth.uid());
CREATE POLICY "Autor grava o próprio rascunho" ON public.infant_experience_drafts FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.infant_experience_drafts d WHERE d.draft_key = infant_experience_drafts.draft_key AND d.author_user_id <> auth.uid()));
CREATE OR REPLACE FUNCTION public.infant_experience_drafts_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'ei-draft:append-only'; END $$;
CREATE TRIGGER infant_experience_drafts_immutable BEFORE UPDATE OR DELETE ON public.infant_experience_drafts
  FOR EACH ROW EXECUTE FUNCTION public.infant_experience_drafts_immutable();

CREATE TABLE public.teacher_work_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind text NOT NULL CHECK (subject_kind IN ('plano','instrumento')),
  subject_id text NOT NULL,
  subject_version_id uuid NOT NULL,
  school_id text NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  event text NOT NULL CHECK (event IN ('enviado','ajuste-solicitado','aprovado')),
  comment text CHECK (comment IS NULL OR length(comment) <= 5000),
  actor_user_id uuid NOT NULL,
  actor_engagement uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_kind, subject_id, seq),
  CHECK (event <> 'ajuste-solicitado' OR length(btrim(coalesce(comment, ''))) >= 3)
);
CREATE INDEX teacher_work_review_by_school ON public.teacher_work_review_events (school_id, subject_kind, subject_id, seq DESC);
GRANT ALL ON public.teacher_work_review_events TO service_role;
ALTER TABLE public.teacher_work_review_events ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.teacher_work_review_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'review:append-only'; END $$;
CREATE TRIGGER teacher_work_review_events_immutable BEFORE UPDATE OR DELETE ON public.teacher_work_review_events
  FOR EACH ROW EXECUTE FUNCTION public.teacher_work_review_immutable();

-- Versão do objeto: autor, escola, título e se é a cabeça da cadeia.
CREATE OR REPLACE FUNCTION public.teacher_work_subject(_kind text, _subject text, _version uuid)
RETURNS TABLE(author_user_id uuid, school_id text, title text, is_head boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.author_user_id, p.school_id, p.title,
         NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions n WHERE n.plan_id = p.plan_id AND n.version > p.version)
    FROM public.teaching_plan_versions p WHERE _kind = 'plano' AND p.id = _version AND p.plan_id = _subject
  UNION ALL
  SELECT i.author_user_id, i.school_id, i.title,
         NOT EXISTS (SELECT 1 FROM public.teacher_instrument_versions n WHERE n.instrument_id = i.instrument_id AND n.version > i.version)
    FROM public.teacher_instrument_versions i WHERE _kind = 'instrumento' AND i.id = _version AND i.instrument_id = _subject
$$;
REVOKE ALL ON FUNCTION public.teacher_work_subject(text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.teacher_work_reviewer(_school text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.engagement_id FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'revisar-trabalho-docente' AND c.policy_id IS NOT NULL
     AND (c.school_id = _school OR c.scope_level = 'rede')
   ORDER BY c.engagement_id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.teacher_work_reviewer(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_teacher_work_review(_kind text, _subject text, _version uuid, _expected_seq integer, _event text, _comment text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s record; head public.teacher_work_review_events; g uuid; nxt integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _event NOT IN ('enviado','ajuste-solicitado','aprovado') THEN RAISE EXCEPTION 'review:event-invalid'; END IF;
  SELECT * INTO s FROM public.teacher_work_subject(_kind, _subject, _version);
  IF s.school_id IS NULL THEN RAISE EXCEPTION 'review:subject-unknown'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('twr:' || _kind || ':' || _subject));
  SELECT * INTO head FROM public.teacher_work_review_events e WHERE e.subject_kind = _kind AND e.subject_id = _subject ORDER BY e.seq DESC LIMIT 1;
  IF coalesce(head.seq, 0) <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'review:head-changed'; END IF;
  IF _event = 'enviado' THEN
    IF s.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'review:only-author-submits'; END IF;
    IF NOT s.is_head THEN RAISE EXCEPTION 'review:version-superseded'; END IF;
    IF head.id IS NOT NULL AND head.event = 'enviado' THEN RAISE EXCEPTION 'review:already-submitted'; END IF;
    IF head.id IS NOT NULL AND head.event = 'aprovado' AND head.subject_version_id = _version THEN RAISE EXCEPTION 'review:already-approved'; END IF;
  ELSE
    IF head.id IS NULL OR head.event <> 'enviado' OR head.subject_version_id <> _version THEN RAISE EXCEPTION 'review:not-awaiting'; END IF;
    IF s.author_user_id = auth.uid() THEN RAISE EXCEPTION 'review:self-review'; END IF;
    g := public.teacher_work_reviewer(s.school_id);
    IF g IS NULL THEN RAISE EXCEPTION 'review:capability-missing'; END IF;
  END IF;
  nxt := coalesce(head.seq, 0) + 1;
  INSERT INTO public.teacher_work_review_events(subject_kind, subject_id, subject_version_id, school_id, seq, event, comment, actor_user_id, actor_engagement)
  VALUES (_kind, _subject, _version, s.school_id, nxt, _event, nullif(btrim(_comment), ''), auth.uid(), g);
  RETURN nxt;
END $$;
REVOKE ALL ON FUNCTION public.record_teacher_work_review(text, text, uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_teacher_work_review(text, text, uuid, integer, text, text) TO authenticated;

-- Histórico de um objeto: autor de qualquer versão ou revisor da escola.
CREATE OR REPLACE FUNCTION public.teacher_work_reviews_of(_kind text, _subject text)
RETURNS TABLE(seq integer, event text, subject_version_id uuid, comment text, by_author boolean, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE sch text; is_author boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT x.school_id, bool_or(x.author_user_id = auth.uid()) INTO sch, is_author FROM (
    SELECT p.school_id, p.author_user_id FROM public.teaching_plan_versions p WHERE _kind = 'plano' AND p.plan_id = _subject
    UNION ALL SELECT i.school_id, i.author_user_id FROM public.teacher_instrument_versions i WHERE _kind = 'instrumento' AND i.instrument_id = _subject) x
  GROUP BY x.school_id LIMIT 1;
  IF sch IS NULL THEN RETURN; END IF;
  IF NOT coalesce(is_author, false) AND public.teacher_work_reviewer(sch) IS NULL THEN RAISE EXCEPTION 'review:access-denied'; END IF;
  RETURN QUERY SELECT e.seq, e.event, e.subject_version_id, e.comment,
      (e.actor_user_id = (SELECT s.author_user_id FROM public.teacher_work_subject(_kind, _subject, e.subject_version_id) s)), e.recorded_at
    FROM public.teacher_work_review_events e WHERE e.subject_kind = _kind AND e.subject_id = _subject ORDER BY e.seq;
END $$;
REVOKE ALL ON FUNCTION public.teacher_work_reviews_of(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_work_reviews_of(text, text) TO authenticated;

-- Fila da OP: objetos cujo último evento é "enviado", só com a capacidade de revisão.
CREATE OR REPLACE FUNCTION public.teacher_work_review_queue(_school text)
RETURNS TABLE(result_kind text, subject_kind text, subject_id text, subject_version_id uuid, title text, seq integer, submitted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR _school IS NULL THEN result_kind := 'invalid'; RETURN NEXT; RETURN; END IF;
  IF public.teacher_work_reviewer(_school) IS NULL THEN result_kind := 'access-denied'; RETURN NEXT; RETURN; END IF;
  RETURN QUERY SELECT 'item'::text, h.subject_kind, h.subject_id, h.subject_version_id,
      (SELECT s.title FROM public.teacher_work_subject(h.subject_kind, h.subject_id, h.subject_version_id) s), h.seq, h.recorded_at
    FROM (SELECT DISTINCT ON (e.subject_kind, e.subject_id) e.* FROM public.teacher_work_review_events e
           WHERE e.school_id = _school ORDER BY e.subject_kind, e.subject_id, e.seq DESC) h
   WHERE h.event = 'enviado' ORDER BY h.recorded_at;
END $$;
REVOKE ALL ON FUNCTION public.teacher_work_review_queue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_work_review_queue(text) TO authenticated;