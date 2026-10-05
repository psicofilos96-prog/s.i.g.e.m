-- 0106: área de entrega de payload para operações técnicas (canal privilegiado do agente).
-- Não é fato de domínio: só transporta o payload até a operação técnica específica, que valida tudo.
CREATE TABLE public.technical_payload_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_kind text NOT NULL CHECK (operation_kind ~ '^technical_[a-z0-9_]+$'),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  part text NOT NULL DEFAULT 'main',
  payload jsonb NOT NULL,
  staged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_kind, source_hash, part)
);
COMMENT ON TABLE public.technical_payload_staging IS 'Transporte efêmero de payload para operações técnicas 0100; sem leitura/escrita por app roles; consumido e descartado após a operação.';
REVOKE ALL ON public.technical_payload_staging FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.technical_payload_staging ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.technical_payload_staging TO sandbox_exec';
    EXECUTE 'CREATE POLICY "canal tecnico do agente" ON public.technical_payload_staging FOR ALL TO sandbox_exec USING (true) WITH CHECK (true)';
  END IF;
END $$;