REVOKE EXECUTE ON FUNCTION public.can_read_class_roster(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_class_roster(text) TO authenticated;