-- PERF.LOADING.3 — "Matrículas vigentes" do painel calculada no servidor (antes: todas as matrículas da
-- escola no navegador e recusa acima de 1000). Mesma regra de activeEnrollments/headsKnownAt:
-- cabeças conhecidas em knownAt (não substituídas por versão conhecida), opened_on <= data e sem
-- encerramento conhecido com ended_on <= data; sem abertura ⇒ "undated", nunca vigente. SECURITY INVOKER: RLS da sessão.
CREATE OR REPLACE FUNCTION public.active_enrollments_at(_school text, _on date, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(active_ids text[], undated_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH known AS (
    SELECT e.id, e.supersedes_id, e.opened_on FROM public.school_enrollments e
    WHERE e.school_id = _school AND (_known_at IS NULL OR e.created_at <= _known_at)
  ), heads AS (
    SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = k.id)
  )
  SELECT
    coalesce(array_agg(h.id::text ORDER BY h.id) FILTER (WHERE h.opened_on IS NOT NULL AND h.opened_on <= _on AND NOT EXISTS (
      SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = h.id AND x.ended_on <= _on AND (_known_at IS NULL OR x.created_at <= _known_at))), '{}'::text[]),
    count(*) FILTER (WHERE h.opened_on IS NULL)
  FROM heads h
$$;
REVOKE ALL ON FUNCTION public.active_enrollments_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_enrollments_at(text, date, timestamptz) TO authenticated, service_role;