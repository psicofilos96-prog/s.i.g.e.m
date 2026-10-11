-- DocServ LOTE 02: documentos de antecedentes do servidor. Tipos são configuração; exigência legal só por política aprovada.
CREATE TABLE IF NOT EXISTS public.docserv_document_types (
  code text PRIMARY KEY,
  label text NOT NULL,
  legacy_requirement text NOT NULL CHECK (legacy_requirement IN ('obrigatorio-no-legado','complementar')),
  approved_policy_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.docserv_document_types IS 'Tipos de documento do DocServ. legacy_requirement só descreve o DocServ de origem; obrigatoriedade/validade legal só valem com approved_policy_ref preenchido por política aprovada.';
GRANT SELECT ON public.docserv_document_types TO authenticated;
GRANT ALL ON public.docserv_document_types TO service_role;
ALTER TABLE public.docserv_document_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docserv types read" ON public.docserv_document_types;
CREATE POLICY "docserv types read" ON public.docserv_document_types FOR SELECT TO authenticated USING (true);
INSERT INTO public.docserv_document_types (code, label, legacy_requirement) VALUES
  ('antecedente_criminal', 'Certidão de antecedentes criminais', 'obrigatorio-no-legado'),
  ('antecedente_civil', 'Certidão de antecedentes cíveis', 'complementar')
ON CONFLICT (code) DO NOTHING;

-- Escola vinculada = atuação vigente do servidor na escola (cadastro canônico).
CREATE OR REPLACE FUNCTION public.docserv_person_in_school(_person uuid, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutional_engagements g WHERE g.person_id::text = _person::text AND g.school_id::text = _school
    AND (g.valid_until IS NULL OR g.valid_until >= current_date))
$$;

CREATE OR REPLACE FUNCTION public.docserv_my_person() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE p uuid; BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  BEGIN p := public.current_person_id(); EXCEPTION WHEN others THEN p := NULL; END;
  RETURN p; END $$;

CREATE TABLE IF NOT EXISTS public.docserv_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  previous_version_id uuid REFERENCES public.docserv_document_versions(id),
  person_id uuid NOT NULL,
  type_code text NOT NULL REFERENCES public.docserv_document_types(code),
  season text NOT NULL CHECK (season ~ '^\d{4}$'),
  school_id text,
  storage_path text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  issuer text,
  issued_on date,
  valid_until date,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
COMMENT ON TABLE public.docserv_document_versions IS 'Arquivo enviado (append-only). Novo envio = nova versão com previous_version_id. Arquivo fica no bucket privado docserv-documentos.';

CREATE TABLE IF NOT EXISTS public.docserv_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  version_id uuid NOT NULL REFERENCES public.docserv_document_versions(id),
  seq integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('enviado','revisado','excluido-logico','restaurado')),
  status text CHECK (status IN ('pendente_validacao','valido','rejeitado','alerta_revisao_urgente')),
  note text,
  actor uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, seq)
);
COMMENT ON TABLE public.docserv_document_events IS 'Trilha append-only do documento: envio, revisão, exclusão lógica. "vencido" é projeção de valid_until, nunca gravado.';

GRANT SELECT ON public.docserv_document_versions, public.docserv_document_events TO authenticated;
GRANT ALL ON public.docserv_document_versions, public.docserv_document_events TO service_role;
ALTER TABLE public.docserv_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docserv_document_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.docserv_can_read(_person uuid, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _person = public.docserv_my_person()
    OR public.has_network_capability('validar-documentos-funcionais')
    OR EXISTS (SELECT 1 FROM public.institutional_engagements g
       WHERE g.person_id::text = _person::text AND (g.valid_until IS NULL OR g.valid_until >= current_date)
         AND public.has_school_capability('gerir-documentos-funcionais', g.school_id::text)))
$$;

DROP POLICY IF EXISTS "docserv versions read" ON public.docserv_document_versions;
CREATE POLICY "docserv versions read" ON public.docserv_document_versions FOR SELECT TO authenticated
  USING (public.docserv_can_read(person_id, school_id));
DROP POLICY IF EXISTS "docserv events read" ON public.docserv_document_events;
CREATE POLICY "docserv events read" ON public.docserv_document_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.docserv_document_versions v WHERE v.id = version_id AND public.docserv_can_read(v.person_id, v.school_id)));

DROP TRIGGER IF EXISTS docserv_versions_no_change ON public.docserv_document_versions;
CREATE TRIGGER docserv_versions_no_change BEFORE UPDATE OR DELETE ON public.docserv_document_versions FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();
DROP TRIGGER IF EXISTS docserv_events_no_change ON public.docserv_document_events;
CREATE TRIGGER docserv_events_no_change BEFORE UPDATE OR DELETE ON public.docserv_document_events FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();

-- Envio: próprio servidor ou escola onde ele atua (com capability). Arquivo precisa estar no caminho <person>/<document>/...
CREATE OR REPLACE FUNCTION public.docserv_submit_document(_document uuid, _person uuid, _type text, _season text, _school text,
  _path text, _sha text, _mime text, _size integer, _issuer text, _issued date, _valid_until date, _expected_version integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head public.docserv_document_versions; _vid uuid; _own boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  _own := _person = public.docserv_my_person();
  IF _school IS NOT NULL AND NOT (public.has_school_capability('gerir-documentos-funcionais', _school) AND public.docserv_person_in_school(_person, _school)) THEN
    RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _school IS NULL AND NOT _own THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _path IS NULL OR split_part(_path, '/', 1) <> _person::text OR split_part(_path, '/', 2) <> _document::text THEN RAISE EXCEPTION 'docserv:invalid-path'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'docserv-documentos' AND o.name = _path) THEN RAISE EXCEPTION 'docserv:file-missing'; END IF;
  IF _valid_until IS NOT NULL AND _issued IS NOT NULL AND _valid_until < _issued THEN RAISE EXCEPTION 'docserv:invalid-dates'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docserv-doc:' || _document::text));
  SELECT * INTO _head FROM public.docserv_document_versions WHERE document_id = _document ORDER BY version DESC LIMIT 1;
  IF coalesce(_head.version, 0) <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'docserv:stale-base'; END IF;
  IF _head.id IS NOT NULL AND (_head.person_id <> _person OR _head.type_code <> _type) THEN RAISE EXCEPTION 'docserv:document-mismatch'; END IF;
  INSERT INTO public.docserv_document_versions (document_id, version, previous_version_id, person_id, type_code, season, school_id, storage_path, sha256, mime_type, size_bytes, issuer, issued_on, valid_until, submitted_by)
  VALUES (_document, coalesce(_head.version, 0) + 1, _head.id, _person, _type, _season, _school, _path, lower(_sha), _mime, _size, nullif(btrim(_issuer), ''), _issued, _valid_until, auth.uid())
  RETURNING id INTO _vid;
  INSERT INTO public.docserv_document_events (document_id, version_id, seq, kind, status, actor)
  VALUES (_document, _vid, coalesce((SELECT max(seq) FROM public.docserv_document_events WHERE document_id = _document), 0) + 1, 'enviado', 'pendente_validacao', auth.uid());
  INSERT INTO public.docserv_audit_events (action, actor, school_id, subject_ref, detail)
  VALUES ('documento-enviado', auth.uid(), _school, _document::text, jsonb_build_object('version', coalesce(_head.version, 0) + 1, 'type', _type, 'season', _season));
  RETURN _vid;
END $$;

-- Revisão: só capability de validação (rede) ou da escola vinculada; nunca o próprio servidor.
CREATE OR REPLACE FUNCTION public.docserv_review_document(_document uuid, _status text, _note text, _expected_seq integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.docserv_document_versions; _seq int; _del boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF _status NOT IN ('valido','rejeitado','alerta_revisao_urgente') THEN RAISE EXCEPTION 'docserv:invalid-status'; END IF;
  SELECT * INTO v FROM public.docserv_document_versions WHERE document_id = _document ORDER BY version DESC LIMIT 1;
  IF v.id IS NULL THEN RAISE EXCEPTION 'docserv:not-found'; END IF;
  IF v.person_id = public.docserv_my_person() THEN RAISE EXCEPTION 'docserv:self-review'; END IF;
  IF NOT (public.has_network_capability('validar-documentos-funcionais')
          OR (v.school_id IS NOT NULL AND public.has_school_capability('validar-documentos-funcionais', v.school_id) AND public.docserv_person_in_school(v.person_id, v.school_id)))
    THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _status IN ('rejeitado','alerta_revisao_urgente') AND length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'docserv:reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docserv-doc:' || _document::text));
  SELECT coalesce(max(seq), 0) INTO _seq FROM public.docserv_document_events WHERE document_id = _document;
  IF _seq <> _expected_seq THEN RAISE EXCEPTION 'docserv:stale-base'; END IF;
  SELECT kind = 'excluido-logico' INTO _del FROM public.docserv_document_events WHERE document_id = _document ORDER BY seq DESC LIMIT 1;
  IF _del THEN RAISE EXCEPTION 'docserv:deleted'; END IF;
  INSERT INTO public.docserv_document_events (document_id, version_id, seq, kind, status, note, actor)
  VALUES (_document, v.id, _seq + 1, 'revisado', _status, nullif(btrim(_note), ''), auth.uid());
  INSERT INTO public.docserv_audit_events (action, actor, school_id, subject_ref, detail)
  VALUES ('documento-revisado', auth.uid(), v.school_id, _document::text, jsonb_build_object('status', _status, 'version', v.version));
  RETURN _seq + 1;
END $$;

-- Exclusão lógica: autor do envio ou rede competente; arquivo e versões permanecem (exclusão permanente fica para política de retenção).
CREATE OR REPLACE FUNCTION public.docserv_delete_document(_document uuid, _reason text, _expected_seq integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.docserv_document_versions; _seq int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'docserv:reason-required'; END IF;
  SELECT * INTO v FROM public.docserv_document_versions WHERE document_id = _document ORDER BY version DESC LIMIT 1;
  IF v.id IS NULL THEN RAISE EXCEPTION 'docserv:not-found'; END IF;
  IF NOT (v.submitted_by = auth.uid() OR public.has_network_capability('validar-documentos-funcionais')) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docserv-doc:' || _document::text));
  SELECT coalesce(max(seq), 0) INTO _seq FROM public.docserv_document_events WHERE document_id = _document;
  IF _seq <> _expected_seq THEN RAISE EXCEPTION 'docserv:stale-base'; END IF;
  INSERT INTO public.docserv_document_events (document_id, version_id, seq, kind, note, actor) VALUES (_document, v.id, _seq + 1, 'excluido-logico', btrim(_reason), auth.uid());
  INSERT INTO public.docserv_audit_events (action, actor, school_id, subject_ref, detail) VALUES ('documento-excluido-logico', auth.uid(), v.school_id, _document::text, '{}'::jsonb);
  RETURN _seq + 1;
END $$;

-- Leitura: situação atual por documento; "vencido" derivado de valid_until.
CREATE OR REPLACE FUNCTION public.docserv_documents_at(_person uuid DEFAULT NULL, _school text DEFAULT NULL, _include_deleted boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'submitted_at' DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('document_id', v.document_id, 'version', v.version, 'version_id', v.id, 'person_id', v.person_id,
      'masked_name', (SELECT public.educacenso_mask_name(p.display_name) FROM public.institutional_persons p WHERE p.id::text = v.person_id::text),
      'type', v.type_code, 'season', v.season, 'school_id', v.school_id, 'path', v.storage_path, 'sha256', v.sha256, 'mime', v.mime_type,
      'size', v.size_bytes, 'issuer', v.issuer, 'issued_on', v.issued_on, 'valid_until', v.valid_until, 'submitted_at', v.submitted_at,
      'submitted_by_me', v.submitted_by = auth.uid(), 'seq', e.seq, 'last_event', e.kind,
      'status', CASE WHEN e.kind = 'excluido-logico' THEN 'excluido'
                     WHEN v.valid_until IS NOT NULL AND v.valid_until < current_date THEN 'vencido'
                     ELSE coalesce((SELECT e2.status FROM public.docserv_document_events e2 WHERE e2.document_id = v.document_id AND e2.version_id = v.id AND e2.status IS NOT NULL ORDER BY e2.seq DESC LIMIT 1), 'pendente_validacao') END,
      'note', (SELECT e3.note FROM public.docserv_document_events e3 WHERE e3.document_id = v.document_id AND e3.version_id = v.id AND e3.kind = 'revisado' ORDER BY e3.seq DESC LIMIT 1)) AS x
    FROM (SELECT DISTINCT ON (document_id) * FROM public.docserv_document_versions ORDER BY document_id, version DESC) v
    JOIN LATERAL (SELECT * FROM public.docserv_document_events e WHERE e.document_id = v.document_id ORDER BY e.seq DESC LIMIT 1) e ON true
    WHERE (_person IS NULL OR v.person_id = _person) AND (_school IS NULL OR v.school_id = _school)
      AND (_include_deleted OR e.kind <> 'excluido-logico')
    LIMIT 500) q
$$;

REVOKE ALL ON FUNCTION public.docserv_person_in_school(uuid, text), public.docserv_my_person(), public.docserv_can_read(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.docserv_submit_document(uuid, uuid, text, text, text, text, text, text, integer, text, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.docserv_review_document(uuid, text, text, integer), public.docserv_delete_document(uuid, text, integer), public.docserv_documents_at(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.docserv_person_in_school(uuid, text), public.docserv_my_person(), public.docserv_can_read(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.docserv_submit_document(uuid, uuid, text, text, text, text, text, text, integer, text, date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.docserv_review_document(uuid, text, text, integer), public.docserv_delete_document(uuid, text, integer), public.docserv_documents_at(uuid, text, boolean) TO authenticated;

-- Storage: pasta <person_id>/<document_id>/arquivo. Gravar: próprio servidor ou escola vinculada; ler: quem pode ler o documento. Sem update/delete.
DROP POLICY IF EXISTS "docserv objects insert" ON storage.objects;
CREATE POLICY "docserv objects insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'docserv-documentos' AND (
    (storage.foldername(name))[1] = public.docserv_my_person()::text
    OR EXISTS (SELECT 1 FROM public.institutional_engagements g WHERE g.person_id::text = (storage.foldername(name))[1]
       AND (g.valid_until IS NULL OR g.valid_until >= current_date) AND public.has_school_capability('gerir-documentos-funcionais', g.school_id::text))));
DROP POLICY IF EXISTS "docserv objects read" ON storage.objects;
CREATE POLICY "docserv objects read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'docserv-documentos' AND EXISTS (SELECT 1 FROM public.docserv_document_versions v WHERE v.storage_path = name AND public.docserv_can_read(v.person_id, v.school_id))
  OR (bucket_id = 'docserv-documentos' AND (storage.foldername(name))[1] = public.docserv_my_person()::text));