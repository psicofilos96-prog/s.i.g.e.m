-- B4.6.7e: revisão da instalação por impressão digital canônica do conteúdo completo da política.
-- Substitui a verificação por contagem (count(*)) que aceitava troca de capability/atuação/alcance com o mesmo número.

CREATE OR REPLACE FUNCTION public.sigem_policy_fingerprint(_policy_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT encode(pg_catalog.sha256(convert_to(jsonb_build_object(
      'fingerprintVersion', 1,
      'id', p.id, 'logicalPolicyId', p.logical_policy_id, 'version', p.version, 'status', p.status,
      'supersedesVersionId', p.supersedes_version_id, 'validFrom', p.valid_from, 'validUntil', p.valid_until,
      'rules', coalesce((SELECT jsonb_agg(jsonb_build_array(r.engagement_kind_id, r.capability_id, to_jsonb(r.scope_dimensions))
                 ORDER BY r.engagement_kind_id, r.capability_id, array_to_string(r.scope_dimensions, chr(31)), r.id)
               FROM public.capability_policy_rules r WHERE r.policy_id = p.id), '[]'::jsonb)
    )::text, 'UTF8')), 'hex')
  FROM public.capability_policies p WHERE p.id = _policy_id
$$;
REVOKE ALL ON FUNCTION public.sigem_policy_fingerprint(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.installation_review()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _state text; _email text; _confirmed boolean; _des text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('contract','b4.6.7e/1','state','access-denied'); END IF;
  SELECT state INTO _state FROM public.sigem_installation_state WHERE singleton;
  SELECT lower(installer_email) INTO _des FROM public.sigem_installer_designation WHERE singleton;
  SELECT lower(email), email_confirmed_at IS NOT NULL INTO _email, _confirmed FROM auth.users WHERE id = _uid;
  IF _des IS NULL OR _email IS DISTINCT FROM _des THEN
    RETURN jsonb_build_object('contract','b4.6.7e/1','state','access-denied'); END IF;
  RETURN jsonb_build_object('contract','b4.6.7e/1','state','lido','installation', _state,'emailConfirmed', _confirmed,
    'policies', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'logicalPolicyId', p.logical_policy_id, 'version', p.version, 'status', p.status,
        'validFrom', p.valid_from, 'validUntil', p.valid_until, 'fingerprint', public.sigem_policy_fingerprint(p.id),
        'rules', coalesce((SELECT jsonb_agg(jsonb_build_object('engagementKindId', r.engagement_kind_id, 'capabilityId', r.capability_id, 'scope', to_jsonb(r.scope_dimensions))
                 ORDER BY r.engagement_kind_id, r.capability_id) FROM public.capability_policy_rules r WHERE r.policy_id = p.id), '[]'::jsonb))
        ORDER BY p.version) FROM public.capability_policies p WHERE p.status = 'draft'), '[]'::jsonb));
END $$;

-- Instalação revisada por impressão digital. Ordem de travas: estado → política → regras (bloqueia escrita concorrente)
-- → recálculo da impressão → install_sigem, tudo na MESMA transação.
CREATE OR REPLACE FUNCTION public.install_sigem_reviewed(_act_ref text, _person_name text, _person_identifier text,
  _engagement_kind_id text, _position_label text, _policy_id uuid, _expected_fingerprint text, _confirm_all_rules_reviewed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _ok boolean; _fp text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  SELECT email_confirmed_at IS NOT NULL INTO _ok FROM auth.users WHERE id = auth.uid();
  IF NOT coalesce(_ok, false) THEN RAISE EXCEPTION 'install:email-not-confirmed'; END IF;
  IF _confirm_all_rules_reviewed IS NOT TRUE THEN RAISE EXCEPTION 'install:review-not-confirmed'; END IF;
  IF _expected_fingerprint IS NULL OR _expected_fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'install:fingerprint-invalid'; END IF;
  PERFORM 1 FROM public.sigem_installation_state WHERE singleton FOR UPDATE;
  PERFORM 1 FROM public.capability_policies WHERE id = _policy_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'install:policy-not-found'; END IF;
  LOCK TABLE public.capability_policy_rules IN SHARE MODE;
  _fp := public.sigem_policy_fingerprint(_policy_id);
  IF _fp IS DISTINCT FROM _expected_fingerprint THEN RAISE EXCEPTION 'install:review-stale'; END IF;
  RETURN public.install_sigem(_act_ref, _person_name, _person_identifier, _engagement_kind_id, _position_label, _policy_id);
END $$;

REVOKE ALL ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean) TO authenticated;
-- A assinatura por contagem deixa de ser porta: sem EXECUTE para ninguém além do dono.
REVOKE ALL ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,integer,boolean) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,integer,boolean) IS 'DEPRECATED: substituída pela versão com impressão digital (B4.6.7e); sem EXECUTE.';
