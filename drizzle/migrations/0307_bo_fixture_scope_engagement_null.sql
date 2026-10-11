-- Concessão BO volta a sair sem atuação (engagement NULL): é o marcador que a tela usa para reconhecer conta técnica
-- sem política; trocar por a.engagement_id (0306) a confundiria com concessão de estação.
CREATE OR REPLACE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, e.scope_level, CASE WHEN e.scope_level = 'escola' THEN e.school_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  WHERE e.person_id = public.current_person_id()
    AND e.scope_level IN ('escola','rede')
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, 'rede', NULL::text
  FROM public.calendar_designated_capabilities(_on) d
  UNION ALL
  SELECT g.capability_id, g.engagement_id, NULL::uuid, NULL::integer, g.scope_level, g.school_id
  FROM public.sector_station_grants(_on) g
  UNION ALL
  SELECT f.capability_id, NULL::uuid, NULL::uuid, NULL::integer, f.scope_level, f.school_id
  FROM public.bo_fixture_capability_grants f
  JOIN public.bo_fixture_accounts a ON a.user_id = f.user_id AND a.person_id = f.person_id AND a.operation_id = f.operation_id
  WHERE f.person_id = public.current_person_id() AND a.user_id = auth.uid()
    AND f.expires_at > now() AND public.technical_automation_enabled()
$function$;