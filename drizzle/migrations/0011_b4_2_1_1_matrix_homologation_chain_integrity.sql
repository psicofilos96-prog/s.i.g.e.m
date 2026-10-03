-- B4.2.1.1 — Integridade da cadeia de homologação: predecessor da MESMA versão de matriz e sequence = predecessor + 1.
-- Aditiva. Sem writer de homologação. Reader passa a falhar fechado diante de cadeia inválida (legado/escrita privilegiada).

CREATE FUNCTION public.guard_matrix_homologation_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _pred public.curricular_matrix_version_homologations%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.sequence <> 1 THEN RAISE EXCEPTION 'matrix-homologation:root-must-be-sequence-1'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO _pred FROM public.curricular_matrix_version_homologations WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'matrix-homologation:predecessor-missing'; END IF;
  IF _pred.matrix_version_id <> NEW.matrix_version_id THEN
    RAISE EXCEPTION 'matrix-homologation:predecessor-other-version';
  END IF;
  IF NEW.sequence <> _pred.sequence + 1 THEN
    RAISE EXCEPTION 'matrix-homologation:sequence-gap';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_matrix_homologation_chain() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER curricular_matrix_version_homologations_chain
  BEFORE INSERT ON public.curricular_matrix_version_homologations
  FOR EACH ROW EXECUTE FUNCTION public.guard_matrix_homologation_chain();

-- Reader: mesma assinatura; verifica a cadeia conhecida antes de escolher o estado.
CREATE OR REPLACE FUNCTION public.curricular_matrix_homologation_state_at(_on date, _known_at timestamptz)
RETURNS TABLE(matrix_id text, version_id uuid, version integer, official_name text,
  homologation_state text, homologation_id uuid, homologation_sequence integer,
  effective_from date, homologation_act_ref text, exercised_capability_id text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'matrix-homologation:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'matrix-homologation:known-at-required'; END IF;
  IF EXISTS (
    WITH m AS (SELECT * FROM public.curricular_matrices_at(_on, _known_at)),
    k AS (SELECT h.* FROM public.curricular_matrix_version_homologations h
          JOIN m ON m.version_id = h.matrix_version_id WHERE h.created_at <= _known_at)
    SELECT 1 FROM k
    LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.sequence <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.matrix_version_id <> k.matrix_version_id OR k.sequence <> p.sequence + 1))
    UNION ALL
    SELECT 1 FROM k GROUP BY k.matrix_version_id, k.sequence HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'matrix-homologation:ambiguous-chain';
  END IF;
  RETURN QUERY
  WITH m AS (SELECT * FROM public.curricular_matrices_at(_on, _known_at)),
  known AS (
    SELECT h.* FROM public.curricular_matrix_version_homologations h
    WHERE h.created_at <= _known_at AND h.effective_from <= _on
  ), head AS (
    SELECT DISTINCT ON (k.matrix_version_id) k.* FROM known k
    ORDER BY k.matrix_version_id, k.sequence DESC
  )
  SELECT m.matrix_id, m.version_id, m.version, m.official_name,
    CASE WHEN hd.id IS NULL THEN 'nao-homologada' ELSE hd.decision END,
    hd.id, hd.sequence, hd.effective_from, hd.homologation_act_ref, hd.exercised_capability_id, hd.created_at
  FROM m LEFT JOIN head hd ON hd.matrix_version_id = m.version_id
  ORDER BY m.official_name, m.matrix_id;
END $fn$;
REVOKE ALL ON FUNCTION public.curricular_matrix_homologation_state_at(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curricular_matrix_homologation_state_at(date, timestamptz) TO authenticated;
