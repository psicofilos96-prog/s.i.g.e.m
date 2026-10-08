-- NCONC.1: primeira versão de uma política lógica não tinha linha para FOR UPDATE; duas sessões
-- concorrentes chegavam à UNIQUE(logical_policy_id, version) com erro bruto. Trava consultiva por
-- política lógica serializa e a segunda sessão recebe policy:stale-head. Corpo idêntico ao da 0080.
CREATE OR REPLACE FUNCTION public.register_capability_policy_draft_expected(_logical text, _expected_head uuid, _rules jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head uuid; r jsonb;
BEGIN
  IF NOT public.has_network_capability('registrar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:registrar-politica-de-capacidades'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('policy-logical:' || coalesce(_logical,''), 0));
  PERFORM 1 FROM public.capability_policies WHERE logical_policy_id = _logical FOR UPDATE;
  SELECT id INTO head FROM public.capability_policies WHERE logical_policy_id = _logical ORDER BY version DESC LIMIT 1;
  IF head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'policy:stale-head'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_rules,'[]')) LOOP
    IF coalesce(r->>'capability_id','') ~ '[*%]' OR coalesce(r->>'engagement_kind_id','') ~ '[*%]' THEN RAISE EXCEPTION 'policy:wildcard-forbidden'; END IF;
  END LOOP;
  RETURN public.register_capability_policy_draft(_logical, _expected_head, _rules);
END $$;
REVOKE EXECUTE ON FUNCTION public.register_capability_policy_draft_expected(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_capability_policy_draft_expected(text, uuid, jsonb) TO authenticated;