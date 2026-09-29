
CREATE OR REPLACE FUNCTION public.effective_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, school_id text, class_id text, component_id text, period_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, cls.school_id, cls.id,
    CASE WHEN 'component' = ANY(r.scope_dimensions) THEN e.component_id END,
    CASE WHEN 'period' = ANY(r.scope_dimensions) THEN e.period_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
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
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION public.homologate_capability_policy(_policy uuid, _act_ref text, _valid_from date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p record; _cap text; _missing text[] := '{}';
BEGIN
  IF NOT public.has_network_capability('homologar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:homologar-politica-de-capacidades'; END IF;
  SELECT * INTO _p FROM capability_policies WHERE id = _policy FOR UPDATE;
  IF _p.id IS NULL OR _p.status <> 'draft' THEN RAISE EXCEPTION 'policy:not-draft'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'policy:act-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'policy:valid-from-required'; END IF;
  -- Invariante de integridade: após a vigência, deve restar caminho administrativo normal.
  FOREACH _cap IN ARRAY ARRAY['manter-pessoas-institucionais','manter-contas-institucionais','manter-atuacoes-institucionais','registrar-politica-de-capacidades','homologar-politica-de-capacidades'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM institutional_engagements e
      JOIN capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
      JOIN capability_policies q ON q.id = r.policy_id
      WHERE r.capability_id = _cap AND e.scope_level = 'rede'
        AND e.valid_from <= _valid_from AND (e.valid_until IS NULL OR e.valid_until >= _valid_from)
        AND (q.id = _policy OR (q.status = 'homologated' AND q.id IS DISTINCT FROM _p.supersedes_version_id
             AND (q.valid_until IS NULL OR q.valid_until >= _valid_from)
             AND NOT EXISTS (SELECT 1 FROM capability_policies s WHERE s.supersedes_version_id = q.id AND s.status = 'homologated' AND s.valid_from <= _valid_from)))
    ) THEN _missing := _missing || _cap; END IF;
  END LOOP;
  IF array_length(_missing,1) > 0 THEN RAISE EXCEPTION 'policy:would-remove-administration:%', array_to_string(_missing, ','); END IF;
  UPDATE capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act_ref, valid_from = _valid_from WHERE id = _policy;
END $$;
