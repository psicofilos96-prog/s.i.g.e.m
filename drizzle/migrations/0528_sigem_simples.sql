
CREATE TABLE public.sg_schools (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  inep text,
  address text,
  district text,
  zone text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
CREATE TABLE public.sg_classes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  school_id text REFERENCES public.sg_schools(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage text,
  shift text,
  year int NOT NULL DEFAULT 2026,
  teacher_id text,
  capacity int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
CREATE TABLE public.sg_students (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  birth_date date,
  sex text,
  race text,
  special_needs text,
  mother_name text,
  father_name text,
  guardian_name text,
  phone text,
  address text,
  school_id text REFERENCES public.sg_schools(id) ON DELETE SET NULL,
  class_id text REFERENCES public.sg_classes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
CREATE TABLE public.sg_staff (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  registration text,
  role text,
  function text,
  bond text,
  status text DEFAULT 'Em atividade',
  phone text,
  school_id text REFERENCES public.sg_schools(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
ALTER TABLE public.sg_classes ADD CONSTRAINT sg_classes_teacher_fk FOREIGN KEY (teacher_id) REFERENCES public.sg_staff(id) ON DELETE SET NULL;
CREATE TABLE public.sg_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.sg_students(id) ON DELETE CASCADE,
  class_id text REFERENCES public.sg_classes(id) ON DELETE SET NULL,
  day date NOT NULL,
  present boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  UNIQUE (student_id, day)
);
CREATE INDEX sg_students_school_idx ON public.sg_students(school_id);
CREATE INDEX sg_students_class_idx ON public.sg_students(class_id);
CREATE INDEX sg_classes_school_idx ON public.sg_classes(school_id);
CREATE INDEX sg_staff_school_idx ON public.sg_staff(school_id);
CREATE INDEX sg_attendance_day_idx ON public.sg_attendance(day);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['sg_schools','sg_classes','sg_students','sg_staff','sg_attendance'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "logados usam" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Carga inicial a partir dos cadastros já existentes
INSERT INTO public.sg_schools (id, name, address, district, zone, phone, email, inep)
SELECT DISTINCT ON (v.school_id) v.school_id, v.official_name, v.address, v.district, v.location_kind, v.phone, v.institutional_email,
  CASE WHEN v.school_id LIKE 'inep-%' THEN substr(v.school_id, 6) END
FROM public.institutional_school_record_versions v
ORDER BY v.school_id, v.version_number DESC;

INSERT INTO public.sg_classes (id, school_id, name, stage, year)
SELECT c.id, CASE WHEN EXISTS (SELECT 1 FROM public.sg_schools s WHERE s.id = c.school_id) THEN c.school_id END,
  coalesce(c.name, c.code, 'Turma'), c.stage_label_snapshot,
  coalesce(nullif(regexp_replace(coalesce(c.academic_year_label,''), '\D', '', 'g'), '')::int, 2026)
FROM public.institutional_classes c;

INSERT INTO public.sg_staff (id, name, registration, role, function, bond, status, school_id)
SELECT r.id::text, r.full_name, r.registration, r.cargo, r.funcao, r.vinculo, coalesce(r.situacao, 'Em atividade'),
  CASE WHEN EXISTS (SELECT 1 FROM public.sg_schools s WHERE s.id = r.school_id) THEN r.school_id END
FROM public.staff_administrative_records r WHERE r.full_name IS NOT NULL;

INSERT INTO public.sg_students (id, name, birth_date, sex, race, special_needs, mother_name, father_name, guardian_name, phone, school_id, class_id, status)
SELECT DISTINCT ON (o.student_id) o.student_id, o.civil_name, o.birth_date, o.sex_literal, o.race_literal, o.nee_literal, o.mother_name, o.father_name, o.guardian_name,
  array_to_string(o.phones, ' / '),
  (SELECT b.school_id FROM public.student_class_bond_observations b WHERE b.student_id = o.student_id AND EXISTS (SELECT 1 FROM public.sg_schools s WHERE s.id=b.school_id) ORDER BY b.valid_from DESC NULLS LAST LIMIT 1),
  (SELECT b.class_id FROM public.student_class_bond_observations b WHERE b.student_id = o.student_id AND EXISTS (SELECT 1 FROM public.sg_classes k WHERE k.id=b.class_id) ORDER BY b.valid_from DESC NULLS LAST LIMIT 1),
  coalesce(o.enrollment_status_literal, 'Ativo')
FROM public.student_registration_observations o
WHERE o.student_id IS NOT NULL AND o.civil_name IS NOT NULL
ORDER BY o.student_id, o.recorded_at DESC;
