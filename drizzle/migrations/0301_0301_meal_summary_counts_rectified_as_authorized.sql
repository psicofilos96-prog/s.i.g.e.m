-- LOTE 14: a Central contava só autorizado-total/parcial; 'retificado' só nasce de autorizado e a consolidação já o trata como autorizado.
CREATE OR REPLACE FUNCTION public.meal_network_action_summary(_on date, _competence text)
 RETURNS TABLE(key text, value bigint, state text, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  UNION ALL SELECT 'pedidos-autorizados', (SELECT count(*) FROM o WHERE o.status IN ('autorizado-total','autorizado-parcial','retificado')), 'AVAILABLE', NULL
  UNION ALL SELECT 'consolidacoes', (SELECT count(*) FROM public.meal_demand_consolidations d WHERE d.competence = _competence), 'AVAILABLE', NULL
  UNION ALL SELECT 'entregas-hoje', (SELECT count(*) FROM sc WHERE sc.expected_on = _on AND sc.logical_id NOT IN (SELECT schedule_logical_id FROM rc)), 'AVAILABLE', NULL
  UNION ALL SELECT 'entregas-atrasadas', (SELECT count(*) FROM sc WHERE sc.expected_on < _on AND sc.logical_id NOT IN (SELECT schedule_logical_id FROM rc)), 'AVAILABLE', NULL
  UNION ALL SELECT 'nao-conformidades-abertas', (SELECT count(*) FROM nc WHERE nc.status NOT IN ('resolvida','encerrada')), 'AVAILABLE', NULL
  UNION ALL SELECT 'prazo-nao-conformidade', NULL::bigint, 'BLOCKED', 'NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'inventarios-pendentes', (SELECT count(*) FROM ct WHERE ct.status IN ('rascunho','conferida')), 'AVAILABLE', NULL
  UNION ALL SELECT 'documentos-com-fim-de-vigencia', (SELECT count(*) FROM mr WHERE mr.valid_to IS NOT NULL AND mr.valid_to >= _on), 'AVAILABLE', NULL
  UNION ALL SELECT 'escolas-sem-execucao', NULL::bigint, 'BLOCKED', 'Calendário aplicável por escola não resolvido: dia letivo não é presumido.'
  UNION ALL SELECT 'adesao', NULL::bigint, 'BLOCKED', 'ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE';
END $function$;