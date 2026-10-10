CREATE OR REPLACE FUNCTION public.declared_monthly_maps_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'school_declared_monthly_maps é append-only: declaração original e proveniência não podem ser alteradas nem apagadas';
END $$;
CREATE TRIGGER declared_monthly_maps_no_update BEFORE UPDATE OR DELETE ON public.school_declared_monthly_maps
  FOR EACH ROW EXECUTE FUNCTION public.declared_monthly_maps_immutable();
CREATE TRIGGER declared_monthly_maps_no_truncate BEFORE TRUNCATE ON public.school_declared_monthly_maps
  FOR EACH STATEMENT EXECUTE FUNCTION public.declared_monthly_maps_immutable();
COMMENT ON TABLE public.school_declared_monthly_maps IS 'Declaração documental da escola (planilha), append-only; idempotência por (file_sha256, source_sheet). Não é apuração nem homologação. Seção IV (nomes) nunca é gravada.';