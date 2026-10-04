-- B1: login institucional (@sigem.itap.gov.br) é identificador, não caixa postal (decisão do usuário, 2026-10-04).
-- Comprovação de caixa postal deixa de ser pré-requisito da instalação; identidade autenticada, designação,
-- confirmação de revisão e impressão digital permanecem.
CREATE OR REPLACE FUNCTION public.install_sigem_reviewed(_act_ref text, _person_name text, _person_identifier text,
  _engagement_kind_id text, _position_label text, _policy_id uuid, _expected_fingerprint text, _confirm_all_rules_reviewed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _fp text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()) THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
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
REVOKE ALL ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean) IS 'Interna: chamada pela assinatura com _actor_nature (B4.6.7g). Sem exigência de caixa postal (login é identificador).';