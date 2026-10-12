-- Titular consulta o próprio histórico sem precisar conhecer seu ID técnico.
CREATE OR REPLACE FUNCTION public.dev_my_formation_record()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.current_person_id() IS NULL THEN NULL ELSE public.dev_formation_record(public.current_person_id(), NULL) END
$$;
REVOKE EXECUTE ON FUNCTION public.dev_my_formation_record() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_my_formation_record() TO authenticated;