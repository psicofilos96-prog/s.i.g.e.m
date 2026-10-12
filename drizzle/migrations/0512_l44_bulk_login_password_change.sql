-- L44: contas provisionadas em massa no L43 (servant-login e sector) exigem troca da senha inicial
-- até registrarem 'troca' posterior ao provisionamento. Não altera senha, conta nem evento existente.
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
                        WHERE e.user_id = u.id AND e.kind = 'troca'
                          AND e.created_at > timestamptz '2026-10-12 22:50:00+00')
    ) THEN true
    ELSE coalesce((SELECT kind IN ('criacao','redefinicao') FROM public.account_credential_events WHERE user_id = auth.uid() ORDER BY created_at DESC, id DESC LIMIT 1), false)
  END
$function$;
REVOKE ALL ON FUNCTION public.password_change_required() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.password_change_required() TO authenticated;