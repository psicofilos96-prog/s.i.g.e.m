-- LOTE 13: campos da Relação de alunos 2026 ainda não persistidos (sem PII de identidade):
-- atendimento, AEE e transporte, como observação censitária por vínculo, append-only, com proveniência.
CREATE TABLE public.student_bond_census_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bond_observation_id uuid NOT NULL REFERENCES public.student_class_bond_observations(id),
  field text NOT NULL CHECK (field IN ('tipo-atendimento','recebe-aee','transporte-escolar')),
  value_text text NOT NULL CHECK (length(btrim(value_text)) > 0),
  source_hash text NOT NULL,
  source_ref text NOT NULL,
  source_locator text NOT NULL,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bond_observation_id, field)
);
GRANT SELECT ON public.student_bond_census_attributes TO authenticated;
GRANT ALL ON public.student_bond_census_attributes TO service_role;
ALTER TABLE public.student_bond_census_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "segue a leitura do vínculo observado" ON public.student_bond_census_attributes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_class_bond_observations o WHERE o.id = bond_observation_id));
CREATE TRIGGER student_bond_census_attributes_ao BEFORE UPDATE OR DELETE ON public.student_bond_census_attributes
  FOR EACH ROW EXECUTE FUNCTION public.identity_link_append_only();
COMMENT ON TABLE public.student_bond_census_attributes IS 'LOTE 13: observação censitária 2026 por vínculo; não é fato oficial nem cadastro do estudante.';