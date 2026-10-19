-- Recebimento confirmado exige nota fiscal registrada (antes só a tela exigia). Rascunho e retificação seguem livres.
CREATE OR REPLACE FUNCTION public.meal_receipt_requires_fiscal() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
BEGIN
  IF NEW.status = 'confirmado' AND NEW.fiscal_document_logical_id IS NULL THEN
    RAISE EXCEPTION 'meal:fiscal-document-required';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER meal_receipt_requires_fiscal BEFORE INSERT ON public.meal_receipts
  FOR EACH ROW EXECUTE FUNCTION public.meal_receipt_requires_fiscal();