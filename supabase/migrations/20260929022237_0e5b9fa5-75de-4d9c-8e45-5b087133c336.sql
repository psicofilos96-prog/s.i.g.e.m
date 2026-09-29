ALTER TABLE public.institutional_classes ADD COLUMN modality_id text;
ALTER TABLE public.institutional_classes ADD COLUMN modality_label_snapshot text;
ALTER TABLE public.institutional_classes ADD COLUMN stage_label_snapshot text;

CREATE TABLE public.institutional_class_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  component_id text REFERENCES public.institutional_curricular_components(id),
  engagement_id uuid REFERENCES public.institutional_engagements(id),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
GRANT SELECT ON public.institutional_class_schedule_slots TO authenticated;
GRANT ALL ON public.institutional_class_schedule_slots TO service_role;
ALTER TABLE public.institutional_class_schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule by own engagement" ON public.institutional_class_schedule_slots
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.institutional_classes c
            WHERE c.id = class_id AND public.can_read_institutional_class(c.id, c.school_id)));
CREATE TRIGGER institutional_schedule_immutable BEFORE UPDATE OR DELETE ON public.institutional_class_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Correção: as políticas comparavam colunas do próprio episódio, nunca liberando leitura.
DROP POLICY "students via readable episode" ON public.institutional_students;
CREATE POLICY "students via readable episode" ON public.institutional_students
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes e
    WHERE e.student_id = institutional_students.id AND public.can_read_class_roster(e.class_id)));
DROP POLICY "enrollments via readable episode" ON public.school_enrollments;
CREATE POLICY "enrollments via readable episode" ON public.school_enrollments
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes e
    WHERE e.enrollment_id = school_enrollments.id AND public.can_read_class_roster(e.class_id)));