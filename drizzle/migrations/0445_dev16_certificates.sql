-- SIGEM Desenvolvimento L16: certificado versionado → validação humana → emissão com código único; PDF é versão no SIGEM Documentos (DocServ).
CREATE TABLE public.dev_certificate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  version int NOT NULL CHECK (version >= 1),
  completion_assessment_id uuid NOT NULL REFERENCES public.dev_completion_confirmations(assessment_id),
  course_title text NOT NULL,
  hours_minutes int NOT NULL CHECK (hours_minutes > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  institution text NOT NULL CHECK (length(btrim(institution)) BETWEEN 3 AND 200),
  pdf_document_version uuid NOT NULL REFERENCES public.docserv_document_versions(id),
  pdf_sha256 text NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, version),
  CHECK (period_end >= period_start),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.dev_certificate_validations (
  version_id uuid PRIMARY KEY REFERENCES public.dev_certificate_versions(id),
  decision text NOT NULL CHECK (decision IN ('validado','recusado')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  validator_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_certificate_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL UNIQUE REFERENCES public.dev_certificate_validations(version_id),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  verification_code text NOT NULL UNIQUE DEFAULT ('CERT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,20))),
  supersedes uuid UNIQUE REFERENCES public.dev_certificate_issuances(id),
  issuer_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_certificate_revocations (
  issuance_id uuid PRIMARY KEY REFERENCES public.dev_certificate_issuances(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  revoker_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dev_certificate_versions, public.dev_certificate_validations, public.dev_certificate_issuances, public.dev_certificate_revocations TO authenticated;
GRANT ALL ON public.dev_certificate_versions, public.dev_certificate_validations, public.dev_certificate_issuances, public.dev_certificate_revocations TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_certificate_versions, public.dev_certificate_validations, public.dev_certificate_issuances, public.dev_certificate_revocations FROM authenticated, anon;
-- Referência do PDF fica oculta para leitura direta (sai só pelo DocServ com sua ACL).
REVOKE SELECT ON public.dev_certificate_versions FROM authenticated;
GRANT SELECT (id, enrollment_id, version, completion_assessment_id, course_title, hours_minutes, period_start, period_end, institution, pdf_sha256, content_sha256, reason, author_person, created_at)
  ON public.dev_certificate_versions TO authenticated;
ALTER TABLE public.dev_certificate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_certificate_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_certificate_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_certificate_revocations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.dev_cert_enrollment_readable(_enrollment uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id = _enrollment
    AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.has_network_capability('validar-certificados-de-formacao')))
$$;
REVOKE EXECUTE ON FUNCTION public.dev_cert_enrollment_readable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_cert_enrollment_readable(uuid) TO authenticated;
CREATE POLICY "dev cert versions read" ON public.dev_certificate_versions FOR SELECT TO authenticated USING (public.dev_cert_enrollment_readable(enrollment_id));
CREATE POLICY "dev cert validations read" ON public.dev_certificate_validations FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_certificate_versions v WHERE v.id = version_id AND public.dev_cert_enrollment_readable(v.enrollment_id)));
CREATE POLICY "dev cert issuances read" ON public.dev_certificate_issuances FOR SELECT TO authenticated USING (public.dev_cert_enrollment_readable(enrollment_id));
CREATE POLICY "dev cert revocations read" ON public.dev_certificate_revocations FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_certificate_issuances i WHERE i.id = issuance_id AND public.dev_cert_enrollment_readable(i.enrollment_id)));
CREATE TRIGGER devcv_immutable BEFORE UPDATE OR DELETE ON public.dev_certificate_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcval_immutable BEFORE UPDATE OR DELETE ON public.dev_certificate_validations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devciss_immutable BEFORE UPDATE OR DELETE ON public.dev_certificate_issuances FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcrev_immutable BEFORE UPDATE OR DELETE ON public.dev_certificate_revocations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Versão: conteúdo vem das fontes canônicas (curso da turma, período da turma, conclusão confirmada L15); só instituição e PDF são informados.
CREATE OR REPLACE FUNCTION public.record_dev_certificate_version(_enrollment uuid, _expected_version int, _institution text, _pdf uuid, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int; _e public.dev_enrollments; _cf public.dev_completion_confirmations;
  _title text; _hours int; _s date; _f date; _pdf_sha text; _content jsonb;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_certificate_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('certificar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _e.person_id = _p THEN RAISE EXCEPTION 'dev:segregation'; END IF;
  SELECT * INTO _cf FROM public.dev_completion_confirmations WHERE enrollment_id = _enrollment AND decision = 'conclusao';
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:not-concluded'; END IF;
  SELECT v.title, v.hours_minutes, k.starts_on, k.ends_on INTO _title, _hours, _s, _f
    FROM public.dev_classes k JOIN public.dev_course_versions v ON v.id = k.course_version_id WHERE k.id = _e.class_id;
  SELECT sha256 INTO _pdf_sha FROM public.docserv_document_versions WHERE id = _pdf AND mime_type = 'application/pdf';
  IF _pdf_sha IS NULL OR _pdf_sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'dev:invalid-document'; END IF;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_certificate_versions WHERE enrollment_id = _enrollment;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  _content := jsonb_build_object('enrollment', _enrollment, 'course_title', _title, 'hours_minutes', _hours, 'period_start', _s, 'period_end', _f,
    'institution', btrim(_institution), 'pdf_sha256', _pdf_sha, 'completion', _cf.assessment_id);
  INSERT INTO public.dev_certificate_versions(enrollment_id, version, completion_assessment_id, course_title, hours_minutes, period_start, period_end,
    institution, pdf_document_version, pdf_sha256, content_sha256, reason, author_person, idempotency_key)
  VALUES (_enrollment, _last + 1, _cf.assessment_id, _title, _hours, _s, _f, btrim(_institution), _pdf, _pdf_sha,
    encode(sha256(convert_to(_content::text, 'UTF8')), 'hex'), nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Validação humana: pessoa ≠ autor, ≠ titular, ≠ quem confirmou a conclusão.
CREATE OR REPLACE FUNCTION public.validate_dev_certificate(_version uuid, _decision text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_certificate_versions; _owner uuid; _confirmer uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_certificate_validations WHERE version_id = _version AND validator_person = _p AND decision = _decision) THEN RETURN; END IF;
  IF NOT public.has_network_capability('validar-certificados-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _v FROM public.dev_certificate_versions WHERE id = _version;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT person_id INTO _owner FROM public.dev_enrollments WHERE id = _v.enrollment_id;
  SELECT confirmer_person INTO _confirmer FROM public.dev_completion_confirmations WHERE assessment_id = _v.completion_assessment_id;
  IF _p IN (_v.author_person, _owner, _confirmer) THEN RAISE EXCEPTION 'dev:segregation'; END IF;
  IF _v.version <> (SELECT max(version) FROM public.dev_certificate_versions WHERE enrollment_id = _v.enrollment_id) THEN RAISE EXCEPTION 'dev:not-latest'; END IF;
  INSERT INTO public.dev_certificate_validations(version_id, decision, reason, validator_person) VALUES (_version, _decision, btrim(_reason), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Emissão: só versão validada e mais recente; PDF ainda com o mesmo hash; nova emissão substitui explicitamente a anterior (nunca silenciosa).
CREATE OR REPLACE FUNCTION public.issue_dev_certificate(_version uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_certificate_versions; _code text; _prev uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT verification_code INTO _code FROM public.dev_certificate_issuances WHERE version_id = _version;
  IF _code IS NOT NULL THEN RETURN _code; END IF;
  IF NOT public.has_network_capability('certificar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _v FROM public.dev_certificate_versions WHERE id = _version;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  PERFORM 1 FROM public.dev_enrollments WHERE id = _v.enrollment_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.dev_certificate_validations WHERE version_id = _version AND decision = 'validado') THEN RAISE EXCEPTION 'dev:not-validated'; END IF;
  IF _v.version <> (SELECT max(version) FROM public.dev_certificate_versions WHERE enrollment_id = _v.enrollment_id) THEN RAISE EXCEPTION 'dev:not-latest'; END IF;
  IF (SELECT sha256 FROM public.docserv_document_versions WHERE id = _v.pdf_document_version) IS DISTINCT FROM _v.pdf_sha256 THEN RAISE EXCEPTION 'dev:document-changed'; END IF;
  SELECT i.id INTO _prev FROM public.dev_certificate_issuances i WHERE i.enrollment_id = _v.enrollment_id
    AND NOT EXISTS (SELECT 1 FROM public.dev_certificate_issuances n WHERE n.supersedes = i.id) ORDER BY i.created_at DESC LIMIT 1;
  IF _prev IS NOT NULL AND _v.reason IS NULL THEN RAISE EXCEPTION 'dev:reason-required'; END IF;
  INSERT INTO public.dev_certificate_issuances(version_id, enrollment_id, supersedes, issuer_person)
  VALUES (_version, _v.enrollment_id, _prev, _p) RETURNING verification_code INTO _code;
  RETURN _code;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_dev_certificate(_issuance uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_certificate_revocations WHERE issuance_id = _issuance) THEN RETURN; END IF;
  IF NOT public.has_network_capability('validar-certificados-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_certificate_issuances WHERE id = _issuance) THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  INSERT INTO public.dev_certificate_revocations(issuance_id, reason, revoker_person) VALUES (_issuance, btrim(_reason), _p);
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Verificação pública por código: situação + dados do certificado + hash do PDF; nunca nome, CPF ou matrícula. Inexistente e malformado respondem igual.
CREATE OR REPLACE FUNCTION public.verify_dev_certificate(_code text)
RETURNS TABLE(status text, course_title text, hours_minutes int, period_start date, period_end date, institution text, version int, issued_on date, pdf_sha256 text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.dev_certificate_revocations r WHERE r.issuance_id = i.id) THEN 'revogado'
              WHEN EXISTS (SELECT 1 FROM public.dev_certificate_issuances n WHERE n.supersedes = i.id) THEN 'substituido'
              ELSE 'valido' END,
         v.course_title, v.hours_minutes, v.period_start, v.period_end, v.institution, v.version, i.created_at::date, v.pdf_sha256
  FROM public.dev_certificate_issuances i JOIN public.dev_certificate_versions v ON v.id = i.version_id
  WHERE i.verification_code = upper(btrim(coalesce(_code,'')))
  UNION ALL SELECT 'nao-encontrado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM public.dev_certificate_issuances WHERE verification_code = upper(btrim(coalesce(_code,''))))
$$;

-- Caminho antigo (sem validação humana nem versão) fica fechado; tabela antiga está vazia.
REVOKE EXECUTE ON FUNCTION public.issue_dev_certification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.dev_certifications IS 'DEPRECATED: replaced by dev_certificate_versions/validations/issuances (L16)';
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_certificate_version(uuid,int,text,uuid,text,text)','validate_dev_certificate(uuid,text,text)',
    'issue_dev_certificate(uuid)','revoke_dev_certificate(uuid,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_dev_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_dev_certificate(text) TO anon, authenticated;