-- B4.2.1 — Fundação estrutural da homologação de versões de matriz (E1 do contrato B4.2.0).
-- Aditiva. B4.1/B4.1.1/B4.1.2 intactas. Nenhum writer: a competência de homologação (R5)
-- não está decidida, logo nenhuma função grava neste registro. Nenhum valor semeado.

CREATE TABLE public.curricular_matrix_version_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_versions(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.curricular_matrix_version_homologations(id),
  decision text NOT NULL CHECK (decision IN ('homologada','revogada')),
  effective_from date NOT NULL,
  homologation_act_ref text NOT NULL CHECK (btrim(homologation_act_ref) <> ''),
  reason text,
  exercised_capability_id text NOT NULL CHECK (exercised_capability_id ~ '^[a-z0-9][a-z0-9-]*$'),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (matrix_version_id, sequence),
  CHECK ((sequence = 1) = (supersedes_id IS NULL)),
  CHECK (sequence = 1 OR coalesce(btrim(reason),'') <> ''),
  CHECK (decision = 'homologada' OR coalesce(btrim(reason),'') <> '')
);
CREATE INDEX curricular_matrix_version_homologations_version_idx
  ON public.curricular_matrix_version_homologations(matrix_version_id);
COMMENT ON TABLE public.curricular_matrix_version_homologations IS
  'B4.2.1/E1: ledger append-only de homologação/revogação de versão de matriz. Sem writer até decisão R5 (competência de homologação).';

CREATE TRIGGER curricular_matrix_version_homologations_immutable
  BEFORE UPDATE OR DELETE ON public.curricular_matrix_version_homologations
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

GRANT SELECT ON public.curricular_matrix_version_homologations TO authenticated;
GRANT ALL ON public.curricular_matrix_version_homologations TO service_role;
REVOKE ALL ON public.curricular_matrix_version_homologations FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.curricular_matrix_version_homologations FROM authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.curricular_matrix_version_homologations FROM sandbox_exec;
  END IF;
END $acl$;
ALTER TABLE public.curricular_matrix_version_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matrix homologations readable by linked accounts"
  ON public.curricular_matrix_version_homologations FOR SELECT TO authenticated
  USING (public.current_person_id() IS NOT NULL);

-- Reader bitemporal: estado de homologação de cada versão de matriz vigente em _on, conforme conhecido em _known_at.
-- Estado: 'nao-homologada' (construída, sem registro efetivo), 'homologada', 'revogada'.
-- Registro com effective_from > _on não produz efeito em _on; registros criados após _known_at são ignorados.
CREATE FUNCTION public.curricular_matrix_homologation_state_at(_on date, _known_at timestamptz)
RETURNS TABLE(matrix_id text, version_id uuid, version integer, official_name text,
  homologation_state text, homologation_id uuid, homologation_sequence integer,
  effective_from date, homologation_act_ref text, exercised_capability_id text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'matrix-homologation:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'matrix-homologation:known-at-required'; END IF;
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

-- Histórico conhecido em _known_at de uma versão (auditoria; inclui registros com efeito futuro).
CREATE FUNCTION public.curricular_matrix_homologation_history(_version_id uuid, _known_at timestamptz)
RETURNS TABLE(homologation_id uuid, sequence integer, supersedes_id uuid, decision text, effective_from date,
  homologation_act_ref text, reason text, exercised_capability_id text, recorded_via_engagement_id uuid, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _version_id IS NULL THEN RAISE EXCEPTION 'matrix-homologation:version-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'matrix-homologation:known-at-required'; END IF;
  RETURN QUERY
  SELECT h.id, h.sequence, h.supersedes_id, h.decision, h.effective_from, h.homologation_act_ref, h.reason,
         h.exercised_capability_id, h.recorded_via_engagement_id, h.created_at
  FROM public.curricular_matrix_version_homologations h
  WHERE h.matrix_version_id = _version_id AND h.created_at <= _known_at
  ORDER BY h.sequence;
END $fn$;

REVOKE ALL ON FUNCTION public.curricular_matrix_homologation_state_at(date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.curricular_matrix_homologation_history(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curricular_matrix_homologation_state_at(date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.curricular_matrix_homologation_history(uuid, timestamptz) TO authenticated;
