ALTER TABLE public.assessment_norm_versions DROP CONSTRAINT assessment_norm_versions_norm_kind_check;
ALTER TABLE public.assessment_norm_versions ADD CONSTRAINT assessment_norm_versions_norm_kind_check
  CHECK (norm_kind IN ('regra-avaliativa','configuracao-avaliativa','regra-de-situacao-academica'));
ALTER TABLE public.attendance_calculation_policies
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_until date;