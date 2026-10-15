-- PERF: mesmas linhas de effective_capabilities(), mas filtradas pela capacidade ANTES de expandir por turma.
-- Uma conta de rede com ~100 capacidades gerava ~70 mil linhas a cada verificação de permissão.
CREATE OR REPLACE FUNCTION public.capability_rows(_caps text[], _on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, school_id text, class_id text, component_id text, period_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, cls.school_id, cls.id,
    CASE WHEN 'component' = ANY(r.scope_dimensions) THEN e.component_id END,
    CASE WHEN 'period' = ANY(r.scope_dimensions) THEN e.period_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id AND r.capability_id = ANY(_caps)
  JOIN public.capability_policies p ON p.id = r.policy_id
  JOIN public.institutional_classes cls ON
       (e.scope_level = 'turma'  AND cls.id = e.class_id AND (e.school_id IS NULL OR cls.school_id = e.school_id))
    OR (e.scope_level = 'turmas' AND cls.school_id = e.school_id
        AND EXISTS (SELECT 1 FROM public.institutional_engagement_scope_classes s WHERE s.engagement_id = e.id AND s.class_id = cls.id))
    OR (e.scope_level = 'escola' AND cls.school_id = e.school_id)
    OR (e.scope_level = 'rede')
  WHERE e.person_id = public.current_person_id()
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::text
  FROM public.calendar_designated_capabilities(_on) d WHERE d.capability_id = ANY(_caps)
  UNION ALL
  SELECT g.capability_id, g.engagement_id, NULL::uuid, NULL::integer, cls.school_id, cls.id, NULL::text, NULL::text
  FROM (SELECT * FROM public.sector_station_grants(_on) x WHERE x.capability_id = ANY(_caps)) g
  JOIN public.institutional_classes cls ON g.scope_level = 'rede' OR (g.scope_level = 'escola' AND cls.school_id = g.school_id)
  UNION ALL
  SELECT f.capability_id, NULL::uuid, NULL::uuid, NULL::integer, cls.school_id, cls.id, NULL::text, NULL::text
  FROM public.bo_fixture_capability_grants f
  JOIN public.bo_fixture_accounts a ON a.user_id = f.user_id AND a.person_id = f.person_id AND a.operation_id = f.operation_id
  JOIN public.institutional_classes cls ON f.scope_level = 'rede' OR cls.school_id = f.school_id
  WHERE f.capability_id = ANY(_caps) AND f.person_id = public.current_person_id() AND a.user_id = auth.uid()
    AND f.expires_at > now() AND public.technical_automation_enabled()
$function$;
REVOKE ALL ON FUNCTION public.capability_rows(text[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capability_rows(text[], date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.roster_readable_classes()
 RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT DISTINCT c.class_id FROM public.capability_rows(ARRAY['consultar-estudantes-da-turma']) c WHERE c.class_id IS NOT NULL
$function$;

CREATE OR REPLACE FUNCTION public.capability_classes(_capability text)
 RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT DISTINCT c.class_id FROM public.capability_rows(ARRAY[_capability]) c WHERE c.class_id IS NOT NULL
$function$;

CREATE OR REPLACE FUNCTION public.can_read_class_roster(_class text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.capability_rows(ARRAY['consultar-estudantes-da-turma']) c
    WHERE (c.class_id = _class
        OR (c.class_id IS NULL AND c.school_id IS NOT NULL AND c.school_id = (SELECT k.school_id FROM public.institutional_classes k WHERE k.id = _class))
        OR (c.class_id IS NULL AND c.school_id IS NULL)))
$function$;

CREATE OR REPLACE FUNCTION public.capability_grant(_capability text, _class text, _component text DEFAULT NULL::text, _period text DEFAULT NULL::text)
 RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.engagement_id, c.policy_id, c.policy_version FROM public.capability_rows(ARRAY[_capability]) c
   WHERE (c.class_id IS NULL OR c.class_id = _class)
     AND (_component IS NULL OR c.component_id IS NULL OR c.component_id = _component)
     AND (_period IS NULL OR c.period_id IS NULL OR c.period_id = _period)
   ORDER BY c.engagement_id NULLS LAST
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.capability_unbound(_capability text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$ SELECT EXISTS (SELECT 1 FROM public.capability_rows(ARRAY[_capability]) c WHERE c.class_id IS NULL) $function$;