-- SIA.READ.1: correção com pontuação por pesos da versão aprovada, discursivas com nota manual,
-- "não lida" nunca vira errada e lançamento no Diário sem duplicação.
ALTER TABLE public.sia_card_corrections ADD COLUMN IF NOT EXISTS score numeric;
ALTER TABLE public.sia_card_corrections ADD COLUMN IF NOT EXISTS max_score numeric;
ALTER TABLE public.sia_card_corrections ADD COLUMN IF NOT EXISTS unread_count integer;
ALTER TABLE public.sia_card_corrections ADD COLUMN IF NOT EXISTS scoring_version text;

CREATE OR REPLACE FUNCTION public.record_sia_card_correction_v2(
  _instrument_version uuid, _variant text, _student text, _card_code text,
  _image_path text, _image_sha256 text, _print_fingerprint text,
  _lines jsonb, _human_confirmed boolean, _expected_head uuid, _reason text, _launch_to_diary boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.teacher_instrument_versions; rv public.teacher_work_review_events; head uuid;
  l jsonb; it jsonb; w numeric; st text; pts numeric; _hits int := 0; _total int; _unread int := 0;
  _score numeric := 0; _max numeric := 0; _wmissing boolean := false; _new uuid; _batch uuid; _closing uuid;
  _cur record; _expected_ids text[]; _given_ids text[];
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
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes c WHERE c.class_id = v.class_id AND c.student_id = _student) THEN RAISE EXCEPTION 'sia:student-not-in-class'; END IF;
  IF split_part(coalesce(_image_path,''), '/', 1) <> auth.uid()::text OR coalesce(_image_sha256,'') !~ '^[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'sia:image-required'; END IF;
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'sia:lines-required'; END IF;
  SELECT array_agg(x->>'item_version_id' ORDER BY x->>'item_version_id') INTO _expected_ids FROM jsonb_array_elements(v.items) x;
  SELECT array_agg(x->>'itemVersionId' ORDER BY x->>'itemVersionId') INTO _given_ids FROM jsonb_array_elements(_lines) x;
  IF _expected_ids IS DISTINCT FROM _given_ids THEN RAISE EXCEPTION 'sia:lines-mismatch'; END IF;
  _total := jsonb_array_length(_lines);
  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    st := l->>'status';
    IF st IS NULL OR st NOT IN ('certa','errada','em-branco','nao-lida','anulada','pontuada') THEN RAISE EXCEPTION 'sia:unresolved-lines'; END IF;
    SELECT x INTO it FROM jsonb_array_elements(v.items) x WHERE x->>'item_version_id' = l->>'itemVersionId' LIMIT 1;
    w := CASE WHEN jsonb_typeof(it->'weight') = 'number' AND (it->>'weight')::numeric > 0 THEN (it->>'weight')::numeric END;
    IF st = 'nao-lida' THEN _unread := _unread + 1; CONTINUE; END IF;
    IF st = 'anulada' THEN CONTINUE; END IF;
    IF w IS NULL THEN _wmissing := true; END IF;
    _max := _max + coalesce(w, 0);
    IF st = 'certa' THEN _hits := _hits + 1; _score := _score + coalesce(w, 0);
    ELSIF st = 'pontuada' THEN
      IF jsonb_typeof(l->'points') <> 'number' THEN RAISE EXCEPTION 'sia:points-required'; END IF;
      pts := (l->>'points')::numeric;
      IF w IS NULL OR pts < 0 OR pts > w THEN RAISE EXCEPTION 'sia:points-out-of-range'; END IF;
      _score := _score + pts;
    END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('sia-corr:' || v.id || ':' || _student));
  SELECT c.id INTO head FROM public.sia_card_corrections c WHERE c.instrument_version_id = v.id AND c.student_id = _student
    AND NOT EXISTS (SELECT 1 FROM public.sia_card_corrections s WHERE s.supersedes_id = c.id);
  IF head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'sia:head-changed'; END IF;
  IF head IS NOT NULL AND coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'sia:reason-required'; END IF;
  IF _launch_to_diary THEN
    IF _unread > 0 THEN RAISE EXCEPTION 'sia:unread-blocks-diary'; END IF;
    IF _wmissing THEN RAISE EXCEPTION 'sia:weights-incomplete'; END IF;
    IF v.results_instrument_id IS NULL THEN RAISE EXCEPTION 'sia:no-diary-instrument'; END IF;
    SELECT x.* INTO _cur FROM public.assessment_entry_versions x WHERE x.logical_entry_id = 'res-' || v.results_instrument_id || '-' || _student
      AND NOT EXISTS (SELECT 1 FROM public.assessment_entry_versions s WHERE s.supersedes_version_id = x.id);
    IF _cur.id IS NOT NULL THEN
      IF _cur.value = jsonb_build_object('kind','numerica','value',_score) THEN _batch := _cur.id; -- mesmo valor: nada a lançar
      ELSE RAISE EXCEPTION 'sia:diary-has-result-use-rectification'; END IF;
    ELSE
      _closing := public.current_closing_for_instrument(v.results_instrument_id);
      _batch := public.register_assessment_results(v.results_instrument_id, 'sia2-' || v.id || '-' || _student,
        NULL, NULL, _closing,
        jsonb_build_array(jsonb_build_object('studentId', _student, 'value', jsonb_build_object('kind','numerica','value',_score), 'origin', 'sia-cartao', 'expectedBaseVersionId', NULL)));
    END IF;
  END IF;
  INSERT INTO public.sia_card_corrections(instrument_id, instrument_version_id, school_id, class_id, variant, student_id, card_code, image_path, image_sha256,
    print_fingerprint, approved_review_event_id, lines, hits, total, human_confirmed, supersedes_id, change_reason, diary_batch_act_id, reviewer_user_id,
    score, max_score, unread_count, scoring_version)
  VALUES (v.instrument_id, v.id, v.school_id, v.class_id, coalesce(_variant,''), _student, _card_code, _image_path, lower(_image_sha256),
    lower(_print_fingerprint), rv.id, _lines, _hits, _total, true, head, nullif(btrim(_reason),''), _batch, auth.uid(),
    CASE WHEN _wmissing OR _unread > 0 THEN NULL ELSE _score END, CASE WHEN _wmissing THEN NULL ELSE _max END, _unread, 'pesos-da-versao:' || v.id)
  RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.record_sia_card_correction_v2(uuid,text,text,text,text,text,text,jsonb,boolean,uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sia_card_correction_v2(uuid,text,text,text,text,text,text,jsonb,boolean,uuid,text,boolean) TO authenticated;
-- v1 lançava acertos como nota e aceitava linha sem decisão de leitura; aposentado para contas.
REVOKE EXECUTE ON FUNCTION public.record_sia_card_correction(uuid,text,text,text,text,text,text,jsonb,boolean,uuid,text,boolean) FROM authenticated;
COMMENT ON FUNCTION public.record_sia_card_correction(uuid,text,text,text,text,text,text,jsonb,boolean,uuid,text,boolean) IS 'DEPRECATED: replaced by record_sia_card_correction_v2';