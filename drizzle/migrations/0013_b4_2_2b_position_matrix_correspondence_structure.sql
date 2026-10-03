-- B4.2.2b — Estrutura versionada E3: correspondência chave de posição individual → matriz lógica + coluna.
-- Aditiva. Sem writer (nem rascunho nem homologação): competências de construção E3 e de homologação (R5) não decididas.
-- Nenhum esquema/valor semeado; o motor não conhece nomes de esquema, valor, etapa nem semântica E/OU.
-- A coluna NÃO é validada no registro; é validada na resolução contra a versão vigente da matriz.

CREATE TABLE public.curricular_position_matrix_correspondences (
  id text PRIMARY KEY CHECK (id ~ '^cpm-[0-9a-f-]+$'),
  profile_id text NOT NULL REFERENCES public.curricular_correspondence_profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.curricular_position_matrix_correspondence_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id text NOT NULL REFERENCES public.curricular_position_matrix_correspondences(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.curricular_position_matrix_correspondence_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date,
  target_matrix_id text NOT NULL REFERENCES public.institutional_curricular_matrices(id),
  target_column_key text NOT NULL CHECK (target_column_key ~ '^[a-z0-9][a-z0-9-]*$'),
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (correspondence_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((version = 1) = (change_kind = 'constituicao')),
  CHECK (version = 1 OR coalesce(btrim(change_reason),'') <> ''),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Chave: um valor (versionado) por esquema; completude contra E2a é verificada na resolução.
CREATE TABLE public.curricular_position_matrix_correspondence_keys (
  correspondence_version_id uuid NOT NULL REFERENCES public.curricular_position_matrix_correspondence_versions(id),
  scheme_id text NOT NULL CHECK (scheme_id ~ '^[a-z0-9][a-z0-9-]*$'),
  value_id text NOT NULL CHECK (value_id ~ '^[a-z0-9][a-z0-9-]*$'),
  value_version integer NOT NULL CHECK (value_version >= 1),
  PRIMARY KEY (correspondence_version_id, scheme_id)
);

CREATE TABLE public.curricular_position_matrix_correspondence_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_version_id uuid NOT NULL REFERENCES public.curricular_position_matrix_correspondence_versions(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.curricular_position_matrix_correspondence_homologations(id),
  decision text NOT NULL CHECK (decision IN ('homologada','revogada')),
  effective_from date NOT NULL,
  homologation_act_ref text NOT NULL CHECK (btrim(homologation_act_ref) <> ''),
  reason text,
  exercised_capability_id text NOT NULL CHECK (exercised_capability_id ~ '^[a-z0-9][a-z0-9-]*$'),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (correspondence_version_id, sequence),
  CHECK ((sequence = 1) = (supersedes_id IS NULL)),
  CHECK (sequence = 1 OR coalesce(btrim(reason),'') <> ''),
  CHECK (decision = 'homologada' OR coalesce(btrim(reason),'') <> '')
);

CREATE FUNCTION public.guard_position_matrix_correspondence_version_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.curricular_position_matrix_correspondence_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 THEN RAISE EXCEPTION 'correspondence:root-must-be-version-1'; END IF; RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.curricular_position_matrix_correspondence_versions WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'correspondence:predecessor-missing'; END IF;
  IF _p.correspondence_id <> NEW.correspondence_id THEN RAISE EXCEPTION 'correspondence:predecessor-other-correspondence'; END IF;
  IF NEW.version <> _p.version + 1 THEN RAISE EXCEPTION 'correspondence:version-gap'; END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION public.guard_position_matrix_correspondence_homologation_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.curricular_position_matrix_correspondence_homologations%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.sequence <> 1 THEN RAISE EXCEPTION 'correspondence-homologation:root-must-be-sequence-1'; END IF; RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.curricular_position_matrix_correspondence_homologations WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'correspondence-homologation:predecessor-missing'; END IF;
  IF _p.correspondence_version_id <> NEW.correspondence_version_id THEN RAISE EXCEPTION 'correspondence-homologation:predecessor-other-version'; END IF;
  IF NEW.sequence <> _p.sequence + 1 THEN RAISE EXCEPTION 'correspondence-homologation:sequence-gap'; END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_position_matrix_correspondence_version_chain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_position_matrix_correspondence_homologation_chain() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER cpm_versions_chain BEFORE INSERT ON public.curricular_position_matrix_correspondence_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_position_matrix_correspondence_version_chain();
CREATE TRIGGER cpm_homologations_chain BEFORE INSERT ON public.curricular_position_matrix_correspondence_homologations
  FOR EACH ROW EXECUTE FUNCTION public.guard_position_matrix_correspondence_homologation_chain();

CREATE TRIGGER cpm_immutable BEFORE UPDATE OR DELETE ON public.curricular_position_matrix_correspondences FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER cpm_versions_immutable BEFORE UPDATE OR DELETE ON public.curricular_position_matrix_correspondence_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER cpm_keys_immutable BEFORE UPDATE OR DELETE ON public.curricular_position_matrix_correspondence_keys FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER cpm_homologations_immutable BEFORE UPDATE OR DELETE ON public.curricular_position_matrix_correspondence_homologations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

GRANT SELECT ON public.curricular_position_matrix_correspondences, public.curricular_position_matrix_correspondence_versions,
  public.curricular_position_matrix_correspondence_keys, public.curricular_position_matrix_correspondence_homologations TO authenticated;
GRANT ALL ON public.curricular_position_matrix_correspondences, public.curricular_position_matrix_correspondence_versions,
  public.curricular_position_matrix_correspondence_keys, public.curricular_position_matrix_correspondence_homologations TO service_role;
REVOKE ALL ON public.curricular_position_matrix_correspondences, public.curricular_position_matrix_correspondence_versions,
  public.curricular_position_matrix_correspondence_keys, public.curricular_position_matrix_correspondence_homologations FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.curricular_position_matrix_correspondences,
  public.curricular_position_matrix_correspondence_versions, public.curricular_position_matrix_correspondence_keys,
  public.curricular_position_matrix_correspondence_homologations FROM authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.curricular_position_matrix_correspondences,
      public.curricular_position_matrix_correspondence_versions, public.curricular_position_matrix_correspondence_keys,
      public.curricular_position_matrix_correspondence_homologations FROM sandbox_exec;
  END IF;
END $acl$;

ALTER TABLE public.curricular_position_matrix_correspondences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_position_matrix_correspondence_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_position_matrix_correspondence_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_position_matrix_correspondence_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpm readable by linked accounts" ON public.curricular_position_matrix_correspondences FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "cpm versions readable by linked accounts" ON public.curricular_position_matrix_correspondence_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "cpm keys readable by linked accounts" ON public.curricular_position_matrix_correspondence_keys FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "cpm homologations readable by linked accounts" ON public.curricular_position_matrix_correspondence_homologations FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);

-- Reader bitemporal: versão vigente de cada correspondência (rascunho ou homologada) em _on conforme _known_at.
-- Retificação conhecida oculta a retificada (sem herdar homologação); sucessão encerra a anterior na véspera.
-- Cadeia inválida ou >1 versão vigente da mesma correspondência ⇒ exceção.
CREATE FUNCTION public.curricular_position_matrix_correspondences_at(_on date, _known_at timestamptz)
RETURNS TABLE(correspondence_id text, profile_id text, version_id uuid, version integer, change_kind text,
  valid_from date, effective_until date, originating_act_ref text, target_matrix_id text, target_column_key text,
  position_key jsonb, homologation_state text, homologation_id uuid, homologation_act_ref text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'correspondence:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'correspondence:known-at-required'; END IF;
  IF EXISTS (
    WITH k AS (SELECT v.* FROM public.curricular_position_matrix_correspondence_versions v WHERE v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.correspondence_id <> k.correspondence_id OR k.version <> p.version + 1))
  ) OR EXISTS (
    WITH k AS (SELECT h.* FROM public.curricular_position_matrix_correspondence_homologations h WHERE h.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.sequence <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.correspondence_version_id <> k.correspondence_version_id OR k.sequence <> p.sequence + 1))
  ) THEN RAISE EXCEPTION 'correspondence:ambiguous-chain'; END IF;

  IF EXISTS (
    WITH known AS (SELECT v.* FROM public.curricular_position_matrix_correspondence_versions v WHERE v.created_at <= _known_at),
    eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
    win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.correspondence_id = e.correspondence_id AND e2.version > e.version)) AS eu FROM eff e)
    SELECT 1 FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR _on <= w.eu) GROUP BY w.correspondence_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'correspondence:ambiguous-temporal-state'; END IF;

  RETURN QUERY
  WITH known AS (SELECT v.* FROM public.curricular_position_matrix_correspondence_versions v WHERE v.created_at <= _known_at),
  eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
  win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.correspondence_id = e.correspondence_id AND e2.version > e.version)) AS eu FROM eff e),
  hit AS (SELECT w.* FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR _on <= w.eu)),
  hk AS (SELECT h.* FROM public.curricular_position_matrix_correspondence_homologations h WHERE h.created_at <= _known_at AND h.effective_from <= _on),
  head AS (SELECT DISTINCT ON (x.correspondence_version_id) x.* FROM hk x ORDER BY x.correspondence_version_id, x.sequence DESC)
  SELECT h.correspondence_id, c.profile_id, h.id, h.version, h.change_kind, h.valid_from, h.eu, h.originating_act_ref,
    h.target_matrix_id, h.target_column_key,
    coalesce((SELECT jsonb_agg(jsonb_build_object('scheme', ky.scheme_id, 'value', ky.value_id, 'version', ky.value_version) ORDER BY ky.scheme_id)
              FROM public.curricular_position_matrix_correspondence_keys ky WHERE ky.correspondence_version_id = h.id), '[]'::jsonb),
    CASE WHEN hd.id IS NULL THEN 'nao-homologada' ELSE hd.decision END, hd.id, hd.homologation_act_ref, h.created_at
  FROM hit h JOIN public.curricular_position_matrix_correspondences c ON c.id = h.correspondence_id
  LEFT JOIN head hd ON hd.correspondence_version_id = h.id
  ORDER BY h.correspondence_id;
END $fn$;

-- Resolução por chave (não é matching por estudante; consumida em B4.2.4):
-- só correspondências HOMOLOGADAS do perfil cuja chave é exatamente igual à informada.
-- Zero ⇒ nenhuma linha (ausência). >1 ⇒ exceção (nunca escolha arbitrária).
-- Coluna validada aqui contra a versão vigente da matriz lógica (column_state por extenso).
CREATE FUNCTION public.resolve_position_matrix_correspondence_at(_profile_id text, _position_key jsonb, _on date, _known_at timestamptz)
RETURNS TABLE(correspondence_id text, version_id uuid, homologation_id uuid, target_matrix_id text, target_column_key text,
  matrix_version_id uuid, column_state text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _profile_id IS NULL THEN RAISE EXCEPTION 'correspondence:profile-required'; END IF;
  IF _position_key IS NULL OR jsonb_typeof(_position_key) <> 'array' OR jsonb_array_length(_position_key) = 0 THEN
    RAISE EXCEPTION 'correspondence:position-key-required'; END IF;
  IF (SELECT count(DISTINCT e->>'scheme') FROM jsonb_array_elements(_position_key) e) <> jsonb_array_length(_position_key)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(_position_key) e
                WHERE coalesce(e->>'scheme','') = '' OR coalesce(e->>'value','') = '' OR jsonb_typeof(e->'version') <> 'number') THEN
    RAISE EXCEPTION 'correspondence:position-key-malformed'; END IF;

  RETURN QUERY
  WITH want AS (
    SELECT jsonb_agg(jsonb_build_object('scheme', e->>'scheme', 'value', e->>'value', 'version', (e->>'version')::integer) ORDER BY e->>'scheme') AS k
    FROM jsonb_array_elements(_position_key) e),
  hits AS (
    SELECT c.* FROM public.curricular_position_matrix_correspondences_at(_on, _known_at) c, want w
    WHERE c.profile_id = _profile_id AND c.homologation_state = 'homologada' AND c.position_key = w.k),
  guard AS (SELECT CASE WHEN count(*) > 1 THEN public.b41_raise('correspondence:ambiguous-homologated') END AS g FROM hits)
  SELECT h.correspondence_id, h.version_id, h.homologation_id, h.target_matrix_id, h.target_column_key, m.version_id,
    CASE WHEN m.version_id IS NULL THEN 'bloqueada:matriz-sem-versao-vigente'
         WHEN EXISTS (SELECT 1 FROM public.curricular_matrix_layout_columns lc
                      WHERE lc.matrix_version_id = m.version_id AND lc.column_key = h.target_column_key) THEN 'coluna-presente'
         ELSE 'bloqueada:coluna-inexistente' END
  FROM hits h CROSS JOIN guard
  LEFT JOIN public.curricular_matrices_at(_on, _known_at) m ON m.matrix_id = h.target_matrix_id
  WHERE guard.g IS NULL;
END $fn$;

REVOKE ALL ON FUNCTION public.curricular_position_matrix_correspondences_at(date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_position_matrix_correspondence_at(text, jsonb, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curricular_position_matrix_correspondences_at(date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_position_matrix_correspondence_at(text, jsonb, date, timestamptz) TO authenticated;