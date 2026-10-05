-- Alimentação Escolar: cardápio, previsão declarada, execução e restrição alimentar mínima.
-- Sem regra nutricional, PNAE, estoque ou compra. Catálogos (sem seed): preparacao-alimentar, refeicao-escolar,
-- grupo-de-atendimento-alimentar, restricao-alimentar. Capabilities (sem regra de política até decisão):
--   manter-cardapio-escolar · registrar-execucao-alimentacao · consultar-alimentacao-escolar
--   registrar-restricao-alimentar · consultar-restricao-alimentar
-- Alcance: escola da própria unidade, ou rede (vale para todas as unidades).

CREATE FUNCTION public.meal_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-cardapio-escolar','registrar-execucao-alimentacao','consultar-alimentacao-escolar','registrar-restricao-alimentar','consultar-restricao-alimentar')
    THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_value_ok(_scheme text, _value text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.attribute_value_definitions d WHERE d.scheme_id = _scheme AND d.value_id = _value AND d.status = 'homologado')
$fn$;
REVOKE ALL ON FUNCTION public.meal_value_ok(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Cabeçalho comum de versão: logical_id/version/supersedes/event_kind/reason/autoria/recorded_at.
CREATE TABLE public.meal_menu_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_menu_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  school_id text NOT NULL,
  service_group_value_id text,
  starts_on date NOT NULL, ends_on date NOT NULL CHECK (ends_on >= starts_on),
  entries jsonb NOT NULL CHECK (jsonb_typeof(entries) = 'array'),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.meal_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_forecasts(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  school_id text NOT NULL, served_on date NOT NULL, meal_slot_value_id text NOT NULL,
  forecast_count integer NOT NULL CHECK (forecast_count >= 0),
  basis text NOT NULL CHECK (length(btrim(basis)) > 0 AND length(basis) <= 300),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.meal_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_service_records(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  school_id text NOT NULL, served_on date NOT NULL, meal_slot_value_id text NOT NULL,
  offered_count integer CHECK (offered_count >= 0),
  served_count integer CHECK (served_count >= 0),
  source_note text CHECK (length(source_note) <= 300),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (offered_count IS NOT NULL OR served_count IS NOT NULL OR event_kind = 'revogacao'),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
-- Restrição alimentar: só a restrição (catálogo) e orientação de manejo curta. Sem diagnóstico.
CREATE TABLE public.dietary_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.dietary_restrictions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  school_id text NOT NULL, student_id text NOT NULL, restriction_value_id text NOT NULL,
  handling_note text CHECK (length(handling_note) <= 500),
  valid_from date NOT NULL, valid_to date, CHECK (valid_to IS NULL OR valid_to >= valid_from),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['meal_menu_versions','meal_forecasts','meal_service_records','dietary_restrictions'] LOOP
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (supersedes_id) WHERE supersedes_id IS NOT NULL', t || '_one_successor', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (school_id)', t || '_school', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.import_append_only()', t || '_append_only', t);
  END LOOP;
END $$;

-- Writers ------------------------------------------------------------------------------------------
CREATE FUNCTION public.record_meal_menu(_base_id uuid, _kind text, _school text, _group text, _starts date, _ends date, _entries jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.meal_menu_versions; e jsonb; p text; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_menu_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_menu_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id;
    IF _kind = 'revogacao' THEN _group := base.service_group_value_id; _starts := base.starts_on; _ends := base.ends_on; _entries := base.entries; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed'; END IF;
  g := public.meal_grant('manter-cardapio-escolar', _school);
  IF _group IS NOT NULL AND NOT public.meal_value_ok('grupo-de-atendimento-alimentar', _group) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  IF jsonb_typeof(_entries) <> 'array' OR jsonb_array_length(_entries) = 0 THEN RAISE EXCEPTION 'meal:entries-required'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(_entries) LOOP
    IF (e->>'date') IS NULL OR (e->>'date')::date < _starts OR (e->>'date')::date > _ends THEN RAISE EXCEPTION 'meal:entry-date-outside-period'; END IF;
    IF NOT public.meal_value_ok('refeicao-escolar', e->>'slot') THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
    IF jsonb_typeof(e->'preparations') <> 'array' OR jsonb_array_length(e->'preparations') = 0 THEN RAISE EXCEPTION 'meal:preparations-required'; END IF;
    FOR p IN SELECT jsonb_array_elements_text(e->'preparations') LOOP
      IF NOT public.meal_value_ok('preparacao-alimentar', p) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
    END LOOP;
  END LOOP;
  INSERT INTO public.meal_menu_versions(logical_id, version, supersedes_id, event_kind, school_id, service_group_value_id, starts_on, ends_on, entries, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _group, _starts, _ends, _entries, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_meal_forecast(_base_id uuid, _kind text, _school text, _on date, _slot text, _count integer, _basis text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.meal_forecasts; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_forecasts WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_forecasts WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id; _on := base.served_on; _slot := base.meal_slot_value_id;
    IF _kind = 'revogacao' THEN _count := base.forecast_count; _basis := base.basis; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  ELSIF EXISTS (SELECT 1 FROM public.meal_forecasts f WHERE f.school_id = _school AND f.served_on = _on AND f.meal_slot_value_id = _slot AND f.event_kind <> 'revogacao'
                AND NOT EXISTS (SELECT 1 FROM public.meal_forecasts s WHERE s.supersedes_id = f.id)) THEN RAISE EXCEPTION 'meal:duplicate-use-rectification';
  END IF;
  g := public.meal_grant('manter-cardapio-escolar', _school);
  IF NOT public.meal_value_ok('refeicao-escolar', _slot) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  INSERT INTO public.meal_forecasts(logical_id, version, supersedes_id, event_kind, school_id, served_on, meal_slot_value_id, forecast_count, basis, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _on, _slot, _count, _basis, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_meal_service(_base_id uuid, _kind text, _school text, _on date, _slot text, _offered integer, _served integer, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.meal_service_records; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_service_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_service_records WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id; _on := base.served_on; _slot := base.meal_slot_value_id;
    IF _kind = 'revogacao' THEN _offered := base.offered_count; _served := base.served_count; _source := base.source_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  ELSIF EXISTS (SELECT 1 FROM public.meal_service_records f WHERE f.school_id = _school AND f.served_on = _on AND f.meal_slot_value_id = _slot AND f.event_kind <> 'revogacao'
                AND NOT EXISTS (SELECT 1 FROM public.meal_service_records s WHERE s.supersedes_id = f.id)) THEN RAISE EXCEPTION 'meal:duplicate-use-rectification';
  END IF;
  g := public.meal_grant('registrar-execucao-alimentacao', _school);
  IF _on > CURRENT_DATE THEN RAISE EXCEPTION 'meal:service-in-future'; END IF;
  IF NOT public.meal_value_ok('refeicao-escolar', _slot) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  INSERT INTO public.meal_service_records(logical_id, version, supersedes_id, event_kind, school_id, served_on, meal_slot_value_id, offered_count, served_count, source_note, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _on, _slot, _offered, _served, nullif(btrim(_source),''), nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_dietary_restriction(_base_id uuid, _kind text, _school text, _student text, _restriction text, _note text, _from date, _to date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.dietary_restrictions; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.dietary_restrictions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.dietary_restrictions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id; _student := base.student_id;
    IF _kind = 'revogacao' THEN _restriction := base.restriction_value_id; _note := base.handling_note; _from := base.valid_from; _to := coalesce(_to, base.valid_to); END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed'; END IF;
  g := public.meal_grant('registrar-restricao-alimentar', _school);
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN RAISE EXCEPTION 'meal:student-not-in-school'; END IF;
  IF NOT public.meal_value_ok('restricao-alimentar', _restriction) THEN RAISE EXCEPTION 'meal:value-not-homologated'; END IF;
  INSERT INTO public.dietary_restrictions(logical_id, version, supersedes_id, event_kind, school_id, student_id, restriction_value_id, handling_note, valid_from, valid_to, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _student, _restriction, nullif(btrim(_note),''), _from, _to, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

-- Readers (cabeças conhecidas até _known_at; histórico por _logical_id) ------------------------------
CREATE FUNCTION public.meal_menus_at(_school text, _from date, _to date, _known_at timestamptz, _logical_id uuid)
RETURNS SETOF public.meal_menu_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.meal_grant('consultar-alimentacao-escolar', _school);
  RETURN QUERY SELECT m.* FROM public.meal_menu_versions m
   WHERE m.school_id = _school AND m.recorded_at <= k AND (_from IS NULL OR m.ends_on >= _from) AND (_to IS NULL OR m.starts_on <= _to)
     AND (CASE WHEN _logical_id IS NOT NULL THEN m.logical_id = _logical_id
          ELSE NOT EXISTS (SELECT 1 FROM public.meal_menu_versions s WHERE s.supersedes_id = m.id AND s.recorded_at <= k) END)
   ORDER BY m.starts_on, m.version LIMIT 500;
END $fn$;
CREATE FUNCTION public.meal_forecasts_at(_school text, _from date, _to date, _known_at timestamptz)
RETURNS SETOF public.meal_forecasts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.meal_grant('consultar-alimentacao-escolar', _school);
  RETURN QUERY SELECT m.* FROM public.meal_forecasts m
   WHERE m.school_id = _school AND m.recorded_at <= k AND m.served_on BETWEEN _from AND _to
     AND NOT EXISTS (SELECT 1 FROM public.meal_forecasts s WHERE s.supersedes_id = m.id AND s.recorded_at <= k)
   ORDER BY m.served_on LIMIT 2000;
END $fn$;
CREATE FUNCTION public.meal_services_at(_school text, _from date, _to date, _known_at timestamptz)
RETURNS SETOF public.meal_service_records LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.meal_grant('consultar-alimentacao-escolar', _school);
  RETURN QUERY SELECT m.* FROM public.meal_service_records m
   WHERE m.school_id = _school AND m.recorded_at <= k AND m.served_on BETWEEN _from AND _to
     AND NOT EXISTS (SELECT 1 FROM public.meal_service_records s WHERE s.supersedes_id = m.id AND s.recorded_at <= k)
   ORDER BY m.served_on LIMIT 2000;
END $fn$;
-- Restrições: capability sensível própria; consultar a alimentação NÃO dá acesso.
CREATE FUNCTION public.dietary_restrictions_at(_school text, _on date, _known_at timestamptz)
RETURNS SETOF public.dietary_restrictions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.meal_grant('consultar-restricao-alimentar', _school);
  RETURN QUERY SELECT d.* FROM public.dietary_restrictions d
   WHERE d.school_id = _school AND d.recorded_at <= k AND d.event_kind <> 'revogacao'
     AND d.valid_from <= _on AND (d.valid_to IS NULL OR d.valid_to >= _on)
     AND NOT EXISTS (SELECT 1 FROM public.dietary_restrictions s WHERE s.supersedes_id = d.id AND s.recorded_at <= k)
   ORDER BY d.student_id LIMIT 2000;
END $fn$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'record_meal_menu(uuid,text,text,text,date,date,jsonb,text)','record_meal_forecast(uuid,text,text,date,text,integer,text,text)',
    'record_meal_service(uuid,text,text,date,text,integer,integer,text,text)','record_dietary_restriction(uuid,text,text,text,text,text,date,date,text)',
    'meal_menus_at(text,date,date,timestamptz,uuid)','meal_forecasts_at(text,date,date,timestamptz)','meal_services_at(text,date,date,timestamptz)',
    'dietary_restrictions_at(text,date,timestamptz)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;