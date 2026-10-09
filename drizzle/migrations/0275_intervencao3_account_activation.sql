-- INTERVENÇÃO 3/6 — primeiro acesso e recuperação por código individual de uso único.
-- Só o hash do código é guardado; nenhuma senha é gravada. Acesso apenas pelo servidor (service_role).
CREATE TABLE public.account_activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('ativacao','recuperacao')),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  issued_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_activation_codes_login_idx ON public.account_activation_codes (login, created_at DESC);
GRANT ALL ON public.account_activation_codes TO service_role;
ALTER TABLE public.account_activation_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.account_activations (
  user_id uuid PRIMARY KEY,
  method text NOT NULL CHECK (method IN ('preservada','codigo')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  code_id uuid
);
GRANT SELECT ON public.account_activations TO authenticated;
GRANT ALL ON public.account_activations TO service_role;
ALTER TABLE public.account_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activation readable" ON public.account_activations FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Contas especiais preservadas: credencial e sessão atuais seguem válidas, sem redefinição.
INSERT INTO public.account_activations(user_id, method)
SELECT u.id, 'preservada' FROM auth.users u
 WHERE lower(u.email) IN ('admin@sigem.itap.gov.br','supervisao@sigem.itap.gov.br')
ON CONFLICT (user_id) DO NOTHING;