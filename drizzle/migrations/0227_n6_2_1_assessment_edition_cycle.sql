CREATE TABLE public.assessment_edition_cycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_logical_id uuid NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  from_state text,
  to_state text NOT NULL CHECK (to_state IN ('planejada','preparada','em-aplicacao','recebida','validada','publicada','arquivada')),
  note text,
  actor_user_id uuid NOT NULL,
  actor_person_id uuid NOT NULL,
  actor_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_logical_id, seq)
);
GRANT ALL ON public.assessment_edition_cycle_events TO service_role;
ALTER TABLE public.assessment_edition_cycle_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assessment_edition_cycle_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'ei:cycle-append-only'; END $$;
CREATE TRIGGER assessment_edition_cycle_events_immutable BEFORE UPDATE OR DELETE ON public.assessment_edition_cycle_events
  FOR EACH ROW EXECUTE FUNCTION public.assessment_edition_cycle_immutable();

CREATE OR REPLACE FUNCTION public.record_assessment_edition_cycle_event(_edition uuid, _expected_seq integer, _to_state text, _note text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g uuid; me uuid; cur text; s integer; ok boolean;
BEGIN
  g := public.ei_grant('manter-programa-avaliativo', NULL);
  me := public.af_natural_person();
  IF NOT EXISTS (SELECT 1 FROM public.assessment_edition_versions v WHERE v.logical_id = _edition AND v.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.assessment_edition_versions x WHERE x.supersedes_id = v.id)) THEN RAISE EXCEPTION 'ei:edition-unknown'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ei-cycle:' || _edition::text));
  SELECT e.to_state, e.seq INTO cur, s FROM public.assessment_edition_cycle_events e WHERE e.edition_logical_id = _edition ORDER BY e.seq DESC LIMIT 1;
  s := coalesce(s, 0);
  IF coalesce(_expected_seq, -1) <> s THEN RAISE EXCEPTION 'ei:cycle-head-changed'; END IF;
  ok := (cur IS NULL AND _to_state = 'planejada')
     OR (cur = 'planejada' AND _to_state = 'preparada')
     OR (cur = 'preparada' AND _to_state = 'em-aplicacao')
     OR (cur = 'em-aplicacao' AND _to_state = 'recebida')
     OR (cur = 'recebida' AND _to_state = 'validada')
     OR (cur = 'validada' AND _to_state = 'publicada')
     OR (cur = 'publicada' AND _to_state = 'arquivada');
  IF NOT ok THEN RAISE EXCEPTION 'ei:cycle-transition-invalid'; END IF;
  INSERT INTO public.assessment_edition_cycle_events(edition_logical_id, seq, from_state, to_state, note, actor_user_id, actor_person_id, actor_engagement)
  VALUES (_edition, s + 1, cur, _to_state, nullif(btrim(_note), ''), auth.uid(), me, g);
  RETURN s + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_assessment_edition_cycle_event(uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_assessment_edition_cycle_event(uuid, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assessment_edition_cycle_at(_edition uuid, _known_at timestamptz DEFAULT now())
RETURNS TABLE(seq integer, from_state text, to_state text, note text, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.seq, e.from_state, e.to_state, e.note, e.recorded_at
  FROM public.assessment_edition_cycle_events e
  WHERE e.edition_logical_id = _edition AND e.recorded_at <= _known_at
    AND EXISTS (SELECT 1 FROM public.assessment_edition_versions v WHERE v.logical_id = _edition)
    AND auth.uid() IS NOT NULL
  ORDER BY e.seq
$$;
REVOKE ALL ON FUNCTION public.assessment_edition_cycle_at(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assessment_edition_cycle_at(uuid, timestamptz) TO authenticated;