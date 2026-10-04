-- B4.6.5a — Estrutura da NORMA versionada de seleção/composição de calendários. Aditiva; 0023–0029 intactas.
-- Sem writer, sem capacidade, sem conteúdo: competência de construção/homologação desta norma não decidida.
-- Primitivas técnicas declaradas (nenhuma escolhida para a rede); ausência de declaração nunca vira default.
-- Resolver de aplicabilidade e homologação de calendário NÃO são alterados nesta fatia.

CREATE TABLE public.calendar_composition_norms (
  id text PRIMARY KEY CHECK (id ~ '^ccn-[a-z0-9-]+$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.calendar_composition_norm_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_id text NOT NULL REFERENCES public.calendar_composition_norms(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.calendar_composition_norm_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (norm_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((version = 1) = (change_kind = 'constituicao')),
  CHECK (version = 1 OR coalesce(btrim(change_reason), '') <> ''),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Primitiva 1 (obrigatória para configuração completa): o que fazer com MÚLTIPLOS candidatos.
--  exigir-exclusividade: >1 candidato ⇒ diagnóstico de conflito (nunca escolhe um).
--  compor-por-dimensao:  candidatos são compostos por dimensão conforme regras declaradas (primitiva 2).
CREATE TABLE public.calendar_composition_norm_multiplicity (
  version_id uuid PRIMARY KEY REFERENCES public.calendar_composition_norm_versions(id),
  operation text NOT NULL CHECK (operation IN ('exigir-exclusividade','compor-por-dimensao'))
);

-- Primitiva 2: regra por dimensão (id aberto). Conflito SEMPRE conserva diagnóstico; não há prioridade.
--  exigir-concordancia: valores divergentes ⇒ diagnóstico.
--  uniao-com-diagnostico: une declarações; incompatíveis ⇒ diagnóstico.
--  on_absence: candidato sem declaração na dimensão ⇒ indeterminado, ou desconsiderado nessa dimensão (explícito).
CREATE TABLE public.calendar_composition_norm_dimension_rules (
  version_id uuid NOT NULL REFERENCES public.calendar_composition_norm_multiplicity(version_id),
  dimension_id text NOT NULL CHECK (dimension_id ~ '^[a-z0-9][a-z0-9-]*$'),
  operation text NOT NULL CHECK (operation IN ('exigir-concordancia','uniao-com-diagnostico')),
  on_absence text NOT NULL CHECK (on_absence IN ('indeterminado','desconsiderar-candidato-sem-declaracao')),
  PRIMARY KEY (version_id, dimension_id)
);

-- Marcador "configuração registrada": sem ele a versão é configuração não registrada (sem default).
CREATE TABLE public.calendar_composition_norm_configuration_records (
  version_id uuid PRIMARY KEY REFERENCES public.calendar_composition_norm_versions(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.calendar_composition_norm_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.calendar_composition_norm_versions(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.calendar_composition_norm_homologations(id),
  decision text NOT NULL CHECK (decision IN ('homologada','revogada')),
  effective_from date NOT NULL,
  homologation_act_ref text NOT NULL CHECK (btrim(homologation_act_ref) <> ''),
  reason text,
  exercised_capability_id text NOT NULL CHECK (exercised_capability_id ~ '^[a-z0-9][a-z0-9-]*$'),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (version_id, sequence),
  CHECK ((sequence = 1) = (supersedes_id IS NULL)),
  CHECK (sequence = 1 OR coalesce(btrim(reason), '') <> ''),
  CHECK (decision = 'homologada' OR coalesce(btrim(reason), '') <> '')
);

-- Guardas -----------------------------------------------------------------------------------------
CREATE FUNCTION public.guard_composition_norm_version() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.calendar_composition_norm_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 THEN RAISE EXCEPTION 'composition-norm:root-must-be-version-1'; END IF;
    IF EXISTS (SELECT 1 FROM public.calendar_composition_norm_versions v WHERE v.norm_id = NEW.norm_id) THEN
      RAISE EXCEPTION 'composition-norm:second-root'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.calendar_composition_norm_versions WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'composition-norm:predecessor-missing'; END IF;
  IF _p.norm_id <> NEW.norm_id THEN RAISE EXCEPTION 'composition-norm:predecessor-other-norm'; END IF;
  IF NEW.version <> _p.version + 1 THEN RAISE EXCEPTION 'composition-norm:version-gap'; END IF;
  IF NEW.change_kind = 'sucessao' AND NEW.valid_from <= _p.valid_from THEN
    RAISE EXCEPTION 'composition-norm:succession-must-start-later'; END IF;
  RETURN NEW;
END $fn$;

-- Filhos e marcador só na mesma transação que criou a versão; filhos nunca depois do marcador.
CREATE FUNCTION public.guard_composition_norm_child() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _created timestamptz;
BEGIN
  SELECT v.created_at INTO _created FROM public.calendar_composition_norm_versions v WHERE v.id = NEW.version_id;
  IF _created IS NULL OR _created < pg_catalog.now() THEN RAISE EXCEPTION 'composition-norm:version-closed'; END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_composition_norm_configuration_records r WHERE r.version_id = NEW.version_id) THEN
    RAISE EXCEPTION 'composition-norm:configuration-already-recorded'; END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION public.guard_composition_norm_homologation() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE _p public.calendar_composition_norm_homologations%ROWTYPE; _v public.calendar_composition_norm_versions%ROWTYPE;
BEGIN
  SELECT * INTO _v FROM public.calendar_composition_norm_versions WHERE id = NEW.version_id;
  IF NEW.decision = 'homologada' AND public.calendar_composition_norm_configuration_issue(NEW.version_id, 'infinity') IS NOT NULL THEN
    RAISE EXCEPTION 'composition-norm-homologation:configuration-%', public.calendar_composition_norm_configuration_issue(NEW.version_id, 'infinity'); END IF;
  IF NEW.effective_from < _v.valid_from OR (_v.valid_until IS NOT NULL AND NEW.effective_from > _v.valid_until) THEN
    RAISE EXCEPTION 'composition-norm-homologation:outside-version-validity'; END IF;
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.sequence <> 1 THEN RAISE EXCEPTION 'composition-norm-homologation:root-must-be-sequence-1'; END IF;
    IF EXISTS (SELECT 1 FROM public.calendar_composition_norm_homologations h WHERE h.version_id = NEW.version_id) THEN
      RAISE EXCEPTION 'composition-norm-homologation:second-root'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.calendar_composition_norm_homologations WHERE id = NEW.supersedes_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'composition-norm-homologation:predecessor-missing'; END IF;
  IF _p.version_id <> NEW.version_id THEN RAISE EXCEPTION 'composition-norm-homologation:predecessor-other-version'; END IF;
  IF NEW.sequence <> _p.sequence + 1 THEN RAISE EXCEPTION 'composition-norm-homologation:sequence-gap'; END IF;
  IF NEW.decision = _p.decision THEN RAISE EXCEPTION 'composition-norm-homologation:repeated-decision'; END IF;
  RETURN NEW;
END $fn$;

-- Helpers privados de inspeção (INVOKER, search_path vazio) ----------------------------------------

-- Configuração da versão como conhecida em _known_at: NULL = completa; senão motivo.
CREATE FUNCTION public.calendar_composition_norm_configuration_issue(_version uuid, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _op text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.calendar_composition_norm_configuration_records r
                 WHERE r.version_id = _version AND r.created_at <= _known_at) THEN RETURN 'nao-registrada'; END IF;
  SELECT m.operation INTO _op FROM public.calendar_composition_norm_multiplicity m WHERE m.version_id = _version;
  IF _op IS NULL THEN RETURN 'incompleta:multiplicidade-nao-declarada'; END IF;
  IF _op = 'compor-por-dimensao' AND NOT EXISTS (SELECT 1 FROM public.calendar_composition_norm_dimension_rules d WHERE d.version_id = _version) THEN
    RETURN 'incompleta:composicao-sem-dimensao'; END IF;
  IF _op = 'exigir-exclusividade' AND EXISTS (SELECT 1 FROM public.calendar_composition_norm_dimension_rules d WHERE d.version_id = _version) THEN
    RETURN 'incoerente:exclusividade-com-regras-de-dimensao'; END IF;
  RETURN NULL;
END $fn$;

-- Versões aplicáveis em (_on, _known_at): conhecidas, cobrindo _on, não retificadas por versão conhecida;
-- sucessão conhecida encerra a predecessora na véspera do seu início. >1 linha = ambiguidade (o chamador decide nada).
CREATE FUNCTION public.calendar_composition_norm_versions_at(_on date, _known_at timestamptz)
RETURNS TABLE(norm_id text, version_id uuid, version integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT v.norm_id, v.id, v.version
  FROM public.calendar_composition_norm_versions v
  WHERE v.created_at <= _known_at AND v.valid_from <= _on AND (v.valid_until IS NULL OR v.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.calendar_composition_norm_versions s
                    WHERE s.supersedes_id = v.id AND s.created_at <= _known_at
                      AND (s.change_kind = 'retificacao' OR (s.change_kind = 'sucessao' AND s.valid_from <= _on)))
$fn$;

-- Estado de homologação da versão em (_on, _known_at): último ato conhecido com effective_from ≤ _on.
CREATE FUNCTION public.calendar_composition_norm_homologation_state_at(_version uuid, _on date, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _n integer; _d text;
BEGIN
  SELECT count(*) INTO _n FROM public.calendar_composition_norm_homologations h
   WHERE h.version_id = _version AND h.created_at <= _known_at AND h.effective_from <= _on
     AND NOT EXISTS (SELECT 1 FROM public.calendar_composition_norm_homologations s
                     WHERE s.supersedes_id = h.id AND s.created_at <= _known_at AND s.effective_from <= _on);
  IF _n = 0 THEN RETURN 'nao-homologada'; END IF;
  IF _n > 1 THEN RETURN 'ambigua:cadeia-de-homologacao'; END IF;
  SELECT h.decision INTO _d FROM public.calendar_composition_norm_homologations h
   WHERE h.version_id = _version AND h.created_at <= _known_at AND h.effective_from <= _on
     AND NOT EXISTS (SELECT 1 FROM public.calendar_composition_norm_homologations s
                     WHERE s.supersedes_id = h.id AND s.created_at <= _known_at AND s.effective_from <= _on);
  RETURN CASE _d WHEN 'homologada' THEN 'homologada' ELSE 'revogada' END;
END $fn$;

-- Inspeção agregada: uma linha por versão aplicável + linha final (norm_id NULL).
-- Final: sem-norma | configuracao-<motivo> | norma-nao-homologada | ambigua:multiplas-normas-homologadas
--        | ambigua:versoes-concorrentes | norma-homologada. Nunca escolhe norma dominante.
CREATE FUNCTION public.calendar_composition_norm_state_at(_on date, _known_at timestamptz)
RETURNS TABLE(state text, norm_id text, version_id uuid, detail text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE r record; _cfg text; _h text; _hom integer := 0; _any integer := 0; _cfgbad text; _conc integer;
BEGIN
  IF _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'composition-norm:snapshot-required'; END IF;
  SELECT count(*) - count(DISTINCT x.norm_id) INTO _conc FROM public.calendar_composition_norm_versions_at(_on, _known_at) x;
  FOR r IN SELECT * FROM public.calendar_composition_norm_versions_at(_on, _known_at) x ORDER BY x.norm_id, x.version LOOP
    _any := _any + 1;
    _cfg := public.calendar_composition_norm_configuration_issue(r.version_id, _known_at);
    _h := public.calendar_composition_norm_homologation_state_at(r.version_id, _on, _known_at);
    norm_id := r.norm_id; version_id := r.version_id;
    IF _cfg IS NOT NULL THEN
      state := 'configuracao-' || _cfg; detail := _h; _cfgbad := coalesce(_cfgbad, _cfg);
    ELSE
      state := _h; detail := NULL;
      IF _h = 'homologada' THEN _hom := _hom + 1; END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
  norm_id := NULL; version_id := NULL; detail := NULL;
  state := CASE WHEN _conc > 0 THEN 'ambigua:versoes-concorrentes'
                WHEN _hom > 1 THEN 'ambigua:multiplas-normas-homologadas'
                WHEN _hom = 1 THEN 'norma-homologada'
                WHEN _any = 0 THEN 'sem-norma'
                WHEN _cfgbad IS NOT NULL THEN 'configuracao-' || _cfgbad
                ELSE 'norma-nao-homologada' END;
  RETURN NEXT;
END $fn$;

REVOKE ALL ON FUNCTION public.guard_composition_norm_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_composition_norm_child() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_composition_norm_homologation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_composition_norm_configuration_issue(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_composition_norm_versions_at(date, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_composition_norm_homologation_state_at(uuid, date, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_composition_norm_state_at(date, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE TRIGGER ccn_versions_guard BEFORE INSERT ON public.calendar_composition_norm_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_composition_norm_version();
CREATE TRIGGER ccn_multiplicity_guard BEFORE INSERT ON public.calendar_composition_norm_multiplicity
  FOR EACH ROW EXECUTE FUNCTION public.guard_composition_norm_child();
CREATE TRIGGER ccn_dimension_guard BEFORE INSERT ON public.calendar_composition_norm_dimension_rules
  FOR EACH ROW EXECUTE FUNCTION public.guard_composition_norm_child();
CREATE TRIGGER ccn_config_record_guard BEFORE INSERT ON public.calendar_composition_norm_configuration_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_composition_norm_child();
CREATE TRIGGER ccn_homologations_guard BEFORE INSERT ON public.calendar_composition_norm_homologations
  FOR EACH ROW EXECUTE FUNCTION public.guard_composition_norm_homologation();

CREATE TRIGGER ccn_immutable BEFORE UPDATE OR DELETE ON public.calendar_composition_norms FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccn_versions_immutable BEFORE UPDATE OR DELETE ON public.calendar_composition_norm_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccn_multiplicity_immutable BEFORE UPDATE OR DELETE ON public.calendar_composition_norm_multiplicity FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccn_dimension_immutable BEFORE UPDATE OR DELETE ON public.calendar_composition_norm_dimension_rules FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccn_config_record_immutable BEFORE UPDATE OR DELETE ON public.calendar_composition_norm_configuration_records FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER ccn_homologations_immutable BEFORE UPDATE OR DELETE ON public.calendar_composition_norm_homologations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- ACL / RLS: nenhum acesso de cliente (sem policy); só service_role/dono.
GRANT ALL ON public.calendar_composition_norms, public.calendar_composition_norm_versions, public.calendar_composition_norm_multiplicity,
  public.calendar_composition_norm_dimension_rules, public.calendar_composition_norm_configuration_records,
  public.calendar_composition_norm_homologations TO service_role;
REVOKE ALL ON public.calendar_composition_norms, public.calendar_composition_norm_versions, public.calendar_composition_norm_multiplicity,
  public.calendar_composition_norm_dimension_rules, public.calendar_composition_norm_configuration_records,
  public.calendar_composition_norm_homologations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.calendar_composition_norms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_composition_norm_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_composition_norm_multiplicity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_composition_norm_dimension_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_composition_norm_configuration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_composition_norm_homologations ENABLE ROW LEVEL SECURITY;
