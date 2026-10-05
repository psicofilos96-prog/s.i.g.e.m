-- Portal da Família: autorização canônica responsável ↔ educando, versionada e append-only.
-- Nunca inferida (sobrenome, endereço, irmão); cada autorização vale para UM educando e só nas seções listadas.
-- Escrita exige 'manter-autorizacao-de-responsavel' na escola de matrícula do educando (ou rede) — sem regra: fechada.

CREATE TABLE public.guardian_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.guardian_authorizations(id),
  event_kind text NOT NULL CHECK (event_kind IN ('constituicao','substituicao','revogacao')),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  guardian_user_id uuid NOT NULL,
  school_id text NOT NULL,
  relation_scheme_id text,
  relation_value_id text,
  sections text[] NOT NULL DEFAULT '{}',
  valid_from date NOT NULL,
  valid_until date,
  reason text,
  source_ref text,
  recorded_by uuid NOT NULL,
  recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (sections <@ ARRAY['matricula','frequencia','avaliacao','calendario','documentos','comunicados']::text[]),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0)),
  CHECK ((relation_scheme_id IS NULL) = (relation_value_id IS NULL))
);
CREATE UNIQUE INDEX ga_one_successor ON public.guardian_authorizations (supersedes_id) WHERE supersedes_id IS NOT NULL;
REVOKE ALL ON public.guardian_authorizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.guardian_authorizations TO service_role;
ALTER TABLE public.guardian_authorizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ga_append_only BEFORE UPDATE OR DELETE ON public.guardian_authorizations FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- Autorização vigente HOJE para o usuário da sessão e o educando: cabeça da cadeia, não revogada, dentro da vigência.
CREATE FUNCTION public.family_authorization(_student text) RETURNS public.guardian_authorizations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT a.* FROM public.guardian_authorizations a
   WHERE a.student_id = _student AND a.guardian_user_id = auth.uid() AND a.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
     AND a.valid_from <= CURRENT_DATE AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE)
   ORDER BY a.recorded_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.family_authorization(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.record_guardian_authorization(_base_id uuid, _kind text, _student text, _guardian_user uuid, _school text,
  _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.guardian_authorizations; r uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _kind NOT IN ('constituicao','substituicao','revogacao') THEN RAISE EXCEPTION 'family:kind-invalid'; END IF;
  IF _kind = 'constituicao' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'family:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.guardian_authorizations WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'family:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.guardian_authorizations WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'family:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'family:already-revoked'; END IF;
    _student := base.student_id; _guardian_user := base.guardian_user_id; _school := base.school_id;
    IF _kind = 'revogacao' THEN _relation_scheme := base.relation_scheme_id; _relation_value := base.relation_value_id; _sections := base.sections; _valid_from := base.valid_from; END IF;
  END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'manter-autorizacao-de-responsavel' AND c.policy_id IS NOT NULL
     AND (c.scope_level = 'rede' OR (c.scope_level = 'escola' AND c.school_id = _school))
   ORDER BY (c.scope_level = 'escola') DESC, c.policy_version DESC LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-autorizacao-de-responsavel'; END IF;
  IF _guardian_user IS NULL OR _guardian_user = auth.uid() THEN RAISE EXCEPTION 'family:guardian-invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN
    RAISE EXCEPTION 'family:student-not-in-school'; END IF;
  IF _relation_scheme IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.attribute_value_definitions d
     WHERE d.scheme_id = _relation_scheme AND d.value_id = _relation_value AND d.status = 'homologado') THEN
    RAISE EXCEPTION 'family:relation-not-homologated'; END IF;
  IF _kind <> 'revogacao' AND cardinality(coalesce(_sections,'{}')) = 0 THEN RAISE EXCEPTION 'family:sections-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'family:valid-from-required'; END IF;
  INSERT INTO public.guardian_authorizations(logical_id, version, supersedes_id, event_kind, student_id, guardian_user_id, school_id,
    relation_scheme_id, relation_value_id, sections, valid_from, valid_until, reason, source_ref, recorded_by, recorded_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _student, _guardian_user, _school,
    _relation_scheme, _relation_value, coalesce(_sections,'{}'), _valid_from, _valid_until, nullif(btrim(_reason),''), nullif(btrim(_source_ref),''), auth.uid(), g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_guardian_authorization(uuid,text,text,uuid,text,text,text,text[],date,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_guardian_authorization(uuid,text,text,uuid,text,text,text,text[],date,date,text,text) TO authenticated;

-- Educandos autorizados para a sessão. Retorno mínimo: id, nome de exibição, seções. Sem nascimento, documentos, endereço, saúde.
CREATE FUNCTION public.family_students()
RETURNS TABLE(student_id text, display_name text, sections text[], valid_until date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT a.student_id,
    (SELECT coalesce(nullif(btrim(v.social_name),''), v.civil_name) FROM public.student_identity_versions v
      WHERE v.student_id = a.student_id ORDER BY v.version DESC LIMIT 1),
    a.sections, a.valid_until
  FROM (SELECT DISTINCT student_id FROM public.guardian_authorizations WHERE guardian_user_id = auth.uid()) s
  CROSS JOIN LATERAL public.family_authorization(s.student_id) a
  WHERE auth.uid() IS NOT NULL AND a.id IS NOT NULL
  ORDER BY 2
$$;
REVOKE ALL ON FUNCTION public.family_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_students() TO authenticated;

-- Resumo de um educando. Sem autorização vigente para ESTE educando ⇒ recusa (mesma resposta para inexistente: sem IDOR).
CREATE FUNCTION public.family_student_summary(_student text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a public.guardian_authorizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  a := public.family_authorization(_student);
  IF a.id IS NULL THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  RETURN jsonb_build_object(
    'sections', a.sections,
    'enrollments', CASE WHEN 'matricula' = ANY (a.sections) THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object('school', coalesce((SELECT r.official_name FROM public.institutional_school_record_versions r
                 WHERE r.school_id = e.school_id ORDER BY r.version_number DESC LIMIT 1), e.school_id),
               'opened_on', e.opened_on,
               'ended_on', (SELECT x.ended_on FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id LIMIT 1),
               'classes', coalesce((SELECT jsonb_agg(jsonb_build_object('class', c.class_label_snapshot, 'from', c.valid_from,
                    'until', (SELECT y.ended_on FROM public.class_enrollment_episode_endings y WHERE y.episode_id = c.id LIMIT 1)) ORDER BY c.valid_from)
                  FROM public.class_enrollment_episodes c WHERE c.enrollment_id = e.id
                   AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = c.id)), '[]'::jsonb))
             ORDER BY e.opened_on DESC NULLS LAST)
      FROM public.school_enrollments e WHERE e.student_id = _student
       AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id)), '[]'::jsonb) END,
    'documents', CASE WHEN 'documentos' = ANY (a.sections) THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object('kind', d.document_kind, 'emission', d.emission_kind, 'emitted_at', d.emitted_at,
               'number', d.emission_number, 'verification_code', d.verification_code) ORDER BY d.emitted_at DESC)
      FROM public.school_document_emissions d WHERE d.student_id = _student), '[]'::jsonb) END
  );
END $fn$;
REVOKE ALL ON FUNCTION public.family_student_summary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_student_summary(text) TO authenticated;