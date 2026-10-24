-- Legacy spreadsheet copies are archival, never a parallel operational registry.
-- Preserve every row and the capability-checked SECURITY DEFINER lookup (0530).
-- Direct Data API access must not bypass the canonical school/capability scope.
REVOKE ALL PRIVILEGES ON TABLE
  public.sg_schools, public.sg_classes, public.sg_students,
  public.sg_staff, public.sg_attendance
FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "logados usam" ON public.sg_schools;
DROP POLICY IF EXISTS "logados usam" ON public.sg_classes;
DROP POLICY IF EXISTS "logados usam" ON public.sg_students;
DROP POLICY IF EXISTS "logados usam" ON public.sg_staff;
DROP POLICY IF EXISTS "logados usam" ON public.sg_attendance;
