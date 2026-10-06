-- NAE.8 Lote 4 — desempenho medido (massa sintética 60k movimentos/8k entregas/15k execuções, rollback):
-- o resumo da rede levava ~2 s porque cada chave reescaneava as linhas factuais. Agora agrega uma vez por
-- (dataset, situação, classe, lote?, validade?, submetido?) e as chaves somam esse agregado pequeno; mesma
-- semântica e mesmas linhas de meal_reporting_facts (drill-down continua reconciliando por construção).
-- Índices parciais de sucessor (busca da última versão) onde faltavam. Sem mudança de dado.
CREATE INDEX IF NOT EXISTS meal_delivery_schedules_successor ON public.meal_delivery_schedules (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meal_receipts_successor ON public.meal_receipts (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meal_daily_executions_successor ON public.meal_daily_executions (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meal_nonconformities_successor ON public.meal_nonconformities (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meal_stock_counts_successor ON public.meal_stock_counts (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meal_order_versions_successor ON public.meal_order_versions (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meal_evidence_attachments_successor ON public.meal_evidence_attachments (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meal_inventory_movements_school_day ON public.meal_inventory_movements (school_id, moved_on);
CREATE INDEX IF NOT EXISTS meal_daily_executions_school_day ON public.meal_daily_executions (school_id, executed_on);

CREATE OR REPLACE FUNCTION public.meal_reporting_summary(_school text, _from date, _to date)
RETURNS TABLE(dataset text, key text, value numeric, state text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.meal_reporting_scope(_school, _from, _to);
  RETURN QUERY
  WITH ag AS MATERIALIZED (
    SELECT d.ds, x.situacao, x.classe, x.lote IS NOT NULL AS has_lot, x.validade IS NOT NULL AS has_val,
           coalesce((x.row_data->>'foi_submetido')::boolean, false) AS sub, count(*)::numeric AS n,
           sum((x.row_data->>'refeicoes_servidas')::numeric) AS meals, count(x.row_data->>'refeicoes_servidas') AS meals_n,
           sum((x.row_data->>'alunos_presentes')::numeric) AS stud, count(x.row_data->>'alunos_presentes') AS stud_n
    FROM unnest(ARRAY['pedidos','entregas','nao-conformidades','evidencias','documentos-fiscais','movimentos','inventarios','execucoes','publicacoes','fechamentos']) d(ds)
    CROSS JOIN LATERAL public.meal_reporting_facts(d.ds, _school, _from, _to) x
    GROUP BY 1, 2, 3, 4, 5, 6),
  k(ds, key, kind, arg) AS (VALUES
    ('pedidos','total','all',NULL), ('pedidos','submetidos','submitted',NULL),
    ('pedidos','autorizado-total','sit','autorizado-total'), ('pedidos','autorizado-parcial','sit','autorizado-parcial'), ('pedidos','rejeitado','sit','rejeitado'),
    ('pedidos','em-analise','sit','em-analise'), ('pedidos','submetido','sit','submetido'), ('pedidos','devolvido','sit','devolvido'), ('pedidos','rascunho','sit','rascunho'),
    ('entregas','total','all',NULL), ('entregas','integral','sit','integral'), ('entregas','parcial','sit','parcial'), ('entregas','rejeitada','sit','rejeitada'), ('entregas','pendente','sit','pendente'),
    ('nao-conformidades','aberta','sit','aberta'), ('nao-conformidades','tratada','sit','tratada'),
    ('evidencias','ativa','sit','ativa'), ('evidencias','revogada','sit','revogada'),
    ('documentos-fiscais','total','all',NULL),
    ('movimentos','entrada-aceite','cls','entrada-aceite'), ('movimentos','consumo-observado','cls','consumo-observado'), ('movimentos','perda','cls','perda'),
    ('movimentos','devolucao','cls','devolucao'), ('movimentos','ajuste-inventario','cls','ajuste-inventario'), ('movimentos','classe-desconhecida','sit','classe-desconhecida'),
    ('movimentos','lote-informado','lot','informado'), ('movimentos','lote-ausente','lot','ausente'),
    ('movimentos','validade-informada','val','informada'), ('movimentos','validade-ausente','val','ausente'),
    ('inventarios','aprovada-divergente','sit','aprovada-divergente'), ('inventarios','aprovada-sem-divergencia','sit','aprovada-sem-divergencia'),
    ('inventarios','rascunho','sit','rascunho'), ('inventarios','conferida','sit','conferida'),
    ('execucoes','total','all',NULL), ('execucoes','seguido','sit','seguido'), ('execucoes','desvio','sit','desvio'), ('execucoes','seguimento-nao-informado','sit','seguimento-nao-informado'),
    ('execucoes','refeicoes-nao-informadas','cls','refeicoes-nao-informadas'),
    ('publicacoes','publicacao','sit','publicacao'), ('publicacoes','retirada','sit','retirada'),
    ('fechamentos','emissao','sit','emissao'), ('fechamentos','reemissao','sit','reemissao'))
  SELECT k.ds, k.key, coalesce((SELECT sum(a.n) FROM ag a WHERE a.ds = k.ds AND CASE k.kind
      WHEN 'all' THEN true WHEN 'sit' THEN a.situacao = k.arg WHEN 'cls' THEN a.classe = k.arg
      WHEN 'submitted' THEN a.sub
      WHEN 'lot' THEN a.classe = 'entrada-aceite' AND ((k.arg = 'informado') = a.has_lot)
      WHEN 'val' THEN a.classe = 'entrada-aceite' AND ((k.arg = 'informada') = a.has_val) END), 0), 'AVAILABLE', NULL::text
  FROM k
  UNION ALL
  SELECT 'execucoes', 'refeicoes-servidas', s.v, CASE WHEN coalesce(s.n, 0) = 0 THEN 'UNKNOWN' ELSE 'AVAILABLE' END,
         CASE WHEN coalesce(s.n, 0) = 0 THEN 'Nenhuma execução com refeições informadas no período.' END
  FROM (SELECT sum(a.meals) v, sum(a.meals_n) n FROM ag a WHERE a.ds = 'execucoes') s
  UNION ALL
  SELECT 'execucoes', 'alunos-presentes', s.v, CASE WHEN coalesce(s.n, 0) = 0 THEN 'UNKNOWN' ELSE 'AVAILABLE' END,
         CASE WHEN coalesce(s.n, 0) = 0 THEN 'Nenhuma execução com alunos presentes informados (medida separada das refeições).' END
  FROM (SELECT sum(a.stud) v, sum(a.stud_n) n FROM ag a WHERE a.ds = 'execucoes') s
  UNION ALL SELECT 'bloqueios', 'adesao', NULL, 'BLOCKED', 'ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'desperdicio', NULL, 'BLOCKED', 'WASTE_METRIC — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'estoque-minimo', NULL, 'BLOCKED', 'MINIMUM_STOCK — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'prazo-nao-conformidade', NULL, 'BLOCKED', 'NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'custo', NULL, 'BLOCKED', 'COST_SOURCE — OFFICIAL_SOURCE_PENDING'
  UNION ALL SELECT 'bloqueios', 'baixa-teorica', NULL, 'BLOCKED', 'THEORETICAL_CONSUMPTION — BLOCKED_BY_HOMOLOGATED_RULE';
END $fn$;
REVOKE ALL ON FUNCTION public.meal_reporting_summary(text, date, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_reporting_summary(text, date, date) TO authenticated;
