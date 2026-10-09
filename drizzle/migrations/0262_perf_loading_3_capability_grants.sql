-- PERF.LOADING.3 — forma compacta de effective_capabilities(): uma linha por concessão (sem expandir
-- 'rede'/'escola' por turma) + leitor das turmas do alcance. A expansão no cliente reproduz exatamente
-- effective_capabilities(); o banco continua usando effective_capabilities/has_capability como garantia.
CREATE OR REPLACE FUNCTION public.effective_capability_grants(_on date DEFAULT CURRENT_DATE)
RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text, class_id text, component_id text, period_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.capability_id, e.id, p.id, p.version,
    CASE WHEN e.scope_level IN ('turma','turmas') THEN 'turma' ELSE e.scope_level END,
    CASE WHEN e.scope_level IN ('turma','turmas') THEN cls.school_id WHEN e.scope_level = 'escola' THEN e.school_id END,
    CASE WHEN e.scope_level IN ('turma','turmas') THEN cls.id END,
    CASE WHEN 'component' = ANY(r.scope_dimensions) THEN e.component_id END,
    CASE WHEN 'period' = ANY(r.scope_dimensions) THEN e.period_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  LEFT JOIN public.institutional_classes cls ON
       (e.scope_level = 'turma'  AND cls.id = e.class_id AND (e.school_id IS NULL OR cls.school_id = e.school_id))
    OR (e.scope_level = 'turmas' AND cls.school_id = e.school_id
        AND EXISTS (SELECT 1 FROM public.institutional_engagement_scope_classes s WHERE s.engagement_id = e.id AND s.class_id = cls.id))
  WHERE e.person_id = public.current_person_id()
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
    AND (e.scope_level IN ('rede','escola') OR cls.id IS NOT NULL)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, 'designacao', NULL::text, NULL::text, NULL::text, NULL::text
  FROM public.calendar_designated_capabilities(_on) d
  UNION ALL
  SELECT g.capability_id, g.engagement_id, NULL::uuid, NULL::integer, g.scope_level,
         CASE WHEN g.scope_level = 'escola' THEN g.school_id END, NULL::text, NULL::text, NULL::text
  FROM public.sector_station_grants(_on) g
  WHERE g.scope_level IN ('rede','escola')
$$;

-- Turmas do alcance 'rede'/'escola' do próprio chamador (as mesmas que effective_capabilities já expunha).
CREATE OR REPLACE FUNCTION public.effective_capability_scope_classes(_on date DEFAULT CURRENT_DATE)
RETURNS TABLE(school_id text, class_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH g AS (SELECT DISTINCT scope_level, school_id FROM public.effective_capability_grants(_on) WHERE scope_level IN ('rede','escola'))
  SELECT cls.school_id, cls.id FROM public.institutional_classes cls
  WHERE EXISTS (SELECT 1 FROM g WHERE g.scope_level = 'rede')
     OR cls.school_id IN (SELECT school_id FROM g WHERE g.scope_level = 'escola')
  ORDER BY cls.school_id, cls.id
$$;

REVOKE ALL ON FUNCTION public.effective_capability_grants(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.effective_capability_scope_classes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_capability_grants(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_capability_scope_classes(date) TO authenticated, service_role;