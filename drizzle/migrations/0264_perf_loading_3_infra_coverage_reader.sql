-- PERF.LOADING.3 — cobertura de infraestrutura agregada no servidor: uma linha por escola visível com os
-- atributos que têm observação vigente (valid_from <= data). SECURITY INVOKER: a RLS da sessão continua
-- decidindo quais observações entram; mesma regra de schoolInfrastructureAt ("informado" = existe vigente).
CREATE OR REPLACE FUNCTION public.infrastructure_coverage_at(_on date)
RETURNS TABLE(school_id text, informed_attribute_ids text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT o.school_id, array_agg(DISTINCT o.attribute_id ORDER BY o.attribute_id)
  FROM public.school_infrastructure_observations o
  WHERE o.valid_from <= _on
  GROUP BY o.school_id
$$;
REVOKE ALL ON FUNCTION public.infrastructure_coverage_at(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.infrastructure_coverage_at(date) TO authenticated, service_role;