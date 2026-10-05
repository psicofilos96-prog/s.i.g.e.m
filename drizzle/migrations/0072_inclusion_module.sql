-- Inclusão (NEI/AEE/mediação). Mínimo necessário, finalidade educacional, sem prontuário.
-- Nenhum campo de diagnóstico/CID/deficiência; categorias só de catálogos homologados, sem seed.
-- Capabilities escolares sem regra de política (fechadas até decisão do proprietário):
--   registrar-apoio-inclusivo · consultar-apoio-inclusivo · manter-mediacao-escolar
--   anexar-documento-inclusao · consultar-documento-sensivel-inclusao
-- Nada é concedido por cargo, turma, AEE ou mediação: mediador lê só educandos com vínculo vigente.

CREATE FUNCTION public.inclusion_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('registrar-apoio-inclusivo','consultar-apoio-inclusivo','manter-mediacao-escolar','anexar-documento-inclusao','consultar-documento-sensivel-inclusao')
    THEN RAISE EXCEPTION 'inclusion:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'inclusion:school-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  RETURN g; -- NULL quando ausente; chamadores decidem (falha fechada)
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.inclusion_require(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid := public.inclusion_grant(_capability, _school);
BEGIN IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF; RETURN g; END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_require(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- 1/2/3/5/7 — registros pedagógicos versionados de inclusão (necessidade de apoio, participação AEE separada da
-- matrícula, atendimento AEE, plano/estratégias, relatório pedagógico). Tipo de registro é estrutura; categoria é catálogo.
CREATE TABLE public.inclusion_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.inclusion_records(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','encerramento')),
  record_type text NOT NULL CHECK (record_type IN ('necessidade-de-apoio','participacao-aee','atendimento-aee','plano-educacional','relatorio-pedagogico')),
  school_id text NOT NULL,
  student_id text NOT NULL,
  category_scheme_id text,
  category_value_id text,
  category_value_version integer,
  educational_purpose text NOT NULL CHECK (length(btrim(educational_purpose)) > 0 AND length(educational_purpose) <= 500),
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 6000),
  valid_from date NOT NULL,
  valid_to date,
  share_with_mediation boolean NOT NULL DEFAULT false,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id text,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK ((category_value_id IS NULL) = (category_scheme_id IS NULL)),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE UNIQUE INDEX inclusion_records_one_successor ON public.inclusion_records (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX inclusion_records_student ON public.inclusion_records (school_id, student_id);
REVOKE ALL ON public.inclusion_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.inclusion_records TO service_role;
ALTER TABLE public.inclusion_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inclusion_records_append_only BEFORE UPDATE OR DELETE ON public.inclusion_records FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- 4 — mediação: vínculo atuação do mediador ↔ educando (turma opcional) por vigência. Não carrega condição alguma.
CREATE TABLE public.inclusion_mediation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.inclusion_mediation_assignments(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','encerramento')),
  school_id text NOT NULL,
  student_id text NOT NULL,
  class_id text,
  mediator_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  valid_from date NOT NULL,
  valid_to date,
  reason text,
  author_user_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE UNIQUE INDEX inclusion_mediation_one_successor ON public.inclusion_mediation_assignments (supersedes_id) WHERE supersedes_id IS NOT NULL;
REVOKE ALL ON public.inclusion_mediation_assignments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.inclusion_mediation_assignments TO service_role;
ALTER TABLE public.inclusion_mediation_assignments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inclusion_mediation_append_only BEFORE UPDATE OR DELETE ON public.inclusion_mediation_assignments FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- 6/8 — anexos: só metadados no banco; conteúdo em armazenamento privado sem política de cliente.
-- Classificação 'clinico' é segregada: exige capability sensível própria, nunca chega a mediação/relatório.
CREATE TABLE public.inclusion_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_logical_id uuid NOT NULL,
  school_id text NOT NULL,
  student_id text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('pedagogico','clinico')),
  purpose text NOT NULL CHECK (length(btrim(purpose)) > 0 AND length(purpose) <= 300),
  storage_path text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  author_user_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_reason text
);
REVOKE ALL ON public.inclusion_attachments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.inclusion_attachments TO service_role;
ALTER TABLE public.inclusion_attachments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inclusion_attachments_append_only BEFORE UPDATE OR DELETE ON public.inclusion_attachments FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- Trilha de acesso: quem, quando, qual anexo, finalidade e resultado. Nunca conteúdo nem nome do arquivo.
CREATE TABLE public.inclusion_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public.inclusion_attachments(id),
  user_id uuid NOT NULL,
  engagement_id uuid,
  purpose text NOT NULL CHECK (length(purpose) <= 300),
  granted boolean NOT NULL,
  denial_code text,
  at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.inclusion_access_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.inclusion_access_events TO service_role;
ALTER TABLE public.inclusion_access_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inclusion_access_append_only BEFORE UPDATE OR DELETE ON public.inclusion_access_events FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- Writers -------------------------------------------------------------------------------------------
CREATE FUNCTION public.record_inclusion_record(_base_id uuid, _kind text, _record_type text, _school text, _student text,
  _category_scheme text, _category_value text, _purpose text, _body text, _valid_from date, _valid_to date, _share_with_mediation boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.inclusion_records; cat record; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','encerramento') THEN RAISE EXCEPTION 'inclusion:kind-invalid'; END IF;
  IF _kind = 'registro' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'inclusion:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.inclusion_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'inclusion:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.inclusion_records WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'inclusion:base-superseded'; END IF;
    IF base.event_kind = 'encerramento' THEN RAISE EXCEPTION 'inclusion:already-closed'; END IF;
    _record_type := base.record_type; _school := base.school_id; _student := base.student_id;
    IF _kind = 'encerramento' THEN
      _category_scheme := base.category_scheme_id; _category_value := base.category_value_id; _purpose := base.educational_purpose;
      _body := base.body; _valid_from := base.valid_from; _share_with_mediation := base.share_with_mediation;
      IF _valid_to IS NULL THEN RAISE EXCEPTION 'inclusion:valid-to-required'; END IF;
    END IF;
  END IF;
  g := public.inclusion_require('registrar-apoio-inclusivo', _school);
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN
    RAISE EXCEPTION 'inclusion:student-not-in-school'; END IF;
  IF _category_value IS NOT NULL THEN
    SELECT d.value_id, d.version INTO cat FROM public.attribute_value_definitions d
     WHERE d.scheme_id = _category_scheme AND d.value_id = _category_value AND d.status = 'homologado' ORDER BY d.version DESC LIMIT 1;
    IF cat.value_id IS NULL THEN RAISE EXCEPTION 'inclusion:category-not-homologated'; END IF;
  END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'inclusion:valid-from-required'; END IF;
  INSERT INTO public.inclusion_records(logical_id, version, supersedes_id, event_kind, record_type, school_id, student_id,
    category_scheme_id, category_value_id, category_value_version, educational_purpose, body, valid_from, valid_to, share_with_mediation,
    reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _record_type, _school, _student,
    CASE WHEN _category_value IS NULL THEN NULL ELSE _category_scheme END, cat.value_id, cat.version, _purpose, _body, _valid_from, _valid_to,
    coalesce(_share_with_mediation,false), nullif(btrim(_reason),''), auth.uid(), public.current_person_id(), g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_inclusion_record(uuid,text,text,text,text,text,text,text,text,date,date,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inclusion_record(uuid,text,text,text,text,text,text,text,text,date,date,boolean,text) TO authenticated;

CREATE FUNCTION public.record_inclusion_mediation(_base_id uuid, _kind text, _school text, _student text, _class text,
  _mediator_engagement uuid, _valid_from date, _valid_to date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.inclusion_mediation_assignments; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','encerramento') THEN RAISE EXCEPTION 'inclusion:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.inclusion_mediation_assignments WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'inclusion:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'inclusion:base-superseded'; END IF;
    IF base.event_kind = 'encerramento' THEN RAISE EXCEPTION 'inclusion:already-closed'; END IF;
    _school := base.school_id; _student := base.student_id;
    IF _kind = 'encerramento' THEN _class := base.class_id; _mediator_engagement := base.mediator_engagement_id; _valid_from := base.valid_from;
      IF _valid_to IS NULL THEN RAISE EXCEPTION 'inclusion:valid-to-required'; END IF; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'inclusion:base-not-allowed';
  END IF;
  g := public.inclusion_require('manter-mediacao-escolar', _school);
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN
    RAISE EXCEPTION 'inclusion:student-not-in-school'; END IF;
  IF _class IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class AND c.school_id = _school) THEN
    RAISE EXCEPTION 'inclusion:class-not-in-school'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _mediator_engagement AND e.school_id = _school) THEN
    RAISE EXCEPTION 'inclusion:mediator-not-in-school'; END IF;
  INSERT INTO public.inclusion_mediation_assignments(logical_id, version, supersedes_id, event_kind, school_id, student_id, class_id,
    mediator_engagement_id, valid_from, valid_to, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _student, _class,
    _mediator_engagement, _valid_from, _valid_to, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_inclusion_mediation(uuid,text,text,text,text,uuid,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inclusion_mediation(uuid,text,text,text,text,uuid,date,date,text) TO authenticated;

-- Mediação vigente da própria conta para o educando (relação funcional, não cargo).
CREATE FUNCTION public.inclusion_my_mediation(_student text, _on date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.inclusion_mediation_assignments m
    JOIN public.institutional_engagements e ON e.id = m.mediator_engagement_id
    JOIN public.user_person_links l ON l.person_id = e.person_id AND l.user_id = auth.uid()
    WHERE m.student_id = _student AND m.event_kind <> 'encerramento'
      AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments s WHERE s.supersedes_id = m.id)
      AND m.valid_from <= _on AND (m.valid_to IS NULL OR m.valid_to >= _on))
$fn$;
REVOKE ALL ON FUNCTION public.inclusion_my_mediation(text, date) FROM PUBLIC, anon, authenticated, service_role;

-- Readers ------------------------------------------------------------------------------------------
CREATE FUNCTION public.inclusion_records_at(_school text, _student text, _known_at timestamptz, _logical_id uuid)
RETURNS SETOF public.inclusion_records LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now()); full_access boolean; mediation boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  full_access := public.inclusion_grant('consultar-apoio-inclusivo', _school) IS NOT NULL;
  mediation := NOT full_access AND _student IS NOT NULL AND public.inclusion_my_mediation(_student, CURRENT_DATE);
  IF NOT full_access AND NOT mediation THEN RAISE EXCEPTION 'capability:consultar-apoio-inclusivo'; END IF;
  RETURN QUERY SELECT r.* FROM public.inclusion_records r
   WHERE r.school_id = _school AND r.recorded_at <= k AND (_student IS NULL OR r.student_id = _student)
     AND (full_access OR (r.share_with_mediation AND r.record_type IN ('necessidade-de-apoio','plano-educacional')))
     AND (CASE WHEN _logical_id IS NOT NULL THEN r.logical_id = _logical_id
          ELSE NOT EXISTS (SELECT 1 FROM public.inclusion_records s WHERE s.supersedes_id = r.id AND s.recorded_at <= k) END)
   ORDER BY r.valid_from DESC, r.recorded_at DESC LIMIT 500;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_records_at(text,text,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inclusion_records_at(text,text,timestamptz,uuid) TO authenticated;

CREATE FUNCTION public.inclusion_mediations_at(_school text, _known_at timestamptz)
RETURNS SETOF public.inclusion_mediation_assignments LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now()); manage boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  manage := public.inclusion_grant('manter-mediacao-escolar', _school) IS NOT NULL OR public.inclusion_grant('consultar-apoio-inclusivo', _school) IS NOT NULL;
  RETURN QUERY SELECT m.* FROM public.inclusion_mediation_assignments m
   WHERE m.school_id = _school AND m.recorded_at <= k
     AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments s WHERE s.supersedes_id = m.id AND s.recorded_at <= k)
     AND (manage OR EXISTS (SELECT 1 FROM public.institutional_engagements e JOIN public.user_person_links l ON l.person_id = e.person_id
                            WHERE e.id = m.mediator_engagement_id AND l.user_id = auth.uid()))
   ORDER BY m.valid_from DESC LIMIT 500;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_mediations_at(text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inclusion_mediations_at(text,timestamptz) TO authenticated;

-- Anexos: registro de metadados (o conteúdo é enviado pelo servidor depois desta autorização).
CREATE FUNCTION public.register_inclusion_attachment(_record_logical uuid, _classification text, _purpose text, _storage_path text, _sha256 text, _media_type text, _size bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE rec public.inclusion_records; g uuid; r uuid;
BEGIN
  SELECT * INTO rec FROM public.inclusion_records WHERE logical_id = _record_logical ORDER BY version DESC LIMIT 1;
  IF rec.id IS NULL THEN RAISE EXCEPTION 'inclusion:record-unknown'; END IF;
  g := public.inclusion_require('anexar-documento-inclusao', rec.school_id);
  IF _classification = 'clinico' THEN PERFORM public.inclusion_require('consultar-documento-sensivel-inclusao', rec.school_id); END IF;
  IF _storage_path !~ ('^' || rec.school_id || '/' || rec.student_id || '/[0-9a-f-]{36}$') THEN RAISE EXCEPTION 'inclusion:storage-path-invalid'; END IF;
  INSERT INTO public.inclusion_attachments(record_logical_id, school_id, student_id, classification, purpose, storage_path, sha256, media_type, size_bytes, author_user_id, author_engagement)
  VALUES (_record_logical, rec.school_id, rec.student_id, _classification, _purpose, _storage_path, _sha256, _media_type, _size, auth.uid(), g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.register_inclusion_attachment(uuid,text,text,text,text,text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_inclusion_attachment(uuid,text,text,text,text,text,bigint) TO authenticated;

-- Lista de anexos: só metadados mínimos; 'clinico' só com capability sensível.
CREATE FUNCTION public.inclusion_attachments_for(_record_logical uuid)
RETURNS TABLE(id uuid, classification text, purpose text, media_type text, size_bytes bigint, recorded_at timestamptz, withdrawn boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s text; sens boolean;
BEGIN
  SELECT r.school_id INTO s FROM public.inclusion_records r WHERE r.logical_id = _record_logical LIMIT 1;
  IF s IS NULL THEN RAISE EXCEPTION 'inclusion:record-unknown'; END IF;
  PERFORM public.inclusion_require('consultar-apoio-inclusivo', s);
  sens := public.inclusion_grant('consultar-documento-sensivel-inclusao', s) IS NOT NULL;
  RETURN QUERY SELECT a.id, a.classification, a.purpose, a.media_type, a.size_bytes, a.recorded_at, a.withdrawn_reason IS NOT NULL
    FROM public.inclusion_attachments a WHERE a.record_logical_id = _record_logical AND (a.classification = 'pedagogico' OR sens)
    ORDER BY a.recorded_at DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_attachments_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inclusion_attachments_for(uuid) TO authenticated;

-- Autoriza a abertura de um anexo e registra a trilha (concedido ou negado). Devolve o caminho só se concedido.
CREATE FUNCTION public.authorize_inclusion_attachment_access(_attachment uuid, _purpose text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a public.inclusion_attachments; g uuid; code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO a FROM public.inclusion_attachments WHERE id = _attachment;
  IF a.id IS NULL THEN RAISE EXCEPTION 'inclusion:attachment-unknown'; END IF;
  IF _purpose IS NULL OR length(btrim(_purpose)) = 0 THEN RAISE EXCEPTION 'inclusion:purpose-required'; END IF;
  g := public.inclusion_grant(CASE WHEN a.classification = 'clinico' THEN 'consultar-documento-sensivel-inclusao' ELSE 'consultar-apoio-inclusivo' END, a.school_id);
  code := CASE WHEN g IS NULL THEN 'capability' WHEN a.withdrawn_reason IS NOT NULL THEN 'withdrawn' END;
  INSERT INTO public.inclusion_access_events(attachment_id, user_id, engagement_id, purpose, granted, denial_code)
  VALUES (a.id, auth.uid(), g, left(_purpose, 300), code IS NULL, code);
  IF code IS NOT NULL THEN RETURN NULL; END IF;
  RETURN a.storage_path;
END $fn$;
REVOKE ALL ON FUNCTION public.authorize_inclusion_attachment_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_inclusion_attachment_access(uuid, text) TO authenticated;

-- Trilha de acesso legível por quem tem a capability sensível da escola (sem conteúdo).
CREATE FUNCTION public.inclusion_access_trail(_attachment uuid)
RETURNS TABLE(at timestamptz, user_id uuid, purpose text, granted boolean, denial_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s text;
BEGIN
  SELECT a.school_id INTO s FROM public.inclusion_attachments a WHERE a.id = _attachment;
  IF s IS NULL THEN RAISE EXCEPTION 'inclusion:attachment-unknown'; END IF;
  PERFORM public.inclusion_require('consultar-documento-sensivel-inclusao', s);
  RETURN QUERY SELECT e.at, e.user_id, e.purpose, e.granted, e.denial_code FROM public.inclusion_access_events e WHERE e.attachment_id = _attachment ORDER BY e.at DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_access_trail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inclusion_access_trail(uuid) TO authenticated;