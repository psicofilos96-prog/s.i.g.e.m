-- B4.2.2a — Estrutura do PERFIL de correspondência (E2 do contrato B4.2.0).
-- Aditiva. Sem writer (nem rascunho nem homologação): competência de construção do perfil e de homologação (R5) não decididas.
-- Nenhum esquema/valor semeado; o motor não conhece nomes de etapa, natureza ou AEE.

CREATE TABLE public.curricular_correspondence_profiles (
  id text PRIMARY KEY CHECK (id ~ '^ccp-[0-9a-f-]+$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.curricular_correspondence_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES public.curricular_correspondence_profiles(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.curricular_correspondence_profile_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  change_reason text,
  -- E2d: regra de interpretação de aplicabilidades múltiplas = referência a valor de catálogo homologado; nula = não avaliável.
  applicability_rule_scheme_id text, applicability_rule_value_id text, applicability_rule_value_version integer,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (profile_id, version),
  UNIQUE (id, profile_id),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((version = 1) = (change_kind = 'constituicao')),
  CHECK (version = 1 OR coalesce(btrim(change_reason),'') <> ''),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK ((applicability_rule_value_id IS NULL) = (applicability_rule_scheme_id IS NULL)
     AND (applicability_rule_value_id IS NULL) = (applicability_rule_value_version IS NULL))
);

-- E2a: esquemas da posição B3.3 que compõem a chave (≥1 exigido na leitura).
CREATE TABLE public.curricular_correspondence_profile_position_keys (
  profile_version_id uuid NOT NULL REFERENCES public.curricular_correspondence_profile_versions(id),
  scheme_id text NOT NULL CHECK (scheme_id ~ '^[a-z0-9][a-z0-9-]*$'),
  PRIMARY KEY (profile_version_id, scheme_id)
);

-- E2b: eixo da Oferta B2.6 designado como natureza da turma (0 ou 1).
CREATE TABLE public.curricular_correspondence_profile_nature_axis (
  profile_version_id uuid PRIMARY KEY REFERENCES public.curricular_correspondence_profile_versions(id),
  scheme_id text NOT NULL CHECK (scheme_id ~ '^[a-z0-9][a-z0-9-]*$'),
  UNIQUE (profile_version_id, scheme_id)
);

-- E2c: portão por valor homologado do eixo de natureza; efeito = primitiva técnica do motor.
CREATE TABLE public.curricular_correspondence_profile_nature_gates (
  profile_version_id uuid NOT NULL,
  scheme_id text NOT NULL,
  value_id text NOT NULL CHECK (value_id ~ '^[a-z0-9][a-z0-9-]*$'),
  value_version integer NOT NULL CHECK (value_version >= 1),
  effect text NOT NULL CHECK (effect IN ('matching-regular','associacao-explicita','fora-de-correspondencia')),
  PRIMARY KEY (profile_version_id, value_id),
  FOREIGN KEY (profile_version_id, scheme_id)
    REFERENCES public.curricular_correspondence_profile_nature_axis(profile_version_id, scheme_id)
);

-- Homologação do perfil: ledger próprio (mesmo padrão E1); sem writer até R5.
CREATE TABLE public.curricular_correspondence_profile_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_version_id uuid NOT NULL REFERENCES public.curricular_correspondence_profile_versions(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.curricular_correspondence_profile_homologations(id),
  decision text NOT NULL CHECK (decision IN ('homologada','revogada')),
  effective_from date NOT NULL,
  homologation_act_ref text NOT NULL CHECK (btrim(homologation_act_ref) <> ''),
  reason text,
  exercised_capability_id text NOT NULL CHECK (exercised_capability_id ~ '^[a-z0-9][a-z0-9-]*$'),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (profile_version_id, sequence),
  CHECK ((sequence = 1) = (supersedes_id IS NULL)),
  CHECK (sequence = 1 OR coalesce(btrim(reason),'') <> ''),
  CHECK (decision = 'homologada' OR coalesce(btrim(reason),'') <> '')
);

-- Cadeias: predecessor do mesmo perfil/versão e número +1.
CREATE FUNCTION public.guard_correspondence_profile_version_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.curricular_correspondence_profile_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 THEN RAISE EXCEPTION 'profile:root-must-be-version-1'; END IF; RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.curricular_correspondence_profile_versions WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile:predecessor-missing'; END IF;
  IF _p.profile_id <> NEW.profile_id THEN RAISE EXCEPTION 'profile:predecessor-other-profile'; END IF;
  IF NEW.version <> _p.version + 1 THEN RAISE EXCEPTION 'profile:version-gap'; END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION public.guard_correspondence_profile_homologation_chain() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.curricular_correspondence_profile_homologations%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.sequence <> 1 THEN RAISE EXCEPTION 'profile-homologation:root-must-be-sequence-1'; END IF; RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.curricular_correspondence_profile_homologations WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile-homologation:predecessor-missing'; END IF;
  IF _p.profile_version_id <> NEW.profile_version_id THEN RAISE EXCEPTION 'profile-homologation:predecessor-other-version'; END IF;
  IF NEW.sequence <> _p.sequence + 1 THEN RAISE EXCEPTION 'profile-homologation:sequence-gap'; END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_correspondence_profile_version_chain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_correspondence_profile_homologation_chain() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER ccp_versions_chain BEFORE INSERT ON public.curricular_correspondence_profile_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_correspondence_profile_version_chain();
CREATE TRIGGER ccp_homologations_chain BEFORE INSERT ON public.curricular_correspondence_profile_homologations
  FOR EACH ROW EXECUTE FUNCTION public.guard_correspondence_profile_homologation_chain();

CREATE TRIGGER ccp_immutable BEFORE UPDATE OR DELETE ON public.curricular_correspondence_profiles FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccp_versions_immutable BEFORE UPDATE OR DELETE ON public.curricular_correspondence_profile_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccp_keys_immutable BEFORE UPDATE OR DELETE ON public.curricular_correspondence_profile_position_keys FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccp_axis_immutable BEFORE UPDATE OR DELETE ON public.curricular_correspondence_profile_nature_axis FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccp_gates_immutable BEFORE UPDATE OR DELETE ON public.curricular_correspondence_profile_nature_gates FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccp_homologations_immutable BEFORE UPDATE OR DELETE ON public.curricular_correspondence_profile_homologations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- ACL / RLS: leitura por contas vinculadas; nenhuma escrita direta.
GRANT SELECT ON public.curricular_correspondence_profiles, public.curricular_correspondence_profile_versions,
  public.curricular_correspondence_profile_position_keys, public.curricular_correspondence_profile_nature_axis,
  public.curricular_correspondence_profile_nature_gates, public.curricular_correspondence_profile_homologations TO authenticated;
GRANT ALL ON public.curricular_correspondence_profiles, public.curricular_correspondence_profile_versions,
  public.curricular_correspondence_profile_position_keys, public.curricular_correspondence_profile_nature_axis,
  public.curricular_correspondence_profile_nature_gates, public.curricular_correspondence_profile_homologations TO service_role;
REVOKE ALL ON public.curricular_correspondence_profiles, public.curricular_correspondence_profile_versions,
  public.curricular_correspondence_profile_position_keys, public.curricular_correspondence_profile_nature_axis,
  public.curricular_correspondence_profile_nature_gates, public.curricular_correspondence_profile_homologations FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.curricular_correspondence_profiles,
  public.curricular_correspondence_profile_versions, public.curricular_correspondence_profile_position_keys,
  public.curricular_correspondence_profile_nature_axis, public.curricular_correspondence_profile_nature_gates,
  public.curricular_correspondence_profile_homologations FROM authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.curricular_correspondence_profiles,
      public.curricular_correspondence_profile_versions, public.curricular_correspondence_profile_position_keys,
      public.curricular_correspondence_profile_nature_axis, public.curricular_correspondence_profile_nature_gates,
      public.curricular_correspondence_profile_homologations FROM sandbox_exec;
  END IF;
END $acl$;
ALTER TABLE public.curricular_correspondence_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_correspondence_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_correspondence_profile_position_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_correspondence_profile_nature_axis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_correspondence_profile_nature_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_correspondence_profile_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ccp readable by linked accounts" ON public.curricular_correspondence_profiles FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "ccp versions readable by linked accounts" ON public.curricular_correspondence_profile_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "ccp keys readable by linked accounts" ON public.curricular_correspondence_profile_position_keys FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "ccp axis readable by linked accounts" ON public.curricular_correspondence_profile_nature_axis FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "ccp gates readable by linked accounts" ON public.curricular_correspondence_profile_nature_gates FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "ccp homologations readable by linked accounts" ON public.curricular_correspondence_profile_homologations FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);

-- Reader bitemporal: versão vigente de cada perfil em _on conforme _known_at, com estado de homologação e configuração.
-- Retificação conhecida oculta a retificada; sucessão encerra a anterior na véspera. Cadeia inválida ou >1 versão vigente ⇒ exceção.
CREATE FUNCTION public.curricular_correspondence_profiles_at(_on date, _known_at timestamptz)
RETURNS TABLE(profile_id text, version_id uuid, version integer, change_kind text, valid_from date, effective_until date,
  originating_act_ref text, homologation_state text, homologation_id uuid, homologation_act_ref text,
  position_key_schemes text[], nature_scheme_id text, nature_gates jsonb, applicability_rule jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'profile:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'profile:known-at-required'; END IF;
  IF EXISTS (
    WITH k AS (SELECT v.* FROM public.curricular_correspondence_profile_versions v WHERE v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.profile_id <> k.profile_id OR k.version <> p.version + 1))
  ) OR EXISTS (
    WITH k AS (SELECT h.* FROM public.curricular_correspondence_profile_homologations h WHERE h.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.sequence <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.profile_version_id <> k.profile_version_id OR k.sequence <> p.sequence + 1))
  ) THEN RAISE EXCEPTION 'profile:ambiguous-chain'; END IF;

  IF EXISTS (
    WITH known AS (SELECT v.* FROM public.curricular_correspondence_profile_versions v WHERE v.created_at <= _known_at),
    eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
    win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.profile_id = e.profile_id AND e2.version > e.version)) AS eu FROM eff e)
    SELECT 1 FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR _on <= w.eu) GROUP BY w.profile_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'profile:ambiguous-temporal-state'; END IF;

  RETURN QUERY
  WITH known AS (SELECT v.* FROM public.curricular_correspondence_profile_versions v WHERE v.created_at <= _known_at),
  eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
  win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.profile_id = e.profile_id AND e2.version > e.version)) AS eu FROM eff e),
  hit AS (SELECT w.* FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR _on <= w.eu)),
  hk AS (SELECT h.* FROM public.curricular_correspondence_profile_homologations h WHERE h.created_at <= _known_at AND h.effective_from <= _on),
  head AS (SELECT DISTINCT ON (x.profile_version_id) x.* FROM hk x ORDER BY x.profile_version_id, x.sequence DESC)
  SELECT h.profile_id, h.id, h.version, h.change_kind, h.valid_from, h.eu, h.originating_act_ref,
    CASE WHEN hd.id IS NULL THEN 'nao-homologada' ELSE hd.decision END, hd.id, hd.homologation_act_ref,
    coalesce((SELECT array_agg(pk.scheme_id ORDER BY pk.scheme_id) FROM public.curricular_correspondence_profile_position_keys pk WHERE pk.profile_version_id = h.id), ARRAY[]::text[]),
    (SELECT na.scheme_id FROM public.curricular_correspondence_profile_nature_axis na WHERE na.profile_version_id = h.id),
    coalesce((SELECT jsonb_agg(jsonb_build_object('value', g.value_id, 'version', g.value_version, 'effect', g.effect) ORDER BY g.value_id)
              FROM public.curricular_correspondence_profile_nature_gates g WHERE g.profile_version_id = h.id), '[]'::jsonb),
    CASE WHEN h.applicability_rule_value_id IS NULL THEN NULL
         ELSE jsonb_build_object('scheme', h.applicability_rule_scheme_id, 'value', h.applicability_rule_value_id, 'version', h.applicability_rule_value_version) END,
    h.created_at
  FROM hit h LEFT JOIN head hd ON hd.profile_version_id = h.id
  ORDER BY h.profile_id;
END $fn$;

-- Seleção do perfil efetivo para B4.2 futura: zero linhas = ausência; >1 homologado vigente ⇒ exceção (nunca arbitrário).
CREATE FUNCTION public.homologated_correspondence_profile_at(_on date, _known_at timestamptz)
RETURNS TABLE(profile_id text, version_id uuid, version integer, homologation_id uuid,
  position_key_schemes text[], nature_scheme_id text, nature_gates jsonb, applicability_rule jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
DECLARE _n integer;
BEGIN
  SELECT count(*) INTO _n FROM public.curricular_correspondence_profiles_at(_on, _known_at) p WHERE p.homologation_state = 'homologada';
  IF _n > 1 THEN RAISE EXCEPTION 'profile:ambiguous-homologated'; END IF;
  RETURN QUERY SELECT p.profile_id, p.version_id, p.version, p.homologation_id, p.position_key_schemes, p.nature_scheme_id, p.nature_gates, p.applicability_rule
  FROM public.curricular_correspondence_profiles_at(_on, _known_at) p WHERE p.homologation_state = 'homologada';
END $fn$;

REVOKE ALL ON FUNCTION public.curricular_correspondence_profiles_at(date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologated_correspondence_profile_at(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curricular_correspondence_profiles_at(date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologated_correspondence_profile_at(date, timestamptz) TO authenticated;
