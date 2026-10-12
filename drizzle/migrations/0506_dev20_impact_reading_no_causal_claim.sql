-- Lote 20: leitura de impacto é interpretação descritiva; afirmação causal sobre a formação é recusada no banco.
-- Vale só para leituras novas (tabela append-only; histórico preservado). Idempotente.
CREATE OR REPLACE FUNCTION public.dev_impact_reading_no_causal()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.interpretation ~* '(caus(ou|aram|a)|gra(ç|c)as (à|a)|devido (à|a) forma(ç|c)(ã|a)o|em raz(ã|a)o da forma(ç|c)(ã|a)o|resultado direto|comprovam? (o )?impacto)' THEN
    RAISE EXCEPTION 'dev:causal-claim';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dev_impact_reading_no_causal ON public.dev_impact_readings;
CREATE TRIGGER dev_impact_reading_no_causal BEFORE INSERT ON public.dev_impact_readings
  FOR EACH ROW EXECUTE FUNCTION public.dev_impact_reading_no_causal();
REVOKE EXECUTE ON FUNCTION public.dev_impact_reading_no_causal() FROM PUBLIC, anon, authenticated;