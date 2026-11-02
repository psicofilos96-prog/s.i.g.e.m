-- Busca administrativa de movimentações, estritamente dentro do vínculo escolar da escola autorizada.
-- CPF/INEP exatos são resolvidos pelo leitor existente, com guarda de tentativas e auditoria.
-- Não há retorno de CPF; nascimento só participa do filtro, nunca é divulgado pela resposta.
CREATE OR REPLACE FUNCTION public.secretariat_movement_search(
  _school text, _name text DEFAULT NULL, _cpf text DEFAULT NULL,
  _birth date DEFAULT NULL, _inep text DEFAULT NULL
)
RETURNS TABLE(student_id text, display_name text, census_inep text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  wanted_name text := NULLIF(pg_catalog.btrim(coalesce(_name,'')), '');
  wanted_cpf text := NULLIF(pg_catalog.btrim(coalesce(_cpf,'')), '');
  wanted_inep text := NULLIF(pg_catalog.btrim(coalesce(_inep,'')), '');
  exact_student text := NULL;
  lookup record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF coalesce(pg_catalog.btrim(_school),'') = '' THEN RAISE EXCEPTION 'secretariat:scope-required'; END IF;
  IF NOT (
    public.has_school_capability('consultar-matricula-e-movimentacao', _school)
    OR public.has_school_capability('manter-matricula-e-enturmacao', _school)
    OR public.has_school_capability('registrar-movimentacao-escolar', _school)
  ) THEN RAISE EXCEPTION 'capability:consultar-matricula-e-movimentacao'; END IF;
  IF wanted_name IS NULL AND wanted_cpf IS NULL AND wanted_inep IS NULL AND _birth IS NULL
    THEN RAISE EXCEPTION 'secretariat:search-required'; END IF;
  IF wanted_name IS NOT NULL AND pg_catalog.char_length(wanted_name) < 3
    THEN RAISE EXCEPTION 'secretariat:name-too-short'; END IF;
  IF _birth > CURRENT_DATE THEN RAISE EXCEPTION 'secretariat:invalid-birth-date'; END IF;

  IF wanted_cpf IS NOT NULL THEN
    SELECT * INTO lookup FROM public.locate_student_exact(_school,'cpf',wanted_cpf,NULL);
    IF lookup.outcome IS DISTINCT FROM 'encontrado' OR lookup.student_id IS NULL THEN RETURN; END IF;
    exact_student := lookup.student_id;
  END IF;
  IF wanted_inep IS NOT NULL THEN
    SELECT * INTO lookup FROM public.locate_student_exact(_school,'inep',wanted_inep,NULL);
    IF lookup.outcome IS DISTINCT FROM 'encontrado' OR lookup.student_id IS NULL THEN RETURN; END IF;
    IF exact_student IS NOT NULL AND exact_student <> lookup.student_id THEN RETURN; END IF;
    exact_student := lookup.student_id;
  END IF;

  RETURN QUERY
  SELECT s.id, s.display_name,
    (SELECT CASE WHEN count(DISTINCT pi.value) = 1 THEN min(pi.value) ELSE NULL END
     FROM public.institutional_student_persons sp
     JOIN public.institutional_person_identifiers pi ON pi.person_id = sp.person_id
     WHERE sp.student_id = s.id AND pi.identifier_kind = 'inep-pessoa')
  FROM public.institutional_students s
  LEFT JOIN LATERAL (
    SELECT v.birth_date FROM public.student_identity_versions v
    WHERE v.student_id = s.id ORDER BY v.version DESC LIMIT 1
  ) identity_on ON true
  LEFT JOIN LATERAL (
    SELECT o.birth_date FROM public.student_registration_observations o
    WHERE o.student_id = s.id AND o.birth_date IS NOT NULL
    ORDER BY o.known_at DESC LIMIT 1
  ) observed_on ON true
  WHERE EXISTS (
    SELECT 1 FROM public.school_enrollments e
    WHERE e.student_id = s.id AND e.school_id = _school
  )
    AND (exact_student IS NULL OR s.id = exact_student)
    AND (wanted_name IS NULL OR pg_catalog.strpos(pg_catalog.lower(s.display_name),pg_catalog.lower(wanted_name)) > 0)
    AND (_birth IS NULL OR coalesce(identity_on.birth_date, observed_on.birth_date) = _birth)
  ORDER BY s.display_name, s.id LIMIT 50;
END $fn$;
REVOKE ALL ON FUNCTION public.secretariat_movement_search(text,text,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_movement_search(text,text,text,date,text) TO authenticated;
