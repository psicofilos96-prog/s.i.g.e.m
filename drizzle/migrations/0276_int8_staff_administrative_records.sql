-- INT.8: registro ADMINISTRATIVO de pessoal 2026 (planilhas oficiais da rede).
-- Não é atuação (institutional_engagements) e nunca concede acesso.
CREATE TABLE public.staff_administrative_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('servidores-por-escola','funcionarios-semed-por-setor')),
  source_file text NOT NULL,
  source_sha256 text NOT NULL,
  sheet text NOT NULL,
  row_no integer NOT NULL,
  reference_period text NOT NULL,
  school_id text REFERENCES public.institutional_schools(id),
  school_name_source text,
  school_match text NOT NULL CHECK (school_match IN ('nome-exato','alias-declarado','sem-correspondencia','nao-se-aplica')),
  sector text,
  full_name text NOT NULL,
  registration text,
  cargo text,
  funcao text,
  vinculo text,
  grupo text,
  situacao text NOT NULL,
  observacao text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by text NOT NULL DEFAULT 'execucao-tecnica-int8',
  UNIQUE (source_sha256, sheet, row_no)
);
COMMENT ON TABLE public.staff_administrative_records IS 'Registro administrativo de pessoal 2026 com proveniência; não é atuação e não concede acesso.';
GRANT SELECT ON public.staff_administrative_records TO authenticated;
GRANT ALL ON public.staff_administrative_records TO service_role;
ALTER TABLE public.staff_administrative_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura por quem consulta quadro ou registro funcional"
  ON public.staff_administrative_records FOR SELECT TO authenticated
  USING (
    public.has_network_capability('consultar-quadro-profissional-da-rede')
    OR public.has_network_capability('consultar-registro-funcional')
    OR (school_id IS NOT NULL AND public.has_school_capability('consultar-quadro-profissional-da-escola', school_id))
  );
CREATE INDEX staff_admin_records_school_idx ON public.staff_administrative_records (school_id);
CREATE OR REPLACE FUNCTION public.staff_admin_records_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'staff_administrative_records é append-only'; END $$;
CREATE TRIGGER staff_admin_records_no_update BEFORE UPDATE OR DELETE ON public.staff_administrative_records
  FOR EACH ROW EXECUTE FUNCTION public.staff_admin_records_immutable();