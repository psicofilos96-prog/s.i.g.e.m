-- Matrículas L09: documentos digitais do pedido. Bucket privado `enr-documentos`; caminho emitido só após código+conferência.
-- Versões e conferências append-only; pendência documental NUNCA bloqueia o pedido nem o direito à educação (nenhum trigger/constraint o faz).
CREATE TABLE public.enr_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  doc_type text NOT NULL CHECK (doc_type IN ('identificacao-estudante','identificacao-responsavel','comprovante-residencia','historico-escolar','declaracao-escolar','outro')),
  version int NOT NULL CHECK (version >= 1),
  object_path text NOT NULL UNIQUE CHECK (object_path ~ '^inscricoes/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes int NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  declared_sha256 text NOT NULL CHECK (declared_sha256 ~ '^[0-9a-f]{64}$'),
  slot_expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, doc_type, version)
);
CREATE TABLE public.enr_document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.enr_application_documents(id),
  seq int NOT NULL CHECK (seq >= 1),
  outcome text NOT NULL CHECK (outcome IN ('conferido','complementacao-solicitada','recusado','vinculado-ged')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  ged_case_id uuid REFERENCES public.admin_case_files(id),
  reviewer_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, seq),
  CHECK ((outcome = 'vinculado-ged') = (ged_case_id IS NOT NULL))
);
GRANT SELECT ON public.enr_application_documents, public.enr_document_reviews TO authenticated;
GRANT ALL ON public.enr_application_documents, public.enr_document_reviews TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_application_documents, public.enr_document_reviews FROM authenticated, anon;
ALTER TABLE public.enr_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_document_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr docs read" ON public.enr_application_documents FOR SELECT TO authenticated USING (public.has_network_capability('conferir-documentos-de-ingresso'));
CREATE POLICY "enr doc reviews read" ON public.enr_document_reviews FOR SELECT TO authenticated USING (public.has_network_capability('conferir-documentos-de-ingresso'));
CREATE TRIGGER enr_docs_append_only BEFORE UPDATE OR DELETE ON public.enr_application_documents FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_doc_reviews_append_only BEFORE UPDATE OR DELETE ON public.enr_document_reviews FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Portal: pede vaga de envio. Código+conferência inválidos ⇒ 'indisponivel' uniforme. Devolve caminho único (válido 30 min).
CREATE OR REPLACE FUNCTION public.enr_public_request_document_slot(_code text, _check text, _doc_type text, _mime text, _size int, _sha256 text, _key text)
RETURNS TABLE(status text, object_path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _app uuid; _hash text; _id uuid := gen_random_uuid(); _v int; _ext text; _path text; _n int;
BEGIN
  IF _key IS NULL OR length(_key) < 16 THEN RETURN QUERY SELECT 'invalido'::text, NULL::text; RETURN; END IF;
  SELECT d.object_path INTO _path FROM public.enr_application_documents d WHERE d.idempotency_key = _key;
  IF _path IS NOT NULL THEN RETURN QUERY SELECT 'ja-registrado'::text, _path; RETURN; END IF;
  IF _code IS NULL OR _check IS NULL OR btrim(_code) !~ '^INS-[0-9A-F]{10}$' OR lower(btrim(_check)) !~ '^[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text; RETURN; END IF;
  SELECT a.id, a.check_hash INTO _app, _hash FROM public.enr_applications a WHERE a.application_code = btrim(_code);
  IF _hash IS NULL OR _hash <> encode(extensions.digest(lower(btrim(_check)), 'sha256'), 'hex') THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text; RETURN; END IF;
  _ext := CASE _mime WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' END;
  IF _ext IS NULL OR _size IS NULL OR _size < 1 OR _size > 10485760 OR _sha256 !~ '^[0-9a-f]{64}$'
     OR _doc_type NOT IN ('identificacao-estudante','identificacao-responsavel','comprovante-residencia','historico-escolar','declaracao-escolar','outro') THEN
    RETURN QUERY SELECT 'invalido'::text, NULL::text; RETURN; END IF;
  SELECT count(*) INTO _n FROM public.enr_application_documents WHERE application_id = _app;
  IF _n >= 30 THEN RETURN QUERY SELECT 'limite'::text, NULL::text; RETURN; END IF;
  PERFORM 1 FROM public.enr_applications WHERE id = _app FOR UPDATE;
  SELECT coalesce(max(version),0) + 1 INTO _v FROM public.enr_application_documents WHERE application_id = _app AND doc_type = _doc_type;
  _path := 'inscricoes/' || _app || '/' || _id || '.' || _ext;
  INSERT INTO public.enr_application_documents(id, application_id, doc_type, version, object_path, mime_type, size_bytes, declared_sha256, slot_expires_at, idempotency_key)
  VALUES (_id, _app, _doc_type, _v, _path, _mime, _size, _sha256, now() + interval '30 minutes', _key);
  RETURN QUERY SELECT 'ok'::text, _path;
END $$;

-- Storage: anon só INSERE no caminho exato emitido, dentro da validade e uma única vez. Sem leitura/alteração/remoção pública.
CREATE OR REPLACE FUNCTION public.enr_document_slot_open(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.enr_application_documents d WHERE d.object_path = _name AND d.slot_expires_at > now())
     AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'enr-documentos' AND o.name = _name)
$$;
CREATE POLICY "enr docs upload slot" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'enr-documentos' AND public.enr_document_slot_open(name));
CREATE POLICY "enr docs staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'enr-documentos' AND public.has_network_capability('conferir-documentos-de-ingresso'));

-- Conferência pela equipe: seq esperado, idempotente, competência explícita; GED só referencia processo existente.
CREATE OR REPLACE FUNCTION public.record_enr_document_review(_doc uuid, _expected_seq int, _outcome text, _reason text, _ged_case uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int; _path text;
BEGIN
  SELECT id INTO _id FROM public.enr_document_reviews WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('conferir-documentos-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT object_path INTO _path FROM public.enr_application_documents WHERE id = _doc FOR UPDATE;
  IF _path IS NULL THEN RAISE EXCEPTION 'documento-inexistente'; END IF;
  IF _outcome IN ('conferido','recusado') AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'enr-documentos' AND o.name = _path) THEN
    RAISE EXCEPTION 'arquivo-nao-enviado'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.enr_document_reviews WHERE document_id = _doc;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'sequencia-desatualizada'; END IF;
  INSERT INTO public.enr_document_reviews(document_id, seq, outcome, reason, ged_case_id, reviewer_person, idempotency_key)
  VALUES (_doc, _last + 1, _outcome, _reason, CASE WHEN _outcome = 'vinculado-ged' THEN _ged_case END, _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Portal: situação dos documentos do próprio pedido (sem caminhos, sem motivos internos além do pedido de complementação).
CREATE OR REPLACE FUNCTION public.enr_public_application_documents(_code text, _check text)
RETURNS TABLE(doc_type text, version int, situation text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _app uuid; _hash text;
BEGIN
  IF _code IS NULL OR _check IS NULL OR btrim(_code) !~ '^INS-[0-9A-F]{10}$' OR lower(btrim(_check)) !~ '^[0-9a-f]{12}$' THEN RETURN; END IF;
  SELECT a.id, a.check_hash INTO _app, _hash FROM public.enr_applications a WHERE a.application_code = btrim(_code);
  IF _hash IS NULL OR _hash <> encode(extensions.digest(lower(btrim(_check)), 'sha256'), 'hex') THEN RETURN; END IF;
  RETURN QUERY SELECT d.doc_type, d.version,
    coalesce((SELECT r.outcome FROM public.enr_document_reviews r WHERE r.document_id = d.id AND r.outcome <> 'vinculado-ged' ORDER BY r.seq DESC LIMIT 1),
      CASE WHEN EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'enr-documentos' AND o.name = d.object_path) THEN 'em-conferencia' ELSE 'nao-enviado' END)
  FROM public.enr_application_documents d WHERE d.application_id = _app ORDER BY d.doc_type, d.version;
END $$;

REVOKE ALL ON FUNCTION public.enr_public_request_document_slot(text,text,text,text,int,text,text), public.enr_document_slot_open(text),
  public.record_enr_document_review(uuid,int,text,text,uuid,text), public.enr_public_application_documents(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enr_public_request_document_slot(text,text,text,text,int,text,text), public.enr_public_application_documents(text,text), public.enr_document_slot_open(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_enr_document_review(uuid,int,text,text,uuid,text) TO authenticated;