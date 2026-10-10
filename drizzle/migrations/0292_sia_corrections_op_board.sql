-- LOTE 8: correção SIA revisada por humano (+ lançamento no Diário) e Quadro Permanente OP por etapa.
CREATE TABLE public.sia_card_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text NOT NULL,
  instrument_version_id uuid NOT NULL REFERENCES public.teacher_instrument_versions(id),
  school_id text NOT NULL,
  class_id text NOT NULL,
  variant text NOT NULL CHECK (variant ~ '^[A-H]?$'),
  student_id text NOT NULL,
  card_code text NOT NULL,
  image_path text NOT NULL,
  image_sha256 text NOT NULL CHECK (image_sha256 ~ '^[0-9a-f]{64}$'),
  print_fingerprint text NOT NULL CHECK (print_fingerprint ~ '^[0-9a-f]{64}$'),
  approved_review_event_id uuid NOT NULL REFERENCES public.teacher_work_review_events(id),
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  hits integer NOT NULL CHECK (hits >= 0),
  total integer NOT NULL CHECK (total > 0 AND hits <= total),
  human_confirmed boolean NOT NULL CHECK (human_confirmed),
  supersedes_id uuid UNIQUE REFERENCES public.sia_card_corrections(id),
  change_reason text,
  diary_batch_act_id uuid,
  reviewer_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sia_card_corrections_ins_idx ON public.sia_card_corrections(instrument_version_id, student_id);
GRANT SELECT ON public.sia_card_corrections TO authenticated;
GRANT ALL ON public.sia_card_corrections TO service_role;
ALTER TABLE public.sia_card_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sia corrections reviewer reads" ON public.sia_card_corrections FOR SELECT TO authenticated USING (reviewer_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_sia_card_correction(
  _instrument_version uuid, _variant text, _student text, _card_code text,
  _image_path text, _image_sha256 text, _print_fingerprint text,
  _lines jsonb, _human_confirmed boolean, _expected_head uuid, _reason text, _launch_to_diary boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.teacher_instrument_versions; rv public.teacher_work_review_events; head uuid;
  _hits int; _total int; _new uuid; _batch uuid; _closing uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _human_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'sia:human-review-required'; END IF;
  SELECT * INTO v FROM public.teacher_instrument_versions WHERE id = _instrument_version;
  IF v.id IS NULL THEN RAISE EXCEPTION 'sia:instrument-unknown'; END IF;
  IF v.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'sia:only-author-corrects'; END IF;
  IF v.status <> 'publicado' THEN RAISE EXCEPTION 'sia:instrument-not-published'; END IF;
  SELECT * INTO rv FROM public.teacher_work_review_events e WHERE e.subject_kind = 'instrumento' AND e.subject_id = v.instrument_id ORDER BY e.seq DESC LIMIT 1;
  IF rv.id IS NULL OR rv.event <> 'aprovado' OR rv.subject_version_id <> v.id THEN RAISE EXCEPTION 'sia:not-approved-by-op'; END IF;
  IF coalesce(btrim(_student),'') = '' OR coalesce(btrim(_card_code),'') = '' THEN RAISE EXCEPTION 'sia:student-required'; END IF;
  IF split_part(coalesce(_image_path,''), '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'sia:image-required'; END IF;
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'sia:lines-required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_lines) l WHERE jsonb_typeof(l->'correct') <> 'boolean') THEN RAISE EXCEPTION 'sia:unresolved-lines'; END IF;
  SELECT count(*) FILTER (WHERE (l->>'correct')::boolean), count(*) INTO _hits, _total FROM jsonb_array_elements(_lines) l;
  PERFORM pg_advisory_xact_lock(hashtext('sia-corr:' || v.id || ':' || _student));
  SELECT c.id INTO head FROM public.sia_card_corrections c WHERE c.instrument_version_id = v.id AND c.student_id = _student
    AND NOT EXISTS (SELECT 1 FROM public.sia_card_corrections s WHERE s.supersedes_id = c.id);
  IF head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'sia:head-changed'; END IF;
  IF head IS NOT NULL AND coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'sia:reason-required'; END IF;
  IF _launch_to_diary THEN
    IF v.results_instrument_id IS NULL THEN RAISE EXCEPTION 'sia:no-diary-instrument'; END IF;
    _closing := public.current_closing_for_instrument(v.results_instrument_id);
    _batch := public.register_assessment_results(v.results_instrument_id, 'sia-' || v.id || '-' || _student || '-' || coalesce(head::text,'0'),
      NULL, NULL, _closing,
      jsonb_build_array(jsonb_build_object('studentId', _student, 'value', jsonb_build_object('kind','numerica','value',_hits), 'origin', 'sia-cartao', 'expectedBaseVersionId', NULL)));
  END IF;
  INSERT INTO public.sia_card_corrections(instrument_id, instrument_version_id, school_id, class_id, variant, student_id, card_code, image_path, image_sha256,
    print_fingerprint, approved_review_event_id, lines, hits, total, human_confirmed, supersedes_id, change_reason, diary_batch_act_id, reviewer_user_id)
  VALUES (v.instrument_id, v.id, v.school_id, v.class_id, coalesce(_variant,''), _student, _card_code, _image_path, lower(_image_sha256),
    lower(_print_fingerprint), rv.id, _lines, _hits, _total, true, head, nullif(btrim(_reason),''), _batch, auth.uid())
  RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.record_sia_card_correction(uuid,text,text,text,text,text,text,jsonb,boolean,uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sia_card_correction(uuid,text,text,text,text,text,text,jsonb,boolean,uuid,text,boolean) TO authenticated;

CREATE TABLE public.op_permanent_board_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key text NOT NULL CHECK (btrim(stage_key) <> ''),
  version integer NOT NULL CHECK (version > 0),
  supersedes_id uuid UNIQUE REFERENCES public.op_permanent_board_versions(id),
  title text NOT NULL CHECK (btrim(title) <> ''),
  sections jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array'),
  change_reason text,
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_key, version)
);
GRANT SELECT ON public.op_permanent_board_versions TO authenticated;
GRANT ALL ON public.op_permanent_board_versions TO service_role;
ALTER TABLE public.op_permanent_board_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op board readable by signed in" ON public.op_permanent_board_versions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_op_permanent_board_version(_stage text, _expected_head uuid, _title text, _sections jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head public.op_permanent_board_versions; _new uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.has_capability('manter-quadro-permanente-op', NULL, NULL) THEN RAISE EXCEPTION 'board:capability-missing'; END IF;
  IF coalesce(btrim(_stage),'') = '' OR coalesce(btrim(_title),'') = '' THEN RAISE EXCEPTION 'board:fields-required'; END IF;
  IF jsonb_typeof(_sections) <> 'array' OR jsonb_array_length(_sections) = 0 THEN RAISE EXCEPTION 'board:sections-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('opboard:' || _stage));
  SELECT * INTO head FROM public.op_permanent_board_versions b WHERE b.stage_key = _stage ORDER BY b.version DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'board:head-changed'; END IF;
  IF head.id IS NOT NULL AND coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'board:reason-required'; END IF;
  INSERT INTO public.op_permanent_board_versions(stage_key, version, supersedes_id, title, sections, change_reason, author_user_id)
  VALUES (btrim(_stage), coalesce(head.version,0)+1, head.id, btrim(_title), _sections, nullif(btrim(_reason),''), auth.uid()) RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.record_op_permanent_board_version(text,uuid,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_op_permanent_board_version(text,uuid,text,jsonb,text) TO authenticated;