-- B4.3 — Jornada canônica da turma (estrutura + reader, SEM writer).
-- Jornada ≠ turno (B2.6) ≠ grade (B4.4) ≠ calendário (B4.6) ≠ aula ministrada.
-- Intervalos são primitivas (dia da semana + [início, fim)); sem taxonomia, sem duração persistida.
-- Não há capability exata para manter jornada: nenhuma função de escrita é criada.

CREATE TABLE public.class_journeys (
  id text PRIMARY KEY CHECK (id ~ '^cj-[0-9a-f-]{36}$'),
  class_id text NOT NULL UNIQUE REFERENCES public.institutional_classes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.class_journey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id text NOT NULL REFERENCES public.class_journeys(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.class_journey_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text NOT NULL CHECK (length(btrim(originating_act_ref)) > 0),
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((change_kind = 'constituicao') = (supersedes_id IS NULL)),
  CHECK (change_kind = 'constituicao' OR length(btrim(coalesce(change_reason, ''))) > 0),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.class_journey_intervals (
  version_id uuid NOT NULL REFERENCES public.class_journey_versions(id),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  PRIMARY KEY (version_id, weekday, starts_at),
  CHECK (starts_at < ends_at)
);

GRANT SELECT ON public.class_journeys, public.class_journey_versions, public.class_journey_intervals TO authenticated;
GRANT ALL ON public.class_journeys, public.class_journey_versions, public.class_journey_intervals TO service_role;
REVOKE ALL ON public.class_journeys, public.class_journey_versions, public.class_journey_intervals FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.class_journeys, public.class_journey_versions, public.class_journey_intervals FROM authenticated;

ALTER TABLE public.class_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_journey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_journey_intervals ENABLE ROW LEVEL SECURITY;

-- Mesma fronteira de leitura do turno da turma (class_shift_versions).
CREATE POLICY "journey by class read boundary" ON public.class_journeys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_journeys.class_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));
CREATE POLICY "journey versions by class read boundary" ON public.class_journey_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_journeys j JOIN public.institutional_classes c ON c.id = j.class_id
    WHERE j.id = class_journey_versions.journey_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));
CREATE POLICY "journey intervals by class read boundary" ON public.class_journey_intervals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_journey_versions v JOIN public.class_journeys j ON j.id = v.journey_id
    JOIN public.institutional_classes c ON c.id = j.class_id WHERE v.id = class_journey_intervals.version_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));

CREATE TRIGGER class_journeys_immutable BEFORE UPDATE OR DELETE ON public.class_journeys FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_journey_versions_immutable BEFORE UPDATE OR DELETE ON public.class_journey_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_journey_intervals_immutable BEFORE UPDATE OR DELETE ON public.class_journey_intervals FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Cadeia linear + vigência dentro da existência estrutural da turma (conhecimento no instante da gravação).
CREATE FUNCTION public.guard_class_journey_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _p public.class_journey_versions%ROWTYPE; _class text; _pt date;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO _p FROM public.class_journey_versions WHERE id = NEW.supersedes_id;
    IF _p.id IS NULL OR _p.journey_id <> NEW.journey_id OR NEW.version <> _p.version + 1 THEN
      RAISE EXCEPTION 'journey:invalid-chain';
    END IF;
    IF NEW.change_kind = 'sucessao' AND NEW.valid_from <= _p.valid_from THEN
      RAISE EXCEPTION 'journey:succession-must-start-later';
    END IF;
  END IF;
  SELECT class_id INTO _class FROM public.class_journeys WHERE id = NEW.journey_id;
  -- pontos de segmento: início da jornada e o dia seguinte a cada fim de versão da turma dentro da janela
  FOR _pt IN
    SELECT NEW.valid_from
    UNION SELECT h.valid_until + 1 FROM public.institutional_class_record_versions h
      WHERE h.class_id = _class AND h.valid_until IS NOT NULL AND h.valid_until >= NEW.valid_from
        AND (NEW.valid_until IS NULL OR h.valid_until < NEW.valid_until)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_at(_class, _pt, NULL)) THEN
      RAISE EXCEPTION 'journey:outside-class-validity';
    END IF;
  END LOOP;
  IF NEW.valid_until IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.class_at(_class, NEW.valid_until, NULL)) THEN
    RAISE EXCEPTION 'journey:outside-class-validity';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_journey_version() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER class_journey_version_guard BEFORE INSERT ON public.class_journey_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_journey_version();

-- Intervalo: só na transação que criou a versão; sem sobreposição no mesmo dia (adjacência permitida).
CREATE FUNCTION public.guard_class_journey_interval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _x xid;
BEGIN
  SELECT xmin INTO _x FROM public.class_journey_versions WHERE id = NEW.version_id;
  IF _x IS NULL OR _x::text <> (pg_current_xact_id()::text::bigint % 4294967296)::text THEN
    RAISE EXCEPTION 'journey:interval-after-version-closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.class_journey_intervals i WHERE i.version_id = NEW.version_id AND i.weekday = NEW.weekday
             AND i.starts_at < NEW.ends_at AND NEW.starts_at < i.ends_at) THEN
    RAISE EXCEPTION 'journey:interval-overlap';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_journey_interval() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER class_journey_interval_guard BEFORE INSERT ON public.class_journey_intervals
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_journey_interval();

-- Versão sem intervalo é rejeitada no commit.
CREATE FUNCTION public.guard_class_journey_version_has_intervals() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.class_journey_intervals WHERE version_id = NEW.id) THEN
    RAISE EXCEPTION 'journey:version-without-intervals';
  END IF;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_journey_version_has_intervals() FROM PUBLIC, anon, authenticated;
CREATE CONSTRAINT TRIGGER class_journey_version_has_intervals AFTER INSERT ON public.class_journey_versions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_class_journey_version_has_intervals();

-- Versões efetivas na data segundo knownAt: retificação conhecida oculta a retificada; sucessão encerra a anterior na véspera.
CREATE FUNCTION public.class_journey_effective_versions(_jid text, _on date, _known_at timestamptz)
RETURNS TABLE(id uuid, version integer, change_kind text, valid_from date, eu date, act text, reason text, created timestamptz)
LANGUAGE sql STABLE SET search_path = '' AS $fn$
  WITH known AS (SELECT v.* FROM public.class_journey_versions v WHERE v.journey_id = _jid AND v.created_at <= _known_at),
  eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
  win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.version > e.version AND e2.valid_from > e.valid_from)) AS eu FROM eff e)
  SELECT w.id, w.version, w.change_kind, w.valid_from, w.eu, w.originating_act_ref, w.change_reason, w.created_at
  FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR w.eu >= _on)
$fn$;
REVOKE ALL ON FUNCTION public.class_journey_effective_versions(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_journey_effective_versions(text, date, timestamptz) TO authenticated;

-- Reader bitemporal. result_kind: access-denied (sem leitura ou turma inexistente: nada revelado) |
-- absent (turma legível, sem jornada efetiva) | interval (uma linha por intervalo, ordem dia/início).
-- Derivados descritivos (não normativos): primeiro início, último fim, minutos do dia, minutos da semana.
CREATE FUNCTION public.class_journey_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz, journey_id text, version_id uuid, version integer,
  change_kind text, valid_from date, effective_until date, originating_act_ref text, change_reason text, recorded_at timestamptz,
  weekday smallint, starts_at time, ends_at time, day_first_start time, day_last_end time, day_minutes integer, week_minutes integer)
LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
DECLARE _school text; _count integer; _jid text;
BEGIN
  IF _class_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'journey:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'journey:known-at-required'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _school IS NULL OR NOT (public.can_read_institutional_class(_class_id, _school)
       OR public.has_school_capability('consultar-matricula-e-movimentacao', _school)) THEN
    RETURN QUERY SELECT 'access-denied'::text, _class_id, _on, _known_at, NULL::text, NULL::uuid, NULL::integer, NULL::text, NULL::date,
      NULL::date, NULL::text, NULL::text, NULL::timestamptz, NULL::smallint, NULL::time, NULL::time, NULL::time, NULL::time, NULL::integer, NULL::integer;
    RETURN;
  END IF;
  SELECT j.id INTO _jid FROM public.class_journeys j WHERE j.class_id = _class_id AND j.created_at <= _known_at;
  IF _jid IS NOT NULL AND EXISTS (
    WITH k AS (SELECT v.* FROM public.class_journey_versions v WHERE v.journey_id = _jid AND v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1) OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR k.version <> p.version + 1))
       OR NOT EXISTS (SELECT 1 FROM public.class_journey_intervals i WHERE i.version_id = k.id)
  ) THEN RAISE EXCEPTION 'journey:invalid-chain'; END IF;
  SELECT count(*)::integer INTO _count FROM public.class_journey_effective_versions(_jid, _on, _known_at);
  IF _count > 1 THEN RAISE EXCEPTION 'journey:ambiguous-temporal-state'; END IF;
  IF _count = 1 AND NOT EXISTS (SELECT 1 FROM public.class_at(_class_id, _on, _known_at)) THEN
    RAISE EXCEPTION 'journey:outside-class-validity';
  END IF;
  IF _count = 0 THEN
    RETURN QUERY SELECT 'absent'::text, _class_id, _on, _known_at, NULL::text, NULL::uuid, NULL::integer, NULL::text, NULL::date,
      NULL::date, NULL::text, NULL::text, NULL::timestamptz, NULL::smallint, NULL::time, NULL::time, NULL::time, NULL::time, NULL::integer, NULL::integer;
    RETURN;
  END IF;
  RETURN QUERY
  WITH iv AS (SELECT i.* FROM public.class_journey_intervals i JOIN public.class_journey_effective_versions(_jid, _on, _known_at) e ON e.id = i.version_id),
  d AS (SELECT iv.weekday wd, min(iv.starts_at) fs, max(iv.ends_at) le,
          sum((extract(epoch FROM iv.ends_at - iv.starts_at) / 60)::integer)::integer mins FROM iv GROUP BY iv.weekday)
  SELECT 'interval'::text, _class_id, _on, _known_at, _jid, e.id, e.version, e.change_kind, e.valid_from, e.eu, e.act, e.reason, e.created,
    iv.weekday, iv.starts_at, iv.ends_at, d.fs, d.le, d.mins, (SELECT sum(d2.mins)::integer FROM d d2)
  FROM iv JOIN public.class_journey_effective_versions(_jid, _on, _known_at) e ON e.id = iv.version_id JOIN d ON d.wd = iv.weekday
  ORDER BY iv.weekday, iv.starts_at;
END $fn$;
REVOKE ALL ON FUNCTION public.class_journey_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_journey_at(text, date, timestamptz) TO authenticated;
