CREATE OR REPLACE FUNCTION public.ndiary_guard_closed_plan_period() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.period_id IS NOT NULL AND NEW.assignment_id IS NOT NULL
     AND public.teacher_diary_closed(NEW.assignment_id::text, NEW.period_id::text) THEN
    RAISE EXCEPTION 'diary:period-closed';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ndiary_guard_closed_plan_period() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ndiary_guard_closed_plan_period BEFORE INSERT ON public.teaching_plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.ndiary_guard_closed_plan_period();