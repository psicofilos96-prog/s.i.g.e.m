CREATE OR REPLACE FUNCTION public.diary_justified_in_class(_class text, _students text[], _on date)
RETURNS TABLE(student_id text, doc_kind text, starts_on date, ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT j.* FROM public.institutional_classes c, LATERAL public.diary_justified_students(c.school_id, _students, _on) j WHERE c.id=_class
$$;
REVOKE ALL ON FUNCTION public.diary_justified_in_class(text,text[],date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.diary_justified_in_class(text,text[],date) TO authenticated;