CREATE OR REPLACE FUNCTION public.diary_holder_scope(_assignment text, _substitution text, _on date, OUT class_id text, OUT school_id text, OUT component_id text, OUT engagement_id uuid, OUT academic_year_id text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE _person uuid := public.current_person_id(); _k timestamptz := pg_catalog.now(); r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'diary:session-required'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'diary:natural-person-required'; END IF;
  IF _on IS NULL OR coalesce(_assignment,'') = '' THEN RAISE EXCEPTION 'diary:target-required'; END IF;
  SELECT a.class_id, c.school_id, c.academic_year_id INTO class_id, school_id, academic_year_id
    FROM public.teaching_assignments a JOIN public.institutional_classes c ON c.id = a.class_id WHERE a.id = _assignment;
  IF class_id IS NULL THEN RAISE EXCEPTION 'diary:assignment-not-found'; END IF;
  SELECT t.* INTO r FROM public.teaching_assignments_at(diary_holder_scope.class_id, _on, _k) t WHERE t.assignment_id = _assignment;
  IF r.version_id IS NULL OR r.assignment_state <> 'vigente' THEN RAISE EXCEPTION 'diary:assignment-not-effective'; END IF;
  component_id := r.component_id;
  IF _substitution IS NULL THEN
    IF r.person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-assignment-holder'; END IF;
    engagement_id := r.engagement_id;
  ELSE
    SELECT s.* INTO r FROM public.teaching_substitutions_at(diary_holder_scope.class_id, _on, _k) s
     WHERE s.substitution_id = _substitution AND s.assignment_id = _assignment;
    IF r.version_id IS NULL THEN RAISE EXCEPTION 'diary:substitution-not-effective'; END IF;
    IF r.substitute_person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-substitute'; END IF;
    engagement_id := r.substitute_engagement_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_capabilities(_on) c WHERE c.capability_id = 'consultar-registro-de-aula'
      AND c.engagement_id = diary_holder_scope.engagement_id AND (c.school_id IS NULL OR c.school_id = diary_holder_scope.school_id) AND c.policy_id IS NOT NULL)
    THEN RAISE EXCEPTION 'diary:capability-missing'; END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.diary_teacher_actor(_assignment text, _substitution text, _on date, _capability text, OUT engagement_id uuid, OUT assignment_version_id uuid, OUT substitution_version_id uuid, OUT policy_id uuid, OUT policy_version integer, OUT class_id text, OUT school_id text, OUT academic_year_id text, OUT matrix_version_id uuid, OUT item_key text, OUT component_id text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE _person uuid := public.current_person_id(); _ys text; _k timestamptz := pg_catalog.now(); r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'diary:session-required'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'diary:natural-person-required'; END IF;
  IF _on IS NULL OR coalesce(_assignment,'') = '' THEN RAISE EXCEPTION 'diary:target-required'; END IF;
  SELECT a.class_id, c.school_id, c.academic_year_id INTO class_id, school_id, academic_year_id
    FROM public.teaching_assignments a JOIN public.institutional_classes c ON c.id = a.class_id WHERE a.id = _assignment;
  IF class_id IS NULL THEN RAISE EXCEPTION 'diary:assignment-not-found'; END IF;
  SELECT s.state INTO _ys FROM public.academic_year_operational_state_at(academic_year_id) s;
  IF _ys IS DISTINCT FROM 'operacional' THEN RAISE EXCEPTION 'diary:year-not-operational:%', coalesce(_ys, 'sem-estado'); END IF;
  SELECT t.* INTO r FROM public.teaching_assignments_at(class_id, _on, _k) t WHERE t.assignment_id = _assignment;
  IF r.version_id IS NULL OR r.assignment_state <> 'vigente' THEN RAISE EXCEPTION 'diary:assignment-not-effective'; END IF;
  assignment_version_id := r.version_id; matrix_version_id := r.matrix_version_id; item_key := r.item_key; component_id := r.component_id;
  IF _substitution IS NULL THEN
    IF r.person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-assignment-holder'; END IF;
    engagement_id := r.engagement_id;
  ELSE
    SELECT s.* INTO r FROM public.teaching_substitutions_at(class_id, _on, _k) s WHERE s.substitution_id = _substitution AND s.assignment_id = _assignment;
    IF r.version_id IS NULL THEN RAISE EXCEPTION 'diary:substitution-not-effective'; END IF;
    IF r.substitute_person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-substitute'; END IF;
    engagement_id := r.substitute_engagement_id; substitution_version_id := r.version_id;
  END IF;
  SELECT c.policy_id, c.policy_version INTO policy_id, policy_version FROM public.effective_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.engagement_id = diary_teacher_actor.engagement_id
     AND (c.school_id IS NULL OR c.school_id = diary_teacher_actor.school_id) AND c.policy_id IS NOT NULL LIMIT 1;
  IF policy_id IS NULL THEN RAISE EXCEPTION 'diary:capability-missing'; END IF;
END $function$;