-- NAE.8 Lote 2 — anexos binários (foto, NF, evidência) da Alimentação Escolar.
-- Bucket privado `alimentacao-evidencias` (sem policy em storage.objects para anon/authenticated:
-- só o servidor toca o objeto, DEPOIS de o banco autorizar como o usuário).
-- Metadado append-only e versionado (anexacao → substituicao → revogacao); objeto anterior nunca é apagado.
-- Anexar NÃO altera recebimento, documento fiscal, estoque nem fluxo financeiro: nenhum writer de domínio é chamado.

CREATE TABLE public.meal_evidence_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_evidence_attachments(id),
  event_kind text NOT NULL CHECK (event_kind IN ('anexacao','substituicao','revogacao')),
  target_kind text NOT NULL CHECK (target_kind IN ('recebimento','nao-conformidade','documento-fiscal')),
  target_logical_id uuid NOT NULL,
  school_id text NOT NULL,
  storage_path text UNIQUE,
  sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type text CHECK (media_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  label text CHECK (length(label) <= 120),
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK ((event_kind = 'revogacao') = (storage_path IS NULL)),
  CHECK (event_kind = 'revogacao' OR (sha256 IS NOT NULL AND media_type IS NOT NULL AND size_bytes IS NOT NULL)),
  CHECK (event_kind = 'anexacao' OR (reason IS NOT NULL AND length(trim(reason)) > 0))
);
CREATE INDEX meal_evidence_target_idx ON public.meal_evidence_attachments(target_kind, target_logical_id);
REVOKE ALL ON public.meal_evidence_attachments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meal_evidence_attachments TO service_role;
ALTER TABLE public.meal_evidence_attachments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_evidence_append_only BEFORE UPDATE OR DELETE ON public.meal_evidence_attachments
  FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE FUNCTION public.meal_evidence_target_school(_kind text, _target uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT CASE _kind
    WHEN 'recebimento' THEN (SELECT r.school_id FROM public.meal_receipts r WHERE r.logical_id = _target ORDER BY r.version DESC LIMIT 1)
    WHEN 'nao-conformidade' THEN (SELECT n.school_id FROM public.meal_nonconformities n WHERE n.logical_id = _target ORDER BY n.version DESC LIMIT 1)
    WHEN 'documento-fiscal' THEN (SELECT f.school_id FROM public.meal_fiscal_documents f WHERE f.logical_id = _target ORDER BY f.version DESC LIMIT 1)
  END $$;
REVOKE ALL ON FUNCTION public.meal_evidence_target_school(text, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_evidence_capability(_kind text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE _kind WHEN 'nao-conformidade' THEN 'registrar-nao-conformidade-alimentar' ELSE 'conferir-recebimento-alimentar' END $$;
REVOKE ALL ON FUNCTION public.meal_evidence_capability(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_evidence_can_read(_kind text, _school text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  BEGIN PERFORM public.meal_grant_on(public.meal_evidence_capability(_kind), _school, CURRENT_DATE); RETURN true;
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', CURRENT_DATE); RETURN true;
  EXCEPTION WHEN others THEN RETURN false; END;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_evidence_can_read(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_evidence_slot(_kind text, _target uuid, _media text, _size integer) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s text;
BEGIN
  PERFORM public.af_natural_person();
  IF _kind NOT IN ('recebimento','nao-conformidade','documento-fiscal') THEN RAISE EXCEPTION 'meal:evidence-target-kind'; END IF;
  IF _media NOT IN ('image/jpeg','image/png','image/webp','application/pdf') THEN RAISE EXCEPTION 'meal:evidence-media-type'; END IF;
  IF _size IS NULL OR _size <= 0 OR _size > 10485760 THEN RAISE EXCEPTION 'meal:evidence-size'; END IF;
  s := public.meal_evidence_target_school(_kind, _target);
  IF s IS NULL THEN RAISE EXCEPTION 'meal:evidence-target-unknown'; END IF;
  PERFORM public.meal_grant_on(public.meal_evidence_capability(_kind), s, CURRENT_DATE);
  RETURN s || '/' || _kind || '/' || _target::text || '/' || gen_random_uuid()::text;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_evidence_slot(text, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_evidence_slot(text, uuid, text, integer) TO authenticated;

CREATE FUNCTION public.record_meal_evidence(_logical uuid, _expected_version integer, _event text, _kind text, _target uuid,
  _path text, _sha256 text, _media text, _size integer, _label text, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; h public.meal_evidence_attachments; s text; lid uuid;
BEGIN
  me := public.af_natural_person();
  IF _event = 'anexacao' THEN
    IF _logical IS NOT NULL THEN RAISE EXCEPTION 'meal:evidence-new-has-no-base'; END IF;
    s := public.meal_evidence_target_school(_kind, _target);
    IF s IS NULL THEN RAISE EXCEPTION 'meal:evidence-target-unknown'; END IF;
    lid := gen_random_uuid();
  ELSIF _event IN ('substituicao','revogacao') THEN
    SELECT * INTO h FROM public.meal_evidence_attachments WHERE logical_id = _logical ORDER BY version DESC LIMIT 1 FOR UPDATE;
    IF h.id IS NULL THEN RAISE EXCEPTION 'meal:evidence-unknown'; END IF;
    IF h.version <> _expected_version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF h.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:evidence-revoked'; END IF;
    IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    _kind := h.target_kind; _target := h.target_logical_id; s := h.school_id; lid := h.logical_id;
  ELSE RAISE EXCEPTION 'meal:evidence-event'; END IF;
  g := public.meal_grant_on(public.meal_evidence_capability(_kind), s, CURRENT_DATE);
  IF _event <> 'revogacao' THEN
    IF _path IS NULL OR _path NOT LIKE s || '/' || _kind || '/' || _target::text || '/%' THEN RAISE EXCEPTION 'meal:evidence-path'; END IF;
    IF _media NOT IN ('image/jpeg','image/png','image/webp','application/pdf') THEN RAISE EXCEPTION 'meal:evidence-media-type'; END IF;
    IF _size IS NULL OR _size <= 0 OR _size > 10485760 THEN RAISE EXCEPTION 'meal:evidence-size'; END IF;
    IF _sha256 IS NULL OR _sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'meal:evidence-hash'; END IF;
  ELSE _path := NULL; _sha256 := NULL; _media := NULL; _size := NULL; END IF;
  INSERT INTO public.meal_evidence_attachments(logical_id, version, supersedes_id, event_kind, target_kind, target_logical_id, school_id,
    storage_path, sha256, media_type, size_bytes, label, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(h.version, 0) + 1, h.id, _event, _kind, _target, s, _path, _sha256, _media, _size,
    left(nullif(trim(_label), ''), 120), nullif(trim(_reason), ''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_evidence(uuid, integer, text, text, uuid, text, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_meal_evidence(uuid, integer, text, text, uuid, text, text, text, integer, text, text) TO authenticated;

CREATE FUNCTION public.meal_evidence_for(_kind text, _target uuid)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, media_type text, size_bytes integer, sha256 text,
  label text, reason text, recorded_at timestamptz, is_head boolean, readable boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  s := public.meal_evidence_target_school(_kind, _target);
  IF s IS NULL OR NOT public.meal_evidence_can_read(_kind, s) THEN RETURN; END IF;
  RETURN QUERY
    SELECT a.id, a.logical_id, a.version, a.event_kind, a.media_type, a.size_bytes, a.sha256, a.label, a.reason, a.recorded_at,
      NOT EXISTS (SELECT 1 FROM public.meal_evidence_attachments n WHERE n.supersedes_id = a.id),
      a.storage_path IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.meal_evidence_attachments r WHERE r.logical_id = a.logical_id AND r.event_kind = 'revogacao')
    FROM public.meal_evidence_attachments a
    WHERE a.target_kind = _kind AND a.target_logical_id = _target
    ORDER BY a.logical_id, a.version;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_evidence_for(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_evidence_for(text, uuid) TO authenticated;

CREATE FUNCTION public.authorize_meal_evidence_access(_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a public.meal_evidence_attachments;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO a FROM public.meal_evidence_attachments WHERE id = _id;
  IF a.id IS NULL OR a.storage_path IS NULL OR NOT public.meal_evidence_can_read(a.target_kind, a.school_id) THEN
    RAISE EXCEPTION 'meal:evidence-not-available'; END IF;
  IF EXISTS (SELECT 1 FROM public.meal_evidence_attachments r WHERE r.logical_id = a.logical_id AND r.event_kind = 'revogacao') THEN
    RAISE EXCEPTION 'meal:evidence-not-available'; END IF;
  RETURN a.storage_path;
END $fn$;
REVOKE ALL ON FUNCTION public.authorize_meal_evidence_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_meal_evidence_access(uuid) TO authenticated;