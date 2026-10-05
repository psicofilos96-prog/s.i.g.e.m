ALTER TABLE public.teaching_plan_versions ADD COLUMN IF NOT EXISTS period_id text REFERENCES public.institutional_academic_periods(id);
ALTER TABLE public.teaching_plan_versions ADD COLUMN IF NOT EXISTS target_date date;
COMMENT ON COLUMN public.teaching_plan_versions.period_id IS 'Período oficial (institutional_academic_periods) coberto; nulo = plano anual/sequência sem período.';
COMMENT ON COLUMN public.teaching_plan_versions.target_date IS 'Data institucional-alvo usada para validar atribuição e ano (nunca CURRENT_DATE).';

CREATE OR REPLACE FUNCTION public.record_teaching_plan_version_v2(_plan_id text, _expected_head uuid, _assignment_id text, _title text, _level_value_id text,
  _target_date date, _period_id text, _covers_from date, _covers_until date, _blocks jsonb, _curricular_refs jsonb, _status text, _copied_from uuid, _change_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid := public.current_person_id(); a record; head record; new_plan text := _plan_id; v int := 1; new_id uuid;
  school text; yr text; ys text; r jsonb; b jsonb; per record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'plan:no-session'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'plan:natural-person-required'; END IF;
  IF _target_date IS NULL THEN RAISE EXCEPTION 'plan:target-date-required'; END IF;
  SELECT * INTO a FROM public.my_teaching_assignments_at(_target_date, pg_catalog.now()) t WHERE t.assignment_id = _assignment_id LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'plan:assignment-not-current'; END IF;
  SELECT c.school_id, c.academic_year_id INTO school, yr FROM public.institutional_classes c WHERE c.id = a.class_id;
  IF school IS NULL THEN RAISE EXCEPTION 'plan:class-missing'; END IF;
  SELECT s.state INTO ys FROM public.academic_year_operational_state_at(yr) s;
  IF ys IS NULL OR ys NOT IN ('em-preparacao','operacional') THEN RAISE EXCEPTION 'plan:year-not-plannable:%', coalesce(ys,'sem-estado'); END IF;
  IF _status NOT IN ('rascunho','publicado','arquivado') THEN RAISE EXCEPTION 'plan:invalid-status'; END IF;
  IF _covers_from IS NOT NULL AND _covers_until IS NOT NULL AND _covers_until < _covers_from THEN RAISE EXCEPTION 'plan:invalid-interval'; END IF;
  IF _period_id IS NOT NULL THEN
    SELECT * INTO per FROM public.institutional_academic_periods p WHERE p.id = _period_id AND p.academic_year_id = yr;
    IF per IS NULL THEN RAISE EXCEPTION 'plan:period-not-of-year'; END IF;
    IF (_covers_from IS NOT NULL AND _covers_from < per.starts_on) OR (_covers_until IS NOT NULL AND _covers_until > per.ends_on)
      THEN RAISE EXCEPTION 'plan:interval-outside-period'; END IF;
  END IF;
  IF jsonb_typeof(coalesce(_blocks,'[]')) <> 'array' OR jsonb_array_length(coalesce(_blocks,'[]')) > 60 THEN RAISE EXCEPTION 'plan:invalid-blocks'; END IF;
  FOR b IN SELECT * FROM jsonb_array_elements(coalesce(_blocks,'[]')) LOOP
    IF jsonb_typeof(b) <> 'object' OR length(coalesce(b->>'heading','')) > 160 OR length(coalesce(b->>'body','')) > 20000
       OR length(coalesce(b->>'kind','')) > 80 THEN RAISE EXCEPTION 'plan:invalid-blocks'; END IF;
  END LOOP;
  IF jsonb_typeof(coalesce(_curricular_refs,'[]')) <> 'array' THEN RAISE EXCEPTION 'plan:invalid-refs'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_curricular_refs,'[]')) LOOP
    IF length(coalesce(r->>'position_key','')) > 200 THEN RAISE EXCEPTION 'plan:invalid-refs'; END IF;
    IF r->>'kind' = 'matrix-item' THEN
      -- Só o elemento da própria atribuição; outro componente exige fluxo de exceção inexistente.
      IF r->>'item_key' IS DISTINCT FROM a.item_key THEN RAISE EXCEPTION 'plan:matrix-item-not-of-assignment'; END IF;
    ELSIF r->>'kind' = 'reference-item' THEN
      IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_items i WHERE i.id::text = r->>'item_id') THEN RAISE EXCEPTION 'plan:reference-item-unknown'; END IF;
    ELSE RAISE EXCEPTION 'plan:invalid-refs'; END IF;
  END LOOP;
  IF _copied_from IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions s WHERE s.id = _copied_from AND s.author_user_id = auth.uid())
    THEN RAISE EXCEPTION 'plan:copy-only-own-structure'; END IF;

  IF _expected_head IS NULL THEN
    IF new_plan IS NULL THEN new_plan := 'pln-' || gen_random_uuid(); END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('plan:' || new_plan));
    IF EXISTS (SELECT 1 FROM public.teaching_plan_versions WHERE plan_id = new_plan) THEN RAISE EXCEPTION 'plan:stale-head'; END IF;
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('plan:' || _plan_id));
    SELECT * INTO head FROM public.teaching_plan_versions WHERE plan_id = _plan_id ORDER BY version DESC LIMIT 1;
    IF head IS NULL OR head.id <> _expected_head THEN RAISE EXCEPTION 'plan:stale-head'; END IF;
    IF head.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'plan:not-author'; END IF;
    IF head.assignment_id <> _assignment_id THEN RAISE EXCEPTION 'plan:assignment-immutable'; END IF;
    IF _copied_from IS NOT NULL THEN RAISE EXCEPTION 'plan:copy-only-on-new'; END IF;
    v := head.version + 1;
  END IF;

  INSERT INTO public.teaching_plan_versions(plan_id, version, supersedes_id, assignment_id, assignment_version_id, matrix_version_id, class_id, school_id,
    level_value_id, covers_from, covers_until, title, blocks, curricular_refs, status, copied_from_version_id, change_reason, author_user_id, author_engagement_id, period_id, target_date)
  SELECT new_plan, v, _expected_head, _assignment_id, a.version_id, tv.matrix_version_id, a.class_id, school,
    nullif(btrim(_level_value_id),''), _covers_from, _covers_until, btrim(_title), coalesce(_blocks,'[]'), coalesce(_curricular_refs,'[]'), _status, _copied_from,
    nullif(btrim(_change_reason),''), auth.uid(), a.engagement_id, _period_id, _target_date
  FROM public.teaching_assignment_versions tv WHERE tv.id = a.version_id
  RETURNING id INTO new_id;
  IF new_id IS NULL THEN RAISE EXCEPTION 'plan:assignment-version-missing'; END IF;
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.record_teaching_plan_version_v2(text,uuid,text,text,text,date,text,date,date,jsonb,jsonb,text,uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_teaching_plan_version_v2(text,uuid,text,text,text,date,text,date,date,jsonb,jsonb,text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_teaching_plan_version(text,uuid,text,text,text,date,date,jsonb,jsonb,text,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.record_teaching_plan_version(text,uuid,text,text,text,date,date,jsonb,jsonb,text,uuid,text) IS 'DEPRECATED: usava current_date; substituída por record_teaching_plan_version_v2';
REVOKE EXECUTE ON FUNCTION public.link_lesson_to_plan(text,uuid,uuid) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.record_teaching_plan_attachment(text,text,text,text,uuid) FROM PUBLIC, anon, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.teaching_plan_versions, public.teaching_plan_lesson_links FROM anon, authenticated, service_role;