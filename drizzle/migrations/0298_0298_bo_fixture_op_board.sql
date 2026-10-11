CREATE OR REPLACE FUNCTION public.bo_fixture_grant_capability(_operation_id text, _user_id uuid, _capability text, _school text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE _a public.bo_fixture_accounts; _id uuid;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF _capability NOT IN ('manter-regras-de-resultado','registrar-folha-final','consultar-folha-final','manter-quadro-permanente-op') THEN RAISE EXCEPTION 'bo:capability-not-allowlisted'; END IF;
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

CREATE POLICY "quadro OP: fixture invisivel a contas reais" ON public.op_permanent_board_versions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.bo_fixture_is_user(author_user_id) OR public.bo_fixture_is_user(auth.uid()));

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
  -- versões do quadro gravadas pela operação, da mais nova para a mais antiga (cadeia supersedes)
  LOOP
    DELETE FROM public.op_permanent_board_versions b
     WHERE b.author_user_id IN (SELECT a.user_id FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id)
       AND NOT EXISTS (SELECT 1 FROM public.op_permanent_board_versions n WHERE n.supersedes_id = b.id);
    EXIT WHEN NOT FOUND;
  END LOOP;
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