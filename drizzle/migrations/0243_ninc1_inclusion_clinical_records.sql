-- NINC.1 — registro clínico restrito da Inclusão (decisão N12.1/N8: CID original e laudo com governança).
-- Separado de inclusion_records (pedagógico). Nenhuma capability nova: grava quem tem registrar-apoio-inclusivo
-- E consultar-documento-sensivel-inclusao na escola; lê só consultar-documento-sensivel-inclusao, com finalidade
-- registrada em trilha própria. Dimensões ficam só de catálogo homologado (sem seed); CID é texto do documento.
CREATE TABLE public.inclusion_clinical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.inclusion_clinical_records(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','encerramento')),
  school_id text NOT NULL,
  student_id text NOT NULL,
  cid_as_written text CHECK (cid_as_written IS NULL OR (length(btrim(cid_as_written)) > 0 AND length(cid_as_written) <= 40)),
  source_document text NOT NULL CHECK (length(btrim(source_document)) > 0 AND length(source_document) <= 300),
  dimension_scheme_id text,
  dimension_value_id text,
  dimension_value_version integer,
  note text CHECK (note IS NULL OR length(note) <= 2000),
  attachment_id uuid REFERENCES public.inclusion_attachments(id),
  valid_from date NOT NULL,
  valid_to date,
  reason text,
  author_user_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK ((dimension_value_id IS NULL) = (dimension_scheme_id IS NULL)),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE UNIQUE INDEX inclusion_clinical_one_successor ON public.inclusion_clinical_records (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX inclusion_clinical_student ON public.inclusion_clinical_records (school_id, student_id);
REVOKE ALL ON public.inclusion_clinical_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.inclusion_clinical_records TO service_role;
ALTER TABLE public.inclusion_clinical_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inclusion_clinical_append_only BEFORE UPDATE OR DELETE ON public.inclusion_clinical_records FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE TABLE public.inclusion_clinical_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL,
  user_id uuid NOT NULL,
  engagement_id uuid,
  purpose text NOT NULL CHECK (length(purpose) <= 300),
  granted boolean NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.inclusion_clinical_access_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.inclusion_clinical_access_events TO service_role;
ALTER TABLE public.inclusion_clinical_access_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER inclusion_clinical_access_append_only BEFORE UPDATE OR DELETE ON public.inclusion_clinical_access_events FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE FUNCTION public.record_inclusion_clinical(_base_id uuid, _kind text, _school text, _student text, _cid text, _source text,
  _dimension_scheme text, _dimension_value text, _note text, _attachment uuid, _valid_from date, _valid_to date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.inclusion_clinical_records; lid uuid; ver int := 1; dv int; r uuid;
BEGIN
  g := public.inclusion_require('registrar-apoio-inclusivo', _school);
  PERFORM public.inclusion_require('consultar-documento-sensivel-inclusao', _school);
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN RAISE EXCEPTION 'inclusion:student-not-in-school'; END IF;
  IF _kind NOT IN ('registro','retificacao','encerramento') THEN RAISE EXCEPTION 'inclusion:kind-invalid'; END IF;
  IF _kind = 'registro' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'inclusion:base-not-allowed'; END IF;
    lid := gen_random_uuid();
  ELSE
    SELECT * INTO base FROM public.inclusion_clinical_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL OR base.school_id <> _school OR base.student_id <> _student THEN RAISE EXCEPTION 'inclusion:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.inclusion_clinical_records WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'inclusion:stale-head'; END IF;
    IF base.event_kind = 'encerramento' THEN RAISE EXCEPTION 'inclusion:already-closed'; END IF;
    lid := base.logical_id; ver := base.version + 1;
  END IF;
  IF _dimension_value IS NOT NULL THEN
    SELECT d.version INTO dv FROM public.attribute_value_definitions d
     WHERE d.scheme_id = _dimension_scheme AND d.value_id = _dimension_value AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
    IF dv IS NULL THEN RAISE EXCEPTION 'inclusion:category-not-homologated'; END IF;
  END IF;
  IF _attachment IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.inclusion_attachments a WHERE a.id = _attachment AND a.school_id = _school AND a.student_id = _student AND a.classification = 'clinico')
    THEN RAISE EXCEPTION 'inclusion:attachment-unknown'; END IF;
  INSERT INTO public.inclusion_clinical_records(logical_id, version, supersedes_id, event_kind, school_id, student_id, cid_as_written, source_document,
    dimension_scheme_id, dimension_value_id, dimension_value_version, note, attachment_id, valid_from, valid_to, reason, author_user_id, author_engagement)
  VALUES (lid, ver, base.id, _kind, _school, _student, nullif(btrim(_cid),''), _source, _dimension_scheme, _dimension_value, dv, nullif(btrim(_note),''),
    _attachment, _valid_from, _valid_to, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_inclusion_clinical(uuid,text,text,text,text,text,text,text,text,uuid,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inclusion_clinical(uuid,text,text,text,text,text,text,text,text,uuid,date,date,text) TO authenticated;

-- Leitura com finalidade obrigatória: toda tentativa (concedida ou negada) entra na trilha; negada devolve vazio.
CREATE FUNCTION public.inclusion_clinical_records_for(_school text, _student text, _purpose text)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, cid_as_written text, source_document text,
  dimension_scheme_id text, dimension_value_id text, note text, attachment_id uuid, valid_from date, valid_to date, reason text, recorded_at timestamptz, is_head boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _purpose IS NULL OR length(btrim(_purpose)) = 0 THEN RAISE EXCEPTION 'inclusion:purpose-required'; END IF;
  g := public.inclusion_grant('consultar-documento-sensivel-inclusao', _school);
  INSERT INTO public.inclusion_clinical_access_events(school_id, student_id, user_id, engagement_id, purpose, granted)
  VALUES (_school, _student, auth.uid(), g, left(_purpose, 300), g IS NOT NULL);
  IF g IS NULL THEN RAISE EXCEPTION 'capability:consultar-documento-sensivel-inclusao'; END IF;
  RETURN QUERY SELECT c.id, c.logical_id, c.version, c.event_kind, c.cid_as_written, c.source_document, c.dimension_scheme_id, c.dimension_value_id,
    c.note, c.attachment_id, c.valid_from, c.valid_to, c.reason, c.recorded_at,
    NOT EXISTS (SELECT 1 FROM public.inclusion_clinical_records s WHERE s.supersedes_id = c.id)
    FROM public.inclusion_clinical_records c WHERE c.school_id = _school AND c.student_id = _student
    ORDER BY c.logical_id, c.version;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_clinical_records_for(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inclusion_clinical_records_for(text,text,text) TO authenticated;