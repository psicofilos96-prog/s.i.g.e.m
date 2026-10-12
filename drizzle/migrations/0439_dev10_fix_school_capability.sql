-- L10 correção: indicação institucional usa a capacidade por escola (has_school_capability), não a de turma.
CREATE OR REPLACE FUNCTION public.request_dev_enrollment(_class uuid, _person uuid, _link uuid, _mode text, _school text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c public.dev_classes; _state text; _l public.professional_functional_links;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_enrollments WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _mode = 'individual' AND _person IS DISTINCT FROM _p THEN RAISE EXCEPTION 'dev:individual-is-self'; END IF;
  IF _mode = 'institucional' AND NOT public.has_school_capability('indicar-para-formacao', _school) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _mode NOT IN ('individual','institucional') THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _c FROM public.dev_classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT status INTO _state FROM public.dev_class_status_events WHERE class_id = _class ORDER BY seq DESC LIMIT 1;
  IF _state IS DISTINCT FROM 'inscricoes-abertas' THEN RAISE EXCEPTION 'dev:enrollment-closed'; END IF;
  SELECT * INTO _l FROM public.professional_functional_links WHERE id = _link AND person_id = _person;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM public.professional_functional_links WHERE supersedes_id = _link)
     OR _l.valid_from > _c.starts_on OR (_l.valid_until IS NOT NULL AND _l.valid_until < _c.starts_on) THEN RAISE EXCEPTION 'dev:not-eligible-link'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_course_prerequisites q WHERE q.course_version_id = _c.course_version_id
     AND NOT EXISTS (SELECT 1 FROM public.dev_enrollments e JOIN public.dev_classes k ON k.id = e.class_id
       JOIN public.dev_course_versions v ON v.id = k.course_version_id JOIN public.dev_participation_events x ON x.enrollment_id = e.id
       WHERE e.person_id = _person AND v.course_id = q.prerequisite_course_id AND x.kind = 'conclusao')) THEN RAISE EXCEPTION 'dev:prerequisite-missing'; END IF;
  INSERT INTO public.dev_enrollments(class_id, person_id, functional_link_id, author_person, idempotency_key) VALUES (_class, _person, _link, _p, _key) RETURNING id INTO _id;
  INSERT INTO public.dev_enrollment_requests(enrollment_id, mode, requesting_school_id, link_valid_from, link_valid_until)
  VALUES (_id, _mode, CASE WHEN _mode = 'institucional' THEN _school END, _l.valid_from, _l.valid_until);
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-enrolled';
  WHEN foreign_key_violation OR check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;