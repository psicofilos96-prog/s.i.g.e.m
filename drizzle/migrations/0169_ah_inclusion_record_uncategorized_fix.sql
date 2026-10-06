-- AH: record_inclusion_record falhava ('record "cat" is not assigned yet') sempre que nenhuma categoria era
-- informada, porque o registro só era atribuído dentro do ramo com categoria. Variáveis escalares resolvem;
-- regras, assinatura e grants inalterados.
CREATE OR REPLACE FUNCTION public.record_inclusion_record(_base_id uuid, _kind text, _record_type text, _school text, _student text, _category_scheme text, _category_value text, _purpose text, _body text, _valid_from date, _valid_to date, _share_with_mediation boolean, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; base public.inclusion_records; cat_value text; cat_version integer; r uuid;
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
    SELECT d.value_id, d.version INTO cat_value, cat_version FROM public.attribute_value_definitions d
     WHERE d.scheme_id = _category_scheme AND d.value_id = _category_value AND d.status = 'homologada' ORDER BY d.version DESC LIMIT 1;
    IF cat_value IS NULL THEN RAISE EXCEPTION 'inclusion:category-not-homologated'; END IF;
  END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'inclusion:valid-from-required'; END IF;
  INSERT INTO public.inclusion_records(logical_id, version, supersedes_id, event_kind, record_type, school_id, student_id,
    category_scheme_id, category_value_id, category_value_version, educational_purpose, body, valid_from, valid_to, share_with_mediation,
    reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _record_type, _school, _student,
    CASE WHEN _category_value IS NULL THEN NULL ELSE _category_scheme END, cat_value, cat_version, _purpose, _body, _valid_from, _valid_to,
    coalesce(_share_with_mediation,false), nullif(btrim(_reason),''), auth.uid(), public.current_person_id(), g)
  RETURNING id INTO r;
  RETURN r;
END $function$;
