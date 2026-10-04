-- B1.4 follow-up: class writers are authenticated application entry points only.
-- The Cloud was hardened after 0057; keep the repository migration chain append-only.
REVOKE EXECUTE ON FUNCTION public.register_institutional_class(text,text,text,text,text,date,date,text)
  FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_institutional_class(text,text,text,text,text,date,date,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)
  TO authenticated;
