-- Direção L14 — Limites de risco da escola: configuração versionada pela Direção da própria escola.
-- Cada alteração é uma nova versão (nunca edita a anterior); a versão vigente é a mais recente.
-- Configuração não é aplicação: o corte de nota só produzirá alerta quando a regra de médias da rede existir.
CREATE TABLE public.school_risk_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  version int NOT NULL,
  frequency_pct numeric(5,2) NULL CHECK (frequency_pct > 0 AND frequency_pct <= 100),
  grade_cutoff numeric(4,2) NULL CHECK (grade_cutoff >= 0 AND grade_cutoff <= 10),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  set_by uuid NOT NULL,
  set_by_principal_id uuid NOT NULL REFERENCES public.institutional_sector_principals(id),
  set_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE,
  UNIQUE (school_id, version),
  CHECK (frequency_pct IS NOT NULL OR grade_cutoff IS NOT NULL)
);
REVOKE ALL ON public.school_risk_limits FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.school_risk_limits ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER srl_no_change BEFORE UPDATE OR DELETE ON public.school_risk_limits FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();

CREATE OR REPLACE FUNCTION public.direcao_set_risk_limits(
  _school text, _frequency_pct numeric, _grade_cutoff numeric, _reason text, _expected_version int, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr uuid; cur int; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'risk:auth-required'; END IF;
  SELECT id INTO pr FROM public.institutional_sector_principals
   WHERE auth_user_id = auth.uid() AND station_code = 'direcao_escolar' AND school_id = _school;
  IF pr IS NULL THEN RAISE EXCEPTION 'risk:direcao-only'; END IF;
  SELECT version INTO cur FROM public.school_risk_limits WHERE idempotency_key = _key;
  IF cur IS NOT NULL THEN RETURN cur; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('srl:' || _school));
  SELECT coalesce(max(version), 0) INTO cur FROM public.school_risk_limits WHERE school_id = _school;
  IF cur <> _expected_version THEN RAISE EXCEPTION 'risk:base-desatualizada'; END IF;
  INSERT INTO public.school_risk_limits(school_id, version, frequency_pct, grade_cutoff, reason, set_by, set_by_principal_id, idempotency_key)
  VALUES (_school, cur + 1, _frequency_pct, _grade_cutoff, btrim(_reason), auth.uid(), pr, _key)
  RETURNING version INTO cur;
  RETURN cur;
END $$;
REVOKE ALL ON FUNCTION public.direcao_set_risk_limits(text, numeric, numeric, text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_set_risk_limits(text, numeric, numeric, text, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_risk_limits_at(_school text)
RETURNS TABLE(version int, frequency_pct numeric, grade_cutoff numeric, reason text, set_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sdo_can_read(_school) THEN RAISE EXCEPTION 'risk:not-authorized'; END IF;
  RETURN QUERY SELECT r.version, r.frequency_pct, r.grade_cutoff, r.reason, r.set_at
  FROM public.school_risk_limits r WHERE r.school_id = _school ORDER BY r.version DESC LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.school_risk_limits_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_risk_limits_at(text) TO authenticated;