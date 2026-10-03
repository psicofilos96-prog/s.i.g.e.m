-- B4.2.3 — Estrutura versionada E4: associação explícita específica da TURMA → matriz lógica B4.1 [+ coluna opcional].
-- Aditiva. Sem writer (nem rascunho nem homologação): competência de construção E4 e de homologação (R5) não decididas.
-- Não infere E4 de natureza/AEE/complementar; não exige posição B3.3 nem correspondência E3; não avalia portão E2 nem aplicabilidade (B4.2.4).
-- column_key opcional; quando informado, validado só na resolução contra a versão vigente da matriz.

CREATE TABLE public.class_specific_matrix_associations (
  id text PRIMARY KEY CHECK (id ~ '^csa-[0-9a-f-]+$'),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.class_specific_matrix_association_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id text NOT NULL REFERENCES public.class_specific_matrix_associations(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.class_specific_matrix_association_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date,
  target_matrix_id text NOT NULL REFERENCES public.institutional_curricular_matrices(id),
  target_column_key text CHECK (target_column_key IS NULL OR target_column_key ~ '^[a-z0-9][a-z0-9-]*$'),
  specific_act_ref text NOT NULL CHECK (btrim(specific_act_ref) <> ''),
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (association_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((version = 1) = (change_kind = 'constituicao')),
  CHECK (version = 1 OR coalesce(btrim(change_reason),'') <> ''),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.class_specific_matrix_association_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_version_id uuid NOT NULL REFERENCES public.class_specific_matrix_association_versions(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.class_specific_matrix_association_homologations(id),
  decision text NOT NULL CHECK (decision IN ('homologada','revogada')),
  effective_from date NOT NULL,
  homologation_act_ref text NOT NULL CHECK (btrim(homologation_act_ref) <> ''),
  reason text,
  exercised_capability_id text NOT NULL CHECK (exercised_capability_id ~ '^[a-z0-9][a-z0-9-]*$'),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (association_version_id, sequence),
  CHECK ((sequence = 1) = (supersedes_id IS NULL)),
  CHECK (sequence = 1 OR coalesce(btrim(reason),'') <> ''),
  CHECK (decision = 'homologada' OR coalesce(btrim(reason),'') <> '')
);

CREATE FUNCTION public.guard_class_specific_association_version_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.class_specific_matrix_association_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 THEN RAISE EXCEPTION 'association:root-must-be-version-1'; END IF; RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.class_specific_matrix_association_versions WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'association:predecessor-missing'; END IF;
  IF _p.association_id <> NEW.association_id THEN RAISE EXCEPTION 'association:predecessor-other-association'; END IF;
  IF NEW.version <> _p.version + 1 THEN RAISE EXCEPTION 'association:version-gap'; END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION public.guard_class_specific_association_homologation_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.class_specific_matrix_association_homologations%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.sequence <> 1 THEN RAISE EXCEPTION 'association-homologation:root-must-be-sequence-1'; END IF; RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.class_specific_matrix_association_homologations WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'association-homologation:predecessor-missing'; END IF;
  IF _p.association_version_id <> NEW.association_version_id THEN RAISE EXCEPTION 'association-homologation:predecessor-other-version'; END IF;
  IF NEW.sequence <> _p.sequence + 1 THEN RAISE EXCEPTION 'association-homologation:sequence-gap'; END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_specific_association_version_chain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_class_specific_association_homologation_chain() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER csa_versions_chain BEFORE INSERT ON public.class_specific_matrix_association_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_specific_association_version_chain();
CREATE TRIGGER csa_homologations_chain BEFORE INSERT ON public.class_specific_matrix_association_homologations
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_specific_association_homologation_chain();

CREATE TRIGGER csa_immutable BEFORE UPDATE OR DELETE ON public.class_specific_matrix_associations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER csa_versions_immutable BEFORE UPDATE OR DELETE ON public.class_specific_matrix_association_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER csa_homologations_immutable BEFORE UPDATE OR DELETE ON public.class_specific_matrix_association_homologations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

GRANT SELECT ON public.class_specific_matrix_associations, public.class_specific_matrix_association_versions,
  public.class_specific_matrix_association_homologations TO authenticated;
GRANT ALL ON public.class_specific_matrix_associations, public.class_specific_matrix_association_versions,
  public.class_specific_matrix_association_homologations TO service_role;
REVOKE ALL ON public.class_specific_matrix_associations, public.class_specific_matrix_association_versions,
  public.class_specific_matrix_association_homologations FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.class_specific_matrix_associations,
  public.class_specific_matrix_association_versions,
  public.class_specific_matrix_association_homologations FROM authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.class_specific_matrix_associations,
      public.class_specific_matrix_association_versions,
      public.class_specific_matrix_association_homologations FROM sandbox_exec;
  END IF;
END $acl$;

ALTER TABLE public.class_specific_matrix_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_specific_matrix_association_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_specific_matrix_association_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csa readable by linked accounts" ON public.class_specific_matrix_associations FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "csa versions readable by linked accounts" ON public.class_specific_matrix_association_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "csa homologations readable by linked accounts" ON public.class_specific_matrix_association_homologations FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);

-- Reader bitemporal: versão vigente de cada associação (rascunho ou homologada) em _on conforme _known_at.
-- Retificação conhecida oculta a retificada (sem herdar homologação); sucessão encerra a anterior na véspera.
-- Cadeia inválida ou >1 versão vigente da mesma associação ⇒ exceção.
CREATE FUNCTION public.class_specific_matrix_associations_at(_on date, _known_at timestamptz)
RETURNS TABLE(association_id text, class_id text, version_id uuid, version integer, change_kind text,
  valid_from date, effective_until date, specific_act_ref text, target_matrix_id text, target_column_key text,
  homologation_state text, homologation_id uuid, homologation_act_ref text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'association:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'association:known-at-required'; END IF;
  IF EXISTS (
    WITH k AS (SELECT v.* FROM public.class_specific_matrix_association_versions v WHERE v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.association_id <> k.association_id OR k.version <> p.version + 1))
  ) OR EXISTS (
    WITH k AS (SELECT h.* FROM public.class_specific_matrix_association_homologations h WHERE h.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.sequence <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.association_version_id <> k.association_version_id OR k.sequence <> p.sequence + 1))
  ) THEN RAISE EXCEPTION 'association:ambiguous-chain'; END IF;

  IF EXISTS (
    WITH known AS (SELECT v.* FROM public.class_specific_matrix_association_versions v WHERE v.created_at <= _known_at),
    eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
    win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.association_id = e.association_id AND e2.version > e.version)) AS eu FROM eff e)
    SELECT 1 FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR _on <= w.eu) GROUP BY w.association_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'association:ambiguous-temporal-state'; END IF;

  RETURN QUERY
  WITH known AS (SELECT v.* FROM public.class_specific_matrix_association_versions v WHERE v.created_at <= _known_at),
  eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
  win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.association_id = e.association_id AND e2.version > e.version)) AS eu FROM eff e),
  hit AS (SELECT w.* FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR _on <= w.eu)),
  hk AS (SELECT h.* FROM public.class_specific_matrix_association_homologations h WHERE h.created_at <= _known_at AND h.effective_from <= _on),
  head AS (SELECT DISTINCT ON (x.association_version_id) x.* FROM hk x ORDER BY x.association_version_id, x.sequence DESC)
  SELECT h.association_id, c.class_id, h.id, h.version, h.change_kind, h.valid_from, h.eu, h.specific_act_ref,
    h.target_matrix_id, h.target_column_key,
    CASE WHEN hd.id IS NULL THEN 'nao-homologada' ELSE hd.decision END, hd.id, hd.homologation_act_ref, h.created_at
  FROM hit h JOIN public.class_specific_matrix_associations c ON c.id = h.association_id
  LEFT JOIN head hd ON hd.association_version_id = h.id
  ORDER BY h.association_id;
END $fn$;

-- Resolver estrutural por turma/data: só associações HOMOLOGADAS; zero ⇒ ausência; >1 ⇒ exceção.
-- Exige matriz com versão vigente homologada (E1); coluna validada só se informada.
CREATE FUNCTION public.resolve_class_specific_matrix_association_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(association_id text, version_id uuid, homologation_id uuid, target_matrix_id text, target_column_key text,
  matrix_version_id uuid, matrix_homologation_id uuid, association_state text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _class_id IS NULL THEN RAISE EXCEPTION 'association:class-required'; END IF;
  RETURN QUERY
  WITH hits AS (
    SELECT a.* FROM public.class_specific_matrix_associations_at(_on, _known_at) a
    WHERE a.class_id = _class_id AND a.homologation_state = 'homologada'),
  guard AS (SELECT CASE WHEN count(*) > 1 THEN public.b41_raise('association:ambiguous-homologated') END AS g FROM hits)
  SELECT h.association_id, h.version_id, h.homologation_id, h.target_matrix_id, h.target_column_key, m.version_id,
    CASE WHEN mh.homologation_state = 'homologada' THEN mh.homologation_id END,
    CASE WHEN m.version_id IS NULL THEN 'bloqueada:matriz-sem-versao-vigente'
         WHEN mh.homologation_state IS DISTINCT FROM 'homologada' THEN 'bloqueada:matriz-nao-homologada'
         WHEN h.target_column_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.curricular_matrix_layout_columns lc
              WHERE lc.matrix_version_id = m.version_id AND lc.column_key = h.target_column_key) THEN 'bloqueada:elemento-da-fonte-inexistente'
         ELSE 'vinculo-especifico-vigente' END
  FROM hits h CROSS JOIN guard
  LEFT JOIN public.curricular_matrices_at(_on, _known_at) m ON m.matrix_id = h.target_matrix_id
  LEFT JOIN public.curricular_matrix_homologation_state_at(_on, _known_at) mh ON mh.version_id = m.version_id
  WHERE guard.g IS NULL;
END $fn$;

REVOKE ALL ON FUNCTION public.class_specific_matrix_associations_at(date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_class_specific_matrix_association_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_specific_matrix_associations_at(date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_class_specific_matrix_association_at(text, date, timestamptz) TO authenticated;