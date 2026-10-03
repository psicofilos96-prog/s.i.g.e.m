-- B4.4 — Grade semanal recorrente canônica da turma (estrutura + reader, SEM writer).
-- Grade ≠ jornada (B4.3) ≠ turno (B2.6) ≠ calendário (B4.6) ≠ aula ministrada (Diário).
-- Não há capability exata para manter grade: nenhuma função de escrita é criada.
-- Tipo/natureza do bloco é referência aberta ao catálogo (scheme/value/version); nenhum literal.
-- Responsáveis são relação N:N bloco → atuação, sem papel (D8 aberta).

COMMENT ON TABLE public.institutional_class_schedule_slots IS
  'DEPRECATED (B4.4): fonte plana sem versão/writer/proveniência; substituída por class_schedule_at. Mantida só por compatibilidade de migration; nenhum consumidor institucional.';

CREATE TABLE public.class_schedules (
  id text PRIMARY KEY CHECK (id ~ '^csch-[0-9a-f-]{36}$'),
  class_id text NOT NULL UNIQUE REFERENCES public.institutional_classes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.class_schedule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id text NOT NULL REFERENCES public.class_schedules(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.class_schedule_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text NOT NULL CHECK (length(btrim(originating_act_ref)) > 0),
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((change_kind = 'constituicao') = (supersedes_id IS NULL)),
  CHECK (change_kind = 'constituicao' OR length(btrim(coalesce(change_reason, ''))) > 0),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.class_schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.class_schedule_versions(id),
  block_key text NOT NULL CHECK (block_key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  component_id text REFERENCES public.institutional_curricular_components(id),
  nature_scheme_id text,
  nature_value_id text,
  nature_value_version integer,
  UNIQUE (version_id, block_key),
  CHECK (starts_at < ends_at),
  CHECK ((nature_scheme_id IS NULL) = (nature_value_id IS NULL) AND (nature_value_id IS NULL) = (nature_value_version IS NULL)),
  CHECK (component_id IS NOT NULL OR nature_value_id IS NOT NULL)
);

CREATE TABLE public.class_schedule_block_engagements (
  block_id uuid NOT NULL REFERENCES public.class_schedule_blocks(id),
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  PRIMARY KEY (block_id, engagement_id)
);

GRANT SELECT ON public.class_schedules, public.class_schedule_versions, public.class_schedule_blocks, public.class_schedule_block_engagements TO authenticated;
GRANT ALL ON public.class_schedules, public.class_schedule_versions, public.class_schedule_blocks, public.class_schedule_block_engagements TO service_role;
REVOKE ALL ON public.class_schedules, public.class_schedule_versions, public.class_schedule_blocks, public.class_schedule_block_engagements FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.class_schedules, public.class_schedule_versions, public.class_schedule_blocks, public.class_schedule_block_engagements FROM authenticated;

ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedule_block_engagements ENABLE ROW LEVEL SECURITY;

-- Mesma fronteira de leitura da jornada/turno da turma.
CREATE POLICY "schedule by class read boundary" ON public.class_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_schedules.class_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));
CREATE POLICY "schedule versions by class read boundary" ON public.class_schedule_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_schedules s JOIN public.institutional_classes c ON c.id = s.class_id
    WHERE s.id = class_schedule_versions.schedule_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));
CREATE POLICY "schedule blocks by class read boundary" ON public.class_schedule_blocks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_schedule_versions v JOIN public.class_schedules s ON s.id = v.schedule_id
    JOIN public.institutional_classes c ON c.id = s.class_id WHERE v.id = class_schedule_blocks.version_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));
CREATE POLICY "schedule block engagements by class read boundary" ON public.class_schedule_block_engagements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_schedule_blocks b JOIN public.class_schedule_versions v ON v.id = b.version_id
    JOIN public.class_schedules s ON s.id = v.schedule_id JOIN public.institutional_classes c ON c.id = s.class_id
    WHERE b.id = class_schedule_block_engagements.block_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));

CREATE TRIGGER class_schedules_immutable BEFORE UPDATE OR DELETE ON public.class_schedules FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_schedule_versions_immutable BEFORE UPDATE OR DELETE ON public.class_schedule_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_schedule_blocks_immutable BEFORE UPDATE OR DELETE ON public.class_schedule_blocks FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_schedule_block_engagements_immutable BEFORE UPDATE OR DELETE ON public.class_schedule_block_engagements FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Cadeia linear + vigência dentro da existência da turma; abre a janela transacional de blocos.
CREATE FUNCTION public.guard_class_schedule_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _p public.class_schedule_versions%ROWTYPE; _class text; _pt date;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO _p FROM public.class_schedule_versions WHERE id = NEW.supersedes_id;
    IF _p.id IS NULL OR _p.schedule_id <> NEW.schedule_id OR NEW.version <> _p.version + 1 THEN
      RAISE EXCEPTION 'schedule:invalid-chain';
    END IF;
    IF NEW.change_kind = 'sucessao' AND NEW.valid_from <= _p.valid_from THEN
      RAISE EXCEPTION 'schedule:succession-must-start-later';
    END IF;
  END IF;
  SELECT class_id INTO _class FROM public.class_schedules WHERE id = NEW.schedule_id;
  FOR _pt IN
    SELECT NEW.valid_from
    UNION SELECT h.valid_until + 1 FROM public.institutional_class_record_versions h
      WHERE h.class_id = _class AND h.valid_until IS NOT NULL AND h.valid_until >= NEW.valid_from
        AND (NEW.valid_until IS NULL OR h.valid_until < NEW.valid_until)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_at(_class, _pt, NULL)) THEN
      RAISE EXCEPTION 'schedule:outside-class-validity';
    END IF;
  END LOOP;
  IF NEW.valid_until IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.class_at(_class, NEW.valid_until, NULL)) THEN
    RAISE EXCEPTION 'schedule:outside-class-validity';
  END IF;
  PERFORM set_config('sigem.schedule_open_' || replace(NEW.id::text, '-', ''), '1', true);
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_schedule_version() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER class_schedule_version_guard BEFORE INSERT ON public.class_schedule_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_schedule_version();

-- Bloco e responsável: só na transação que criou a versão. Sobreposição NÃO é proibida aqui (decisão
-- normativa ausente); o reader a sinaliza.
CREATE FUNCTION public.guard_class_schedule_block() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF coalesce(current_setting('sigem.schedule_open_' || replace(NEW.version_id::text, '-', ''), true), '') <> '1' THEN
    RAISE EXCEPTION 'schedule:block-after-version-closed';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_schedule_block() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER class_schedule_block_guard BEFORE INSERT ON public.class_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_schedule_block();

CREATE FUNCTION public.guard_class_schedule_block_engagement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _v uuid;
BEGIN
  SELECT version_id INTO _v FROM public.class_schedule_blocks WHERE id = NEW.block_id;
  IF _v IS NULL OR coalesce(current_setting('sigem.schedule_open_' || replace(_v::text, '-', ''), true), '') <> '1' THEN
    RAISE EXCEPTION 'schedule:block-after-version-closed';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_schedule_block_engagement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER class_schedule_block_engagement_guard BEFORE INSERT ON public.class_schedule_block_engagements
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_schedule_block_engagement();

-- Versão sem bloco é rejeitada no commit.
CREATE FUNCTION public.guard_class_schedule_version_has_blocks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.class_schedule_blocks WHERE version_id = NEW.id) THEN
    RAISE EXCEPTION 'schedule:version-without-blocks';
  END IF;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_schedule_version_has_blocks() FROM PUBLIC, anon, authenticated;
CREATE CONSTRAINT TRIGGER class_schedule_version_has_blocks AFTER INSERT ON public.class_schedule_versions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_class_schedule_version_has_blocks();

-- Versões efetivas na data segundo knownAt (mesma semântica da jornada B4.3).
CREATE FUNCTION public.class_schedule_effective_versions(_sid text, _on date, _known_at timestamptz)
RETURNS TABLE(id uuid, version integer, change_kind text, valid_from date, eu date, act text, reason text, created timestamptz)
LANGUAGE sql STABLE SET search_path = '' AS $fn$
  WITH known AS (SELECT v.* FROM public.class_schedule_versions v WHERE v.schedule_id = _sid AND v.created_at <= _known_at),
  eff AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')),
  win AS (SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2 WHERE e2.version > e.version AND e2.valid_from > e.valid_from)) AS eu FROM eff e)
  SELECT w.id, w.version, w.change_kind, w.valid_from, w.eu, w.originating_act_ref, w.change_reason, w.created_at
  FROM win w WHERE w.valid_from <= _on AND (w.eu IS NULL OR w.eu >= _on)
$fn$;
REVOKE ALL ON FUNCTION public.class_schedule_effective_versions(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_schedule_effective_versions(text, date, timestamptz) TO authenticated;

-- Validade estrutural do responsável no bloco. SECURITY DEFINER porque atuações de terceiros não são
-- legíveis pelo RLS; devolve SOMENTE booleano e NULL quando o chamador não pode ler a turma.
-- Não expõe pessoa, cargo nem outros dados da atuação.
CREATE FUNCTION public.class_schedule_engagement_valid(_engagement uuid, _class text, _component text, _on date, _known_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class
      AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id)))
    THEN NULL
    ELSE EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement AND e.created_at <= _known_at
      AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
      AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.created_at <= _known_at AND x.ended_on < _on)
      AND (e.class_id = _class OR EXISTS (SELECT 1 FROM public.institutional_engagement_scope_classes s
             WHERE s.engagement_id = e.id AND s.class_id = _class AND s.created_at <= _known_at))
      AND (e.component_id IS NULL OR _component IS NULL OR e.component_id = _component))
  END
$fn$;
REVOKE ALL ON FUNCTION public.class_schedule_engagement_valid(uuid, text, text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_schedule_engagement_valid(uuid, text, text, date, timestamptz) TO authenticated;

-- Reader canônico da grade.
CREATE FUNCTION public.class_schedule_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz, schedule_state text, schedule_id text,
  version_id uuid, version integer, change_kind text, valid_from date, effective_until date, originating_act_ref text,
  change_reason text, recorded_at timestamptz, block_id uuid, block_key text, weekday smallint, starts_at time, ends_at time,
  block_minutes integer, component_id text, component_version integer, component_name text, nature_scheme_id text,
  nature_value_id text, nature_value_version integer, nature_label text, engagement_ids uuid[], block_state text,
  block_issues text[], overlapping_block_keys text[], coverage_state text, coverage_matrix_ids text[],
  day_minutes integer, week_minutes integer)
LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
#variable_conflict use_column
DECLARE _school text; _count integer; _sid text; _jabsent boolean; _covm text[] := '{}'; _covc text[] := '{}'; _covfail boolean := false;
BEGIN
  IF _class_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'schedule:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'schedule:known-at-required'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _school IS NULL OR NOT (public.can_read_institutional_class(_class_id, _school)
       OR public.has_school_capability('consultar-matricula-e-movimentacao', _school)) THEN
    result_kind := 'access-denied'; class_id := _class_id; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;
  SELECT s.id INTO _sid FROM public.class_schedules s WHERE s.class_id = _class_id AND s.created_at <= _known_at;
  IF _sid IS NOT NULL AND EXISTS (
    WITH k AS (SELECT v.* FROM public.class_schedule_versions v WHERE v.schedule_id = _sid AND v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1) OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR k.version <> p.version + 1))
       OR NOT EXISTS (SELECT 1 FROM public.class_schedule_blocks b WHERE b.version_id = k.id)
  ) THEN RAISE EXCEPTION 'schedule:invalid-chain'; END IF;
  SELECT count(*)::integer INTO _count FROM public.class_schedule_effective_versions(_sid, _on, _known_at);
  IF _count > 1 THEN RAISE EXCEPTION 'schedule:ambiguous-temporal-state'; END IF;
  IF _count = 1 AND NOT EXISTS (SELECT 1 FROM public.class_at(_class_id, _on, _known_at)) THEN
    RAISE EXCEPTION 'schedule:outside-class-validity';
  END IF;
  IF _count = 0 THEN
    result_kind := 'absent'; class_id := _class_id; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;

  -- Jornada B4.3 na mesma data/knownAt; exceções da jornada propagam (fail-closed).
  _jabsent := NOT EXISTS (SELECT 1 FROM public.class_journey_at(_class_id, _on, _known_at) j WHERE j.result_kind = 'interval');

  -- Proveniência curricular: componente presente em itens de ALGUMA matriz efetivamente resolvida
  -- (B4.2.5). Não escolhe dominante, não soma carga. Falha de leitura ⇒ cobertura não comprovada
  -- (sinalizada), nunca ausência de grade nem comprovação.
  BEGIN
    SELECT coalesce(array_agg(x.mid), '{}'), coalesce(array_agg(x.cid), '{}') INTO _covm, _covc FROM (
      SELECT DISTINCT m.matrix_id AS mid, it.component_id AS cid
      FROM public.class_curricular_matrices_at(_school, _class_id, _on, _known_at) m
      CROSS JOIN LATERAL public.curricular_matrix_items_at(m.matrix_id, _on, _known_at) it
      WHERE m.matrix_version_id IS NOT NULL AND it.version_id = m.matrix_version_id AND it.component_id IS NOT NULL
        AND ((m.result_kind = 'matrix' AND m.state = 'resolvida-por-posicao')
          OR (m.result_kind = 'specific-link' AND m.state = 'vinculo-especifico-vigente'))) x;
  EXCEPTION WHEN OTHERS THEN _covfail := true; _covm := '{}'; _covc := '{}';
  END;

  RETURN QUERY
  WITH ev AS (SELECT * FROM public.class_schedule_effective_versions(_sid, _on, _known_at)),
  jv AS (SELECT j.weekday AS wd, j.starts_at AS js, j.ends_at AS je FROM public.class_journey_at(_class_id, _on, _known_at) j WHERE j.result_kind = 'interval'),
  cov AS (SELECT x.mid, x.cid FROM unnest(_covm, _covc) AS x(mid, cid)),
  b AS (SELECT bl.* FROM public.class_schedule_blocks bl JOIN ev ON ev.id = bl.version_id),
  bx AS (
    SELECT b.*, cv.cver, cv.cname, cv.cact, ad.nlabel,
      (SELECT array_agg(be.engagement_id ORDER BY be.engagement_id) FROM public.class_schedule_block_engagements be WHERE be.block_id = b.id) AS engs,
      EXISTS (SELECT 1 FROM public.class_schedule_block_engagements be WHERE be.block_id = b.id
        AND public.class_schedule_engagement_valid(be.engagement_id, _class_id, b.component_id, _on, _known_at) IS NOT TRUE) AS engbad,
      EXISTS (SELECT 1 FROM jv WHERE jv.wd = b.weekday AND jv.js <= b.starts_at AND b.ends_at <= jv.je) AS fits,
      (SELECT array_agg(o.block_key ORDER BY o.block_key) FROM b o WHERE o.id <> b.id AND o.weekday = b.weekday
         AND o.starts_at < b.ends_at AND b.starts_at < o.ends_at) AS ovl,
      (SELECT array_agg(DISTINCT cov.mid ORDER BY cov.mid) FROM cov WHERE cov.cid = b.component_id) AS covmx
    FROM b
    LEFT JOIN LATERAL (SELECT v.version AS cver, v.official_name AS cname, v.is_active AS cact FROM public.curricular_component_versions v
      WHERE v.component_id = b.component_id AND v.valid_from <= _on AND v.created_at <= _known_at ORDER BY v.version DESC LIMIT 1) cv ON true
    LEFT JOIN LATERAL (SELECT d.label AS nlabel FROM public.attribute_value_definitions d
      WHERE d.scheme_id = b.nature_scheme_id AND d.value_id = b.nature_value_id AND d.version = b.nature_value_version
        AND d.status = 'homologada' AND (d.valid_from IS NULL OR d.valid_from <= _on) AND d.created_at <= _known_at LIMIT 1) ad ON true
  ),
  bi AS (
    SELECT bx.*, (extract(epoch FROM bx.ends_at - bx.starts_at) / 60)::integer AS mins,
      array_remove(ARRAY[
        CASE WHEN _jabsent THEN 'bloqueada:jornada-ausente' END,
        CASE WHEN bx.component_id IS NOT NULL AND bx.cact IS NOT TRUE THEN 'bloqueada:componente-inexistente-ou-inativo' END,
        CASE WHEN bx.nature_value_id IS NOT NULL AND bx.nlabel IS NULL THEN 'bloqueada:tipo-nao-homologado' END,
        CASE WHEN bx.engbad THEN 'bloqueada:engagement-invalido' END,
        CASE WHEN NOT _jabsent AND NOT bx.fits THEN 'bloqueada:bloco-fora-da-jornada' END,
        CASE WHEN bx.ovl IS NOT NULL THEN 'inconsistente:sobreposicao-de-blocos' END
      ]::text[], NULL) AS issues
    FROM bx
  ),
  bj AS (SELECT bi.*, EXISTS (SELECT 1 FROM unnest(bi.issues) z WHERE z LIKE 'bloqueada:%') AS blk FROM bi)
  SELECT 'block'::text, _class_id, _on, _known_at,
    CASE WHEN _jabsent THEN 'bloqueada:jornada-ausente'
         WHEN bool_or(bj.blk) OVER () THEN 'bloqueada:blocos-com-pendencia'
         WHEN bool_or(cardinality(bj.issues) > 0) OVER () THEN 'inconsistente:sobreposicao-de-blocos'
         ELSE 'utilizavel' END,
    _sid, ev.id, ev.version, ev.change_kind, ev.valid_from, ev.eu, ev.act, ev.reason, ev.created,
    bj.id, bj.block_key, bj.weekday, bj.starts_at, bj.ends_at, bj.mins, bj.component_id, bj.cver, bj.cname,
    bj.nature_scheme_id, bj.nature_value_id, bj.nature_value_version, bj.nlabel, coalesce(bj.engs, '{}'::uuid[]),
    coalesce(bj.issues[1], 'utilizavel'), bj.issues, coalesce(bj.ovl, '{}'::text[]),
    CASE WHEN bj.component_id IS NULL THEN 'nao-aplicavel'
         WHEN bj.covmx IS NOT NULL THEN 'comprovada'
         WHEN _covfail THEN 'nao-comprovada:leitura-curricular-interrompida'
         ELSE 'nao-comprovada' END,
    coalesce(bj.covmx, '{}'::text[]),
    (sum(bj.mins) OVER (PARTITION BY bj.weekday))::integer, (sum(bj.mins) OVER ())::integer
  FROM bj CROSS JOIN ev
  ORDER BY bj.weekday, bj.starts_at, bj.block_key;
END $fn$;
REVOKE ALL ON FUNCTION public.class_schedule_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_schedule_at(text, date, timestamptz) TO authenticated;
