-- Parâmetros por setor: catálogo fechado (cada chave tem consumidor real) + versões append-only.
CREATE TABLE public.sector_parameter_catalog (
  key text PRIMARY KEY,
  sector text NOT NULL,
  capability_id text NOT NULL,
  value_kind text NOT NULL CHECK (value_kind IN ('dias','escolha')),
  allowed jsonb
);
GRANT SELECT ON public.sector_parameter_catalog TO authenticated;
GRANT ALL ON public.sector_parameter_catalog TO service_role;
ALTER TABLE public.sector_parameter_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalogo legivel" ON public.sector_parameter_catalog FOR SELECT TO authenticated USING (true);

INSERT INTO public.sector_parameter_catalog(key, sector, capability_id, value_kind, allowed) VALUES
 ('alimentacao.prazo-nao-conformidade', 'alimentacao', 'manter-parametros-nutricionais', 'dias', NULL),
 ('alimentacao.formula-adesao', 'alimentacao', 'manter-parametros-nutricionais', 'escolha', '["refeicoes-por-presentes"]'::jsonb);

CREATE TABLE public.sector_parameter_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL REFERENCES public.sector_parameter_catalog(key),
  version integer NOT NULL,
  value jsonb NOT NULL,
  reason text NOT NULL,
  author_user_id uuid NOT NULL,
  author_engagement uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);
GRANT SELECT ON public.sector_parameter_versions TO authenticated;
GRANT ALL ON public.sector_parameter_versions TO service_role;
ALTER TABLE public.sector_parameter_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versoes legiveis" ON public.sector_parameter_versions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sector_parameter_versions_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'parameter:append-only'; END $$;
CREATE TRIGGER sector_parameter_versions_no_change BEFORE UPDATE OR DELETE ON public.sector_parameter_versions
FOR EACH ROW EXECUTE FUNCTION public.sector_parameter_versions_append_only();

CREATE OR REPLACE FUNCTION public.sector_parameter_value(_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT v.value FROM public.sector_parameter_versions v WHERE v.key = _key ORDER BY v.version DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.record_sector_parameter(_key text, _value jsonb, _reason text, _expected_version integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c public.sector_parameter_catalog; cur integer; g uuid; n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO c FROM public.sector_parameter_catalog WHERE key = _key;
  IF NOT FOUND THEN RAISE EXCEPTION 'parameter:unknown'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'parameter:reason-required'; END IF;
  IF c.sector = 'alimentacao' THEN g := public.meal_network_grant_on(c.capability_id, current_date);
  ELSE RAISE EXCEPTION 'parameter:sector-not-enabled'; END IF;
  IF c.value_kind = 'dias' THEN
    IF jsonb_typeof(_value) <> 'number' OR (_value #>> '{}')::numeric <> floor((_value #>> '{}')::numeric)
       OR (_value #>> '{}')::int < 1 OR (_value #>> '{}')::int > 365 THEN RAISE EXCEPTION 'parameter:days-invalid'; END IF;
  ELSIF NOT (c.allowed ? (_value #>> '{}')) THEN RAISE EXCEPTION 'parameter:choice-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sector-parameter:' || _key));
  SELECT coalesce(max(version), 0) INTO cur FROM public.sector_parameter_versions WHERE key = _key;
  IF cur <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'parameter:stale-base'; END IF;
  n := cur + 1;
  INSERT INTO public.sector_parameter_versions(key, version, value, reason, author_user_id, author_engagement)
  VALUES (_key, n, _value, btrim(_reason), auth.uid(), g);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.record_sector_parameter(text, jsonb, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sector_parameter(text, jsonb, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.sector_parameter_value(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sector_parameter_value(text) TO authenticated;

-- Central da Alimentação passa a ler os parâmetros.
CREATE OR REPLACE FUNCTION public.meal_network_action_summary(_on date, _competence text)
 RETURNS TABLE(key text, value bigint, state text, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE dl int; af text; meals bigint; pres bigint;
BEGIN
  PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', _on);
  IF _competence IS NULL OR _competence !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
  dl := (public.sector_parameter_value('alimentacao.prazo-nao-conformidade') #>> '{}')::int;
  af := public.sector_parameter_value('alimentacao.formula-adesao') #>> '{}';
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
  UNION ALL SELECT 'prazo-nao-conformidade',
     CASE WHEN dl IS NULL THEN NULL ELSE (SELECT count(*) FROM nc WHERE nc.status NOT IN ('resolvida','encerrada') AND (nc.opened_at AT TIME ZONE 'America/Sao_Paulo')::date + dl < _on) END,
     CASE WHEN dl IS NULL THEN 'BLOCKED' ELSE 'AVAILABLE' END,
     CASE WHEN dl IS NULL THEN 'NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE' ELSE 'Abertas há mais de ' || dl || ' dias.' END
  UNION ALL SELECT 'inventarios-pendentes', (SELECT count(*) FROM ct WHERE ct.status IN ('rascunho','conferida')), 'AVAILABLE', NULL
  UNION ALL SELECT 'documentos-com-fim-de-vigencia', (SELECT count(*) FROM mr WHERE mr.valid_to IS NOT NULL AND mr.valid_to >= _on), 'AVAILABLE', NULL
  UNION ALL SELECT 'escolas-sem-execucao', NULL::bigint, 'BLOCKED', 'Calendário aplicável por escola não resolvido: dia letivo não é presumido.'
  UNION ALL SELECT 'adesao',
     CASE WHEN af IS NULL OR coalesce(pres, 0) = 0 THEN NULL ELSE round(meals * 100.0 / pres)::bigint END,
     CASE WHEN af IS NULL THEN 'BLOCKED' WHEN coalesce(pres, 0) = 0 THEN 'UNKNOWN' ELSE 'AVAILABLE' END,
     CASE WHEN af IS NULL THEN 'ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE'
          WHEN coalesce(pres, 0) = 0 THEN 'Sem execução com alunos presentes informados nesta competência.'
          ELSE '% — refeições servidas ÷ alunos presentes (' || meals || ' ÷ ' || pres || ').' END;
END $function$;