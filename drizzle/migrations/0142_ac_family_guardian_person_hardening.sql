ALTER TABLE public.guardian_authorizations ADD COLUMN IF NOT EXISTS guardian_person_id uuid;
COMMENT ON COLUMN public.guardian_authorizations.guardian_person_id IS 'AC: pessoa responsável validada (institutional_persons). Acesso exige que a conta esteja ligada a ESTA pessoa por user_person_links; nulo = autorização legada só por conta.';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.guardian_authorizations FROM service_role;
GRANT SELECT ON public.guardian_authorizations TO service_role;

-- Vigência hoje + coerência pessoa↔conta: se a autorização nomeia pessoa, a conta precisa estar ligada a ela.
CREATE OR REPLACE FUNCTION public.family_authorization(_student text) RETURNS public.guardian_authorizations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT a.* FROM public.guardian_authorizations a
   WHERE a.student_id = _student AND a.guardian_user_id = auth.uid() AND a.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
     AND a.valid_from <= CURRENT_DATE AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE)
     AND (a.guardian_person_id IS NULL OR EXISTS (SELECT 1 FROM public.user_person_links l WHERE l.user_id = auth.uid() AND l.person_id = a.guardian_person_id))
   ORDER BY a.recorded_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.family_authorization(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_guardian_authorization_v2(_base_id uuid, _kind text, _student text, _guardian_user uuid, _guardian_person uuid, _school text,
  _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.guardian_authorizations; r uuid; me uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = me AND p.actor_nature = 'pessoa-natural') THEN RAISE EXCEPTION 'family:natural-person-required'; END IF;
  IF _kind NOT IN ('constituicao','substituicao','revogacao') THEN RAISE EXCEPTION 'family:kind-invalid'; END IF;
  IF _kind = 'constituicao' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'family:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.guardian_authorizations WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'family:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.guardian_authorizations WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'family:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'family:already-revoked'; END IF;
    _student := base.student_id; _guardian_user := base.guardian_user_id; _school := base.school_id; _guardian_person := coalesce(base.guardian_person_id, _guardian_person);
    IF _kind = 'revogacao' THEN _relation_scheme := base.relation_scheme_id; _relation_value := base.relation_value_id; _sections := base.sections; _valid_from := base.valid_from; END IF;
  END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'manter-autorizacao-de-responsavel' AND c.policy_id IS NOT NULL
     AND (c.scope_level = 'rede' OR (c.scope_level = 'escola' AND c.school_id = _school))
   ORDER BY (c.scope_level = 'escola') DESC, c.policy_version DESC LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-autorizacao-de-responsavel'; END IF;
  IF _guardian_user IS NULL OR _guardian_user = auth.uid() THEN RAISE EXCEPTION 'family:guardian-invalid'; END IF;
  IF _guardian_person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _guardian_person AND p.actor_nature = 'pessoa-natural') THEN RAISE EXCEPTION 'family:guardian-person-invalid'; END IF;
  IF _guardian_person = me THEN RAISE EXCEPTION 'family:guardian-invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_person_links l WHERE l.user_id = _guardian_user AND l.person_id <> _guardian_person) THEN RAISE EXCEPTION 'family:account-person-mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN RAISE EXCEPTION 'family:student-not-in-school'; END IF;
  IF _relation_scheme IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.attribute_value_definitions d
     WHERE d.scheme_id = _relation_scheme AND d.value_id = _relation_value AND d.status = 'homologado') THEN RAISE EXCEPTION 'family:relation-not-homologated'; END IF;
  IF _kind <> 'revogacao' AND cardinality(coalesce(_sections,'{}')) = 0 THEN RAISE EXCEPTION 'family:sections-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'family:valid-from-required'; END IF;
  INSERT INTO public.guardian_authorizations(logical_id, version, supersedes_id, event_kind, student_id, guardian_user_id, guardian_person_id, school_id,
    relation_scheme_id, relation_value_id, sections, valid_from, valid_until, reason, source_ref, recorded_by, recorded_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _student, _guardian_user, _guardian_person, _school,
    _relation_scheme, _relation_value, coalesce(_sections,'{}'), _valid_from, _valid_until, nullif(btrim(_reason),''), nullif(btrim(_source_ref),''), auth.uid(), g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_guardian_authorization_v2(uuid,text,text,uuid,uuid,text,text,text,text[],date,date,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_guardian_authorization_v2(uuid,text,text,uuid,uuid,text,text,text,text[],date,date,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_guardian_authorization(uuid,text,text,uuid,text,text,text,text[],date,date,text,text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.record_guardian_authorization(uuid,text,text,uuid,text,text,text,text[],date,date,text,text) IS 'DEPRECATED (AC): substituída por record_guardian_authorization_v2 (pessoa responsável validada + autor pessoa natural).';
REVOKE EXECUTE ON FUNCTION public.family_students() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.family_student_summary(text) FROM service_role;