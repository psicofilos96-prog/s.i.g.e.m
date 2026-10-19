CREATE OR REPLACE FUNCTION public.my_lessons_without_attendance(_days int DEFAULT 14)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM lesson_record_versions l
  WHERE auth.uid() IS NOT NULL AND l.author_person_id = public.current_person_id()
    AND l.diary_contract = 'w/1'
    AND l.lesson_date BETWEEN current_date - least(greatest(_days,1),60) AND current_date
    AND NOT EXISTS (SELECT 1 FROM lesson_record_versions s WHERE s.supersedes_version_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM attendance_record_versions a WHERE a.lesson_logical_id = l.logical_record_id)
$$;
REVOKE ALL ON FUNCTION public.my_lessons_without_attendance(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_lessons_without_attendance(int) TO authenticated;
COMMENT ON FUNCTION public.my_lessons_without_attendance(int) IS 'Contagem das aulas registradas pela própria pessoa, sem chamada, na janela recente (máx. 60 dias). Sem chamada = não registrada, nunca presença.';