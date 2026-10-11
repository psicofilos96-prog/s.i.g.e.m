-- NEI.6: indicadores do NEI calculados na hora sobre os ledgers existentes (nada gravado). Fórmulas e denominadores
-- documentados em src/features/inclusion/nei-indicators.ts. Só gestão NEI (coordenação/técnico/estação) no escopo; AEE não.
CREATE OR REPLACE FUNCTION public.nei_aee_current_status(_logical uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT e.status FROM public.nei_aee_offer_events e WHERE e.service_logical_id = _logical ORDER BY e.seq DESC LIMIT 1), 'planejada')
$$;
REVOKE ALL ON FUNCTION public.nei_aee_current_status(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_plan_overdue(_plan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM (SELECT v.status, v.content FROM public.nei_plan_versions v WHERE v.plan_id = _plan ORDER BY v.version DESC LIMIT 1) h,
    jsonb_array_elements(coalesce(h.content->'metas','[]'::jsonb)) m
    WHERE h.status <> 'concluido' AND nullif(m->>'prazo','') IS NOT NULL AND (m->>'prazo')::date < CURRENT_DATE)
$$;
REVOKE ALL ON FUNCTION public.nei_plan_overdue(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_indicators(_school text DEFAULT NULL)
RETURNS TABLE(school_id text, followed bigint, with_paee bigint, with_pei bigint, plans_total bigint, plans_overdue bigint,
  aee_services bigint, aee_planned bigint, aee_started bigint, aee_interrupted bigint,
  cases_open bigint, cases_overdue bigint, support_open bigint, actions_open bigint, actions_overdue bigint,
  mediations bigint, mediations_uncovered bigint, protocols_sent bigint, protocols_answered bigint, protocol_reply_days_median numeric,
  support_first_move_days_median numeric, barriers_open bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  PERFORM public.nei_log('indicadores', _school, 'permitido');
  RETURN QUERY
  WITH sc AS (SELECT s.id FROM public.institutional_schools s WHERE (_school IS NULL OR s.id = _school) AND public.nei_school_manager(s.id)),
  aee AS (SELECT DISTINCT ON (a.logical_id) a.* FROM public.aee_services a ORDER BY a.logical_id, a.version DESC),
  aeev AS (SELECT a.school_id, public.nei_aee_current_status(a.logical_id) st FROM aee a WHERE a.event_kind <> 'encerramento' AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)),
  cl AS (SELECT c.school_id, (SELECT e.stage FROM public.nei_case_events e WHERE e.case_id = c.id ORDER BY e.seq DESC LIMIT 1) st,
           (SELECT e.due_date FROM public.nei_case_events e WHERE e.case_id = c.id AND e.due_date IS NOT NULL ORDER BY e.seq DESC LIMIT 1) due FROM public.nei_cases c),
  med AS (SELECT DISTINCT ON (m.logical_id) m.* FROM public.inclusion_mediation_assignments m ORDER BY m.logical_id, m.version DESC),
  medv AS (SELECT m.school_id, NOT public.nei_engagement_active_at(m.mediator_engagement_id, m.school_id)
        OR (EXISTS (SELECT 1 FROM public.nei_coverage_events c WHERE c.covered_engagement_id = m.mediator_engagement_id AND c.kind = 'afastamento' AND c.starts_on <= CURRENT_DATE AND (c.ends_on IS NULL OR c.ends_on >= CURRENT_DATE))
          AND NOT EXISTS (SELECT 1 FROM public.nei_coverage_events c WHERE c.covered_engagement_id = m.mediator_engagement_id AND c.kind = 'substituicao' AND c.starts_on <= CURRENT_DATE AND (c.ends_on IS NULL OR c.ends_on >= CURRENT_DATE))) unc
      FROM med m WHERE m.event_kind <> 'encerramento' AND m.valid_from <= CURRENT_DATE AND (m.valid_to IS NULL OR m.valid_to >= CURRENT_DATE)),
  pr AS (SELECT p.school_id, p.sent_at, (SELECT min(e.recorded_at) FROM public.nei_protocol_events e WHERE e.protocol_id = p.id AND e.stage = 'devolutiva') ans FROM public.nei_protocols p),
  sr AS (SELECT r.school_id, r.opened_at, (SELECT e.stage FROM public.nei_support_request_events e WHERE e.request_id = r.id ORDER BY e.seq DESC LIMIT 1) st,
           (SELECT e.recorded_at FROM public.nei_support_request_events e WHERE e.request_id = r.id AND e.seq = 2) moved FROM public.nei_support_requests r),
  ac AS (SELECT a.school_id, a.due_on, (SELECT e.status FROM public.nei_action_events e WHERE e.action_id = a.id ORDER BY e.seq DESC LIMIT 1) st FROM public.nei_actions a),
  stu AS (SELECT x.school_id, x.student_id FROM public.nei_profile_entries x UNION SELECT c.school_id, c.student_id FROM public.nei_cases c UNION SELECT p.school_id, p.student_id FROM public.nei_plans p)
  SELECT sc.id,
    (SELECT count(DISTINCT s.student_id) FROM stu s WHERE s.school_id = sc.id),
    (SELECT count(DISTINCT p.student_id) FROM public.nei_plans p WHERE p.school_id = sc.id AND p.kind = 'paee'),
    (SELECT count(DISTINCT p.student_id) FROM public.nei_plans p WHERE p.school_id = sc.id AND p.kind = 'pei'),
    (SELECT count(*) FROM public.nei_plans p WHERE p.school_id = sc.id),
    (SELECT count(*) FROM public.nei_plans p WHERE p.school_id = sc.id AND public.nei_plan_overdue(p.id)),
    (SELECT count(*) FROM aeev WHERE aeev.school_id = sc.id),
    (SELECT count(*) FROM aeev WHERE aeev.school_id = sc.id AND aeev.st = 'planejada'),
    (SELECT count(*) FROM aeev WHERE aeev.school_id = sc.id AND aeev.st IN ('iniciada','retomada')),
    (SELECT count(*) FROM aeev WHERE aeev.school_id = sc.id AND aeev.st = 'interrompida'),
    (SELECT count(*) FROM cl WHERE cl.school_id = sc.id AND cl.st <> 'encerramento'),
    (SELECT count(*) FROM cl WHERE cl.school_id = sc.id AND cl.st <> 'encerramento' AND cl.due < CURRENT_DATE),
    (SELECT count(*) FROM sr WHERE sr.school_id = sc.id AND sr.st NOT IN ('indeferida','cancelada','encerrada')),
    (SELECT count(*) FROM ac WHERE ac.school_id = sc.id AND ac.st NOT IN ('concluida','cancelada')),
    (SELECT count(*) FROM ac WHERE ac.school_id = sc.id AND ac.st NOT IN ('concluida','cancelada') AND ac.due_on < CURRENT_DATE),
    (SELECT count(*) FROM medv WHERE medv.school_id = sc.id),
    (SELECT count(*) FROM medv WHERE medv.school_id = sc.id AND medv.unc),
    (SELECT count(*) FROM pr WHERE pr.school_id = sc.id),
    (SELECT count(*) FROM pr WHERE pr.school_id = sc.id AND pr.ans IS NOT NULL),
    (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM pr.ans - pr.sent_at) / 86400))::numeric, 1) FROM pr WHERE pr.school_id = sc.id AND pr.ans IS NOT NULL),
    (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM sr.moved - sr.opened_at) / 86400))::numeric, 1) FROM sr WHERE sr.school_id = sc.id AND sr.moved IS NOT NULL),
    (SELECT count(*) FROM public.nei_accessibility_barriers b WHERE b.school_id = sc.id
       AND (SELECT e.status FROM public.nei_barrier_events e WHERE e.barrier_id = b.id ORDER BY e.seq DESC LIMIT 1) NOT IN ('resolvida','sem-solucao'))
  FROM sc ORDER BY sc.id;
END $$;
REVOKE ALL ON FUNCTION public.nei_indicators(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_indicators(text) TO authenticated;

-- Drill-down autorizado e minimizado: só nome de exibição, situação e data; nada clínico, nenhum texto livre.
CREATE OR REPLACE FUNCTION public.nei_indicator_drill(_school text, _key text)
RETURNS TABLE(student_name text, situation text, ref_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR NOT public.nei_school_manager(_school) THEN PERFORM public.nei_log('indicador-detalhe', _school, 'recusado'); RETURN; END IF;
  PERFORM public.nei_log('indicador-detalhe:' || left(coalesce(_key,''), 40), _school, 'permitido');
  RETURN QUERY
  WITH nm AS (SELECT DISTINCT ON (v.student_id) v.student_id, coalesce(nullif(btrim(v.social_name),''), v.civil_name) n FROM public.student_identity_versions v ORDER BY v.student_id, v.version DESC)
  SELECT * FROM (
    SELECT nm.n, ('Plano ' || upper(p.kind) || ' com meta vencida')::text, p.created_at::date FROM public.nei_plans p LEFT JOIN nm ON nm.student_id = p.student_id
      WHERE _key = 'plans_overdue' AND p.school_id = _school AND public.nei_plan_overdue(p.id)
    UNION ALL
    SELECT nm.n, ('Caso na etapa ' || e.stage)::text, e.due_date FROM public.nei_cases c LEFT JOIN nm ON nm.student_id = c.student_id
      JOIN LATERAL (SELECT x.stage, (SELECT y.due_date FROM public.nei_case_events y WHERE y.case_id = c.id AND y.due_date IS NOT NULL ORDER BY y.seq DESC LIMIT 1) due_date FROM public.nei_case_events x WHERE x.case_id = c.id ORDER BY x.seq DESC LIMIT 1) e ON true
      WHERE _key = 'cases_open' AND c.school_id = _school AND e.stage <> 'encerramento'
    UNION ALL
    SELECT nm.n, ('AEE ' || public.nei_aee_current_status(a.logical_id))::text, a.valid_from FROM (SELECT DISTINCT ON (x.logical_id) x.* FROM public.aee_services x ORDER BY x.logical_id, x.version DESC) a LEFT JOIN nm ON nm.student_id = a.student_id
      WHERE _key = 'aee_services' AND a.school_id = _school AND a.event_kind <> 'encerramento' AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
  ) q ORDER BY 1 NULLS LAST LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.nei_indicator_drill(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_indicator_drill(text,text) TO authenticated;

-- Agregado para CIECE/rede: só totais da rede, sem escola nem pessoa; contagem 1–4 é suprimida (NULL).
CREATE OR REPLACE FUNCTION public.nei_network_aggregate()
RETURNS TABLE(indicator text, value bigint, suppressed boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT (public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role = 'coordenador' AND g.scope_kind = 'rede')
          OR public.has_network_capability('consultar-ciece')) THEN
    PERFORM public.nei_log('agregado-rede', NULL, 'recusado'); RETURN;
  END IF;
  PERFORM public.nei_log('agregado-rede', NULL, 'permitido');
  RETURN QUERY
  WITH t AS (
    SELECT 'estudantes-acompanhados'::text k, (SELECT count(DISTINCT s) FROM (SELECT student_id s FROM public.nei_profile_entries UNION SELECT student_id FROM public.nei_cases UNION SELECT student_id FROM public.nei_plans) u) v
    UNION ALL SELECT 'estudantes-com-paee', (SELECT count(DISTINCT student_id) FROM public.nei_plans WHERE kind = 'paee')
    UNION ALL SELECT 'estudantes-com-pei', (SELECT count(DISTINCT student_id) FROM public.nei_plans WHERE kind = 'pei')
    UNION ALL SELECT 'aee-vigentes', (SELECT count(*) FROM (SELECT DISTINCT ON (logical_id) * FROM public.aee_services ORDER BY logical_id, version DESC) a WHERE a.event_kind <> 'encerramento' AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE))
  ) SELECT t.k, CASE WHEN t.v BETWEEN 1 AND 4 THEN NULL ELSE t.v END, t.v BETWEEN 1 AND 4 FROM t;
END $$;
REVOKE ALL ON FUNCTION public.nei_network_aggregate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_network_aggregate() TO authenticated;
