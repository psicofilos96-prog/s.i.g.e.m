-- Portal público: só conteúdo EXPLICITAMENTE publicado sai sem autenticação.
-- Nenhuma tabela é lida por anon; leitura pública só por funções que devolvem
-- a última versão quando ela está em estado 'publicado'. Ausência de registro,
-- rascunho e revogação produzem a mesma resposta (sem enumeração).
CREATE TABLE public.public_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('calendario-escolar', 'comunicado', 'informacao-institucional')),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
);
CREATE TABLE public.public_publication_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.public_publications(id),
  version integer NOT NULL CHECK (version >= 1),
  state text NOT NULL CHECK (state IN ('rascunho', 'publicado', 'revogado')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  summary text CHECK (summary IS NULL OR length(summary) <= 500),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
  reason text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE (publication_id, version)
);
GRANT SELECT ON public.public_publications, public.public_publication_versions TO authenticated;
GRANT ALL ON public.public_publications, public.public_publication_versions TO service_role;
ALTER TABLE public.public_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_publication_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publishers read publications" ON public.public_publications FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('publicar-conteudo-publico')));
CREATE POLICY "publishers read publication versions" ON public.public_publication_versions FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('publicar-conteudo-publico')));

CREATE FUNCTION public.public_publication_versions_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
BEGIN RAISE EXCEPTION 'public_publication_versions é append-only'; END $fn$;
CREATE TRIGGER public_publication_versions_no_mutation BEFORE UPDATE OR DELETE ON public.public_publication_versions
  FOR EACH ROW EXECUTE FUNCTION public.public_publication_versions_append_only();

CREATE FUNCTION public.record_public_publication(
  _kind text, _slug text, _state text, _title text, _summary text, _body text, _reason text, _expected_version integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p uuid; cur integer;
BEGIN
  IF NOT public.has_network_capability('publicar-conteudo-publico') THEN RAISE EXCEPTION 'sem capability publicar-conteudo-publico'; END IF;
  IF _state = 'revogado' AND (_reason IS NULL OR length(btrim(_reason)) = 0) THEN RAISE EXCEPTION 'revogação exige motivo'; END IF;
  SELECT id INTO p FROM public.public_publications WHERE slug = _slug FOR UPDATE;
  IF p IS NULL THEN
    IF coalesce(_expected_version, -1) <> 0 THEN RAISE EXCEPTION 'conflito: publicação inexistente'; END IF;
    INSERT INTO public.public_publications(kind, slug) VALUES (_kind, _slug) RETURNING id INTO p;
    cur := 0;
  ELSE
    IF (SELECT kind FROM public.public_publications WHERE id = p) <> _kind THEN RAISE EXCEPTION 'tipo não pode mudar'; END IF;
    SELECT coalesce(max(version), 0) INTO cur FROM public.public_publication_versions WHERE publication_id = p;
    IF cur <> _expected_version THEN RAISE EXCEPTION 'conflito: versão atual %', cur; END IF;
  END IF;
  INSERT INTO public.public_publication_versions(publication_id, version, state, title, summary, body, reason)
    VALUES (p, cur + 1, _state, _title, _summary, coalesce(_body, ''), _reason);
  RETURN jsonb_build_object('publication_id', p, 'version', cur + 1);
END $fn$;
REVOKE ALL ON FUNCTION public.record_public_publication(text, text, text, text, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_public_publication(text, text, text, text, text, text, text, integer) TO authenticated;

CREATE FUNCTION public.public_portal_list(_kind text)
RETURNS TABLE(slug text, kind text, title text, summary text, published_at timestamptz, version integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT p.slug, p.kind, v.title, v.summary, v.recorded_at, v.version
  FROM public.public_publications p
  JOIN LATERAL (SELECT * FROM public.public_publication_versions x WHERE x.publication_id = p.id ORDER BY x.version DESC LIMIT 1) v ON true
  WHERE v.state = 'publicado' AND (_kind IS NULL OR p.kind = _kind)
  ORDER BY v.recorded_at DESC LIMIT 100
$fn$;
CREATE FUNCTION public.public_portal_get(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT coalesce((
    SELECT jsonb_build_object('status', 'publicado', 'slug', p.slug, 'kind', p.kind, 'title', v.title,
      'summary', v.summary, 'body', v.body, 'published_at', v.recorded_at, 'version', v.version)
    FROM public.public_publications p
    JOIN LATERAL (SELECT * FROM public.public_publication_versions x WHERE x.publication_id = p.id ORDER BY x.version DESC LIMIT 1) v ON true
    WHERE p.slug = _slug AND v.state = 'publicado'), jsonb_build_object('status', 'indisponivel'))
$fn$;
REVOKE ALL ON FUNCTION public.public_portal_list(text), public.public_portal_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_portal_list(text), public.public_portal_get(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.public_publication_versions_append_only() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_school_document(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE e record; x record; title text;
BEGIN
  IF _code IS NULL OR upper(btrim(_code)) !~ '^[0-9A-F]{16}$' THEN RETURN jsonb_build_object('status', 'invalido'); END IF;
  SELECT * INTO e FROM public.school_document_emissions WHERE verification_code = upper(btrim(_code));
  IF e.id IS NULL THEN RETURN jsonb_build_object('status', 'nao-encontrado'); END IF;
  SELECT * INTO x FROM public.school_document_emission_events WHERE emission_id = coalesce(e.reproduces_id, e.id);
  SELECT v.title INTO title FROM public.school_document_template_versions v WHERE v.id = e.template_version_id;
  RETURN jsonb_build_object(
    'status', CASE WHEN x.event_kind = 'cancelamento' THEN 'cancelado' WHEN x.event_kind = 'retificacao' THEN 'retificado' ELSE 'valido' END,
    'emission_kind', e.emission_kind, 'document_kind', e.document_kind, 'title', title,
    'emission_number', e.emission_number, 'emitted_at', e.emitted_at,
    'snapshot_sha256', e.snapshot_sha256, 'public_fields', e.public_payload);
END $fn$;