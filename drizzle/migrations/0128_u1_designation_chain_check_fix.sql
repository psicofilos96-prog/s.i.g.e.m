-- U.1: corrige a conjunção da verificação de cadeia (0127 usava OR).
CREATE OR REPLACE FUNCTION public.designation_policies_for_category(_category text, _on date)
RETURNS TABLE(policy public.class_designation_policy_versions, chain_ok boolean) LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH heads AS (
    SELECT DISTINCT ON (v.policy_key) v.* FROM public.class_designation_policy_versions v
    JOIN public.class_designation_policy_homologations h ON h.policy_version_id = v.id
    WHERE v.valid_from <= _on AND (v.valid_until IS NULL OR v.valid_until >= _on)
    ORDER BY v.policy_key, v.version DESC
  )
  SELECT h::public.class_designation_policy_versions,
    NOT EXISTS (
      SELECT 1 FROM public.class_designation_policy_versions x
      LEFT JOIN public.class_designation_policy_versions p ON p.id = x.supersedes_id
      WHERE x.policy_key = h.policy_key
        AND ((x.supersedes_id IS NULL AND x.version <> 1)
          OR (x.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.policy_key <> x.policy_key OR x.version <> p.version + 1)))
    ) AND (SELECT pg_catalog.count(*) FROM public.class_designation_policy_versions y WHERE y.policy_key = h.policy_key) >= h.version
      AND (SELECT pg_catalog.count(DISTINCT y.version) FROM public.class_designation_policy_versions y WHERE y.policy_key = h.policy_key)
        = (SELECT pg_catalog.count(*) FROM public.class_designation_policy_versions y WHERE y.policy_key = h.policy_key)
  FROM heads h
  WHERE h.criterion_params->'prefixes' ? _category
$$;
REVOKE ALL ON FUNCTION public.designation_policies_for_category(text, date) FROM PUBLIC, anon, authenticated, service_role;
