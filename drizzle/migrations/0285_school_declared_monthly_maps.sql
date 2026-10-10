CREATE TABLE public.school_declared_monthly_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  inep_declared text,
  year integer NOT NULL CHECK (year = 2026),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  source_file text NOT NULL,
  source_sheet text NOT NULL,
  file_sha256 text NOT NULL,
  previous_month_enrollment integer,
  transfers_in integer,
  new_students integer,
  transfers_out integer,
  dropouts integer,
  withdrawn_cancelled integer,
  total_ii integer,
  declared_classes integer,
  total_iii integer,
  shifts jsonb NOT NULL DEFAULT '{}'::jsonb,
  classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  consistency_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  originating_act_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_sha256, source_sheet)
);
COMMENT ON TABLE public.school_declared_monthly_maps IS 'Mapa Estatístico mensal declarado pela escola (planilha). Append-only; sem nomes de alunos (Estrutura IV não importada). Declaração não é apuração do SIGEM.';
GRANT SELECT ON public.school_declared_monthly_maps TO authenticated;
GRANT ALL ON public.school_declared_monthly_maps TO service_role;
ALTER TABLE public.school_declared_monthly_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "declared maps readable by school scope" ON public.school_declared_monthly_maps
  FOR SELECT TO authenticated
  USING (school_id IN (SELECT c.school_id FROM public.institutional_classes c));
CREATE INDEX school_declared_monthly_maps_school_month ON public.school_declared_monthly_maps (school_id, year, month);