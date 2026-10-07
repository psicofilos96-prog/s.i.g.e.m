CREATE TABLE public.inclusion_term_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_logical_id uuid NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  original_term text NOT NULL CHECK (length(btrim(original_term)) BETWEEN 1 AND 300),
  origin text NOT NULL CHECK (length(btrim(origin)) BETWEEN 1 AND 200),
  status text NOT NULL CHECK (status IN ('pendente','validado','recusado')),
  alias text,
  category_value_id text,
  note text,
  actor_user_id uuid NOT NULL,
  actor_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_logical_id, seq),
  CHECK (status <> 'validado' OR length(btrim(coalesce(alias, category_value_id, ''))) > 0)
);
GRANT ALL ON public.inclusion_term_review_events TO service_role;
ALTER TABLE public.inclusion_term_review_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.inclusion_term_review_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'inclusion:term-append-only'; END $$;
CREATE TRIGGER inclusion_term_review_events_immutable BEFORE UPDATE OR DELETE ON public.inclusion_term_review_events
  FOR EACH ROW EXECUTE FUNCTION public.inclusion_term_review_immutable();

CREATE OR REPLACE FUNCTION public.inclusion_term_grant() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'revisar-termos-inclusao' AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'inclusion:capability-missing'; END IF;
  RETURN g;
END $$;
REVOKE ALL ON FUNCTION public.inclusion_term_grant() FROM PUBLIC, anon, authenticated;

-- Registro humano: abre (pendente, sem base) ou decide (validado/recusado, com base esperada).
CREATE OR REPLACE FUNCTION public.record_inclusion_term_review(_term uuid, _expected_seq integer, _original text, _origin text, _status text, _alias text, _category text, _note text)
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
  IF _category IS NOT NULL AND NOT public.attribute_value_homologated(_category) THEN RAISE EXCEPTION 'inclusion:category-not-homologated'; END IF;
  INSERT INTO public.inclusion_term_review_events(term_logical_id, seq, original_term, origin, status, alias, category_value_id, note, actor_user_id, actor_engagement)
  VALUES (_term, head.seq + 1, head.original_term, head.origin, _status, nullif(btrim(_alias), ''), _category, nullif(btrim(_note), ''), auth.uid(), g);
  RETURN _term;
END $$;
REVOKE ALL ON FUNCTION public.record_inclusion_term_review(uuid, integer, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inclusion_term_review(uuid, integer, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.inclusion_term_reviews_at(_known_at timestamptz DEFAULT now())
RETURNS TABLE(term_logical_id uuid, seq integer, original_term text, origin text, status text, alias text, category_value_id text, note text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.inclusion_term_grant();
  RETURN QUERY SELECT e.term_logical_id, e.seq, e.original_term, e.origin, e.status, e.alias, e.category_value_id, e.note, e.recorded_at
    FROM public.inclusion_term_review_events e WHERE e.recorded_at <= _known_at ORDER BY e.term_logical_id, e.seq;
END $$;
REVOKE ALL ON FUNCTION public.inclusion_term_reviews_at(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inclusion_term_reviews_at(timestamptz) TO authenticated;