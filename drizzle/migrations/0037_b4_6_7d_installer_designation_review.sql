-- B4.6.7 Fatia 4 — designação condicional do instalador (decisão do usuário) + revisão obrigatória.
CREATE TABLE public.sigem_installer_designation_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_email text NOT NULL,
  decision_source text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('designacao-registrada','designacao-existente-preservada')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sigem_installer_designation_origins TO service_role;
ALTER TABLE public.sigem_installer_designation_origins ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER installer_designation_origins_immutable BEFORE UPDATE OR DELETE ON public.sigem_installer_designation_origins
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Nunca sobrescreve designação existente; instalação já feita também preserva.
DO $$
DECLARE _src text := 'decisao-explicita-do-usuario:B4.6.6-D5 (chat 2026-10-04): supervisao@sigem.itap.gov.br e a conta da Supervisao Escolar';
BEGIN
  IF EXISTS (SELECT 1 FROM public.sigem_installer_designation) THEN
    INSERT INTO public.sigem_installer_designation_origins(requested_email, decision_source, outcome)
    VALUES ('supervisao@sigem.itap.gov.br', _src, 'designacao-existente-preservada');
  ELSE
    INSERT INTO public.sigem_installer_designation(singleton, installer_email, designation_act_ref)
    VALUES (true, 'supervisao@sigem.itap.gov.br', 'decisao-usuario-B4.6.6-D5');
    INSERT INTO public.sigem_installer_designation_origins(requested_email, decision_source, outcome)
    VALUES ('supervisao@sigem.itap.gov.br', _src, 'designacao-registrada');
  END IF;
END $$;

-- Revisão para a conta designada (único leitor de rascunho antes da instalação).
CREATE OR REPLACE FUNCTION public.installation_review()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _state text; _email text; _confirmed boolean; _des text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('contract','b4.6.7d/1','state','access-denied'); END IF;
  SELECT state INTO _state FROM public.sigem_installation_state WHERE singleton;
  SELECT lower(installer_email) INTO _des FROM public.sigem_installer_designation WHERE singleton;
  SELECT lower(email), email_confirmed_at IS NOT NULL INTO _email, _confirmed FROM auth.users WHERE id = _uid;
  IF _des IS NULL OR _email IS DISTINCT FROM _des THEN
    RETURN jsonb_build_object('contract','b4.6.7d/1','state','access-denied'); END IF;
  RETURN jsonb_build_object('contract','b4.6.7d/1','state','lido','installation', _state,'emailConfirmed', _confirmed,
    'policies', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'logicalPolicyId', p.logical_policy_id, 'version', p.version, 'status', p.status,
        'rules', coalesce((SELECT jsonb_agg(jsonb_build_object('engagementKindId', r.engagement_kind_id, 'capabilityId', r.capability_id, 'scope', to_jsonb(r.scope_dimensions))
                 ORDER BY r.engagement_kind_id, r.capability_id) FROM public.capability_policy_rules r WHERE r.policy_id = p.id), '[]'::jsonb))
        ORDER BY p.version) FROM public.capability_policies p WHERE p.status = 'draft'), '[]'::jsonb));
END $$;

-- Instalação revisada: e-mail confirmado + contagem revisada igual às regras da política + confirmação explícita.
CREATE OR REPLACE FUNCTION public.install_sigem_reviewed(_act_ref text, _person_name text, _person_identifier text,
  _engagement_kind_id text, _position_label text, _policy_id uuid, _reviewed_rule_count integer, _confirm_all_rules_reviewed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _n integer; _ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  SELECT email_confirmed_at IS NOT NULL INTO _ok FROM auth.users WHERE id = auth.uid();
  IF NOT coalesce(_ok, false) THEN RAISE EXCEPTION 'install:email-not-confirmed'; END IF;
  IF _confirm_all_rules_reviewed IS NOT TRUE THEN RAISE EXCEPTION 'install:review-not-confirmed'; END IF;
  SELECT count(*) INTO _n FROM public.capability_policy_rules WHERE policy_id = _policy_id;
  IF _reviewed_rule_count IS DISTINCT FROM _n THEN RAISE EXCEPTION 'install:review-stale'; END IF;
  RETURN public.install_sigem(_act_ref, _person_name, _person_identifier, _engagement_kind_id, _position_label, _policy_id);
END $$;

REVOKE ALL ON FUNCTION public.installation_review(), public.install_sigem_reviewed(text,text,text,text,text,uuid,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.installation_review(), public.install_sigem_reviewed(text,text,text,text,text,uuid,integer,boolean) TO authenticated;
-- A porta antiga deixa de ser chamável diretamente: só a revisada (que a invoca como definidora).
REVOKE EXECUTE ON FUNCTION public.install_sigem(text,text,text,text,text,uuid) FROM authenticated, PUBLIC, anon;
