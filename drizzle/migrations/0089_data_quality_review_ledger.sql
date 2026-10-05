-- Central de Qualidade: detecções são projeções calculadas na hora; só a REVISÃO humana é persistida (append-only).
CREATE TABLE public.data_quality_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-z0-9:._/-]{3,300}$'),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  rule_id text NOT NULL CHECK (rule_id ~ '^[a-z0-9-]{2,80}$'),
  rule_version integer NOT NULL CHECK (rule_version >= 1),
  school_id uuid NULL,
  state text NOT NULL CHECK (state IN ('revisado','dispensado','reaberto')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 1000),
  supersedes_id uuid NULL REFERENCES public.data_quality_review_events(id),
  recorded_by uuid NOT NULL,
  recorded_by_person uuid NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX data_quality_review_head ON public.data_quality_review_events (fingerprint, coalesce(supersedes_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX data_quality_review_school ON public.data_quality_review_events (school_id, fingerprint);

GRANT SELECT ON public.data_quality_review_events TO authenticated;
GRANT ALL ON public.data_quality_review_events TO service_role;
REVOKE ALL ON public.data_quality_review_events FROM anon, PUBLIC;
ALTER TABLE public.data_quality_review_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.data_quality_can_review(_school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_network_capability('revisar-qualidade-dos-dados')
      OR (_school IS NOT NULL AND EXISTS (SELECT 1 FROM public.school_capability_grant('revisar-qualidade-dos-dados', _school::text)));
$$;
REVOKE ALL ON FUNCTION public.data_quality_can_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_quality_can_review(uuid) TO authenticated;

CREATE POLICY "revisao de qualidade visivel a quem pode revisar" ON public.data_quality_review_events
  FOR SELECT TO authenticated USING (public.data_quality_can_review(school_id));

CREATE OR REPLACE FUNCTION public.data_quality_review_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'data-quality:append-only'; END; $$;
CREATE TRIGGER data_quality_review_no_update BEFORE UPDATE OR DELETE ON public.data_quality_review_events
  FOR EACH ROW EXECUTE FUNCTION public.data_quality_review_immutable();

-- Writer único: cabeça esperada (concorrência otimista), capability, nunca altera o fato de origem.
CREATE OR REPLACE FUNCTION public.record_data_quality_review(
  _fingerprint text, _evidence_sha256 text, _rule_id text, _rule_version integer,
  _school uuid, _state text, _reason text, _expected_head uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head uuid; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'data-quality:auth-required'; END IF;
  IF NOT public.data_quality_can_review(_school) THEN RAISE EXCEPTION 'data-quality:capability-missing'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('dq:' || _fingerprint));
  SELECT e.id INTO _head FROM public.data_quality_review_events e WHERE e.fingerprint = _fingerprint
    AND NOT EXISTS (SELECT 1 FROM public.data_quality_review_events n WHERE n.supersedes_id = e.id);
  IF _head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'data-quality:stale-head'; END IF;
  INSERT INTO public.data_quality_review_events (fingerprint, evidence_sha256, rule_id, rule_version, school_id, state, reason, supersedes_id, recorded_by, recorded_by_person)
  VALUES (_fingerprint, _evidence_sha256, _rule_id, _rule_version, _school, _state, pg_catalog.btrim(_reason), _head, auth.uid(), public.current_person_id())
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.record_data_quality_review(text, text, text, integer, uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_data_quality_review(text, text, text, integer, uuid, text, text, uuid) TO authenticated;