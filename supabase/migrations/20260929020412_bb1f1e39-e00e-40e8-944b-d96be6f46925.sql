CREATE TABLE public.institutional_students (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  institutional_identifier text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.school_enrollments (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL,
  opened_on date NOT NULL,
  originating_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.class_enrollment_episodes (
  id text PRIMARY KEY,
  enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL,
  class_id text NOT NULL,
  class_label_snapshot text NOT NULL,
  cycle_id text,
  valid_from date NOT NULL,
  originating_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.class_enrollment_episode_endings (
  episode_id text PRIMARY KEY REFERENCES public.class_enrollment_episodes(id),
  ended_on date NOT NULL,
  reason_label text,
  originating_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.institutional_students, public.school_enrollments, public.class_enrollment_episodes, public.class_enrollment_episode_endings TO authenticated;
GRANT ALL ON public.institutional_students, public.school_enrollments, public.class_enrollment_episodes, public.class_enrollment_episode_endings TO service_role;

ALTER TABLE public.institutional_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollment_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollment_episode_endings ENABLE ROW LEVEL SECURITY;

-- Imutabilidade: correção/encerramento é fato novo.
CREATE TRIGGER immutable_students BEFORE UPDATE OR DELETE ON public.institutional_students FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_enrollments BEFORE UPDATE OR DELETE ON public.school_enrollments FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_episodes BEFORE UPDATE OR DELETE ON public.class_enrollment_episodes FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_episode_endings BEFORE UPDATE OR DELETE ON public.class_enrollment_episode_endings FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Coerência: vínculo pertence à mesma escola/estudante da matrícula; sem sobreposição na mesma turma.
CREATE OR REPLACE FUNCTION public.guard_class_enrollment_episode() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM school_enrollments e WHERE e.id = NEW.enrollment_id AND e.student_id = NEW.student_id AND e.school_id = NEW.school_id) THEN
    RAISE EXCEPTION 'Vínculo não corresponde à matrícula (estudante/escola)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM class_enrollment_episodes o
    LEFT JOIN class_enrollment_episode_endings x ON x.episode_id = o.id
    WHERE o.student_id = NEW.student_id AND o.class_id = NEW.class_id
      AND (x.ended_on IS NULL OR x.ended_on >= NEW.valid_from)
  ) THEN
    RAISE EXCEPTION 'Sobreposição de vigência do estudante na mesma turma';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_episode BEFORE INSERT ON public.class_enrollment_episodes FOR EACH ROW EXECUTE FUNCTION public.guard_class_enrollment_episode();

CREATE OR REPLACE FUNCTION public.guard_episode_ending() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ended_on < (SELECT valid_from FROM class_enrollment_episodes WHERE id = NEW.episode_id) THEN
    RAISE EXCEPTION 'Término anterior ao início da vigência';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ending BEFORE INSERT ON public.class_enrollment_episode_endings FOR EACH ROW EXECUTE FUNCTION public.guard_episode_ending();

CREATE OR REPLACE FUNCTION public.can_read_class_roster(_class text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.effective_capabilities(current_date) c
    WHERE c.capability_id = 'consultar-estudantes-da-turma' AND (c.class_id IS NULL OR c.class_id = _class))
$$;

CREATE POLICY "roster episodes by capability" ON public.class_enrollment_episodes FOR SELECT TO authenticated
  USING (public.can_read_class_roster(class_id));
CREATE POLICY "roster endings by capability" ON public.class_enrollment_episode_endings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.id = episode_id AND public.can_read_class_roster(e.class_id)));
CREATE POLICY "enrollments via readable episode" ON public.school_enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.enrollment_id = id AND public.can_read_class_roster(e.class_id)));
CREATE POLICY "students via readable episode" ON public.institutional_students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.student_id = id AND public.can_read_class_roster(e.class_id)));