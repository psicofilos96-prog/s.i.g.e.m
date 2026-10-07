ALTER TABLE public.inclusion_term_review_events ADD COLUMN category_version integer;

CREATE OR REPLACE FUNCTION public.record_inclusion_term_review_v2(_term uuid, _expected_seq integer, _original text, _origin text, _status text, _alias text, _category text, _category_version integer, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g uuid; head public.inclusion_term_review_events; t uuid;
BEGIN
  g := public.inclusion_term_grant();
  IF _status NOT IN ('pendente','validado','recusado') THEN RAISE EXCEPTION 'inclusion:term-status-invalid'; END IF;
  IF _term IS NULL THEN
    IF _status <> 'pendente' OR coalesce(_expected_seq, 0) <> 0 THEN RAISE EXCEPTION 'inclusion:term-must-open-pending'; END IF;
    t := gen_random_uuid();
    INSERT INTO public.inclusion_term_review_events(term_logical_id, seq, original_term, origin, status, note, actor_user_id, actor_engagement)
    VALUES (t, 1, btrim(_original), btrim(_origin), 'pendente', nullif(btrim(_note), ''), auth.uid(), g);
    RETURN t;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('inc-term:' || _term::text));
  SELECT * INTO head FROM public.inclusion_term_review_events WHERE term_logical_id = _term ORDER BY seq DESC LIMIT 1;
  IF head.id IS NULL THEN RAISE EXCEPTION 'inclusion:term-unknown'; END IF;
  IF head.seq <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'inclusion:term-head-changed'; END IF;
  IF _status = 'pendente' THEN RAISE EXCEPTION 'inclusion:term-already-open'; END IF;
  IF _category IS NOT NULL AND NOT public.attribute_value_homologated('categoria-de-apoio-inclusivo', _category, _category_version, CURRENT_DATE) THEN
    RAISE EXCEPTION 'inclusion:category-not-homologated'; END IF;
  INSERT INTO public.inclusion_term_review_events(term_logical_id, seq, original_term, origin, status, alias, category_value_id, category_version, note, actor_user_id, actor_engagement)
  VALUES (_term, head.seq + 1, head.original_term, head.origin, _status, nullif(btrim(_alias), ''), _category, CASE WHEN _category IS NULL THEN NULL ELSE _category_version END, nullif(btrim(_note), ''), auth.uid(), g);
  RETURN _term;
END $$;
REVOKE ALL ON FUNCTION public.record_inclusion_term_review_v2(uuid, integer, text, text, text, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inclusion_term_review_v2(uuid, integer, text, text, text, text, text, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_inclusion_term_review(uuid, integer, text, text, text, text, text, text) FROM authenticated;
COMMENT ON FUNCTION public.record_inclusion_term_review(uuid, integer, text, text, text, text, text, text) IS 'DEPRECATED: replaced by record_inclusion_term_review_v2';