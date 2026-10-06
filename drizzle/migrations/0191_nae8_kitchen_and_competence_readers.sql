-- NAE.8 Lote 3 — leitores operacionais (somente leitura) para Estação Cozinha e checklist de fechamento por competência.
-- Nenhuma escrita, nenhuma capability nova: a Cozinha reutiliza 'registrar-execucao-alimentacao' (escopo escola, por data do fato).
-- Ausência nunca vira zero: áreas sem fonte calculável retornam UNKNOWN/BLOCKED com código.

CREATE FUNCTION public.meal_kitchen_day_at(_school text, _on date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE r jsonb;
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:fact-date-required'; END IF;
  PERFORM public.meal_grant_on('registrar-execucao-alimentacao', _school, _on);
  WITH ex AS (
    SELECT e.* FROM public.meal_daily_executions e
     WHERE e.school_id = _school AND e.executed_on = _on
       AND NOT EXISTS (SELECT 1 FROM public.meal_daily_executions s WHERE s.supersedes_id = e.id)),
  sch AS (
    SELECT DISTINCT ON (d.logical_id) d.* FROM public.meal_delivery_schedules d WHERE d.school_id = _school ORDER BY d.logical_id, d.version DESC),
  rec AS (
    SELECT DISTINCT ON (x.logical_id) x.* FROM public.meal_receipts x WHERE x.school_id = _school ORDER BY x.logical_id, x.version DESC)
  SELECT jsonb_build_object(
    'executions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ex.id, 'slot', ex.meal_slot_value_id, 'event_kind', ex.event_kind, 'version', ex.version,
        'followed', ex.followed, 'preparation', ex.executed_preparation, 'deviation', ex.deviation, 'meals_total', ex.meals_total, 'count_basis', ex.count_basis,
        'students_present', ex.students_present, 'recorded_at', ex.recorded_at) ORDER BY ex.meal_slot_value_id) FROM ex WHERE ex.event_kind <> 'revogacao'), '[]'::jsonb),
    'deliveries', coalesce((SELECT jsonb_agg(jsonb_build_object('schedule', sch.logical_id, 'item', sch.item_ref, 'unit', sch.unidade_ref, 'quantity', sch.quantity,
        'receipt_status', (SELECT rec.status FROM rec WHERE rec.schedule_logical_id = sch.logical_id AND rec.status IN ('confirmado','retificado') LIMIT 1)) ORDER BY sch.item_ref)
      FROM sch WHERE sch.expected_on = _on AND sch.action <> 'cancelamento'), '[]'::jsonb),
    'overdue_receipts', (SELECT count(*) FROM sch WHERE sch.expected_on < _on AND sch.action <> 'cancelamento'
        AND NOT EXISTS (SELECT 1 FROM rec WHERE rec.schedule_logical_id = sch.logical_id AND rec.status IN ('confirmado','retificado'))),
    'stock', coalesce((SELECT jsonb_agg(jsonb_build_object('item', l.item_value_id, 'unit', l.unit_value_id, 'lot', l.lot, 'expires_on', l.expires_on, 'balance', l.balance)
        ORDER BY l.expires_on NULLS LAST, l.item_value_id) FROM public.meal_stock_lines(_school, _on, now()) l WHERE l.balance IS NULL OR l.balance > 0), '[]'::jsonb),
    'operational_records', (SELECT count(*) FROM public.meal_operational_records o WHERE o.school_id = _school AND o.recorded_on = _on
        AND NOT EXISTS (SELECT 1 FROM public.meal_operational_records s WHERE s.supersedes_id = o.id))
  ) INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_kitchen_day_at(text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_kitchen_day_at(text, date) TO authenticated;

CREATE FUNCTION public.meal_competence_checklist_at(_school text, _competence text)
RETURNS TABLE(area text, state text, amount integer, code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE f date; l date; ended boolean;
BEGIN
  PERFORM public.meal_stock_read_guard(_school);
  IF _competence IS NULL OR _competence !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
  f := to_date(_competence || '-01', 'YYYY-MM-DD');
  l := (f + interval '1 month' - interval '1 day')::date;
  ended := l <= (now() AT TIME ZONE 'UTC')::date;
  RETURN QUERY
  WITH o AS (SELECT DISTINCT ON (v.logical_id) v.* FROM public.meal_order_versions v WHERE v.school_id = _school AND v.competence = _competence ORDER BY v.logical_id, v.version DESC),
  sch AS (SELECT DISTINCT ON (d.logical_id) d.* FROM public.meal_delivery_schedules d WHERE d.school_id = _school AND d.expected_on BETWEEN f AND l ORDER BY d.logical_id, d.version DESC),
  rec AS (SELECT DISTINCT ON (x.logical_id) x.* FROM public.meal_receipts x WHERE x.school_id = _school ORDER BY x.logical_id, x.version DESC),
  nc AS (SELECT DISTINCT ON (n.logical_id) n.* FROM public.meal_nonconformities n WHERE n.school_id = _school ORDER BY n.logical_id, n.version DESC),
  cnt AS (SELECT DISTINCT ON (c.logical_id) c.* FROM public.meal_stock_counts c WHERE c.school_id = _school AND c.counted_on BETWEEN f AND l ORDER BY c.logical_id, c.version DESC),
  mv AS (SELECT m.* FROM public.meal_inventory_movements m WHERE m.school_id = _school AND m.moved_on BETWEEN f AND l
          AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements s WHERE s.supersedes_id = m.id)),
  ev AS (SELECT DISTINCT ON (a.logical_id) a.* FROM public.meal_evidence_attachments a WHERE a.school_id = _school ORDER BY a.logical_id, a.version DESC),
  cl AS (SELECT c.* FROM public.meal_stock_closings c WHERE c.school_id = _school AND c.competence = _competence ORDER BY c.version DESC LIMIT 1)
  SELECT 'pedidos'::text,
         CASE WHEN NOT EXISTS (SELECT 1 FROM o) THEN 'UNKNOWN' WHEN EXISTS (SELECT 1 FROM o WHERE o.status IN ('rascunho','submetido','em-analise','devolvido')) THEN 'PENDING' ELSE 'AVAILABLE' END,
         (SELECT count(*) FROM o WHERE o.status IN ('rascunho','submetido','em-analise','devolvido'))::integer,
         CASE WHEN NOT EXISTS (SELECT 1 FROM o) THEN 'NO_ORDER_RECORDED' ELSE NULL END
  UNION ALL
  SELECT 'recebimentos',
         CASE WHEN NOT EXISTS (SELECT 1 FROM sch WHERE sch.action <> 'cancelamento') THEN 'UNKNOWN'
              WHEN EXISTS (SELECT 1 FROM sch WHERE sch.action <> 'cancelamento' AND NOT EXISTS (SELECT 1 FROM rec WHERE rec.schedule_logical_id = sch.logical_id AND rec.status IN ('confirmado','retificado'))) THEN 'PENDING' ELSE 'AVAILABLE' END,
         (SELECT count(*) FROM sch WHERE sch.action <> 'cancelamento' AND NOT EXISTS (SELECT 1 FROM rec WHERE rec.schedule_logical_id = sch.logical_id AND rec.status IN ('confirmado','retificado')))::integer,
         CASE WHEN NOT EXISTS (SELECT 1 FROM sch) THEN 'NO_DELIVERY_SCHEDULED' ELSE NULL END
  UNION ALL
  SELECT 'evidencias',
         CASE WHEN NOT EXISTS (SELECT 1 FROM rec WHERE rec.status IN ('confirmado','retificado') AND rec.received_at::date BETWEEN f AND l) THEN 'UNKNOWN'
              WHEN EXISTS (SELECT 1 FROM rec WHERE rec.status IN ('confirmado','retificado') AND rec.received_at::date BETWEEN f AND l
                  AND NOT EXISTS (SELECT 1 FROM ev WHERE ev.target_kind = 'recebimento' AND ev.target_logical_id = rec.logical_id AND ev.event_kind <> 'revogacao')) THEN 'PENDING' ELSE 'AVAILABLE' END,
         (SELECT count(*) FROM rec WHERE rec.status IN ('confirmado','retificado') AND rec.received_at::date BETWEEN f AND l
             AND NOT EXISTS (SELECT 1 FROM ev WHERE ev.target_kind = 'recebimento' AND ev.target_logical_id = rec.logical_id AND ev.event_kind <> 'revogacao'))::integer,
         'EVIDENCE_REQUIREMENT_NOT_HOMOLOGATED'
  UNION ALL
  SELECT 'ocorrencias',
         CASE WHEN EXISTS (SELECT 1 FROM nc WHERE nc.status NOT IN ('resolvida','encerrada')) THEN 'PENDING' WHEN EXISTS (SELECT 1 FROM nc) THEN 'AVAILABLE' ELSE 'ZERO' END,
         (SELECT count(*) FROM nc WHERE nc.status NOT IN ('resolvida','encerrada'))::integer, NULL
  UNION ALL
  SELECT 'movimentos',
         CASE WHEN EXISTS (SELECT 1 FROM mv WHERE public.meal_movement_sign(mv) IS NULL) THEN 'UNKNOWN' WHEN EXISTS (SELECT 1 FROM mv) THEN 'AVAILABLE' ELSE 'UNKNOWN' END,
         (SELECT count(*) FROM mv)::integer,
         CASE WHEN EXISTS (SELECT 1 FROM mv WHERE public.meal_movement_sign(mv) IS NULL) THEN 'LEGACY_SIGN_UNKNOWN' WHEN NOT EXISTS (SELECT 1 FROM mv) THEN 'NO_MOVEMENT_RECORDED' ELSE NULL END
  UNION ALL
  SELECT 'inventario',
         CASE WHEN NOT EXISTS (SELECT 1 FROM cnt WHERE cnt.status <> 'anulada') THEN 'PENDING' WHEN EXISTS (SELECT 1 FROM cnt WHERE cnt.status IN ('rascunho','conferida')) THEN 'PENDING' ELSE 'AVAILABLE' END,
         (SELECT count(*) FROM cnt WHERE cnt.status <> 'anulada')::integer,
         CASE WHEN NOT EXISTS (SELECT 1 FROM cnt WHERE cnt.status <> 'anulada') THEN 'NO_PHYSICAL_COUNT' ELSE NULL END
  UNION ALL
  SELECT 'divergencias',
         CASE WHEN NOT EXISTS (SELECT 1 FROM cnt WHERE cnt.status IN ('conferida','aprovada')) THEN 'UNKNOWN'
              WHEN EXISTS (SELECT 1 FROM cnt, jsonb_array_elements(cnt.lines) x WHERE cnt.status IN ('conferida','aprovada') AND (x->>'diferenca') IS NULL) THEN 'UNKNOWN'
              WHEN EXISTS (SELECT 1 FROM cnt, jsonb_array_elements(cnt.lines) x WHERE cnt.status IN ('conferida','aprovada') AND (x->>'diferenca')::numeric <> 0
                  AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements m WHERE m.stock_count_ref = cnt.logical_id AND m.item_value_id = x->>'item_value_id' AND m.event_kind <> 'anulacao')) THEN 'PENDING'
              ELSE 'AVAILABLE' END,
         (SELECT count(*) FROM cnt, jsonb_array_elements(cnt.lines) x WHERE cnt.status IN ('conferida','aprovada') AND (x->>'diferenca')::numeric <> 0
             AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements m WHERE m.stock_count_ref = cnt.logical_id AND m.item_value_id = x->>'item_value_id' AND m.event_kind <> 'anulacao'))::integer,
         NULL
  UNION ALL
  SELECT 'execucao',
         CASE WHEN EXISTS (SELECT 1 FROM public.meal_daily_executions e WHERE e.school_id = _school AND e.executed_on BETWEEN f AND l) THEN 'AVAILABLE' ELSE 'UNKNOWN' END,
         (SELECT count(DISTINCT e.executed_on) FROM public.meal_daily_executions e WHERE e.school_id = _school AND e.executed_on BETWEEN f AND l AND e.event_kind <> 'revogacao')::integer,
         'SCHOOL_DAYS_CALENDAR_UNRESOLVED'
  UNION ALL
  SELECT 'fechamento',
         CASE WHEN NOT ended THEN 'BLOCKED' WHEN EXISTS (SELECT 1 FROM cl) THEN 'AVAILABLE' ELSE 'PENDING' END,
         coalesce((SELECT cl.version FROM cl), 0)::integer,
         CASE WHEN NOT ended THEN 'COMPETENCE_NOT_ENDED' WHEN NOT EXISTS (SELECT 1 FROM cl) THEN 'NO_STOCK_CLOSING' ELSE (SELECT cl.manifest_sha256 FROM cl) END;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_competence_checklist_at(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_competence_checklist_at(text, text) TO authenticated;
