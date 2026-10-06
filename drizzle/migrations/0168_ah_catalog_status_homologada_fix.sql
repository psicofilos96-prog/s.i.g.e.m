-- AH: o catálogo homologável grava status 'homologada' (CHECK de attribute_value_definitions); estes cinco
-- gravadores comparavam com 'homologado' e recusavam todo valor homologado (falha fechada indevida).
-- Correção de literal apenas; assinaturas, grants e demais regras inalteradas.
CREATE OR REPLACE FUNCTION public.record_guardian_authorization(_base_id uuid, _kind text, _student text, _guardian_user uuid, _school text, _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     WHERE d.scheme_id = _relation_scheme AND d.value_id = _relation_value AND d.status = 'homologada') THEN
    RAISE EXCEPTION 'family:relation-not-homologated'; END IF;
  IF _kind <> 'revogacao' AND cardinality(coalesce(_sections,'{}')) = 0 THEN RAISE EXCEPTION 'family:sections-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'family:valid-from-required'; END IF;
  INSERT INTO public.guardian_authorizations(logical_id, version, supersedes_id, event_kind, student_id, guardian_user_id, school_id,
    relation_scheme_id, relation_value_id, sections, valid_from, valid_until, reason, source_ref, recorded_by, recorded_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _student, _guardian_user, _school,
    _relation_scheme, _relation_value, coalesce(_sections,'{}'), _valid_from, _valid_until, nullif(btrim(_reason),''), nullif(btrim(_source_ref),''), auth.uid(), g)
  RETURNING id INTO r;
  RETURN r;
END $function$
;

CREATE OR REPLACE FUNCTION public.record_guardian_authorization_v2(_base_id uuid, _kind text, _student text, _guardian_user uuid, _guardian_person uuid, _school text, _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     WHERE d.scheme_id = _relation_scheme AND d.value_id = _relation_value AND d.status = 'homologada') THEN RAISE EXCEPTION 'family:relation-not-homologated'; END IF;
  IF _kind <> 'revogacao' AND cardinality(coalesce(_sections,'{}')) = 0 THEN RAISE EXCEPTION 'family:sections-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'family:valid-from-required'; END IF;
  INSERT INTO public.guardian_authorizations(logical_id, version, supersedes_id, event_kind, student_id, guardian_user_id, guardian_person_id, school_id,
    relation_scheme_id, relation_value_id, sections, valid_from, valid_until, reason, source_ref, recorded_by, recorded_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _student, _guardian_user, _guardian_person, _school,
    _relation_scheme, _relation_value, coalesce(_sections,'{}'), _valid_from, _valid_until, nullif(btrim(_reason),''), nullif(btrim(_source_ref),''), auth.uid(), g)
  RETURNING id INTO r;
  RETURN r;
END $function$
;

CREATE OR REPLACE FUNCTION public.meal_value_ok(_scheme text, _value text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.attribute_value_definitions d WHERE d.scheme_id = _scheme AND d.value_id = _value AND d.status = 'homologada')
$function$
;

CREATE OR REPLACE FUNCTION public.record_inclusion_record(_base_id uuid, _kind text, _record_type text, _school text, _student text, _category_scheme text, _category_value text, _purpose text, _body text, _valid_from date, _valid_to date, _share_with_mediation boolean, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     WHERE d.scheme_id = _category_scheme AND d.value_id = _category_value AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
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
END $function$
;

CREATE OR REPLACE FUNCTION public.record_aee_session(_base_id uuid, _kind text, _service_logical uuid, _date date, _presence_scheme text, _presence_value text, _note text, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; me uuid; base public.aee_sessions; svc public.aee_services; cat record; r uuid;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'inclusion:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.aee_sessions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'inclusion:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.aee_sessions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'inclusion:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'inclusion:already-annulled'; END IF;
    _service_logical := base.service_logical_id; _date := base.session_date;
    IF _kind = 'anulacao' THEN _presence_scheme := base.presence_scheme_id; _presence_value := base.presence_value_id; _note := base.pedagogical_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'inclusion:base-not-allowed';
  END IF;
  SELECT a.* INTO svc FROM public.aee_services a WHERE a.logical_id = _service_logical
    AND NOT EXISTS (SELECT 1 FROM public.aee_services x WHERE x.supersedes_id = a.id);
  IF svc.id IS NULL THEN RAISE EXCEPTION 'inclusion:aee-unknown'; END IF;
  g := public.ah_grant('registrar-sessao-aee', svc.school_id);
  IF g IS NULL THEN RAISE EXCEPTION 'capability:registrar-sessao-aee'; END IF;
  IF _date IS NULL OR _date < svc.valid_from OR (svc.valid_to IS NOT NULL AND _date > svc.valid_to) THEN
    RAISE EXCEPTION 'inclusion:session-outside-service'; END IF;
  SELECT d.value_id, d.version INTO cat FROM public.attribute_value_definitions d
   WHERE d.scheme_id = _presence_scheme AND d.value_id = _presence_value AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
  IF cat.value_id IS NULL THEN RAISE EXCEPTION 'inclusion:presence-not-homologated'; END IF;
  IF _kind = 'registro' AND EXISTS (SELECT 1 FROM public.aee_sessions s WHERE s.service_logical_id = _service_logical AND s.session_date = _date
     AND s.event_kind <> 'anulacao' AND NOT EXISTS (SELECT 1 FROM public.aee_sessions x WHERE x.supersedes_id = s.id))
  THEN RAISE EXCEPTION 'inclusion:session-duplicate'; END IF;
  INSERT INTO public.aee_sessions(logical_id, version, supersedes_id, event_kind, service_logical_id, school_id, student_id, session_date,
    presence_scheme_id, presence_value_id, presence_value_version, pedagogical_note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _service_logical, svc.school_id, svc.student_id, _date,
    _presence_scheme, cat.value_id, cat.version, nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r;
  RETURN r;
END $function$
;
