ALTER TABLE public.sector_parameter_catalog ADD COLUMN default_value jsonb;
UPDATE public.sector_parameter_catalog SET default_value = '5'::jsonb WHERE key = 'alimentacao.prazo-nao-conformidade';
UPDATE public.sector_parameter_catalog SET default_value = '"refeicoes-por-presentes"'::jsonb WHERE key = 'alimentacao.formula-adesao';
INSERT INTO public.sector_parameter_catalog(key, sector, capability_id, value_kind, allowed, default_value) VALUES
 ('alimentacao.dias-de-atendimento', 'alimentacao', 'manter-parametros-nutricionais', 'escolha', '["segunda-a-sexta","segunda-a-sabado"]'::jsonb, '"segunda-a-sexta"'::jsonb);

-- Valor vigente: última versão; sem versão, o padrão do sistema (nada fica bloqueado por falta de definição).
CREATE OR REPLACE FUNCTION public.sector_parameter_value(_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce(
    (SELECT v.value FROM public.sector_parameter_versions v WHERE v.key = _key ORDER BY v.version DESC LIMIT 1),
    (SELECT c.default_value FROM public.sector_parameter_catalog c WHERE c.key = _key))
$$;

CREATE OR REPLACE FUNCTION public.meal_network_action_summary(_on date, _competence text)
 RETURNS TABLE(key text, value bigint, state text, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE dl int; af text; dd text; meals bigint; pres bigint; served boolean;
BEGIN
  PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', _on);
  IF _competence IS NULL OR _competence !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
  dl := (public.sector_parameter_value('alimentacao.prazo-nao-conformidade') #>> '{}')::int;
  af := public.sector_parameter_value('alimentacao.formula-adesao') #>> '{}';
  dd := public.sector_parameter_value('alimentacao.dias-de-atendimento') #>> '{}';
  served := extract(isodow FROM _on) <= CASE WHEN dd = 'segunda-a-sabado' THEN 6 ELSE 5 END;
  IF af = 'refeicoes-por-presentes' THEN
    SELECT sum(e.meals_total), sum(e.students_present) INTO meals, pres FROM public.meal_daily_executions e
     WHERE to_char(e.executed_on, 'YYYY-MM') = _competence AND e.meals_total IS NOT NULL AND e.students_present IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.meal_daily_executions n WHERE n.supersedes_id = e.id);
  END IF;
  RETURN QUERY
  WITH o AS (SELECT v.status FROM public.meal_order_versions v WHERE v.competence = _competence
             AND NOT EXISTS (SELECT 1 FROM public.meal_order_versions n WHERE n.supersedes_id = v.id)),
       sc AS (SELECT s.logical_id, s.expected_on FROM public.meal_delivery_schedules s WHERE s.action <> 'cancelamento'
             AND NOT EXISTS (SELECT 1 FROM public.meal_delivery_schedules n WHERE n.supersedes_id = s.id)),
       rc AS (SELECT DISTINCT r.schedule_logical_id FROM public.meal_receipts r WHERE r.status IN ('confirmado','retificado')
             AND NOT EXISTS (SELECT 1 FROM public.meal_receipts n WHERE n.supersedes_id = r.id)),
       nc AS (SELECT x.status, (SELECT min(f.recorded_at) FROM public.meal_nonconformities f WHERE f.logical_id = x.logical_id) AS opened_at
             FROM public.meal_nonconformities x WHERE NOT EXISTS (SELECT 1 FROM public.meal_nonconformities n WHERE n.supersedes_id = x.id)),
       ct AS (SELECT x.status FROM public.meal_stock_counts x WHERE NOT EXISTS (SELECT 1 FROM public.meal_stock_counts n WHERE n.supersedes_id = x.id)),
       mr AS (SELECT h.kind, h.valid_to FROM public.meal_master_records h WHERE h.status = 'homologada'
             AND NOT EXISTS (SELECT 1 FROM public.meal_master_records n WHERE n.logical_id = h.logical_id AND n.version > h.version)),
       ks AS (SELECT DISTINCT l.school_id FROM public.meal_kitchen_school_links l
              WHERE l.valid_from <= _on AND (l.valid_to IS NULL OR l.valid_to >= _on)
                AND NOT EXISTS (SELECT 1 FROM public.meal_kitchen_school_links n WHERE n.supersedes_id = l.id)
                AND l.event_kind <> 'encerramento'),
       ex AS (SELECT DISTINCT e.school_id FROM public.meal_daily_executions e WHERE e.executed_on = _on)
  SELECT 'pedidos-submetidos', (SELECT count(*) FROM o WHERE o.status = 'submetido'), 'AVAILABLE', NULL::text
  UNION ALL SELECT 'pedidos-em-analise', (SELECT count(*) FROM o WHERE o.status = 'em-analise'), 'AVAILABLE', NULL
  UNION ALL SELECT 'pedidos-devolvidos', (SELECT count(*) FROM o WHERE o.status = 'devolvido'), 'AVAILABLE', NULL
  UNION ALL SELECT 'pedidos-rascunho', (SELECT count(*) FROM o WHERE o.status = 'rascunho'), 'AVAILABLE', NULL
  UNION ALL SELECT 'pedidos-autorizados', (SELECT count(*) FROM o WHERE o.status IN ('autorizado-total','autorizado-parcial','retificado')), 'AVAILABLE', NULL
  UNION ALL SELECT 'consolidacoes', (SELECT count(*) FROM public.meal_demand_consolidations d WHERE d.competence = _competence), 'AVAILABLE', NULL
  UNION ALL SELECT 'entregas-hoje', (SELECT count(*) FROM sc WHERE sc.expected_on = _on AND sc.logical_id NOT IN (SELECT schedule_logical_id FROM rc)), 'AVAILABLE', NULL
  UNION ALL SELECT 'entregas-atrasadas', (SELECT count(*) FROM sc WHERE sc.expected_on < _on AND sc.logical_id NOT IN (SELECT schedule_logical_id FROM rc)), 'AVAILABLE', NULL
  UNION ALL SELECT 'nao-conformidades-abertas', (SELECT count(*) FROM nc WHERE nc.status NOT IN ('resolvida','encerrada')), 'AVAILABLE', NULL
  UNION ALL SELECT 'prazo-nao-conformidade',
     (SELECT count(*) FROM nc WHERE nc.status NOT IN ('resolvida','encerrada') AND (nc.opened_at AT TIME ZONE 'America/Sao_Paulo')::date + dl < _on),
     'AVAILABLE', 'Abertas há mais de ' || dl || ' dias.'
  UNION ALL SELECT 'inventarios-pendentes', (SELECT count(*) FROM ct WHERE ct.status IN ('rascunho','conferida')), 'AVAILABLE', NULL
  UNION ALL SELECT 'documentos-com-fim-de-vigencia', (SELECT count(*) FROM mr WHERE mr.valid_to IS NOT NULL AND mr.valid_to >= _on), 'AVAILABLE', NULL
  UNION ALL SELECT 'escolas-sem-execucao',
     CASE WHEN served THEN (SELECT count(*) FROM ks WHERE ks.school_id NOT IN (SELECT school_id FROM ex)) ELSE 0 END,
     'AVAILABLE',
     CASE WHEN served THEN 'Escolas ligadas a uma cozinha sem refeição registrada nesta data.' ELSE 'Esta data não é dia de atendimento.' END
  UNION ALL SELECT 'adesao',
     CASE WHEN coalesce(pres, 0) = 0 THEN NULL ELSE round(meals * 100.0 / pres)::bigint END,
     CASE WHEN coalesce(pres, 0) = 0 THEN 'UNKNOWN' ELSE 'AVAILABLE' END,
     CASE WHEN coalesce(pres, 0) = 0 THEN 'Ainda sem refeições com alunos presentes informados neste mês.'
          ELSE '% — refeições servidas ÷ alunos presentes (' || meals || ' ÷ ' || pres || ').' END;
END $function$;