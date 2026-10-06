-- BO.3: leitura em lote da listagem de turmas. Substitui 2×N chamadas RPC
-- (class_at + class_period_organization_at por turma) por uma única chamada.
-- Semântica idêntica: a ACL de cada turma é avaliada UMA vez com os mesmos
-- predicados das políticas RLS (registro: can_read_offer_organization;
-- vínculo: can_read_institutional_class), e a projeção temporal reutiliza
-- os readers canônicos class_at/class_period_organization_at, sem cópia de regra.
CREATE OR REPLACE FUNCTION public.classes_with_period_link_at(_valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(class_id text, school_id text, academic_year_id text, record jsonb, link jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF _valid_on IS NULL THEN RAISE EXCEPTION 'class:query-arguments-required'; END IF;
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH visible AS (
    SELECT c.id, c.school_id, c.academic_year_id,
           public.can_read_institutional_class(c.id, c.school_id) AS link_ok
      FROM public.institutional_classes c
     WHERE public.can_read_offer_organization(c.id)
  )
  SELECT v.id, v.school_id, v.academic_year_id,
    COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.class_at(v.id, _valid_on, _known_at) r), '[]'::jsonb),
    CASE WHEN v.link_ok
      THEN COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM public.class_period_organization_at(v.id, _valid_on, _known_at) l), '[]'::jsonb)
      ELSE '[]'::jsonb END
  FROM visible v;
END $$;
REVOKE ALL ON FUNCTION public.classes_with_period_link_at(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classes_with_period_link_at(date, timestamptz) TO authenticated;