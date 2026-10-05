CREATE OR REPLACE FUNCTION public.admin_account_overview()
RETURNS TABLE(user_id uuid, person_id uuid, login text, last_sign_in_at timestamptz, banned boolean, password_change_required boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_network_capability('manter-contas-institucionais') THEN RAISE EXCEPTION 'capability:manter-contas-institucionais'; END IF;
  RETURN QUERY SELECT u.id, l.person_id, u.email::text, u.last_sign_in_at, (u.banned_until IS NOT NULL AND u.banned_until > now()),
    coalesce((SELECT e.kind IN ('criacao','redefinicao') FROM public.account_credential_events e WHERE e.user_id = u.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1), false)
  FROM auth.users u LEFT JOIN public.user_person_links l ON l.user_id = u.id ORDER BY u.email;
END $$;