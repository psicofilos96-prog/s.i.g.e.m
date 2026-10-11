CREATE FUNCTION public.aa_fixture_row(_old jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE op text := current_setting('sigem.bo_cleanup_op', true);
BEGIN
  IF op IS NULL OR op !~ '^bo-[0-9a-f]{12}$' THEN RETURN false; END IF;
  IF public.bo_fixture_cleanup_row(_old) THEN RETURN true; END IF;
  IF position(op IN _old::text) > 0 THEN RETURN true; END IF;
  IF _old ? 'opened_by' AND EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = op AND a.user_id::text = _old->>'opened_by') THEN RETURN true; END IF;
  IF _old ? 'result_version_id' AND EXISTS (SELECT 1 FROM public.ext_result_versions v WHERE v.id::text = _old->>'result_version_id' AND position(op IN v.source_ref) > 0) THEN RETURN true; END IF;
  IF _old ? 'rule_version_id' AND EXISTS (SELECT 1 FROM public.aa_calc_rule_versions v WHERE v.id::text = _old->>'rule_version_id' AND position(op IN v.source_ref) > 0) THEN RETURN true; END IF;
  IF _old ? 'case_id' AND EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id::text = _old->>'case_id' AND position(op IN c.basis_period) > 0) THEN RETURN true; END IF;
  RETURN false;
END $$;
CREATE OR REPLACE FUNCTION public.ext_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN IF TG_OP = 'DELETE' AND public.aa_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF; RAISE EXCEPTION 'avaliacao-externa:append-only'; END $$;
CREATE OR REPLACE FUNCTION public.aa_rule_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN IF TG_OP = 'DELETE' AND public.aa_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF; RAISE EXCEPTION 'regra-avaliacao:append-only'; END $$;
CREATE OR REPLACE FUNCTION public.ei_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN IF TG_OP = 'DELETE' AND public.aa_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF; RAISE EXCEPTION 'educacao-infantil:append-only'; END $$;
CREATE OR REPLACE FUNCTION public.aa_outreach_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN IF TG_OP = 'DELETE' AND public.aa_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF; RAISE EXCEPTION 'busca-ativa:append-only'; END $$;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_aa(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _users uuid[]; _n int := 0; _c int; m text := '%' || _operation_id || '%';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  SELECT coalesce(array_agg(a.user_id), '{}') INTO _users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.aa_outreach_events e WHERE e.author_user_id = ANY(_users) OR e.note LIKE m
     OR e.case_id IN (SELECT c.id FROM public.aa_outreach_cases c WHERE c.opened_by = ANY(_users) OR c.basis_period LIKE m);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.aa_outreach_cases c WHERE c.opened_by = ANY(_users) OR c.basis_period LIKE m; GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.ei_feedback_events f WHERE f.author_user_id = ANY(_users) OR f.text_body LIKE m; GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  LOOP DELETE FROM public.ei_followup_versions v WHERE (v.author_user_id = ANY(_users) OR v.observation LIKE m) AND NOT EXISTS (SELECT 1 FROM public.ei_followup_versions n WHERE n.supersedes_id = v.id);
    GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c; EXIT WHEN _c = 0; END LOOP;
  DELETE FROM public.ext_result_homologations h WHERE h.author_user_id = ANY(_users) OR h.result_version_id IN (SELECT v.id FROM public.ext_result_versions v WHERE v.author_user_id = ANY(_users) OR v.source_ref LIKE m);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  LOOP DELETE FROM public.ext_result_versions v WHERE (v.author_user_id = ANY(_users) OR v.source_ref LIKE m) AND NOT EXISTS (SELECT 1 FROM public.ext_result_versions n WHERE n.supersedes_id = v.id);
    GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c; EXIT WHEN _c = 0; END LOOP;
  DELETE FROM public.aa_calc_rule_homologations h WHERE h.author_user_id = ANY(_users) OR h.rule_version_id IN (SELECT v.id FROM public.aa_calc_rule_versions v WHERE v.author_user_id = ANY(_users) OR v.source_ref LIKE m);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  LOOP DELETE FROM public.aa_calc_rule_versions v WHERE (v.author_user_id = ANY(_users) OR v.source_ref LIKE m) AND NOT EXISTS (SELECT 1 FROM public.aa_calc_rule_versions n WHERE n.supersedes_id = v.id);
    GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c; EXIT WHEN _c = 0; END LOOP;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN _n;
END $$;