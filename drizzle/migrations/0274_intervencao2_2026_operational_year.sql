-- INTERVENÇÃO 2/6 — decisão do proprietário (2026-10-09): 2026 é o ano operacional principal;
-- 2027 fica só em planejamento. Operação técnica estreita, idempotente, auditável, sem autoria humana.
DO $$
DECLARE y text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831'; h public.academic_year_operational_states;
  op uuid; src text := 'decisao-proprietario-intervencao-2-2026-10-09'; fp text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.institutional_academic_year_versions WHERE academic_year_id = y AND official_name = 'Ano letivo 2026') THEN
    RAISE EXCEPTION 'technical:year-2026-not-found';
  END IF;
  fp := encode(sha256(convert_to(y || ':operacional', 'UTF8')), 'hex');
  IF EXISTS (SELECT 1 FROM public.technical_execution_operations WHERE operation_kind = 'tecnica-abrir-2026-operacional' AND source_hash = fp) THEN
    RETURN; -- já executada
  END IF;
  SELECT * INTO h FROM public.academic_year_operational_states WHERE academic_year_id = y ORDER BY sequence DESC LIMIT 1;
  IF h.state IS DISTINCT FROM 'historico-importado' THEN RAISE EXCEPTION 'technical:unexpected-head:%', h.state; END IF;
  op := gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, 'tecnica-abrir-2026-operacional', 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento',
          src, fp, 'decisao-do-proprietario', fp, 'concluida',
          jsonb_build_object('academic_year_id', y, 'from', 'historico-importado', 'to', 'operacional'), now());
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id, technical_provenance)
  VALUES (y, h.sequence + 1, 'operacional', h.id,
          'Decisão do proprietário (Intervenção 2/6, 2026-10-09): 2026 passa a ser o ano operacional principal; a carga EducaCenso 2026 permanece como origem documentada.',
          NULL, NULL, NULL, 'technical_execution_operations:' || op);
  INSERT INTO public.technical_execution_targets VALUES (op, 'academic_year_operational_states', y);
END $$;