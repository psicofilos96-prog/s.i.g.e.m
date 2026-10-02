REVOKE EXECUTE ON FUNCTION public.current_person_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_person_id() TO authenticated;