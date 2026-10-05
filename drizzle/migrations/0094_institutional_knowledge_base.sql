-- Base de conhecimento institucional: documento → versão (append-only) → chunks; ACL por versão acompanha cada chunk.
CREATE TABLE public.kb_documents (
  id text PRIMARY KEY CHECK (id ~ '^kb-[a-z0-9-]{3,80}$'),
  source_kind text NOT NULL CHECK (source_kind IN ('documentacao-sigem','norma-oficial','manual-institucional','conteudo-autorizado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.kb_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL REFERENCES public.kb_documents(id),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  classification text NOT NULL CHECK (classification IN ('publico','interno')),
  required_capability text,
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
  original_ref text NOT NULL CHECK (length(original_ref) BETWEEN 1 AND 500),
  supersedes_id uuid REFERENCES public.kb_document_versions(id),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version),
  CHECK (classification = 'publico' OR required_capability IS NOT NULL)
);
CREATE TABLE public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.kb_document_versions(id),
  ordinal integer NOT NULL,
  section text,
  page integer,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(section,'') || ' ' || body)) STORED,
  UNIQUE (version_id, ordinal)
);
CREATE INDEX kb_chunks_tsv ON public.kb_chunks USING gin (tsv);
CREATE TABLE public.kb_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.kb_document_versions(id),
  kind text NOT NULL CHECK (kind IN ('revogacao','exclusao-do-indice')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, kind)
);

GRANT SELECT ON public.kb_documents, public.kb_document_versions, public.kb_chunks, public.kb_document_events TO authenticated;
GRANT ALL ON public.kb_documents, public.kb_document_versions, public.kb_chunks, public.kb_document_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.kb_documents, public.kb_document_versions, public.kb_chunks, public.kb_document_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.kb_can_read_version(_version uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.kb_document_versions v WHERE v.id = _version AND (
    v.classification = 'publico'
    OR EXISTS (SELECT 1 FROM public.effective_capabilities() c WHERE c.capability_id = v.required_capability)));
$$;
REVOKE ALL ON FUNCTION public.kb_can_read_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_can_read_version(uuid) TO authenticated;

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY kb_docs_read ON public.kb_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.kb_document_versions v WHERE v.document_id = kb_documents.id AND public.kb_can_read_version(v.id)));
CREATE POLICY kb_versions_read ON public.kb_document_versions FOR SELECT TO authenticated USING (public.kb_can_read_version(id));
CREATE POLICY kb_chunks_read ON public.kb_chunks FOR SELECT TO authenticated USING (public.kb_can_read_version(version_id));
CREATE POLICY kb_events_read ON public.kb_document_events FOR SELECT TO authenticated USING (public.kb_can_read_version(version_id));

CREATE TRIGGER kb_versions_ao BEFORE UPDATE OR DELETE ON public.kb_document_versions FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();
CREATE TRIGGER kb_chunks_ao BEFORE UPDATE OR DELETE ON public.kb_chunks FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();
CREATE TRIGGER kb_events_ao BEFORE UPDATE OR DELETE ON public.kb_document_events FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();

CREATE OR REPLACE FUNCTION public.record_kb_document_version(_document text, _source_kind text, _title text, _classification text, _required_capability text, _original_sha256 text, _original_ref text, _expected_head uuid, _chunks jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head uuid; _v integer; _id uuid; _c jsonb; _i integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'kb:unauthenticated'; END IF;
  IF NOT public.has_network_capability('gerir-base-de-conhecimento') THEN RAISE EXCEPTION 'kb:forbidden'; END IF;
  IF jsonb_typeof(_chunks) <> 'array' OR jsonb_array_length(_chunks) = 0 OR jsonb_array_length(_chunks) > 2000 THEN RAISE EXCEPTION 'kb:chunks'; END IF;
  INSERT INTO public.kb_documents(id, source_kind) VALUES (_document, _source_kind) ON CONFLICT (id) DO NOTHING;
  IF (SELECT d.source_kind FROM public.kb_documents d WHERE d.id = _document) <> _source_kind THEN RAISE EXCEPTION 'kb:source-kind-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('kb:' || _document));
  SELECT v.id, v.version INTO _head, _v FROM public.kb_document_versions v WHERE v.document_id = _document ORDER BY v.version DESC LIMIT 1;
  IF _head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'kb:stale-head'; END IF;
  INSERT INTO public.kb_document_versions(document_id, version, title, classification, required_capability, original_sha256, original_ref, supersedes_id, recorded_by)
  VALUES (_document, coalesce(_v, 0) + 1, _title, _classification, nullif(_required_capability, ''), _original_sha256, _original_ref, _head, auth.uid()) RETURNING id INTO _id;
  FOR _c IN SELECT * FROM jsonb_array_elements(_chunks) LOOP
    _i := _i + 1;
    INSERT INTO public.kb_chunks(version_id, ordinal, section, page, body) VALUES (_id, _i, left(_c->>'section', 300), nullif(_c->>'page','')::integer, _c->>'body');
  END LOOP;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_kb_document_event(_version uuid, _kind text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'kb:unauthenticated'; END IF;
  IF NOT public.has_network_capability('gerir-base-de-conhecimento') THEN RAISE EXCEPTION 'kb:forbidden'; END IF;
  INSERT INTO public.kb_document_events(version_id, kind, reason, recorded_by) VALUES (_version, _kind, _reason, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.record_kb_document_version(text,text,text,text,text,text,text,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_kb_document_event(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_kb_document_version(text,text,text,text,text,text,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_kb_document_event(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.kb_search(_q text, _limit integer DEFAULT 20)
RETURNS TABLE(chunk_id uuid, document_id text, version_id uuid, version integer, title text, classification text, section text, page integer, body text, rank real, status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH q AS (SELECT websearch_to_tsquery('portuguese', left(_q, 300)) AS t),
  heads AS (SELECT hv.document_id, max(hv.version) AS v FROM public.kb_document_versions hv GROUP BY hv.document_id)
  SELECT c.id, v.document_id, v.id, v.version, v.title, v.classification, c.section, c.page, c.body,
         ts_rank(c.tsv, q.t),
         CASE WHEN EXISTS (SELECT 1 FROM public.kb_document_events e WHERE e.version_id = v.id AND e.kind = 'revogacao') THEN 'revogada'
              WHEN v.version < h.v THEN 'substituida' ELSE 'vigente' END
  FROM public.kb_chunks c JOIN public.kb_document_versions v ON v.id = c.version_id JOIN heads h ON h.document_id = v.document_id, q
  WHERE c.tsv @@ q.t
    AND NOT EXISTS (SELECT 1 FROM public.kb_document_events e WHERE e.version_id = v.id AND e.kind = 'exclusao-do-indice')
  ORDER BY (CASE WHEN v.version = h.v THEN 0 ELSE 1 END), ts_rank(c.tsv, q.t) DESC
  LIMIT least(greatest(_limit, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.kb_search(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_search(text, integer) TO authenticated;