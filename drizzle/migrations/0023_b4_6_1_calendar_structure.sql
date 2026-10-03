-- B4.6.1 — Calendário institucional: ESTRUTURA + readers fechados, SEM writer, SEM dados, SEM capability.
-- Conteúdo normativo ≠ apresentação (B4.7). Ano/organização/períodos vêm só de B2.4 por ID.
-- Tipos de dia/evento são abertos (identidade + versões); efeito letivo NULL = não declarado (≠ false).
-- Regras de precedência/composição e motor normativo estão FORA do escopo: concorrência é detectada, nunca arbitrada.
-- Readers públicos retornam 'access-denied' para toda conta até haver decisão de competência de leitura (D4/consulta).

CREATE TABLE public.institutional_calendars (
  id text PRIMARY KEY CHECK (id ~ '^cal-[0-9a-f-]{36}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.calendar_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id text NOT NULL REFERENCES public.institutional_calendars(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.calendar_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  academic_year_id text NOT NULL,
  period_organization_id text NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid REFERENCES public.institutional_persons(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (calendar_id, version),
  FOREIGN KEY (period_organization_id, academic_year_id) REFERENCES public.institutional_period_organizations(id, academic_year_id),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((change_kind = 'constituicao') = (supersedes_id IS NULL)),
  CHECK (change_kind = 'constituicao' OR coalesce(btrim(change_reason), '') <> ''),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Relação explícita versão → períodos B2.4 (sem nome/datas duplicados).
CREATE TABLE public.calendar_version_periods (
  version_id uuid NOT NULL REFERENCES public.calendar_versions(id),
  period_id text NOT NULL REFERENCES public.institutional_academic_periods(id),
  PRIMARY KEY (version_id, period_id)
);

CREATE TABLE public.calendar_day_types (
  id text PRIMARY KEY CHECK (id ~ '^cdt-[0-9a-f-]{36}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.calendar_day_type_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_type_id text NOT NULL REFERENCES public.calendar_day_types(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.calendar_day_type_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  label text NOT NULL CHECK (btrim(label) <> ''),
  school_day_effect boolean, -- NULL = efeito letivo não declarado; false é dado válido.
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid REFERENCES public.institutional_persons(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (day_type_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((change_kind = 'constituicao') = (supersedes_id IS NULL)),
  CHECK (change_kind = 'constituicao' OR coalesce(btrim(change_reason), '') <> '')
);

-- Conteúdo: filhos imutáveis da versão; cada um FIXA a versão do tipo (não resolve "a última").
CREATE TABLE public.calendar_version_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.calendar_versions(id),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  day_type_version_id uuid NOT NULL REFERENCES public.calendar_day_type_versions(id),
  CHECK (ends_on >= starts_on)
);
CREATE TABLE public.calendar_version_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.calendar_versions(id),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  label text NOT NULL CHECK (btrim(label) <> ''),
  day_type_version_id uuid NOT NULL REFERENCES public.calendar_day_type_versions(id),
  CHECK (ends_on >= starts_on)
);
CREATE TABLE public.calendar_version_day_assignments (
  version_id uuid NOT NULL REFERENCES public.calendar_versions(id),
  day date NOT NULL,
  day_type_version_id uuid NOT NULL REFERENCES public.calendar_day_type_versions(id),
  PRIMARY KEY (version_id, day)
);
CREATE INDEX calendar_version_ranges_version_idx ON public.calendar_version_ranges(version_id);
CREATE INDEX calendar_version_events_version_idx ON public.calendar_version_events(version_id);

-- Homologação: ledger append-only por versão (aprova o snapshot inteiro: versão + filhos + versões de tipo fixadas).
CREATE TABLE public.calendar_version_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_version_id uuid NOT NULL REFERENCES public.calendar_versions(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.calendar_version_homologations(id),
  decision text NOT NULL CHECK (decision IN ('homologada','revogada')),
  effective_from date NOT NULL,
  homologation_act_ref text NOT NULL CHECK (btrim(homologation_act_ref) <> ''),
  reason text,
  exercised_capability_id text NOT NULL CHECK (exercised_capability_id ~ '^[a-z0-9][a-z0-9-]*$'),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (calendar_version_id, sequence),
  CHECK ((sequence = 1) = (supersedes_id IS NULL)),
  CHECK (sequence = 1 OR coalesce(btrim(reason), '') <> ''),
  CHECK (decision = 'homologada' OR coalesce(btrim(reason), '') <> '')
);

-- ACL: sem SELECT nem DML para anon/authenticated/PUBLIC; RLS sem policy (fechado).
DO $acl$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['institutional_calendars','calendar_versions','calendar_version_periods','calendar_day_types',
    'calendar_day_type_versions','calendar_version_ranges','calendar_version_events','calendar_version_day_assignments',
    'calendar_version_homologations'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation()', t || '_immutable', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM sandbox_exec', t);
    END IF;
  END LOOP;
END $acl$;

-- Cadeia linear de versão de calendário; ano/organização imutáveis na cadeia; abre janela de filhos.
CREATE FUNCTION public.guard_calendar_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _p public.calendar_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO _p FROM public.calendar_versions WHERE id = NEW.supersedes_id;
    IF _p.id IS NULL OR _p.calendar_id <> NEW.calendar_id OR NEW.version <> _p.version + 1 THEN
      RAISE EXCEPTION 'calendar:invalid-chain';
    END IF;
    IF _p.academic_year_id <> NEW.academic_year_id OR _p.period_organization_id <> NEW.period_organization_id THEN
      RAISE EXCEPTION 'calendar:scope-immutable';
    END IF;
    IF NEW.change_kind = 'sucessao' AND NEW.valid_from <= _p.valid_from THEN
      RAISE EXCEPTION 'calendar:succession-must-start-later';
    END IF;
  END IF;
  PERFORM set_config('sigem.calendar_open_' || replace(NEW.id::text, '-', ''), '1', true);
  RETURN NEW;
END $fn$;
CREATE TRIGGER calendar_version_guard BEFORE INSERT ON public.calendar_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_version();

CREATE FUNCTION public.guard_calendar_day_type_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _p public.calendar_day_type_versions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO _p FROM public.calendar_day_type_versions WHERE id = NEW.supersedes_id;
    IF _p.id IS NULL OR _p.day_type_id <> NEW.day_type_id OR NEW.version <> _p.version + 1 THEN
      RAISE EXCEPTION 'calendar-day-type:invalid-chain';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER calendar_day_type_version_guard BEFORE INSERT ON public.calendar_day_type_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_day_type_version();

-- Filhos: só na transação que criou a versão; períodos devem pertencer à organização da versão;
-- tipo fixado deve ser conhecido antes (ou junto) da versão.
CREATE FUNCTION public.guard_calendar_version_child() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _v public.calendar_versions%ROWTYPE; _tv uuid; _org text; _yr text;
BEGIN
  SELECT * INTO _v FROM public.calendar_versions WHERE id = NEW.version_id;
  IF _v.id IS NULL OR coalesce(current_setting('sigem.calendar_open_' || replace(_v.id::text, '-', ''), true), '') <> '1' THEN
    RAISE EXCEPTION 'calendar:child-after-version-closed';
  END IF;
  IF TG_TABLE_NAME = 'calendar_version_periods' THEN
    SELECT p.period_organization_id, p.academic_year_id INTO _org, _yr FROM public.institutional_academic_periods p WHERE p.id = NEW.period_id;
    IF _org IS DISTINCT FROM _v.period_organization_id OR _yr IS DISTINCT FROM _v.academic_year_id THEN
      RAISE EXCEPTION 'calendar:period-outside-organization';
    END IF;
    RETURN NEW;
  END IF;
  _tv := NEW.day_type_version_id;
  IF NOT EXISTS (SELECT 1 FROM public.calendar_day_type_versions t WHERE t.id = _tv AND t.created_at <= _v.created_at) THEN
    RAISE EXCEPTION 'calendar:day-type-version-unknown-at-version';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER calendar_version_periods_guard BEFORE INSERT ON public.calendar_version_periods FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_version_child();
CREATE TRIGGER calendar_version_ranges_guard BEFORE INSERT ON public.calendar_version_ranges FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_version_child();
CREATE TRIGGER calendar_version_events_guard BEFORE INSERT ON public.calendar_version_events FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_version_child();
CREATE TRIGGER calendar_version_day_assignments_guard BEFORE INSERT ON public.calendar_version_day_assignments FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_version_child();

CREATE FUNCTION public.guard_calendar_homologation_chain() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _p public.calendar_version_homologations%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.sequence <> 1 THEN RAISE EXCEPTION 'calendar-homologation:root-must-be-sequence-1'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO _p FROM public.calendar_version_homologations WHERE id = NEW.supersedes_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'calendar-homologation:predecessor-missing'; END IF;
  IF _p.calendar_version_id <> NEW.calendar_version_id THEN RAISE EXCEPTION 'calendar-homologation:predecessor-other-version'; END IF;
  IF NEW.sequence <> _p.sequence + 1 THEN RAISE EXCEPTION 'calendar-homologation:sequence-gap'; END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER calendar_version_homologations_chain BEFORE INSERT ON public.calendar_version_homologations
  FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_homologation_chain();

REVOKE ALL ON FUNCTION public.guard_calendar_version(), public.guard_calendar_day_type_version(),
  public.guard_calendar_version_child(), public.guard_calendar_homologation_chain() FROM PUBLIC, anon, authenticated;

-- ===== Helpers PRIVADOS (núcleo técnico; sem EXECUTE para PUBLIC/anon/authenticated) =====

-- Versão B2.4 efetiva em _p conhecida em _k: maior versão com valid_from ≤ _p e created_at ≤ _k.
-- Integridade da referência ao longo de [valid_from, fim]: ano, organização e cada período ativos em todo
-- ponto de segmento (início + cada valid_from de versão B2.4 dentro da janela) e conteúdo dentro do ano vigente.
-- NÃO exige que conteúdo caia dentro de período avaliativo (não há norma assim). Retorna NULL se íntegra.
CREATE FUNCTION public.calendar_version_reference_issue(_version_id uuid, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _v public.calendar_versions%ROWTYPE; _pt date; _yr record; _org record; _end date;
BEGIN
  SELECT * INTO _v FROM public.calendar_versions WHERE id = _version_id AND created_at <= _known_at;
  IF _v.id IS NULL THEN RETURN 'version-unknown'; END IF;
  _end := coalesce(_v.valid_until, 'infinity'::date);
  FOR _pt IN
    SELECT _v.valid_from
    UNION SELECT y.valid_from FROM public.institutional_academic_year_versions y
      WHERE y.academic_year_id = _v.academic_year_id AND y.created_at <= _known_at AND y.valid_from > _v.valid_from AND y.valid_from <= _end
    UNION SELECT o.valid_from FROM public.institutional_period_organization_versions o
      WHERE o.organization_id = _v.period_organization_id AND o.created_at <= _known_at AND o.valid_from > _v.valid_from AND o.valid_from <= _end
    UNION SELECT pv.valid_from FROM public.institutional_academic_period_versions pv
      JOIN public.calendar_version_periods cp ON cp.period_id = pv.period_id AND cp.version_id = _v.id
      WHERE pv.created_at <= _known_at AND pv.valid_from > _v.valid_from AND pv.valid_from <= _end
  LOOP
    SELECT y.* INTO _yr FROM public.institutional_academic_year_versions y
      WHERE y.academic_year_id = _v.academic_year_id AND y.valid_from <= _pt AND y.created_at <= _known_at
      ORDER BY y.version DESC LIMIT 1;
    IF _yr IS NULL OR NOT _yr.is_active THEN RETURN 'year-inactive'; END IF;
    SELECT o.* INTO _org FROM public.institutional_period_organization_versions o
      WHERE o.organization_id = _v.period_organization_id AND o.valid_from <= _pt AND o.created_at <= _known_at
      ORDER BY o.version DESC LIMIT 1;
    IF _org IS NULL OR NOT _org.is_active THEN RETURN 'organization-inactive'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.calendar_version_periods cp
      WHERE cp.version_id = _v.id AND NOT coalesce((
        SELECT pv.is_active FROM public.institutional_academic_period_versions pv
        WHERE pv.period_id = cp.period_id AND pv.valid_from <= _pt AND pv.created_at <= _known_at
        ORDER BY pv.version DESC LIMIT 1), false))
    THEN RETURN 'period-inactive'; END IF;
    IF EXISTS (SELECT 1 FROM public.calendar_version_ranges r WHERE r.version_id = _v.id AND (r.starts_on < _yr.starts_on OR r.ends_on > _yr.ends_on))
      OR EXISTS (SELECT 1 FROM public.calendar_version_events e WHERE e.version_id = _v.id AND (e.starts_on < _yr.starts_on OR e.ends_on > _yr.ends_on))
      OR EXISTS (SELECT 1 FROM public.calendar_version_day_assignments a WHERE a.version_id = _v.id AND (a.day < _yr.starts_on OR a.day > _yr.ends_on))
    THEN RETURN 'content-outside-year'; END IF;
  END LOOP;
  RETURN NULL;
END $fn$;

-- Versão efetiva do calendário em _on conhecida em _known_at. Cadeia corrompida ⇒ exceção; >1 ⇒ exceção.
-- Retificação conhecida substitui a predecessora inteira; sucessão substitui a partir do seu valid_from.
CREATE FUNCTION public.calendar_effective_version(_calendar_id text, _on date, _known_at timestamptz)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _ids uuid[];
BEGIN
  IF _calendar_id IS NULL OR _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'calendar:arguments-required'; END IF;
  IF EXISTS (
    WITH k AS (SELECT * FROM public.calendar_versions WHERE calendar_id = _calendar_id AND created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1)
       OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR k.version <> p.version + 1))
    UNION ALL SELECT 1 FROM k GROUP BY k.version HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'calendar:invalid-chain'; END IF;
  SELECT array_agg(k.id) INTO _ids
  FROM public.calendar_versions k
  WHERE k.calendar_id = _calendar_id AND k.created_at <= _known_at
    AND k.valid_from <= _on AND (k.valid_until IS NULL OR k.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.calendar_versions s WHERE s.supersedes_id = k.id AND s.created_at <= _known_at
      AND (s.change_kind = 'retificacao' OR (s.change_kind = 'sucessao' AND s.valid_from <= _on)));
  IF coalesce(cardinality(_ids), 0) = 0 THEN RETURN NULL; END IF;
  IF cardinality(_ids) > 1 THEN RAISE EXCEPTION 'calendar:ambiguous-effective-version'; END IF;
  RETURN _ids[1];
END $fn$;

-- Estado de homologação da versão em _on conhecido em _known_at (cadeia verificada; sem efeito antes de effective_from).
CREATE FUNCTION public.calendar_version_homologation_state(_version_id uuid, _on date, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _d text;
BEGIN
  IF EXISTS (
    WITH k AS (SELECT * FROM public.calendar_version_homologations WHERE calendar_version_id = _version_id AND created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.sequence <> 1) OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR k.sequence <> p.sequence + 1))
    UNION ALL SELECT 1 FROM k GROUP BY k.sequence HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'calendar-homologation:ambiguous-chain'; END IF;
  SELECT h.decision INTO _d FROM public.calendar_version_homologations h
  WHERE h.calendar_version_id = _version_id AND h.created_at <= _known_at AND h.effective_from <= _on
  ORDER BY h.sequence DESC LIMIT 1;
  RETURN coalesce(_d, 'nao-homologada');
END $fn$;

-- Declarações cruas de uma data (sem precedência). day_state:
--   'sem-versao-vigente' | 'referencia-b2-4-invalida' | 'nao-declarado' | 'declarado' | 'conflito-sem-regra'.
-- 'conflito-sem-regra' só quando declarações com efeito letivo DECLARADO divergem (true × false);
-- efeito NULL não participa nem vira false; eventos informativos coexistem sem conflito.
CREATE FUNCTION public.calendar_day_declarations(_calendar_id text, _date date, _known_at timestamptz)
RETURNS TABLE(day_state text, version_id uuid, reference_issue text, homologation_state text,
  declaration_kind text, declaration_id text, starts_on date, ends_on date, event_label text,
  day_type_id text, day_type_version_id uuid, day_type_version integer, day_type_label text, school_day_effect boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _v uuid; _iss text; _hs text;
BEGIN
  _v := public.calendar_effective_version(_calendar_id, _date, _known_at);
  IF _v IS NULL THEN
    day_state := 'sem-versao-vigente'; RETURN NEXT; RETURN;
  END IF;
  _iss := public.calendar_version_reference_issue(_v, _known_at);
  _hs := public.calendar_version_homologation_state(_v, _date, _known_at);
  IF _iss IS NOT NULL THEN
    day_state := 'referencia-b2-4-invalida'; version_id := _v; reference_issue := _iss; homologation_state := _hs; RETURN NEXT; RETURN;
  END IF;
  RETURN QUERY
    WITH d AS (
      SELECT 'faixa'::text AS kind, r.id::text AS did, r.starts_on AS s, r.ends_on AS e, NULL::text AS lbl, r.day_type_version_id AS tv
        FROM public.calendar_version_ranges r WHERE r.version_id = _v AND _date BETWEEN r.starts_on AND r.ends_on
      UNION ALL SELECT 'evento', e.id::text, e.starts_on, e.ends_on, e.label, e.day_type_version_id
        FROM public.calendar_version_events e WHERE e.version_id = _v AND _date BETWEEN e.starts_on AND e.ends_on
      UNION ALL SELECT 'atribuicao', a.day::text, a.day, a.day, NULL, a.day_type_version_id
        FROM public.calendar_version_day_assignments a WHERE a.version_id = _v AND a.day = _date),
    j AS (SELECT d.*, t.day_type_id AS tid, t.version AS tver, t.label AS tlabel, t.school_day_effect AS eff
          FROM d JOIN public.calendar_day_type_versions t ON t.id = d.tv),
    st AS (SELECT CASE WHEN count(DISTINCT j.eff) > 1 THEN 'conflito-sem-regra' ELSE 'declarado' END AS v FROM j)
    SELECT st.v, _v, NULL::text, _hs, j.kind, j.did, j.s, j.e, j.lbl, j.tid, j.tv, j.tver, j.tlabel, j.eff
    FROM j CROSS JOIN st
    UNION ALL
    SELECT 'nao-declarado', _v, NULL::text, _hs, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT EXISTS (SELECT 1 FROM j)
    ORDER BY 5, 7, 6;
END $fn$;

REVOKE ALL ON FUNCTION public.calendar_version_reference_issue(uuid, timestamptz),
  public.calendar_effective_version(text, date, timestamptz),
  public.calendar_version_homologation_state(uuid, date, timestamptz),
  public.calendar_day_declarations(text, date, timestamptz) FROM PUBLIC, anon, authenticated;

-- ===== Readers públicos: fechados até decisão institucional de leitura =====
-- Não consultam nenhuma tabela: mesma resposta para calendário existente, inexistente, NULL ou arbitrário.
CREATE FUNCTION public.calendar_at(_calendar_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, valid_on date, known_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT 'access-denied'::text, _on, _known_at;
$fn$;
CREATE FUNCTION public.calendar_day_at(_calendar_id text, _date date, _known_at timestamptz)
RETURNS TABLE(result_kind text, valid_on date, known_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT 'access-denied'::text, _date, _known_at;
$fn$;
REVOKE ALL ON FUNCTION public.calendar_at(text, date, timestamptz), public.calendar_day_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_at(text, date, timestamptz), public.calendar_day_at(text, date, timestamptz) TO authenticated;

COMMENT ON TABLE public.calendar_versions IS 'B4.6.1: versão append-only de calendário (refs B2.4). Sem writer; uso institucional indisponível até D4/R5/competência de leitura.';
COMMENT ON TABLE public.calendar_version_homologations IS 'B4.6.1: ledger append-only de homologação/revogação do snapshot da versão. Sem writer até R5.';