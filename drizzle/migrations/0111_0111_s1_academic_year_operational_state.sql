CREATE TABLE public.academic_year_operational_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  state text NOT NULL CHECK (state IN ('historico-importado','em-preparacao','operacional','encerrado')),
  supersedes_id uuid REFERENCES public.academic_year_operational_states(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  recorded_by uuid,
  recorded_by_person_id text,
  recorded_via_engagement_id text,
  technical_provenance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, sequence),
  CHECK ((recorded_by IS NOT NULL AND technical_provenance IS NULL) OR (recorded_by IS NULL AND technical_provenance IS NOT NULL))
);
COMMENT ON TABLE public.academic_year_operational_states IS 'S1: estado operacional do ano letivo, append-only. Virada é transição de contexto, nunca reset.';
GRANT SELECT ON public.academic_year_operational_states TO authenticated;
GRANT SELECT ON public.academic_year_operational_states TO service_role;
ALTER TABLE public.academic_year_operational_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read year states" ON public.academic_year_operational_states FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.academic_year_states_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'year-state:append-only'; END $$;
CREATE TRIGGER academic_year_operational_states_immutable BEFORE UPDATE OR DELETE ON public.academic_year_operational_states
FOR EACH ROW EXECUTE FUNCTION public.academic_year_states_immutable();

CREATE OR REPLACE FUNCTION public.academic_year_operational_state_at(_academic_year_id text)
RETURNS TABLE(academic_year_id text, state text, sequence integer, recorded_at timestamptz, technical boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT s.academic_year_id, s.state, s.sequence, s.created_at, s.technical_provenance IS NOT NULL
  FROM public.academic_year_operational_states s
  WHERE s.academic_year_id = _academic_year_id
  ORDER BY s.sequence DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.record_academic_year_operational_state(
  _academic_year_id text, _state text, _expected_sequence integer, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head public.academic_year_operational_states; _id uuid; _person text; _eng text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'year-state:no-session'; END IF;
  IF NOT public.has_network_capability('preparar-ano-letivo') THEN RAISE EXCEPTION 'year-state:capability'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN RAISE EXCEPTION 'year-state:reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('year-state:' || _academic_year_id));
  SELECT * INTO _head FROM public.academic_year_operational_states
   WHERE academic_year_id = _academic_year_id ORDER BY sequence DESC LIMIT 1;
  IF COALESCE(_head.sequence, 0) <> COALESCE(_expected_sequence, 0) THEN RAISE EXCEPTION 'year-state:stale-head'; END IF;
  IF NOT (
    (_head.id IS NULL AND _state = 'em-preparacao') OR
    (_head.state = 'em-preparacao' AND _state IN ('operacional')) OR
    (_head.state = 'operacional' AND _state = 'encerrado') OR
    (_head.state = 'historico-importado' AND _state = 'encerrado')
  ) THEN RAISE EXCEPTION 'year-state:transition-not-allowed'; END IF;
  SELECT e.person_id, e.id INTO _person, _eng FROM public.institutional_engagements e
   JOIN public.institutional_persons p ON p.id = e.person_id
   WHERE p.auth_user_id = auth.uid() ORDER BY e.created_at DESC LIMIT 1;
  IF _person IS NULL THEN RAISE EXCEPTION 'year-state:no-person'; END IF;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_academic_year_id, COALESCE(_head.sequence,0)+1, _state, _head.id, _reason, auth.uid(), _person, _eng)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_academic_year_operational_state(text,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_academic_year_operational_state(text,text,integer,text) TO authenticated;

INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
SELECT y.id, 1, 'historico-importado', 'Baseline censitário EducaCenso 2026 (decisão do proprietário 2026-10-05): fotografia histórica, não ano operacional.', 'technical:educacenso-2026-baseline'
FROM public.institutional_academic_years y
JOIN public.institutional_academic_year_versions v ON v.academic_year_id = y.id AND v.version = 1
WHERE v.official_name = 'Ano letivo 2026';