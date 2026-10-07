-- N5.3b — nome do Livro: identidade cadastral versionada; sem versão, o nome de registro do estudante (cadastro pelo wizard).
-- Livro de Matrícula: projeção reproduzível das matrículas vigentes da escola/ano conhecidas até _known_at.
-- Sem número oficial (NUMERAÇÃO_OFICIAL_PENDENTE): a ordem é cronológica de registro e não é numeração jurídica.
CREATE OR REPLACE FUNCTION public.secretariat_enrollment_book_at(_school text, _year text, _known_at timestamptz)
RETURNS TABLE(entry_order integer, enrollment_id text, student_name text, institutional_number text, opened_on date,
  class_label text, situation text, ended_on date, end_reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE k timestamptz := coalesce(_known_at, pg_catalog.now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('consultar-matricula-e-movimentacao', _school) THEN RAISE EXCEPTION 'secretariat:not-authorized'; END IF;
  RETURN QUERY
  WITH en AS (
    SELECT e.* FROM public.school_enrollments e
     WHERE e.school_id = _school AND e.academic_year_id = _year AND e.created_at <= k
       AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND s.created_at <= k)
  )
  SELECT (row_number() OVER (ORDER BY en.opened_on NULLS LAST, en.created_at, en.id))::integer,
    en.id,
    coalesce((SELECT coalesce(nullif(v.social_name,''), v.civil_name) FROM public.student_identity_versions v
      WHERE v.student_id = en.student_id AND v.created_at <= k ORDER BY v.version DESC LIMIT 1),
      (SELECT s.display_name FROM public.institutional_students s WHERE s.id = en.student_id)),
    en.institutional_number, en.opened_on,
    (SELECT p.class_label_snapshot FROM public.class_enrollment_episodes p
      WHERE p.enrollment_id = en.id AND p.created_at <= k
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes q WHERE q.supersedes_id = p.id AND q.created_at <= k)
      ORDER BY p.valid_from DESC, p.created_at DESC LIMIT 1),
    CASE WHEN x.enrollment_id IS NULL THEN 'ativa' ELSE 'encerrada' END,
    x.ended_on, x.reason_text, en.created_at
  FROM en LEFT JOIN LATERAL (SELECT * FROM public.school_enrollment_endings z WHERE z.enrollment_id = en.id AND z.created_at <= k ORDER BY z.created_at DESC LIMIT 1) x ON true
  ORDER BY 1;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_enrollment_book_at(text, text, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_enrollment_book_at(text, text, timestamptz) TO authenticated;