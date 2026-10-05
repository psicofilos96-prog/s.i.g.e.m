-- 0096 — Política de capacidades v5 (decisão do proprietário 2026-10-05), append-only sobre a v4.
-- Concede explicitamente as 10 capabilities usadas por funções/RLS das camadas avançadas que
-- nenhuma política homologada concedia. v1–v4 permanecem intactas.

-- A) Capacidades reservadas ao Administrador Geral: lista explícita e append-only (dado, não código).
CREATE TABLE public.sigem_master_reserved_capabilities (
  capability_id text PRIMARY KEY CHECK (capability_id ~ '^[a-z0-9-]+$'),
  origin text NOT NULL CHECK (origin IN ('decisao-do-proprietario','ato-administrativo')),
  decided_on date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sigem_master_reserved_capabilities TO service_role;
ALTER TABLE public.sigem_master_reserved_capabilities ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.sigem_master_reserved_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $f$
BEGIN RAISE EXCEPTION 'master-reserved:append-only'; END $f$;
CREATE TRIGGER sigem_master_reserved_immutable BEFORE UPDATE OR DELETE ON public.sigem_master_reserved_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.sigem_master_reserved_immutable();
INSERT INTO public.sigem_master_reserved_capabilities(capability_id, origin, decided_on) VALUES
  ('manter-definicoes-de-workflow','decisao-do-proprietario',DATE '2026-10-05'),
  ('homologar-definicoes-de-workflow','decisao-do-proprietario',DATE '2026-10-05'),
  ('administrar-integracoes','decisao-do-proprietario',DATE '2026-10-05'),
  ('gerir-base-de-conhecimento','decisao-do-proprietario',DATE '2026-10-05');

-- B) Cobertura: capacidade só do mestre continua recusada, exceto se reservada explicitamente acima.
CREATE OR REPLACE FUNCTION public.sigem_general_admin_coverage_issues(_policy uuid)
 RETURNS TABLE(issue text, capability_id text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH k AS (SELECT public.sigem_general_admin_kind() AS kind),
  has_master AS (SELECT EXISTS (SELECT 1 FROM public.capability_policy_rules r, k WHERE r.policy_id = _policy AND r.engagement_kind_id = k.kind) AS v),
  sector AS (SELECT DISTINCT r.capability_id FROM public.capability_policy_rules r, k WHERE r.policy_id = _policy AND r.engagement_kind_id <> k.kind),
  master AS (SELECT r.capability_id, r.scope_dimensions FROM public.capability_policy_rules r, k WHERE r.policy_id = _policy AND r.engagement_kind_id = k.kind)
  SELECT * FROM (
    SELECT 'missing-sector-capability', s.capability_id FROM sector s
      WHERE NOT EXISTS (SELECT 1 FROM master m WHERE m.capability_id = s.capability_id AND m.scope_dimensions = ARRAY['network']::text[])
    UNION ALL
    SELECT 'missing-administrative-capability', a FROM unnest(public.sigem_administrative_capabilities()) a
      WHERE NOT EXISTS (SELECT 1 FROM master m WHERE m.capability_id = a AND m.scope_dimensions = ARRAY['network']::text[])
    UNION ALL
    SELECT 'scope-not-network', m.capability_id FROM master m WHERE m.scope_dimensions <> ARRAY['network']::text[]
    UNION ALL
    SELECT 'master-only-capability', m.capability_id FROM master m
      WHERE NOT EXISTS (SELECT 1 FROM sector s WHERE s.capability_id = m.capability_id)
        AND NOT (m.capability_id = ANY (public.sigem_administrative_capabilities()))
        AND NOT EXISTS (SELECT 1 FROM public.sigem_master_reserved_capabilities x WHERE x.capability_id = m.capability_id)
  ) x WHERE (SELECT v FROM has_master)
$function$;
REVOKE ALL ON FUNCTION public.sigem_general_admin_coverage_issues(uuid) FROM PUBLIC, anon, authenticated;

-- C) v5 = v4 + delta explícito; homologada por decisão do proprietário, sem ato, vigência 2026-10-05.
DO $do$
DECLARE _v4 uuid; _v5 uuid; _issue text; _delta int;
BEGIN
  SELECT id INTO _v4 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario'
    AND version = 4 AND status = 'homologated' FOR UPDATE;
  IF _v4 IS NULL OR EXISTS (SELECT 1 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version > 4) THEN
    RAISE EXCEPTION 'v5:v4-not-head'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v4) <> 213 THEN RAISE EXCEPTION 'v5:v4-shape-divergent'; END IF;

  INSERT INTO public.capability_policies(logical_policy_id, version, supersedes_version_id, status)
  VALUES ('politica-capacidades-diario', 5, _v4, 'draft') RETURNING id INTO _v5;
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v5, engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id = _v4;

  WITH d(kind, cap, dims) AS (VALUES
    ('administrador-geral-do-sigem','administrar-integracoes',ARRAY['network']),
    ('administrador-geral-do-sigem','consultar-banco-de-itens',ARRAY['network']),
    ('administrador-geral-do-sigem','consultar-instrumento-docente',ARRAY['network']),
    ('administrador-geral-do-sigem','consultar-planejamento-docente',ARRAY['network']),
    ('administrador-geral-do-sigem','gerir-base-de-conhecimento',ARRAY['network']),
    ('administrador-geral-do-sigem','gerir-tarefas-operacionais',ARRAY['network']),
    ('administrador-geral-do-sigem','homologar-definicoes-de-workflow',ARRAY['network']),
    ('administrador-geral-do-sigem','manter-definicoes-de-workflow',ARRAY['network']),
    ('administrador-geral-do-sigem','publicar-conteudo-publico',ARRAY['network']),
    ('administrador-geral-do-sigem','revisar-qualidade-dos-dados',ARRAY['network']),
    ('gestao-pedagogica-da-rede','consultar-planejamento-docente',ARRAY['network']),
    ('gestao-pedagogica-da-rede','consultar-banco-de-itens',ARRAY['network']),
    ('gestao-pedagogica-da-rede','consultar-instrumento-docente',ARRAY['network']),
    ('gestao-pedagogica-da-rede','publicar-conteudo-publico',ARRAY['network']),
    ('direcao-escolar','consultar-planejamento-docente',ARRAY['school']),
    ('direcao-escolar','consultar-banco-de-itens',ARRAY['school']),
    ('direcao-escolar','consultar-instrumento-docente',ARRAY['school']),
    ('direcao-escolar','revisar-qualidade-dos-dados',ARRAY['school']),
    ('direcao-escolar','gerir-tarefas-operacionais',ARRAY['school']),
    ('orientacao-pedagogica','consultar-planejamento-docente',ARRAY['school']),
    ('orientacao-pedagogica','consultar-banco-de-itens',ARRAY['school']),
    ('orientacao-pedagogica','consultar-instrumento-docente',ARRAY['school']),
    ('orientacao-pedagogica','gerir-tarefas-operacionais',ARRAY['school']),
    ('professor','consultar-banco-de-itens',ARRAY['school']),
    ('secretaria-escolar','gerir-tarefas-operacionais',ARRAY['school']),
    ('ciece-auditoria-coordenacao','revisar-qualidade-dos-dados',ARRAY['network'])
  )
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v5, kind, cap, dims FROM d;
  GET DIAGNOSTICS _delta = ROW_COUNT;

  IF _delta <> 26
     OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v5) <> 239
     OR (SELECT count(DISTINCT capability_id) FROM public.capability_policy_rules WHERE policy_id = _v5) <> 95
     OR (SELECT count(DISTINCT (engagement_kind_id, capability_id, scope_dimensions)) FROM public.capability_policy_rules WHERE policy_id = _v5) <> 239
     OR EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _v5 AND (capability_id ~ '[*%]' OR engagement_kind_id ~ '[*%]'))
     OR EXISTS (SELECT 1 FROM public.capability_policy_rules a WHERE a.policy_id = _v4 AND NOT EXISTS (
          SELECT 1 FROM public.capability_policy_rules b WHERE b.policy_id = _v5 AND b.engagement_kind_id = a.engagement_kind_id
            AND b.capability_id = a.capability_id AND b.scope_dimensions = a.scope_dimensions))
  THEN RAISE EXCEPTION 'v5:shape-divergent'; END IF;

  _issue := public.capability_policy_homologation_issues(_v5, DATE '2026-10-05');
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'v5:%', _issue; END IF;
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = NULL,
    homologation_origin = 'decisao-do-proprietario', valid_from = DATE '2026-10-05' WHERE id = _v5;
END $do$;