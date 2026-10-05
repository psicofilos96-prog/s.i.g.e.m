ALTER TABLE public.capability_policies ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
COMMENT ON COLUMN public.capability_policies.created_by IS 'Conta que registrou o rascunho (nulo para versões anteriores a 0080).';

-- Rascunhos e suas regras: legíveis só por quem registra ou efetiva política, na rede.
CREATE POLICY "policy managers read drafts" ON public.capability_policies FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-politica-de-capacidades') OR public.has_network_capability('homologar-politica-de-capacidades'));
CREATE POLICY "policy managers read draft rules" ON public.capability_policy_rules FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-politica-de-capacidades') OR public.has_network_capability('homologar-politica-de-capacidades'));

-- Rascunho com base esperada: deve suceder a versão mais recente da política lógica.
CREATE OR REPLACE FUNCTION public.register_capability_policy_draft_expected(_logical text, _expected_head uuid, _rules jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head uuid; r jsonb;
BEGIN
  IF NOT public.has_network_capability('registrar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:registrar-politica-de-capacidades'; END IF;
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

-- Efetivação com estado esperado: só o rascunho mais recente, ainda rascunho.
CREATE OR REPLACE FUNCTION public.homologate_capability_policy_expected(_policy uuid, _valid_from date, _act_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p record;
BEGIN
  IF NOT public.has_network_capability('homologar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:homologar-politica-de-capacidades'; END IF;
  SELECT * INTO p FROM public.capability_policies WHERE id = _policy FOR UPDATE;
  IF p IS NULL OR p.status <> 'draft' THEN RAISE EXCEPTION 'policy:not-draft'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policies q WHERE q.logical_policy_id = p.logical_policy_id AND q.version > p.version) THEN RAISE EXCEPTION 'policy:stale-head'; END IF;
  PERFORM public.homologate_capability_policy(_policy, _act_ref, _valid_from);
  UPDATE public.capability_policies SET homologated_by = auth.uid() WHERE id = _policy AND homologated_by IS NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.homologate_capability_policy_expected(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.homologate_capability_policy_expected(uuid, date, text) TO authenticated;

-- Prévia de consequências sem gravar.
CREATE OR REPLACE FUNCTION public.preview_capability_policy(_policy uuid, _valid_from date)
RETURNS TABLE(issue text, coverage_missing text[]) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.has_network_capability('registrar-politica-de-capacidades') OR public.has_network_capability('homologar-politica-de-capacidades')) THEN RAISE EXCEPTION 'capability:homologar-politica-de-capacidades'; END IF;
  RETURN QUERY SELECT public.capability_policy_homologation_issues(_policy, _valid_from),
    ARRAY(SELECT c::text FROM public.sigem_general_admin_coverage_issues(_policy) c);
END $$;
REVOKE EXECUTE ON FUNCTION public.preview_capability_policy(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_capability_policy(uuid, date) TO authenticated;

-- Contas vinculadas: só identificador de login e estado, nunca credencial.
CREATE OR REPLACE FUNCTION public.admin_account_overview()
RETURNS TABLE(user_id uuid, person_id uuid, login text, last_sign_in_at timestamptz, banned boolean, password_change_required boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_network_capability('manter-contas-institucionais') THEN RAISE EXCEPTION 'capability:manter-contas-institucionais'; END IF;
  RETURN QUERY SELECT u.id, l.person_id, u.email::text, u.last_sign_in_at, (u.banned_until IS NOT NULL AND u.banned_until > now()),
    EXISTS (SELECT 1 FROM public.account_credential_events e WHERE e.user_id = u.id
            AND e.recorded_at = (SELECT max(x.recorded_at) FROM public.account_credential_events x WHERE x.user_id = u.id) AND e.event_kind <> 'troca-pelo-titular')
  FROM auth.users u LEFT JOIN public.user_person_links l ON l.user_id = u.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_account_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_account_overview() TO authenticated;