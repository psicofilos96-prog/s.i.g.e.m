CREATE TABLE public.lesson_resource_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_ref text NOT NULL,
  resources text[] NOT NULL DEFAULT '{}',
  other_text text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_resource_records_ref_idx ON public.lesson_resource_records (lesson_ref, recorded_at DESC);
GRANT SELECT, INSERT ON public.lesson_resource_records TO authenticated;
GRANT ALL ON public.lesson_resource_records TO service_role;
ALTER TABLE public.lesson_resource_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lrr read" ON public.lesson_resource_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "lrr insert own" ON public.lesson_resource_records FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());
COMMENT ON TABLE public.lesson_resource_records IS 'Recursos utilizados na aula: append-only; a última versão por aula vale.';