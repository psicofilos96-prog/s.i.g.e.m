-- Primeiro acesso do servidor: login + data de nascimento da folha criam a primeira senha.
-- Só para contas servant-login que ainda não trocaram a senha inicial. Tentativas registradas e limitadas.
CREATE TABLE IF NOT EXISTS public.first_access_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL,
  ok boolean NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS first_access_attempts_login_idx ON public.first_access_attempts(login, created_at DESC);
ALTER TABLE public.first_access_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.first_access_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.first_access_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.first_access_verify(p_login text, p_birth date)
 RETURNS TABLE(user_id uuid, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_user auth.users%ROWTYPE;
  v_birth date;
  v_reason text;
BEGIN
  IF (SELECT count(*) FROM public.first_access_attempts a
      WHERE a.login = v_login AND NOT a.ok AND a.created_at > now() - interval '1 hour') >= 5 THEN
    v_reason := 'bloqueado-temporariamente';
  ELSE
    SELECT * INTO v_user FROM auth.users u WHERE lower(u.email) = v_login LIMIT 1;
    IF NOT FOUND OR v_user.raw_app_meta_data->>'sigem_account' IS DISTINCT FROM 'servant-login' THEN
      v_reason := 'nao-confere';
    ELSIF EXISTS (SELECT 1 FROM public.account_credential_events e
                  WHERE e.user_id = v_user.id AND e.kind = 'troca'
                    AND e.created_at > timestamptz '2026-10-12 22:50:00+00') THEN
      v_reason := 'ja-ativado';
    ELSE
      SELECT r.birth_date INTO v_birth FROM public.payroll_functional_registrations r
       WHERE r.registration_norm = v_user.raw_app_meta_data->>'registration_norm'
       ORDER BY r.reference_period DESC LIMIT 1;
      IF v_birth IS NULL THEN v_reason := 'sem-nascimento';
      ELSIF p_birth IS NULL OR v_birth <> p_birth THEN v_reason := 'nao-confere';
      ELSE v_reason := 'ok';
      END IF;
    END IF;
  END IF;
  INSERT INTO public.first_access_attempts(login, ok, reason) VALUES (v_login, v_reason = 'ok', v_reason);
  RETURN QUERY SELECT CASE WHEN v_reason = 'ok' THEN v_user.id END, v_reason;
END
$function$;
REVOKE ALL ON FUNCTION public.first_access_verify(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.first_access_verify(text, date) TO service_role;

CREATE OR REPLACE FUNCTION public.first_access_record(p_user uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  INSERT INTO public.account_credential_events(user_id, kind, login, recorded_by, act_ref)
  SELECT u.id, 'troca', u.email, u.id, 'primeiro-acesso-nascimento' FROM auth.users u WHERE u.id = p_user;
$function$;
REVOKE ALL ON FUNCTION public.first_access_record(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.first_access_record(uuid) TO service_role;