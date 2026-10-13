-- Senha de conta de setor definida pela administração: registra o evento para que o setor não seja obrigado a trocar.
ALTER TABLE public.account_credential_events DROP CONSTRAINT IF EXISTS account_credential_events_kind_check;
ALTER TABLE public.account_credential_events ADD CONSTRAINT account_credential_events_kind_check
  CHECK (kind = ANY (ARRAY['criacao','redefinicao','troca','definida-pela-administracao']));

CREATE OR REPLACE FUNCTION public.password_change_required()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND u.raw_app_meta_data->>'sigem_account' IN ('servant-login','sector')
        AND NOT EXISTS (SELECT 1 FROM public.account_credential_events e
                        WHERE e.user_id = u.id AND e.kind IN ('troca','definida-pela-administracao')
                          AND e.created_at > timestamptz '2026-10-12 22:50:00+00')
    ) THEN true
    ELSE coalesce((SELECT kind IN ('criacao','redefinicao') FROM public.account_credential_events WHERE user_id = auth.uid() ORDER BY created_at DESC, id DESC LIMIT 1), false)
  END
$function$;

CREATE OR REPLACE FUNCTION public.sector_password_record(p_user uuid, p_by uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH t AS (SELECT u.id, u.email FROM auth.users u WHERE u.id = p_user AND u.raw_app_meta_data->>'sigem_account' = 'sector'),
  ins AS (INSERT INTO public.account_credential_events(user_id, kind, login, recorded_by, act_ref)
          SELECT t.id, 'definida-pela-administracao', t.email, p_by, 'senha-de-setor' FROM t RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM ins);
$function$;
REVOKE ALL ON FUNCTION public.sector_password_record(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sector_password_record(uuid, uuid) TO service_role;