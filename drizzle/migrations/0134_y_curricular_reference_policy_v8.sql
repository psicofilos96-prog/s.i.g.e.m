-- Frente Y.1 — Política v8 = v7 + capacidades curriculares estreitas para a gestão pedagógica da rede (Supervisão)
-- e cobertura obrigatória do Administrador Geral; sem curinga; decisão do proprietário de 05/10/2026.
DO $do$
DECLARE _v7 uuid; _v8 uuid; _issue text; _delta int;
BEGIN
  SELECT id INTO _v7 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 7 AND status = 'homologated' FOR UPDATE;
  IF _v7 IS NULL OR EXISTS (SELECT 1 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version > 7) THEN RAISE EXCEPTION 'v8:v7-not-head'; END IF;
  INSERT INTO public.capability_policies(logical_policy_id, version, supersedes_version_id, status)
  VALUES ('politica-capacidades-diario', 8, _v7, 'draft') RETURNING id INTO _v8;
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v8, engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id = _v7;
  WITH d(cap) AS (VALUES ('construir-referencia-curricular'),('homologar-referencia-curricular'),('manter-mapeamentos-curriculares'),
    ('homologar-mapeamentos-curriculares'),('manter-simplificacoes-curriculares'),('homologar-simplificacoes-curriculares'))
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v8, k.kind, d.cap, ARRAY['network'] FROM d CROSS JOIN (VALUES ('gestao-pedagogica-da-rede'),('administrador-geral-do-sigem')) k(kind)
  WHERE NOT EXISTS (SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id = _v8 AND r.engagement_kind_id = k.kind AND r.capability_id = d.cap);
  GET DIAGNOSTICS _delta = ROW_COUNT;
  IF _delta <> 12 OR EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _v8 AND (capability_id ~ '[*%]' OR engagement_kind_id ~ '[*%]')) THEN
    RAISE EXCEPTION 'v8:shape-divergent'; END IF;
  _issue := public.capability_policy_homologation_issues(_v8, DATE '2026-10-05');
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'v8:%', _issue; END IF;
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = NULL,
    homologation_origin = 'decisao-do-proprietario', valid_from = DATE '2026-10-05' WHERE id = _v8;
END $do$;
