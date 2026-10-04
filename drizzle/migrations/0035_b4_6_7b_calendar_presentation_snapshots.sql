-- B4.6.7b — Snapshot imutável de apresentação/origem por versão de calendário (aditiva).
-- Guarda o original importado (fonte bruta), apresentação (documento, simbologia, layout, assinaturas) e a
-- natureza da origem; NÃO é fonte de efeito de dia (efeito vem só das declarações da versão).
CREATE TABLE public.calendar_version_presentation_snapshots (
  version_id uuid PRIMARY KEY REFERENCES public.calendar_versions(id),
  source_kind text NOT NULL CHECK (source_kind IN ('importacao-navegador','referencia-codigo','edicao-institucional')),
  source_key text,
  source_entry_id text,
  source_digest text NOT NULL CHECK (source_digest ~ '^[0-9a-f]{64}$'),
  source_raw jsonb,
  presentation jsonb NOT NULL,
  declared_by_user_note text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_kind <> 'importacao-navegador' OR (source_raw IS NOT NULL AND source_key IS NOT NULL)),
  CHECK (source_kind <> 'referencia-codigo' OR coalesce(btrim(declared_by_user_note),'') <> '')
);
GRANT ALL ON public.calendar_version_presentation_snapshots TO service_role;
REVOKE ALL ON public.calendar_version_presentation_snapshots FROM PUBLIC, anon, authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.calendar_version_presentation_snapshots FROM sandbox_exec';
  END IF;
END $acl$;
ALTER TABLE public.calendar_version_presentation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_calendar_presentation_snapshots BEFORE UPDATE OR DELETE ON public.calendar_version_presentation_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE FUNCTION public.record_calendar_presentation_snapshot(
  _version_id uuid, _source_kind text, _source_key text, _source_entry_id text, _source_digest text,
  _source_raw jsonb, _presentation jsonb, _declared_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _pid uuid;
BEGIN
  g := public.calendar_network_grant('construir-calendario-da-rede');
  _pid := public.current_person_id();
  IF _pid IS NULL THEN RAISE EXCEPTION 'calendar-presentation:person-link-required'; END IF;
  IF _version_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.calendar_versions v WHERE v.id = _version_id) THEN
    RAISE EXCEPTION 'calendar-presentation:version-not-found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-presentation:' || _version_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.calendar_version_homologations h WHERE h.calendar_version_id = _version_id) THEN
    RAISE EXCEPTION 'calendar-presentation:version-already-decided'; END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_version_presentation_snapshots s WHERE s.version_id = _version_id) THEN
    RAISE EXCEPTION 'calendar-presentation:already-recorded'; END IF;
  IF pg_catalog.jsonb_typeof(coalesce(_presentation,'null')) <> 'object' THEN RAISE EXCEPTION 'calendar-presentation:presentation-required'; END IF;
  INSERT INTO public.calendar_version_presentation_snapshots(version_id, source_kind, source_key, source_entry_id, source_digest,
    source_raw, presentation, declared_by_user_note, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_version_id, _source_kind, nullif(pg_catalog.btrim(coalesce(_source_key,'')),''), nullif(pg_catalog.btrim(coalesce(_source_entry_id,'')),''),
    _source_digest, _source_raw, _presentation, nullif(pg_catalog.btrim(coalesce(_declared_note,'')),''), auth.uid(), _pid, g);
  RETURN pg_catalog.jsonb_build_object('versionId', _version_id, 'recorded', true);
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_presentation_snapshot(uuid, text, text, text, text, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_presentation_snapshot(uuid, text, text, text, text, jsonb, jsonb, text) TO authenticated;

-- Leitor: construção vê qualquer; demais autenticados só quando a versão está homologada na data.
CREATE FUNCTION public.calendar_presentation_at(_version_id uuid, _on date, _known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE s public.calendar_version_presentation_snapshots%ROWTYPE; _ok boolean;
BEGIN
  IF auth.uid() IS NULL OR _version_id IS NULL OR _on IS NULL OR _known_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.7b/1','state','access-denied'); END IF;
  _ok := public.calendar_has_network_capability('construir-calendario-da-rede')
      OR public.calendar_version_homologation_state(_version_id, _on, _known_at) = 'homologada';
  IF NOT _ok THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.7b/1','state','access-denied'); END IF;
  SELECT * INTO s FROM public.calendar_version_presentation_snapshots x WHERE x.version_id = _version_id AND x.created_at <= _known_at;
  IF s.version_id IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.7b/1','state','sem-snapshot'); END IF;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.7b/1','state','lido','snapshot', pg_catalog.jsonb_build_object(
    'versionId', s.version_id, 'sourceKind', s.source_kind, 'sourceKey', s.source_key, 'sourceEntryId', s.source_entry_id,
    'sourceDigest', s.source_digest, 'presentation', s.presentation, 'declaredNote', s.declared_by_user_note, 'recordedAt', s.created_at));
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_presentation_at(uuid, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_presentation_at(uuid, date, timestamptz) TO authenticated;