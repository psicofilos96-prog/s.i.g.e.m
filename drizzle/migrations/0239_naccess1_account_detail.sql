-- NACCESS.1: leitura explicativa por conta (somente leitura). Não altera política, regra nem conta.
CREATE OR REPLACE FUNCTION public.access_center_account_detail(_user uuid, _on date DEFAULT CURRENT_DATE)
RETURNS TABLE(entry_kind text, capability_id text, origin text, scope text, school_id text, on_date date, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.access_center_holder() THEN RAISE EXCEPTION 'access-center:not-holder'; END IF;
  RETURN QUERY
  -- conta de setor: regras da estação na versão vigente
  SELECT 'capacidade'::text, r.capability_id, ('estacao:' || p.station_code || '@v' || r.rules_version)::text,
         CASE p.scope_kind WHEN 'network' THEN 'rede' ELSE 'escola' END, p.school_id, NULL::date, r.decision_ref
  FROM public.institutional_sector_principals p
  JOIN public.sector_station_rules r ON r.station_code = p.station_code AND r.rules_version = public.current_sector_rules_version(_on)
  WHERE p.auth_user_id = _user AND p.valid_from <= _on
    AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principal_revocations x WHERE x.principal_id = p.id AND x.revoked_on <= _on)
  UNION ALL
  -- pessoa/órgão: atuação vigente × política homologada vigente
  SELECT 'capacidade', r.capability_id, ('politica:v' || pol.version || ' · atuacao:' || e.engagement_kind_id)::text,
         e.scope_level, e.school_id, e.valid_from, NULL::text
  FROM public.user_person_links l
  JOIN public.institutional_engagements e ON e.person_id = l.person_id
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies pol ON pol.id = r.policy_id
  WHERE l.user_id = _user AND pol.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= _on)
    AND (pol.valid_from IS NULL OR pol.valid_from <= _on) AND (pol.valid_until IS NULL OR pol.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = pol.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT 'revogacao', NULL, 'estacao:' || p.station_code, NULL, p.school_id, x.revoked_on, x.reason
  FROM public.institutional_sector_principals p JOIN public.institutional_sector_principal_revocations x ON x.principal_id = p.id
  WHERE p.auth_user_id = _user
  UNION ALL
  SELECT 'encerramento-atuacao', NULL, 'atuacao:' || e.engagement_kind_id, e.scope_level, e.school_id, x.ended_on, x.act_ref
  FROM public.user_person_links l JOIN public.institutional_engagements e ON e.person_id = l.person_id
  JOIN public.engagement_endings x ON x.engagement_id = e.id
  WHERE l.user_id = _user
  UNION ALL
  SELECT 'provisionamento', NULL, ev.operation, NULL, NULL, ev.recorded_at::date, ev.outcome
  FROM public.institutional_sector_principals p JOIN public.institutional_sector_provisioning_events ev ON ev.principal_id = p.id
  WHERE p.auth_user_id = _user
  ORDER BY 1, 2, 3;
END $function$;
REVOKE ALL ON FUNCTION public.access_center_account_detail(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_center_account_detail(uuid, date) TO authenticated;