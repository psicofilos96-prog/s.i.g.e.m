-- AB.2: record_school_pedagogical_record_v2 falhava com 'record st is not assigned' quando a situação era omitida (opcional),
-- tornando impossível registrar intervenção sem situação. Correção aditiva: st inicializado como nulo. ACLs preservadas.
CREATE OR REPLACE FUNCTION public.record_school_pedagogical_record_v2(_base_id uuid, _kind text, _school text, _subject_kind text, _subject_id text, _category_value text, _body text, _visibility text, _occurred_on date, _reason text, _referral text, _responsible_person_id uuid, _period_id text, _return_on date, _status_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE _person uuid := public.current_person_id(); r uuid; st record; g uuid; base public.school_pedagogical_records; cat record;
BEGIN
  SELECT NULL::text AS value_id, NULL::integer AS version INTO st;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'followup:natural-person-required'; END IF;
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'followup:kind-invalid'; END IF;
  IF _kind = 'registro' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'followup:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.school_pedagogical_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'followup:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_pedagogical_records WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'followup:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'followup:already-annulled'; END IF;
    IF base.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'followup:only-author-rectifies'; END IF;
    _school := base.school_id; _subject_kind := base.subject_kind; _subject_id := base.subject_id;
    IF _kind = 'anulacao' THEN _category_value := base.category_value_id; _body := base.body; _visibility := base.visibility; _occurred_on := base.occurred_on;
      _referral := base.referral; _responsible_person_id := base.responsible_person_id; _period_id := base.period_id; _return_on := base.return_on; _status_value := base.status_value_id; END IF;
  END IF;
  IF _occurred_on IS NULL THEN RAISE EXCEPTION 'followup:occurred-on-invalid'; END IF;
  g := public.school_followup_grant_on('registrar-acompanhamento-pedagogico', _school, _occurred_on);
  IF _subject_kind = 'estudante' AND NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _subject_id AND e.school_id = _school) THEN RAISE EXCEPTION 'followup:subject-not-in-school'; END IF;
  IF _subject_kind = 'turma' AND NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _subject_id AND c.school_id = _school) THEN RAISE EXCEPTION 'followup:subject-not-in-school'; END IF;
  IF _subject_kind = 'escola' AND _subject_id <> _school THEN RAISE EXCEPTION 'followup:subject-not-in-school'; END IF;
  SELECT d.value_id, d.version INTO cat FROM public.attribute_value_definitions d
   WHERE d.scheme_id = 'categoria-de-acompanhamento-pedagogico' AND d.value_id = _category_value AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
  IF cat.value_id IS NULL THEN RAISE EXCEPTION 'followup:category-not-homologated'; END IF;
  IF _occurred_on IS NULL OR _occurred_on > CURRENT_DATE THEN RAISE EXCEPTION 'followup:occurred-on-invalid'; END IF;
  IF _responsible_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _responsible_person_id AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'followup:responsible-invalid'; END IF;
  IF _return_on IS NOT NULL AND _return_on < _occurred_on THEN RAISE EXCEPTION 'followup:return-before-occurrence'; END IF;
  IF length(coalesce(_referral,'')) > 4000 THEN RAISE EXCEPTION 'followup:referral-too-long'; END IF;
  IF _period_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_academic_periods p WHERE p.id = _period_id) THEN RAISE EXCEPTION 'followup:period-unknown'; END IF;
  IF _status_value IS NOT NULL THEN
    SELECT d.value_id, d.version INTO st FROM public.attribute_value_definitions d
     WHERE d.scheme_id = 'situacao-de-acompanhamento-pedagogico' AND d.value_id = _status_value AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
    IF st.value_id IS NULL THEN RAISE EXCEPTION 'followup:status-not-homologated'; END IF;
  END IF;
  INSERT INTO public.school_pedagogical_records(logical_id, version, supersedes_id, event_kind, school_id, subject_kind, subject_id,
    category_scheme_id, category_value_id, category_value_version, body, visibility, occurred_on, reason, author_user_id, author_person_id, author_engagement,
    referral, responsible_person_id, period_id, return_on, status_value_id, status_value_version)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _school, _subject_kind, _subject_id,
    'categoria-de-acompanhamento-pedagogico', cat.value_id, cat.version, _body, _visibility, _occurred_on, nullif(btrim(_reason),''),
    auth.uid(), _person, g, nullif(btrim(_referral),''), _responsible_person_id, _period_id, _return_on, st.value_id, st.version)
  RETURNING id INTO r;
  RETURN r;
END $function$

;