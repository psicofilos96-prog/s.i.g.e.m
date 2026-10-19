-- Direção: processo de reclassificação/avanço (LDB art. 23 §1º) como cadeia imutável de etapas.
-- O despacho não altera a matrícula: a mudança de turma/etapa continua sendo ato da Secretaria.
CREATE TABLE public.school_reclassification_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  process_id uuid NOT NULL,
  seq int NOT NULL CHECK (seq BETWEEN 1 AND 5),
  step text NOT NULL CHECK (step IN ('abertura','comissao','avaliacao','ata','despacho')),
  student_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reclassificacao','avanco')),
  content text NOT NULL CHECK (length(btrim(content)) >= 3 AND length(content) <= 8000),
  outcome text NULL CHECK (outcome IS NULL OR outcome IN ('deferido','indeferido')),
  recorded_by uuid NOT NULL,
  recorded_by_principal_id uuid NOT NULL REFERENCES public.institutional_sector_principals(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE,
  UNIQUE (process_id, seq)
);
REVOKE ALL ON public.school_reclassification_steps FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.school_reclassification_steps ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER srs_no_change BEFORE UPDATE OR DELETE ON public.school_reclassification_steps FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();

CREATE OR REPLACE FUNCTION public.direcao_record_reclassification_step(
  _school text, _process uuid, _step text, _student text, _kind text, _content text, _outcome text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr uuid; cur int; first record; expected text; nid uuid;
  order_ text[] := ARRAY['abertura','comissao','avaliacao','ata','despacho'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'reclass:auth-required'; END IF;
  SELECT id INTO pr FROM public.institutional_sector_principals
   WHERE auth_user_id = auth.uid() AND station_code = 'direcao_escolar' AND school_id = _school;
  IF pr IS NULL THEN RAISE EXCEPTION 'reclass:direcao-only'; END IF;
  SELECT process_id INTO nid FROM public.school_reclassification_steps WHERE idempotency_key = _key;
  IF nid IS NOT NULL THEN RETURN nid; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('srs:' || _process::text));
  SELECT coalesce(max(seq), 0) INTO cur FROM public.school_reclassification_steps WHERE process_id = _process;
  IF cur >= 5 THEN RAISE EXCEPTION 'reclass:processo-encerrado'; END IF;
  expected := order_[cur + 1];
  IF _step <> expected THEN RAISE EXCEPTION 'reclass:etapa-fora-de-ordem:%', expected; END IF;
  IF cur = 0 THEN
    IF _kind NOT IN ('reclassificacao','avanco') THEN RAISE EXCEPTION 'reclass:tipo-invalido'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id = _school AND e.student_id = _student) THEN
      RAISE EXCEPTION 'reclass:estudante-fora-da-escola'; END IF;
  ELSE
    SELECT * INTO first FROM public.school_reclassification_steps WHERE process_id = _process AND seq = 1;
    IF first.school_id <> _school THEN RAISE EXCEPTION 'reclass:outra-escola'; END IF;
    _student := first.student_id; _kind := first.kind;
  END IF;
  IF _step = 'despacho' AND (_outcome IS NULL) THEN RAISE EXCEPTION 'reclass:despacho-exige-resultado'; END IF;
  IF _step <> 'despacho' THEN _outcome := NULL; END IF;
  INSERT INTO public.school_reclassification_steps(school_id, process_id, seq, step, student_id, kind, content, outcome, recorded_by, recorded_by_principal_id, idempotency_key)
  VALUES (_school, _process, cur + 1, _step, _student, _kind, btrim(_content), _outcome, auth.uid(), pr, _key);
  RETURN _process;
END $$;
REVOKE ALL ON FUNCTION public.direcao_record_reclassification_step(text, uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_record_reclassification_step(text, uuid, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_reclassifications_at(_school text)
RETURNS TABLE(process_id uuid, seq int, step text, student_id text, student_name text, kind text, content text, outcome text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sdo_can_read(_school) THEN RAISE EXCEPTION 'reclass:not-authorized'; END IF;
  RETURN QUERY SELECT s.process_id, s.seq, s.step, s.student_id,
    coalesce((SELECT v.civil_name FROM public.student_identity_versions v WHERE v.student_id = s.student_id ORDER BY v.version DESC LIMIT 1),
             (SELECT i.display_name FROM public.institutional_students i WHERE i.id = s.student_id), s.student_id),
    s.kind, s.content, s.outcome, s.recorded_at
  FROM public.school_reclassification_steps s WHERE s.school_id = _school ORDER BY s.recorded_at DESC, s.seq LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.school_reclassifications_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_reclassifications_at(text) TO authenticated;