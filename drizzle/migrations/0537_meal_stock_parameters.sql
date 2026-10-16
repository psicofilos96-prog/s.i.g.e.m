INSERT INTO public.sector_parameter_catalog(key, sector, capability_id, value_kind, allowed, default_value) VALUES
 ('alimentacao.aviso-de-validade', 'alimentacao', 'manter-parametros-nutricionais', 'dias', NULL, '30'::jsonb),
 ('alimentacao.saldo-do-pedido', 'alimentacao', 'manter-parametros-nutricionais', 'escolha', '["saldo-atual","saldo-menos-entregas-previstas"]'::jsonb, '"saldo-atual"'::jsonb);

CREATE OR REPLACE FUNCTION public.meal_stock_basis_at(_school text, _competence text)
 RETURNS TABLE(state text, policy jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p jsonb; d date;
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  IF _competence IS NULL OR _competence !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
  d := to_date(_competence || '-01', 'YYYY-MM-DD');
  p := public.meal_policy_on('politica-base-de-estoque', d);
  IF p IS NOT NULL THEN RETURN QUERY SELECT 'homologada'::text, p; RETURN; END IF;
  RETURN QUERY SELECT 'parametro'::text, jsonb_build_object('opcao', public.sector_parameter_value('alimentacao.saldo-do-pedido') #>> '{}');
END $function$;

CREATE OR REPLACE FUNCTION public.meal_stock_alerts_at(_school text, _on date, _expiry_window_days integer)
 RETURNS TABLE(kind text, item_value_id text, unit_value_id text, lot text, detail text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE w int;
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:as-of-required'; END IF;
  w := coalesce(_expiry_window_days, (public.sector_parameter_value('alimentacao.aviso-de-validade') #>> '{}')::int);
  RETURN QUERY
    SELECT 'saldo-negativo'::text, l.item_value_id, l.unit_value_id, l.lot, l.balance::text FROM public.meal_stock_lines(_school, _on, now()) l WHERE l.balance < 0
    UNION ALL
    SELECT 'sinal-desconhecido', l.item_value_id, l.unit_value_id, l.lot, l.unknown_sign::text || ' movimento(s) legado(s) de ajuste sem direção' FROM public.meal_stock_lines(_school, _on, now()) l WHERE l.unknown_sign > 0
    UNION ALL
    SELECT 'validade-proxima', l.item_value_id, l.unit_value_id, l.lot, l.expires_on::text FROM public.meal_stock_lines(_school, _on, now()) l
     WHERE w IS NOT NULL AND l.expires_on IS NOT NULL AND l.balance > 0 AND l.expires_on <= _on + w
    UNION ALL
    SELECT 'aceite-sem-lote', m.item_value_id, m.unit_value_id, NULL, m.moved_on::text FROM public.meal_inventory_movements m
     WHERE m.school_id = _school AND m.source_receipt_version_id IS NOT NULL AND m.lot IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.meal_receipts r WHERE r.id = m.source_receipt_version_id AND r.lot IS NOT NULL)
       AND EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (x.logical_id) x.* FROM public.meal_master_records x WHERE x.kind = 'exigencia-de-lote' ORDER BY x.logical_id, x.version DESC) e
                    WHERE e.status = 'homologada' AND e.payload->>'item_estoque_value_id' = m.item_value_id)
    UNION ALL
    SELECT 'inventario-divergente', x->>'item_value_id', x->>'unit_value_id', x->>'lote', x->>'diferenca'
      FROM (SELECT DISTINCT ON (c.logical_id) c.* FROM public.meal_stock_counts c WHERE c.school_id = _school ORDER BY c.logical_id, c.version DESC) c, jsonb_array_elements(c.lines) x
     WHERE c.status IN ('conferida','aprovada') AND (x->>'diferenca')::numeric <> 0
       AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements m WHERE m.stock_count_ref = c.logical_id AND m.item_value_id = x->>'item_value_id' AND m.event_kind <> 'anulacao')
    UNION ALL
    SELECT 'movimento-possivelmente-duplicado', m.item_value_id, m.unit_value_id, m.lot, m.moved_on::text || ' × ' || count(*)::text
      FROM public.meal_inventory_movements m
     WHERE m.school_id = _school AND m.event_kind = 'registro' AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements s WHERE s.supersedes_id = m.id)
     GROUP BY m.item_value_id, m.unit_value_id, m.lot, m.moved_on, m.quantity, public.meal_movement_class(m), date_trunc('minute', m.recorded_at) HAVING count(*) > 1;
END $function$;