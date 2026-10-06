-- Frente Z.2 — conclusão do Planejamento (aditivo). Período pela versão canônica aplicável à turma na data-alvo,
-- janela integral (período ∩ atribuição ∩ plano), referência Y normalizada com edição, item validado por versão da matriz,
-- posição curricular explícita, vínculo plano↔aula só por ato explícito de pessoa natural. Sem relógio civil autorizador.

CREATE OR REPLACE FUNCTION public.plan_period_window(_class text, _period text, _on date, _known_at timestamptz,
  OUT issue text, OUT starts_on date, OUT ends_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _org text; _n int;
BEGIN
  SELECT count(*), min(o.organization_id) INTO _n, _org FROM public.institutional_class_period_organization_versions o
   WHERE o.class_id = _class AND o.created_at <= _known_at AND o.valid_from <= _on AND (o.valid_until IS NULL OR o.valid_until >= _on)
     AND NOT EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions s WHERE s.supersedes_id = o.id AND s.created_at <= _known_at);
  IF _n = 0 THEN issue := 'plan:class-period-organization-missing'; RETURN; END IF;
  IF _n > 1 THEN issue := 'plan:class-period-organization-ambiguous'; RETURN; END IF;
  SELECT v.starts_on, v.ends_on INTO starts_on, ends_on FROM public.institutional_academic_periods p
   JOIN LATERAL (SELECT x.* FROM public.institutional_academic_period_versions x WHERE x.period_id = p.id AND x.created_at <= _known_at
                 ORDER BY x.version DESC LIMIT 1) v ON true
   WHERE p.id = _period AND p.period_organization_id = _org AND v.is_active;
  IF starts_on IS NULL THEN issue := 'plan:period-not-of-class-organization'; RETURN; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_teaching_plan_version_v2(_plan_id text, _expected_head uuid, _assignment_id text, _title text, _level_value_id text,
  _target_date date, _period_id text, _covers_from date, _covers_until date, _blocks jsonb, _curricular_refs jsonb, _status text, _copied_from uuid, _change_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid := public.current_person_id(); _k timestamptz := pg_catalog.now(); a record; head record; new_plan text := _plan_id; v int := 1; new_id uuid;
  school text; yr text; ys text; r jsonb; b jsonb; pw record; mv uuid; refs jsonb := '[]'; _ed uuid; f date; u date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'plan:no-session'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'plan:natural-person-required'; END IF;
  IF _target_date IS NULL THEN RAISE EXCEPTION 'plan:target-date-required'; END IF;
  SELECT * INTO a FROM public.my_teaching_assignments_at(_target_date, _k) t WHERE t.assignment_id = _assignment_id LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'plan:assignment-not-current'; END IF;
  SELECT tv.matrix_version_id INTO mv FROM public.teaching_assignment_versions tv WHERE tv.id = a.version_id;
  IF mv IS NULL THEN RAISE EXCEPTION 'plan:assignment-version-missing'; END IF;
  SELECT c.school_id, c.academic_year_id INTO school, yr FROM public.institutional_classes c WHERE c.id = a.class_id;
  IF school IS NULL THEN RAISE EXCEPTION 'plan:class-missing'; END IF;
  SELECT s.state INTO ys FROM public.academic_year_operational_state_at(yr) s;
  IF ys IS NULL OR ys NOT IN ('em-preparacao','operacional') THEN RAISE EXCEPTION 'plan:year-not-plannable:%', coalesce(ys,'sem-estado'); END IF;
  IF _status NOT IN ('rascunho','publicado','arquivado') THEN RAISE EXCEPTION 'plan:invalid-status'; END IF;
  IF _covers_from IS NOT NULL AND _covers_until IS NOT NULL AND _covers_until < _covers_from THEN RAISE EXCEPTION 'plan:invalid-interval'; END IF;
  -- Janela efetiva: data-alvo dentro do intervalo do plano; plano dentro da atribuição
  f := coalesce(_covers_from, _target_date); u := coalesce(_covers_until, _covers_from, _target_date);
  IF _target_date < f OR _target_date > u THEN RAISE EXCEPTION 'plan:target-date-outside-plan'; END IF;
  IF f < a.effective_from OR (a.effective_until IS NOT NULL AND u > a.effective_until) THEN RAISE EXCEPTION 'plan:interval-outside-assignment'; END IF;
  IF _period_id IS NOT NULL THEN
    SELECT * INTO pw FROM public.plan_period_window(a.class_id, _period_id, _target_date, _k);
    IF pw.issue IS NOT NULL THEN RAISE EXCEPTION '%', pw.issue; END IF;
    IF f < pw.starts_on OR u > pw.ends_on THEN RAISE EXCEPTION 'plan:interval-outside-period'; END IF;
  END IF;
  IF pg_catalog.jsonb_typeof(coalesce(_blocks,'[]')) <> 'array' OR pg_catalog.jsonb_array_length(coalesce(_blocks,'[]')) > 60 THEN RAISE EXCEPTION 'plan:invalid-blocks'; END IF;
  FOR b IN SELECT * FROM pg_catalog.jsonb_array_elements(coalesce(_blocks,'[]')) LOOP
    IF pg_catalog.jsonb_typeof(b) <> 'object' OR pg_catalog.length(coalesce(b->>'heading','')) > 160 OR pg_catalog.length(coalesce(b->>'body','')) > 20000
       OR pg_catalog.length(coalesce(b->>'kind','')) > 80 THEN RAISE EXCEPTION 'plan:invalid-blocks'; END IF;
  END LOOP;
  IF pg_catalog.jsonb_typeof(coalesce(_curricular_refs,'[]')) <> 'array' OR pg_catalog.jsonb_array_length(coalesce(_curricular_refs,'[]')) > 200 THEN RAISE EXCEPTION 'plan:invalid-refs'; END IF;
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(coalesce(_curricular_refs,'[]')) LOOP
    IF pg_catalog.jsonb_typeof(r) <> 'object' OR pg_catalog.length(coalesce(r->>'position_key','')) > 200 THEN RAISE EXCEPTION 'plan:invalid-refs'; END IF;
    -- Posição curricular explícita (multietapa): só uma posição registrada de aluno alocado na turma na data-alvo
    IF nullif(r->>'position_key','') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.allocation_curricular_positions_at(school, a.class_id, _target_date, _k) x WHERE x.position_logical_id = r->>'position_key')
      THEN RAISE EXCEPTION 'plan:position-not-in-class'; END IF;
    IF r->>'kind' = 'matrix-item' THEN
      IF r->>'item_key' IS DISTINCT FROM a.item_key THEN RAISE EXCEPTION 'plan:matrix-item-not-of-assignment'; END IF;
      IF r ? 'matrix_version_id' AND r->>'matrix_version_id' IS DISTINCT FROM mv::text THEN RAISE EXCEPTION 'plan:matrix-version-mismatch'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = mv AND i.item_key = a.item_key)
        THEN RAISE EXCEPTION 'plan:matrix-item-not-of-assignment'; END IF;
      refs := refs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('kind','matrix-item','item_key',a.item_key,
        'matrix_version_id',mv,'position_key',nullif(r->>'position_key',''))));
    ELSIF r->>'kind' = 'reference-item' THEN
      SELECT i.edition_id INTO _ed FROM public.curricular_reference_items i WHERE i.id::text = r->>'item_id';
      IF _ed IS NULL THEN RAISE EXCEPTION 'plan:reference-item-unknown'; END IF;
      IF r ? 'edition_id' AND r->>'edition_id' IS DISTINCT FROM _ed::text THEN RAISE EXCEPTION 'plan:reference-edition-mismatch'; END IF;
      refs := refs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('kind','reference-item','item_id',r->>'item_id',
        'edition_id',_ed,'position_key',nullif(r->>'position_key',''))));
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
  VALUES (new_plan, v, _expected_head, _assignment_id, a.version_id, mv, a.class_id, school,
    nullif(pg_catalog.btrim(_level_value_id),''), _covers_from, _covers_until, pg_catalog.btrim(_title), coalesce(_blocks,'[]'), refs, _status, _copied_from,
    nullif(pg_catalog.btrim(_change_reason),''), auth.uid(), a.engagement_id, _period_id, _target_date)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Vínculo plano↔aula: ato explícito de pessoa natural, sobre aula w/1 da mesma regência; revogar é novo evento (nada é apagado).
CREATE OR REPLACE FUNCTION public.link_lesson_to_plan(_lesson_logical_record_id text, _plan_version_id uuid, _revoke_link uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p record; new_id uuid; _person uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'plan:no-session'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons x WHERE x.id = _person AND x.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'plan:natural-person-required'; END IF;
  IF _revoke_link IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('plan-link:' || _revoke_link::text));
    IF NOT EXISTS (SELECT 1 FROM public.teaching_plan_lesson_links l WHERE l.id = _revoke_link AND l.linked_by = auth.uid() AND NOT l.revoked
                   AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_lesson_links x WHERE x.supersedes_id = l.id)) THEN RAISE EXCEPTION 'plan:stale-head'; END IF;
    INSERT INTO public.teaching_plan_lesson_links(lesson_logical_record_id, plan_version_id, linked_by, revoked, supersedes_id)
      SELECT l.lesson_logical_record_id, l.plan_version_id, auth.uid(), true, l.id FROM public.teaching_plan_lesson_links l WHERE l.id = _revoke_link RETURNING id INTO new_id;
    RETURN new_id;
  END IF;
  SELECT * INTO p FROM public.teaching_plan_versions WHERE id = _plan_version_id;
  IF p IS NULL OR p.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'plan:not-author'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lesson_record_versions l WHERE l.logical_record_id = _lesson_logical_record_id AND l.author_user_id = auth.uid()
                  AND l.assignment_id = p.assignment_id AND l.diary_contract = 'w/1')
    THEN RAISE EXCEPTION 'plan:lesson-not-own-assignment'; END IF;
  IF EXISTS (SELECT 1 FROM public.teaching_plan_lesson_links l WHERE l.lesson_logical_record_id = _lesson_logical_record_id AND l.plan_version_id = _plan_version_id
              AND NOT l.revoked AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_lesson_links x WHERE x.supersedes_id = l.id))
    THEN RAISE EXCEPTION 'plan:link-exists'; END IF;
  INSERT INTO public.teaching_plan_lesson_links(lesson_logical_record_id, plan_version_id, linked_by) VALUES (_lesson_logical_record_id, _plan_version_id, auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Períodos oficiais da turma da própria atribuição na data (para a tela do professor).
CREATE OR REPLACE FUNCTION public.plan_periods_for_assignment(_assignment text, _on date)
RETURNS TABLE(period_id text, label text, starts_on date, ends_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record; _org text; _k timestamptz := pg_catalog.now();
BEGIN
  IF auth.uid() IS NULL OR _on IS NULL THEN RETURN; END IF;
  SELECT * INTO a FROM public.my_teaching_assignments_at(_on, _k) t WHERE t.assignment_id = _assignment LIMIT 1;
  IF a IS NULL THEN RETURN; END IF;
  SELECT min(o.organization_id) INTO _org FROM public.institutional_class_period_organization_versions o
   WHERE o.class_id = a.class_id AND o.created_at <= _k AND o.valid_from <= _on AND (o.valid_until IS NULL OR o.valid_until >= _on)
     AND NOT EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions s WHERE s.supersedes_id = o.id AND s.created_at <= _k)
   HAVING count(*) = 1;
  IF _org IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT p.id, v.official_name, v.starts_on, v.ends_on FROM public.institutional_academic_periods p
   JOIN LATERAL (SELECT x.* FROM public.institutional_academic_period_versions x WHERE x.period_id = p.id AND x.created_at <= _k ORDER BY x.version DESC LIMIT 1) v ON true
   WHERE p.period_organization_id = _org AND v.is_active ORDER BY v.starts_on;
END $$;

-- Acompanhamento SOMENTE LEITURA (Orientação/Direção da escola; rede por capacidade): só planos compartilhados, sem rascunhos, sem ação.
CREATE OR REPLACE FUNCTION public.teaching_plans_overview_at(_school text, _on date)
RETURNS TABLE(result_kind text, plan_id text, version int, plan_version_id uuid, class_id text, assignment_id text, title text,
  period_id text, covers_from date, covers_until date, blocks jsonb, curricular_refs jsonb, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR _school IS NULL OR _on IS NULL THEN result_kind := 'invalid'; RETURN NEXT; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(_on) c WHERE c.capability_id = 'consultar-planejamento-docente'
      AND c.policy_id IS NOT NULL AND (c.school_id = _school OR c.scope_level = 'rede')) THEN
    result_kind := 'access-denied'; RETURN NEXT; RETURN; END IF;
  RETURN QUERY SELECT 'plan'::text, p.plan_id, p.version, p.id, p.class_id, p.assignment_id, p.title, p.period_id, p.covers_from, p.covers_until,
      p.blocks, p.curricular_refs, p.recorded_at
    FROM public.teaching_plan_versions p
   WHERE p.school_id = _school AND p.status = 'publicado'
     AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions s WHERE s.supersedes_id = p.id)
     AND (p.covers_from IS NULL OR p.covers_from <= _on) AND (p.covers_until IS NULL OR p.covers_until >= _on OR p.covers_until IS NULL)
   ORDER BY p.class_id, p.title;
END $$;

REVOKE ALL ON FUNCTION public.plan_period_window(text,text,date,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_teaching_plan_version_v2(text,uuid,text,text,text,date,text,date,date,jsonb,jsonb,text,uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_teaching_plan_version_v2(text,uuid,text,text,text,date,text,date,date,jsonb,jsonb,text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.link_lesson_to_plan(text,uuid,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.link_lesson_to_plan(text,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.plan_periods_for_assignment(text,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.plan_periods_for_assignment(text,date) TO authenticated;
REVOKE ALL ON FUNCTION public.teaching_plans_overview_at(text,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.teaching_plans_overview_at(text,date) TO authenticated;
