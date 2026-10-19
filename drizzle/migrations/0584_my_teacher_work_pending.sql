CREATE OR REPLACE FUNCTION public.my_teacher_work_pending()
RETURNS TABLE(subject_kind text, em_analise int, ajuste_solicitado int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT DISTINCT subject_kind, subject_id FROM teacher_work_review_events
    WHERE event = 'enviado' AND actor_user_id = auth.uid()
  ), head AS (
    SELECT DISTINCT ON (e.subject_kind, e.subject_id) e.subject_kind, e.event
    FROM teacher_work_review_events e JOIN mine m USING (subject_kind, subject_id)
    ORDER BY e.subject_kind, e.subject_id, e.seq DESC
  )
  SELECT subject_kind,
         count(*) FILTER (WHERE event = 'enviado')::int,
         count(*) FILTER (WHERE event = 'ajuste-solicitado')::int
  FROM head WHERE auth.uid() IS NOT NULL GROUP BY subject_kind
$$;
REVOKE ALL ON FUNCTION public.my_teacher_work_pending() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_teacher_work_pending() TO authenticated;
COMMENT ON FUNCTION public.my_teacher_work_pending() IS 'Só contagens do próprio autor (planos e provas enviados à OP); nada de outras pessoas.';