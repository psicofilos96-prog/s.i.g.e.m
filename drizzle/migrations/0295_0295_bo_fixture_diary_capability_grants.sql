CREATE TABLE IF NOT EXISTS public.bo_fixture_capability_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id text NOT NULL,
  user_id uuid NOT NULL,
  person_id uuid NOT NULL,
  capability_id text NOT NULL,
  scope_level text NOT NULL CHECK (scope_level IN ('rede','escola')),
  school_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_level = 'rede' AND school_id IS NULL) OR (scope_level = 'escola' AND school_id IS NOT NULL))
);
REVOKE ALL ON public.bo_fixture_capability_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bo_fixture_capability_grants TO service_role;
ALTER TABLE public.bo_fixture_capability_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bo_fixture_is_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.user_id = _uid) $$;
REVOKE ALL ON FUNCTION public.bo_fixture_is_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bo_fixture_is_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bo_fixture_grant_capability(_operation_id text, _user_id uuid, _capability text, _school text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE _a public.bo_fixture_accounts; _id uuid;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF _capability NOT IN ('manter-regras-de-resultado','registrar-folha-final','consultar-folha-final') THEN RAISE EXCEPTION 'bo:capability-not-allowlisted'; END IF;
  SELECT * INTO _a FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id;
  IF _a.user_id IS NULL OR _a.person_id IS NULL THEN RAISE EXCEPTION 'bo:not-a-fixture-account'; END IF;
  IF _school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'bo:school-unknown'; END IF;
  INSERT INTO public.bo_fixture_capability_grants(operation_id, user_id, person_id, capability_id, scope_level, school_id, expires_at)
    VALUES (_operation_id, _user_id, _a.person_id, _capability, CASE WHEN _school IS NULL THEN 'rede' ELSE 'escola' END, _school, now() + interval '2 hours')
    RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_grant_capability(text,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_grant_capability(text,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.effective_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, school_id text, class_id text, component_id text, period_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::text
  FROM public.calendar_designated_capabilities(_on) d
  UNION ALL
  SELECT g.capability_id, g.engagement_id, NULL::uuid, NULL::integer, cls.school_id, cls.id, NULL::text, NULL::text
  FROM public.sector_station_grants(_on) g
  JOIN public.institutional_classes cls ON g.scope_level = 'rede' OR (g.scope_level = 'escola' AND cls.school_id = g.school_id)
  UNION ALL
  SELECT f.capability_id, NULL::uuid, NULL::uuid, NULL::integer, cls.school_id, cls.id, NULL::text, NULL::text
  FROM public.bo_fixture_capability_grants f
  JOIN public.bo_fixture_accounts a ON a.user_id = f.user_id AND a.person_id = f.person_id AND a.operation_id = f.operation_id
  JOIN public.institutional_classes cls ON f.scope_level = 'rede' OR cls.school_id = f.school_id
  WHERE f.person_id = public.current_person_id() AND a.user_id = auth.uid()
    AND f.expires_at > now() AND public.technical_automation_enabled()
$function$;

CREATE POLICY "folha final: fixture invisivel a contas reais" ON public.final_sheet_acts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.bo_fixture_is_user(actor_id) OR public.bo_fixture_is_user(auth.uid()));
CREATE POLICY "regras: fixture invisivel a contas reais" ON public.final_sheet_rule_versions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.bo_fixture_is_user(author_id) OR public.bo_fixture_is_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.final_sheet_immutable()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
DECLARE _op text := current_setting('sigem.bo_cleanup_op', true); _who uuid;
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(_op, '') ~ '^bo-[0-9a-f]{12}$' THEN
    _who := CASE WHEN TG_TABLE_NAME = 'final_sheet_acts' THEN (to_jsonb(OLD)->>'actor_id')::uuid ELSE (to_jsonb(OLD)->>'author_id')::uuid END;
    IF EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = _op AND a.user_id = _who) THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'FINAL_SHEET_IMMUTABLE';
END $function$;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup(_operation_id text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _a record; _n integer := 0;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.final_sheet_acts f WHERE f.actor_id IN (SELECT a.user_id FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id);
  DELETE FROM public.final_sheet_rule_versions r WHERE r.author_id IN (SELECT a.user_id FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id);
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  DELETE FROM public.bo_fixture_capability_grants g WHERE g.operation_id = _operation_id;
  FOR _a IN SELECT * FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id LOOP
    IF _a.engagement_id IS NOT NULL THEN
      DELETE FROM public.institutional_engagements e WHERE e.id = _a.engagement_id AND e.person_id = _a.person_id
        AND e.originating_act_ref = 'bo-fixture:' || _operation_id AND e.position_label_snapshot = 'BO FIXTURE';
      IF NOT FOUND THEN RAISE EXCEPTION 'bo:engagement-marker-mismatch'; END IF;
    END IF;
    DELETE FROM public.user_person_links l WHERE l.user_id = _a.user_id AND l.person_id = _a.person_id;
    DELETE FROM public.institutional_persons p WHERE p.id = _a.person_id
      AND p.institutional_identifier = 'bo-fixture:' || _operation_id || ':' || _a.user_id::text AND p.display_name = 'BO FIXTURE ' || _operation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'bo:person-marker-mismatch'; END IF;
    DELETE FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _a.user_id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $function$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup(text) TO service_role;