-- NAE.8 Lote 4 — Central do Núcleo, relatórios e drill-down. SOMENTE LEITURA.
-- Um único conjunto de linhas factuais por dataset (meal_reporting_facts, interno) alimenta o resumo
-- (meal_reporting_summary) e o drill-down paginado (meal_reporting_rows): o número do cartão é, por construção,
-- a contagem das linhas que o explicam. Nenhum valor é gravado ou materializado; nenhuma métrica normativa
-- (adesão, desperdício, estoque mínimo, custo, prazo de NC, score) é calculada: aparecem BLOCKED com código.
-- Quantidades de unidades diferentes nunca são somadas no resumo: o resumo conta fatos; quantidades ficam nas linhas.
-- Sem PII: nenhuma linha devolve pessoa, usuário, aluno, storage_path ou URL; autoria é só "pessoa natural registrada".
-- Escopo: escola = consultar-alimentacao-escolar (escola ou rede) ou acompanhar-alimentacao-rede; rede inteira = só
-- acompanhar-alimentacao-rede. Autorização pela data final do período, no banco.

CREATE FUNCTION public.meal_reporting_scope(_school text, _from date, _to date) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from > _to OR _to - _from > 370 THEN RAISE EXCEPTION 'meal:period-invalid'; END IF;
  IF _school IS NULL THEN
    PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', _to);
  ELSE
    BEGIN
      PERFORM public.meal_network_grant_on('acompanhar-alimentacao-rede', _to);
    EXCEPTION WHEN others THEN
      PERFORM public.meal_grant_on('consultar-alimentacao-escolar', _school, _to);
    END;
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_reporting_scope(text, date, date) FROM PUBLIC, anon, authenticated, service_role;

-- Interno: linhas factuais por dataset. Sem verificação própria; só é chamado depois de meal_reporting_scope.
CREATE FUNCTION public.meal_reporting_facts(_dataset text, _school text, _from date, _to date)
RETURNS TABLE(situacao text, classe text, item text, lote text, validade date, ref uuid, on_date date, school_id text, row_data jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE c0 text := to_char(_from, 'YYYY-MM'); c1 text := to_char(_to, 'YYYY-MM');
BEGIN
  IF _dataset = 'pedidos' THEN RETURN QUERY
    SELECT v.status, NULL::text, NULL::text, NULL::text, NULL::date, v.logical_id, NULL::date, v.school_id,
      jsonb_build_object('competencia', v.competence, 'versao', v.version, 'situacao', v.status,
        'linhas_atuais', jsonb_array_length(v.lines),
        'linhas_solicitadas', (SELECT s.lines FROM public.meal_order_versions s WHERE s.logical_id = v.logical_id AND s.status = 'submetido' ORDER BY s.version DESC LIMIT 1),
        'linhas_autorizadas', CASE WHEN v.status IN ('autorizado-total','autorizado-parcial') THEN v.lines END,
        'foi_submetido', EXISTS (SELECT 1 FROM public.meal_order_versions s WHERE s.logical_id = v.logical_id AND s.status = 'submetido'),
        'registrado_em', v.recorded_at, 'motivo', v.reason)
    FROM public.meal_order_versions v
    WHERE v.competence BETWEEN c0 AND c1 AND (_school IS NULL OR v.school_id = _school)
      AND NOT EXISTS (SELECT 1 FROM public.meal_order_versions n WHERE n.supersedes_id = v.id);
  ELSIF _dataset = 'entregas' THEN RETURN QUERY
    WITH s AS (SELECT * FROM public.meal_delivery_schedules x WHERE x.action <> 'cancelamento' AND x.expected_on BETWEEN _from AND _to
                 AND (_school IS NULL OR x.school_id = _school) AND NOT EXISTS (SELECT 1 FROM public.meal_delivery_schedules n WHERE n.supersedes_id = x.id)),
         r AS (SELECT x.schedule_logical_id sl, sum(x.accepted_qty) acc, sum(x.rejected_qty) rej, sum(x.delivered_qty) dlv, count(*) n,
                 string_agg(DISTINCT x.lot, ', ') lots, min(x.expires_on) exp
               FROM public.meal_receipts x WHERE x.status IN ('confirmado','retificado')
                 AND NOT EXISTS (SELECT 1 FROM public.meal_receipts n WHERE n.supersedes_id = x.id) GROUP BY x.schedule_logical_id)
    SELECT CASE WHEN r.sl IS NULL THEN 'pendente' WHEN r.acc = 0 THEN 'rejeitada' WHEN r.acc >= s.quantity THEN 'integral' ELSE 'parcial' END,
      NULL::text, s.item_ref::text, r.lots, r.exp, s.logical_id, s.expected_on, s.school_id,
      jsonb_build_object('competencia', s.competence, 'prevista_para', s.expected_on, 'programado', s.quantity, 'item_ref', s.item_ref,
        'unidade_ref', s.unidade_ref, 'contrato_ref', s.contrato_ref, 'entregue', r.dlv, 'aceito', r.acc, 'rejeitado', r.rej, 'recebimentos', coalesce(r.n, 0),
        'lote', r.lots, 'validade', r.exp, 'versao', s.version)
    FROM s LEFT JOIN r ON r.sl = s.logical_id;
  ELSIF _dataset = 'nao-conformidades' THEN RETURN QUERY
    SELECT CASE WHEN x.status IN ('resolvida','encerrada') THEN 'tratada' ELSE 'aberta' END, x.status, x.item_ref::text, NULL::text, NULL::date,
      x.logical_id, (x.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date, x.school_id,
      jsonb_build_object('situacao', x.status, 'motivo_nc', x.motive, 'devolvido', x.returned_qty, 'evidencias', coalesce(cardinality(x.evidence_refs), 0),
        'recebimento_ref', x.receipt_logical_id, 'entrega_ref', x.schedule_logical_id, 'versao', x.version, 'atualizada_em', x.recorded_at,
        'prazo', 'NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE')
    FROM public.meal_nonconformities x
    WHERE (_school IS NULL OR x.school_id = _school) AND (x.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _from AND _to
      AND NOT EXISTS (SELECT 1 FROM public.meal_nonconformities n WHERE n.supersedes_id = x.id);
  ELSIF _dataset = 'evidencias' THEN RETURN QUERY
    SELECT CASE WHEN x.event_kind = 'revogacao' THEN 'revogada' ELSE 'ativa' END, x.target_kind, NULL::text, NULL::text, NULL::date,
      x.logical_id, (x.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date, x.school_id,
      jsonb_build_object('alvo', x.target_kind, 'alvo_ref', x.target_logical_id, 'evento', x.event_kind, 'versao', x.version, 'rotulo', x.label,
        'tipo', x.media_type, 'bytes', x.size_bytes, 'sha256', x.sha256, 'registrada_em', x.recorded_at, 'motivo', x.reason)
    FROM public.meal_evidence_attachments x
    WHERE (_school IS NULL OR x.school_id = _school) AND (x.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _from AND _to
      AND NOT EXISTS (SELECT 1 FROM public.meal_evidence_attachments n WHERE n.supersedes_id = x.id);
  ELSIF _dataset = 'documentos-fiscais' THEN RETURN QUERY
    SELECT x.status, NULL::text, NULL::text, NULL::text, NULL::date, x.logical_id, x.issued_on, x.school_id,
      jsonb_build_object('numero', x.number, 'emitido_em', x.issued_on, 'situacao', x.status, 'entrega_ref', x.schedule_logical_id, 'sha256', x.sha256, 'versao', x.version)
    FROM public.meal_fiscal_documents x
    WHERE (_school IS NULL OR x.school_id = _school) AND x.issued_on BETWEEN _from AND _to
      AND NOT EXISTS (SELECT 1 FROM public.meal_fiscal_documents n WHERE n.supersedes_id = x.id);
  ELSIF _dataset = 'movimentos' THEN RETURN QUERY
    SELECT CASE WHEN x.movement_class IS NULL THEN 'classe-desconhecida' ELSE 'registrado' END, coalesce(x.movement_class, x.movement_kind),
      x.item_value_id, x.lot, x.expires_on, x.logical_id, x.moved_on, x.school_id,
      jsonb_build_object('data', x.moved_on, 'classe', x.movement_class, 'tipo', x.movement_kind, 'item', x.item_value_id, 'unidade', x.unit_value_id,
        'quantidade', x.quantity, 'sentido', x.direction, 'lote', x.lot, 'validade', x.expires_on, 'contagem_ref', x.stock_count_ref,
        'recebimento_ref', x.source_receipt_version_id, 'evento', x.event_kind, 'versao', x.version, 'motivo', x.reason)
    FROM public.meal_inventory_movements x
    WHERE (_school IS NULL OR x.school_id = _school) AND x.moved_on BETWEEN _from AND _to AND x.event_kind <> 'anulacao'
      AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements n WHERE n.supersedes_id = x.id);
  ELSIF _dataset = 'inventarios' THEN RETURN QUERY
    SELECT CASE WHEN x.status = 'aprovada' AND EXISTS (SELECT 1 FROM jsonb_array_elements(x.lines) l WHERE coalesce((l->>'diferenca')::numeric, 0) <> 0) THEN 'aprovada-divergente'
                WHEN x.status = 'aprovada' THEN 'aprovada-sem-divergencia' ELSE x.status END,
      NULL::text, NULL::text, NULL::text, NULL::date, x.logical_id, x.counted_on, x.school_id,
      jsonb_build_object('contada_em', x.counted_on, 'situacao', x.status, 'linhas', x.lines, 'versao', x.version, 'motivo', x.reason)
    FROM public.meal_stock_counts x
    WHERE (_school IS NULL OR x.school_id = _school) AND x.counted_on BETWEEN _from AND _to
      AND NOT EXISTS (SELECT 1 FROM public.meal_stock_counts n WHERE n.supersedes_id = x.id);
  ELSIF _dataset = 'execucoes' THEN RETURN QUERY
    SELECT CASE WHEN x.followed IS NULL THEN 'seguimento-nao-informado' WHEN x.followed THEN 'seguido' ELSE 'desvio' END,
      CASE WHEN x.meals_total IS NULL THEN 'refeicoes-nao-informadas' ELSE 'refeicoes-informadas' END,
      x.meal_slot_value_id, NULL::text, NULL::date, x.logical_id, x.executed_on, x.school_id,
      jsonb_build_object('data', x.executed_on, 'refeicao', x.meal_slot_value_id, 'seguido', x.followed, 'preparacao', x.executed_preparation,
        'desvio', x.deviation, 'motivo_desvio', x.deviation_reason, 'refeicoes_servidas', x.meals_total, 'base_contagem', x.count_basis,
        'alunos_presentes', x.students_present, 'fonte_alunos', x.students_present_source, 'evento', x.event_kind, 'versao', x.version)
    FROM public.meal_daily_executions x
    WHERE (_school IS NULL OR x.school_id = _school) AND x.executed_on BETWEEN _from AND _to AND x.event_kind <> 'revogacao'
      AND NOT EXISTS (SELECT 1 FROM public.meal_daily_executions n WHERE n.supersedes_id = x.id);
  ELSIF _dataset = 'publicacoes' THEN RETURN QUERY
    SELECT x.action, NULL::text, NULL::text, NULL::text, NULL::date, x.menu_logical_id, (x.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date, x.school_id,
      jsonb_build_object('cardapio_ref', x.menu_logical_id, 'versao_cardapio', x.menu_version_id, 'sequencia', x.sequence, 'ato', x.action, 'em', x.recorded_at, 'motivo', x.reason)
    FROM public.meal_menu_publications x
    WHERE (_school IS NULL OR x.school_id = _school) AND (x.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _from AND _to;
  ELSIF _dataset = 'fechamentos' THEN RETURN QUERY
    SELECT CASE WHEN x.version > 1 THEN 'reemissao' ELSE 'emissao' END, NULL::text, NULL::text, NULL::text, NULL::date, x.id, x.closing_on, x.school_id,
      jsonb_build_object('competencia', x.competence, 'versao', x.version, 'fechado_em', x.closing_on, 'conhecido_em', x.known_at,
        'movimentos', coalesce(cardinality(x.movement_ids), 0), 'manifesto_sha256', x.manifest_sha256, 'motivo', x.reason)
    FROM public.meal_stock_closings x
    WHERE (_school IS NULL OR x.school_id = _school) AND x.competence BETWEEN c0 AND c1;
  ELSE RAISE EXCEPTION 'meal:dataset-unknown';
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_reporting_facts(text, text, date, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_reporting_summary(_school text, _from date, _to date)
RETURNS TABLE(dataset text, key text, value numeric, state text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.meal_reporting_scope(_school, _from, _to);
  RETURN QUERY
  WITH rf AS MATERIALIZED (SELECT d.ds, x.situacao, x.classe, x.item, x.lote, x.validade, x.row_data
         FROM unnest(ARRAY['pedidos','entregas','nao-conformidades','evidencias','documentos-fiscais','movimentos','inventarios','execucoes','publicacoes','fechamentos']) d(ds)
         CROSS JOIN LATERAL public.meal_reporting_facts(d.ds, _school, _from, _to) x),
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
  SELECT k.ds, k.key, (SELECT count(*)::numeric FROM rf f WHERE f.ds = k.ds AND CASE k.kind
      WHEN 'all' THEN true WHEN 'sit' THEN f.situacao = k.arg WHEN 'cls' THEN f.classe = k.arg
      WHEN 'submitted' THEN (f.row_data->>'foi_submetido')::boolean
      WHEN 'lot' THEN f.classe = 'entrada-aceite' AND ((k.arg = 'informado') = (f.lote IS NOT NULL))
      WHEN 'val' THEN f.classe = 'entrada-aceite' AND ((k.arg = 'informada') = (f.validade IS NOT NULL)) END), 'AVAILABLE', NULL::text
  FROM k
  UNION ALL
  SELECT 'execucoes', 'refeicoes-servidas', s.v, CASE WHEN s.n = 0 THEN 'UNKNOWN' ELSE 'AVAILABLE' END,
         CASE WHEN s.n = 0 THEN 'Nenhuma execução com refeições informadas no período.' END
  FROM (SELECT sum((f.row_data->>'refeicoes_servidas')::numeric) v, count(f.row_data->>'refeicoes_servidas') n FROM rf f WHERE f.ds = 'execucoes') s
  UNION ALL
  SELECT 'execucoes', 'alunos-presentes', s.v, CASE WHEN s.n = 0 THEN 'UNKNOWN' ELSE 'AVAILABLE' END,
         CASE WHEN s.n = 0 THEN 'Nenhuma execução com alunos presentes informados (medida separada das refeições).' END
  FROM (SELECT sum((f.row_data->>'alunos_presentes')::numeric) v, count(f.row_data->>'alunos_presentes') n FROM rf f WHERE f.ds = 'execucoes') s
  UNION ALL SELECT 'bloqueios', 'adesao', NULL, 'BLOCKED', 'ADHESION_METRIC — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'desperdicio', NULL, 'BLOCKED', 'WASTE_METRIC — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'estoque-minimo', NULL, 'BLOCKED', 'MINIMUM_STOCK — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'prazo-nao-conformidade', NULL, 'BLOCKED', 'NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE'
  UNION ALL SELECT 'bloqueios', 'custo', NULL, 'BLOCKED', 'COST_SOURCE — OFFICIAL_SOURCE_PENDING'
  UNION ALL SELECT 'bloqueios', 'baixa-teorica', NULL, 'BLOCKED', 'THEORETICAL_CONSUMPTION — BLOCKED_BY_HOMOLOGATED_RULE';
END $fn$;
REVOKE ALL ON FUNCTION public.meal_reporting_summary(text, date, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_reporting_summary(text, date, date) TO authenticated;

CREATE FUNCTION public.meal_reporting_rows(_dataset text, _school text, _from date, _to date, _filters jsonb, _limit integer, _offset integer)
RETURNS TABLE(total bigint, school_id text, row_data jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE f jsonb := coalesce(_filters, '{}'::jsonb);
BEGIN
  PERFORM public.meal_reporting_scope(_school, _from, _to);
  IF _limit IS NULL OR _limit < 1 OR _limit > 500 OR _offset IS NULL OR _offset < 0 THEN RAISE EXCEPTION 'meal:page-invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN ('situacao','classe','item','lote','validade','ref','submetido')) THEN RAISE EXCEPTION 'meal:filter-unknown'; END IF;
  RETURN QUERY
  SELECT count(*) OVER (), x.school_id, x.row_data
  FROM public.meal_reporting_facts(_dataset, _school, _from, _to) x
  WHERE (NOT f ? 'situacao' OR x.situacao = f->>'situacao')
    AND (NOT f ? 'classe' OR x.classe = f->>'classe')
    AND (NOT f ? 'item' OR x.item = f->>'item')
    AND (NOT f ? 'ref' OR x.ref::text = f->>'ref')
    AND (NOT f ? 'submetido' OR (x.row_data->>'foi_submetido')::boolean = (f->>'submetido')::boolean)
    AND (NOT f ? 'lote' OR CASE f->>'lote' WHEN 'informado' THEN x.lote IS NOT NULL WHEN 'ausente' THEN x.lote IS NULL ELSE x.lote = f->>'lote' END)
    AND (NOT f ? 'validade' OR CASE f->>'validade' WHEN 'informada' THEN x.validade IS NOT NULL ELSE x.validade IS NULL END)
  ORDER BY x.on_date DESC NULLS LAST, x.ref
  LIMIT _limit OFFSET _offset;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_reporting_rows(text, text, date, date, jsonb, integer, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_reporting_rows(text, text, date, date, jsonb, integer, integer) TO authenticated;
