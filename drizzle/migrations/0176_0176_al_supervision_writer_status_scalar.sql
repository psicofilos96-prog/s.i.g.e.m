-- AL: situação opcional como escalares (record não atribuído quebrava registro sem situação; achado do E2E).
CREATE OR REPLACE FUNCTION public.record_school_supervision(_base_id uuid, _kind text, _school text, _modality text, _subject text, _occurred_on date, _referral text, _responsible_label text, _return_on date, _status_value text, _school_visible boolean, _reason text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _person uuid; g uuid; base public.school_supervision_records; m record; st_id text; st_v integer; r uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'supervision:session-required'; END IF;
  SELECT l.person_id INTO _person FROM public.user_person_links l WHERE l.user_id = auth.uid();
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'supervision:natural-person-required'; END IF;
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'supervision:kind-invalid'; END IF;
  IF _kind = 'registro' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'supervision:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.school_supervision_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'supervision:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_supervision_records x WHERE x.supersedes_id = base.id) THEN RAISE EXCEPTION 'supervision:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'supervision:already-annulled'; END IF;
    IF base.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'supervision:only-author-rectifies'; END IF;
    IF length(btrim(coalesce(_reason,''))) = 0 THEN RAISE EXCEPTION 'supervision:reason-required'; END IF;
    _school := base.school_id;
    IF _kind = 'anulacao' THEN _modality := base.modality_value_id; _subject := base.subject; _occurred_on := base.occurred_on; _referral := base.referral;
      _responsible_label := base.responsible_label; _return_on := base.return_on; _status_value := base.status_value_id; _school_visible := base.school_visible; END IF;
  END IF;
  g := public.al_supervision_grant('registrar-acompanhamento-da-supervisao', _school);
  IF g IS NULL THEN RAISE EXCEPTION 'capability:registrar-acompanhamento-da-supervisao'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'supervision:school-unknown'; END IF;
  SELECT d.value_id, d.version INTO m FROM public.attribute_value_definitions d
   WHERE d.scheme_id = 'modalidade-de-acompanhamento-da-supervisao' AND d.value_id = _modality AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
  IF m.value_id IS NULL THEN RAISE EXCEPTION 'supervision:modality-not-homologated'; END IF;
  IF _status_value IS NOT NULL THEN
    SELECT d.value_id, d.version INTO st_id, st_v FROM public.attribute_value_definitions d
     WHERE d.scheme_id = 'situacao-de-acompanhamento-da-supervisao' AND d.value_id = _status_value AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
    IF st_id IS NULL THEN RAISE EXCEPTION 'supervision:status-not-homologated'; END IF;
  END IF;
  IF _occurred_on IS NULL THEN RAISE EXCEPTION 'supervision:occurred-on-required'; END IF;
  IF _occurred_on > CURRENT_DATE THEN RAISE EXCEPTION 'supervision:occurred-on-future'; END IF;
  IF _return_on IS NOT NULL AND _return_on < _occurred_on THEN RAISE EXCEPTION 'supervision:return-before-occurrence'; END IF;
  IF length(btrim(coalesce(_subject,''))) = 0 THEN RAISE EXCEPTION 'supervision:subject-required'; END IF;
  INSERT INTO public.school_supervision_records(logical_id, version, supersedes_id, event_kind, school_id, modality_value_id, modality_value_version,
    subject, occurred_on, referral, responsible_label, return_on, status_value_id, status_value_version, school_visible, reason,
    author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _school, m.value_id, m.version,
    btrim(_subject), _occurred_on, nullif(btrim(_referral),''), nullif(btrim(_responsible_label),''), _return_on, st_id, st_v,
    coalesce(_school_visible, false), nullif(btrim(_reason),''), auth.uid(), _person, g)
  RETURNING id INTO r;
  RETURN r;
END $function$;