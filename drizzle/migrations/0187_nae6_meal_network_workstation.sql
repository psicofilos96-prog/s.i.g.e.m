-- NAE.6 — Central do Núcleo: leitura agregada (uma consulta, sem N+1) do que precisa de ação, qualidade dos dados
-- e trilha de autoria. Somente leitura; nenhum indicador normativo (adesão, eficiência, score) é calculado.
-- Estado por linha: AVAILABLE (contagem lida), BLOCKED (regra/fonte ausente, com motivo). Zero só quando lido.

CREATE FUNCTION public.meal_network_action_summary(_on date, _competence text)
RETURNS TABLE(key text, value bigint, state text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', _on);
  IF _competence IS NULL OR _competence !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
  RETURN QUERY
  WITH o AS (SELECT v.status FROM public.meal_order_versions v WHERE v.competence = _competence
             AND NOT EXISTS (SELECT 1 FROM public.meal_order_versions n WHERE n.supersedes_id = v.id)),
       sc AS (SELECT s.logical_id, s.expected_on FROM public.meal_delivery_schedules s WHERE s.action <> 'cancelamento'
             AND NOT EXISTS (SELECT 1 FROM public.meal_delivery_schedules n WHERE n.supersedes_id = s.id)),
       rc AS (SELECT DISTINCT r.schedule_logical_id FROM public.meal_receipts r WHERE r.status IN ('confirmado','retificado')
             AND NOT EXISTS (SELECT 1 FROM public.meal_receipts n WHERE n.supersedes_id = r.id)),
       nc AS (SELECT x.status FROM public.meal_nonconformities x WHERE NOT EXISTS (SELECT 1 FROM public.meal_nonconformities n WHERE n.supersedes_id = x.id)),
       ct AS (SELECT x.status FROM public.meal_stock_counts x WHERE NOT EXISTS (SELECT 1 FROM public.meal_stock_counts n WHERE n.supersedes_id = x.id)),
       mr AS (SELECT h.kind, h.valid_to FROM public.meal_master_records h WHERE h.status = 'homologada'
             AND NOT EXISTS (SELECT 1 FROM public.meal_master_records n WHERE n.logical_id = h.logical_id AND n.version > h.version))
  SELECT 'pedidos-submetidos', (SELECT count(*) FROM o WHERE o.status = 'submetido'), 'AVAILABLE', NULL::text
  UNION ALL SELECT 'pedidos-em-analise', (SELECT count(*) FROM o WHERE o.status = 'em-analise'), 'AVAILABLE', NULL
  UNION ALL SELECT 'pedidos-devolvidos', (SELECT count(*) FROM o WHERE o.status = 'devolvido'), 'AVAILABLE', NULL
  UNION ALL SELECT 'pedidos-rascunho', (SELECT count(*) FROM o WHERE o.status = 'rascunho'), 'AVAILABLE', NULL
  UNION ALL SELECT 'pedidos-autorizados', (SELECT count(*) FROM o WHERE o.status IN ('autorizado-total','autorizado-parcial')), 'AVAILABLE', NULL
  UNION ALL SELECT 'consolidacoes', (SELECT count(*) FROM public.meal_demand_consolidations d WHERE d.competence = _competence), 'AVAILABLE', NULL
  UNION ALL SELECT 'entregas-hoje', (SELECT count(*) FROM sc WHERE sc.expected_on = _on AND sc.logical_id NOT IN (SELECT schedule_logical_id FROM rc)), 'AVAILABLE', NULL
  UNION ALL SELECT 'entregas-atrasadas', (SELECT count(*) FROM sc WHERE sc.expected_on < _on AND sc.logical_id NOT IN (SELECT schedule_logical_id FROM rc)), 'AVAILABLE', NULL
  UNION ALL SELECT 'nao-conformidades-abertas', (SELECT count(*) FROM nc WHERE nc.status NOT IN ('resolvida','encerrada')), 'AVAILABLE', NULL
  UNION ALL SELECT 'prazo-nao-conformidade', NULL::bigint, 'BLOCKED', 'NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'inventarios-pendentes', (SELECT count(*) FROM ct WHERE ct.status IN ('rascunho','conferida')), 'AVAILABLE', NULL
  UNION ALL SELECT 'documentos-com-fim-de-vigencia', (SELECT count(*) FROM mr WHERE mr.valid_to IS NOT NULL AND mr.valid_to >= _on), 'AVAILABLE', NULL
  UNION ALL SELECT 'escolas-sem-execucao', NULL::bigint, 'BLOCKED', 'Calendário aplicável por escola não resolvido: dia letivo não é presumido.'
  UNION ALL SELECT 'adesao', NULL::bigint, 'BLOCKED', 'ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE';
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_action_summary(date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_network_action_summary(date, text) TO authenticated;

CREATE FUNCTION public.meal_network_data_quality(_on date)
RETURNS TABLE(key text, value bigint, state text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', _on);
  RETURN QUERY
  SELECT 'movimento-sinal-desconhecido', (SELECT count(*) FROM public.meal_inventory_movements m
           WHERE m.movement_kind = 'ajuste' AND m.direction IS NULL AND m.movement_class IS NULL), 'AVAILABLE', NULL::text
  UNION ALL SELECT 'recebimento-sem-programacao', (SELECT count(*) FROM public.meal_receipts r
           WHERE NOT EXISTS (SELECT 1 FROM public.meal_delivery_schedules s WHERE s.logical_id = r.schedule_logical_id)), 'AVAILABLE', NULL
  UNION ALL SELECT 'cardapio-sem-publicacao', (SELECT count(*) FROM public.meal_menu_versions v WHERE v.event_kind <> 'revogacao'
           AND NOT EXISTS (SELECT 1 FROM public.meal_menu_versions n WHERE n.supersedes_id = v.id)
           AND NOT EXISTS (SELECT 1 FROM public.meal_menu_publications p WHERE p.menu_version_id = v.id)), 'AVAILABLE', NULL
  UNION ALL SELECT 'documento-vencido', (SELECT count(*) FROM public.meal_master_records h WHERE h.kind = 'documento-tecnico' AND h.status = 'homologada'
           AND h.valid_to IS NOT NULL AND h.valid_to < _on
           AND NOT EXISTS (SELECT 1 FROM public.meal_master_records n WHERE n.logical_id = h.logical_id AND n.version > h.version)), 'AVAILABLE', NULL
  UNION ALL SELECT 'consumo-sem-vinculo', (SELECT count(*) FROM public.meal_inventory_movements m WHERE m.movement_class = 'consumo-observado'
           AND m.note LIKE 'execucao:%' AND NOT EXISTS (SELECT 1 FROM public.meal_execution_consumptions c WHERE c.movement_id = m.id)), 'AVAILABLE', NULL
  UNION ALL SELECT 'estoque-negativo', NULL::bigint, 'UNAVAILABLE', 'Saldo é derivado por escola; consulte os alertas da escola.'
  UNION ALL SELECT 'conversao-ausente', NULL::bigint, 'BLOCKED', 'UNIT_CONVERSIONS — BLOCKED_BY_HOMOLOGATED_RULE';
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_data_quality(date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_network_data_quality(date) TO authenticated;

-- Trilha de autoria: só atos com pessoa natural registrada; atores técnicos não têm linhas aqui.
CREATE FUNCTION public.meal_audit_trail_at(_school text, _from timestamptz, _to timestamptz)
RETURNS TABLE(source text, logical_id uuid, version integer, act text, school_id text, author_person_id uuid, reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', (_to AT TIME ZONE 'UTC')::date);
  IF _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > interval '370 days' THEN RAISE EXCEPTION 'meal:period-invalid'; END IF;
  RETURN QUERY SELECT * FROM (
    SELECT 'pedido', v.logical_id, v.version, v.status, v.school_id, v.author_person_id, v.reason, v.recorded_at FROM public.meal_order_versions v
    UNION ALL SELECT 'programacao', s.logical_id, s.version, s.action, s.school_id, s.author_person_id, s.reason, s.recorded_at FROM public.meal_delivery_schedules s
    UNION ALL SELECT 'recebimento', r.logical_id, r.version, r.status, r.school_id, r.author_person_id, r.reason, r.recorded_at FROM public.meal_receipts r
    UNION ALL SELECT 'nao-conformidade', n.logical_id, n.version, n.status, n.school_id, n.author_person_id, n.reason, n.recorded_at FROM public.meal_nonconformities n
    UNION ALL SELECT 'estoque', m.logical_id, m.version, coalesce(m.movement_class, m.movement_kind), m.school_id, m.author_person_id, m.reason, m.recorded_at FROM public.meal_inventory_movements m
    UNION ALL SELECT 'execucao', e.logical_id, e.version, e.event_kind, e.school_id, e.author_person_id, e.reason, e.recorded_at FROM public.meal_daily_executions e
  ) t WHERE t.recorded_at BETWEEN _from AND _to AND (_school IS NULL OR t.school_id = _school)
  ORDER BY t.recorded_at DESC LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_audit_trail_at(text, timestamptz, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_audit_trail_at(text, timestamptz, timestamptz) TO authenticated;
