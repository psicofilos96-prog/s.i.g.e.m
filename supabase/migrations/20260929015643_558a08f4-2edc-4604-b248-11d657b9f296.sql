CREATE TABLE public.attendance_calculation_policies (
  id text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  definition jsonb NOT NULL,
  homologated_at timestamptz,
  homologation_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
GRANT SELECT ON public.attendance_calculation_policies TO authenticated;
GRANT ALL ON public.attendance_calculation_policies TO service_role;
ALTER TABLE public.attendance_calculation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read homologated attendance policies" ON public.attendance_calculation_policies FOR SELECT TO authenticated USING (status = 'homologada');
CREATE TRIGGER attendance_calculation_policies_guard BEFORE UPDATE OR DELETE ON public.attendance_calculation_policies
  FOR EACH ROW EXECUTE FUNCTION public.guard_homologated_row();

CREATE OR REPLACE FUNCTION public.require_homologated_attendance_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.attendance_calculation_policies p
     WHERE p.id = NEW.record->>'policyId' AND p.version::text = NEW.record->>'policyVersion' AND p.status = 'homologada')
  THEN RAISE EXCEPTION 'policy-not-homologated'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_closing_requires_policy BEFORE INSERT ON public.attendance_closing_versions
  FOR EACH ROW EXECUTE FUNCTION public.require_homologated_attendance_policy();