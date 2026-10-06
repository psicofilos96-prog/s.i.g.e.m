-- AI — Alimentação Escolar: unidade/cozinha atendente (vínculo temporal com escolas), publicação governada do
-- cardápio à família, livro de movimentação de estoque só sobre catálogos homologados (sem seed: INVENTORY_CATALOG_PENDING),
-- visão de rede com grandezas separadas (previsto, informado, dias) e automação sem DML.
-- Capabilities novas (sem regra; fechadas até homologação): rede manter-unidades-de-alimentacao · acompanhar-alimentacao-rede;
-- escola/rede publicar-cardapio-escolar · registrar-estoque-alimentar. Nenhum valor nutricional, per capita, PNAE ou estoque mínimo.

CREATE OR REPLACE FUNCTION public.meal_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-cardapio-escolar','registrar-execucao-alimentacao','consultar-alimentacao-escolar','registrar-restricao-alimentar','consultar-restricao-alimentar',
                         'publicar-cardapio-escolar','registrar-estoque-alimentar')
    THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;

CREATE FUNCTION public.meal_network_grant(_capability text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-unidades-de-alimentacao','acompanhar-alimentacao-rede') THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_grant(text) FROM PUBLIC, anon, authenticated, service_role;

-- 1 — unidade/cozinha e escolas atendidas
CREATE TABLE public.meal_kitchens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.meal_kitchen_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid NOT NULL REFERENCES public.meal_kitchens(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_kitchen_versions(id),
  name text NOT NULL CHECK (length(btrim(name)) > 0 AND length(name) <= 200),
  host_school_id text,
  valid_from date NOT NULL, valid_to date, CHECK (valid_to IS NULL OR valid_to >= valid_from),
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kitchen_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.meal_kitchen_school_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_kitchen_school_links(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','encerramento')),
  kitchen_id uuid NOT NULL REFERENCES public.meal_kitchens(id),
  school_id text NOT NULL,
  valid_from date NOT NULL, valid_to date, CHECK (valid_to IS NULL OR valid_to >= valid_from),
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
-- 2 — publicação do cardápio à família: ato próprio sobre a versão vigente; retificar o cardápio exige republicar.
CREATE TABLE public.meal_menu_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_logical_id uuid NOT NULL,
  menu_version_id uuid NOT NULL REFERENCES public.meal_menu_versions(id),
  school_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  action text NOT NULL CHECK (action IN ('publicacao','retirada')),
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_logical_id, sequence),
  CHECK (action = 'publicacao' OR length(btrim(coalesce(reason,''))) > 0)
);
-- 4 — livro de estoque: item e unidade só de catálogos homologados; sem saldo mínimo nem regra de consumo.
CREATE TABLE public.meal_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_inventory_movements(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','anulacao')),
  school_id text NOT NULL,
  item_value_id text NOT NULL, item_value_version integer NOT NULL,
  unit_value_id text NOT NULL, unit_value_version integer NOT NULL,
  movement_kind text NOT NULL CHECK (movement_kind IN ('entrada','saida','ajuste')),
  quantity numeric(14,3) NOT NULL CHECK (quantity >= 0),
  moved_on date NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 300),
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['meal_kitchens','meal_kitchen_versions','meal_kitchen_school_links','meal_menu_publications','meal_inventory_movements'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.import_append_only()', t || '_append_only', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['meal_menu_versions','meal_forecasts','meal_service_records','dietary_restrictions'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM service_role', t);
  END LOOP;
END $$;
CREATE UNIQUE INDEX meal_kitchen_versions_one_successor ON public.meal_kitchen_versions (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE UNIQUE INDEX meal_kitchen_links_one_successor ON public.meal_kitchen_school_links (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE UNIQUE INDEX meal_inventory_one_successor ON public.meal_inventory_movements (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX meal_inventory_school ON public.meal_inventory_movements (school_id, moved_on);

CREATE FUNCTION public.meal_catalog_version(_scheme text, _value text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT max(d.version) FROM public.attribute_value_definitions d WHERE d.scheme_id = _scheme AND d.value_id = _value AND d.status = 'homologada'
$fn$;
REVOKE ALL ON FUNCTION public.meal_catalog_version(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Writers ------------------------------------------------------------------------------------------
CREATE FUNCTION public.record_meal_kitchen(_kitchen uuid, _expected_version integer, _name text, _host_school text, _from date, _to date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; head public.meal_kitchen_versions; k uuid := _kitchen;
BEGIN
  me := public.af_natural_person();
  g := public.meal_network_grant('manter-unidades-de-alimentacao');
  IF _from IS NULL THEN RAISE EXCEPTION 'meal:valid-from-required'; END IF;
  IF _host_school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _host_school) THEN RAISE EXCEPTION 'meal:school-unknown'; END IF;
  IF k IS NULL THEN
    IF _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:stale'; END IF;
    INSERT INTO public.meal_kitchens DEFAULT VALUES RETURNING id INTO k;
  ELSE
    PERFORM 1 FROM public.meal_kitchens WHERE id = k FOR UPDATE;
    SELECT * INTO head FROM public.meal_kitchen_versions WHERE kitchen_id = k ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:kitchen-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
  END IF;
  INSERT INTO public.meal_kitchen_versions(kitchen_id, version, supersedes_id, name, host_school_id, valid_from, valid_to, reason, author_user_id, author_person_id, author_engagement)
  VALUES (k, coalesce(head.version,0)+1, head.id, btrim(_name), _host_school, _from, _to, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN k;
END $fn$;

CREATE FUNCTION public.record_meal_kitchen_link(_base_id uuid, _kind text, _kitchen uuid, _school text, _from date, _to date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.meal_kitchen_school_links; r uuid;
BEGIN
  me := public.af_natural_person();
  g := public.meal_network_grant('manter-unidades-de-alimentacao');
  IF _kind NOT IN ('registro','retificacao','encerramento') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_kitchen_school_links WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_kitchen_school_links WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'encerramento' THEN RAISE EXCEPTION 'meal:already-closed'; END IF;
    _kitchen := base.kitchen_id; _school := base.school_id;
    IF _kind = 'encerramento' THEN _from := base.valid_from; IF _to IS NULL THEN RAISE EXCEPTION 'meal:valid-to-required'; END IF; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.meal_kitchens WHERE id = _kitchen) THEN RAISE EXCEPTION 'meal:kitchen-unknown'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'meal:school-unknown'; END IF;
  IF _from IS NULL THEN RAISE EXCEPTION 'meal:valid-from-required'; END IF;
  -- uma escola é atendida por uma unidade de cada vez
  IF _kind <> 'encerramento' AND EXISTS (SELECT 1 FROM public.meal_kitchen_school_links l WHERE l.school_id = _school
       AND l.logical_id <> coalesce(base.logical_id, '00000000-0000-0000-0000-000000000000'::uuid) AND l.event_kind <> 'encerramento'
       AND NOT EXISTS (SELECT 1 FROM public.meal_kitchen_school_links x WHERE x.supersedes_id = l.id)
       AND daterange(l.valid_from, l.valid_to, '[]') && daterange(_from, _to, '[]'))
  THEN RAISE EXCEPTION 'meal:school-already-served'; END IF;
  INSERT INTO public.meal_kitchen_school_links(logical_id, version, supersedes_id, event_kind, kitchen_id, school_id, valid_from, valid_to, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _kitchen, _school, _from, _to, nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_meal_menu_publication(_menu_version uuid, _expected_sequence integer, _action text, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; m public.meal_menu_versions; last public.meal_menu_publications; s integer;
BEGIN
  me := public.af_natural_person();
  SELECT * INTO m FROM public.meal_menu_versions WHERE id = _menu_version;
  IF m.id IS NULL THEN RAISE EXCEPTION 'meal:menu-unknown'; END IF;
  g := public.meal_grant('publicar-cardapio-escolar', m.school_id);
  IF _action NOT IN ('publicacao','retirada') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  PERFORM 1 FROM public.meal_menu_versions WHERE logical_id = m.logical_id FOR UPDATE;
  SELECT * INTO last FROM public.meal_menu_publications WHERE menu_logical_id = m.logical_id ORDER BY sequence DESC LIMIT 1;
  IF coalesce(last.sequence, 0) IS DISTINCT FROM coalesce(_expected_sequence, 0) THEN RAISE EXCEPTION 'meal:stale'; END IF;
  IF _action = 'publicacao' THEN
    IF EXISTS (SELECT 1 FROM public.meal_menu_versions x WHERE x.supersedes_id = m.id) THEN RAISE EXCEPTION 'meal:menu-superseded'; END IF;
    IF m.event_kind = 'revogacao' THEN RAISE EXCEPTION 'meal:menu-revoked'; END IF;
    IF last.action = 'publicacao' AND last.menu_version_id = m.id THEN RAISE EXCEPTION 'meal:already-published'; END IF;
  ELSIF last.id IS NULL OR last.action <> 'publicacao' THEN RAISE EXCEPTION 'meal:not-published';
  END IF;
  s := coalesce(last.sequence, 0) + 1;
  INSERT INTO public.meal_menu_publications(menu_logical_id, menu_version_id, school_id, sequence, action, reason, author_user_id, author_person_id, author_engagement)
  VALUES (m.logical_id, m.id, m.school_id, s, _action, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN s;
END $fn$;

CREATE FUNCTION public.record_meal_inventory_movement(_base_id uuid, _kind text, _school text, _item text, _unit text, _movement text, _quantity numeric, _on date, _note text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.meal_inventory_movements; iv integer; uv integer; r uuid;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'meal:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.meal_inventory_movements WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_inventory_movements WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'meal:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'meal:already-revoked'; END IF;
    _school := base.school_id;
    IF _kind = 'anulacao' THEN _item := base.item_value_id; _unit := base.unit_value_id; _movement := base.movement_kind; _quantity := base.quantity; _on := base.moved_on; _note := base.note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'meal:base-not-allowed';
  END IF;
  g := public.meal_grant('registrar-estoque-alimentar', _school);
  iv := public.meal_catalog_version('item-de-estoque-alimentar', _item);
  uv := public.meal_catalog_version('unidade-de-medida-alimentar', _unit);
  IF iv IS NULL OR uv IS NULL THEN RAISE EXCEPTION 'meal:inventory-catalog-pending'; END IF;
  IF _on IS NULL OR _on > CURRENT_DATE THEN RAISE EXCEPTION 'meal:movement-date-invalid'; END IF;
  IF _quantity IS NULL OR _quantity < 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
  INSERT INTO public.meal_inventory_movements(logical_id, version, supersedes_id, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version,
    movement_kind, quantity, moved_on, note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _item, iv, _unit, uv, _movement, _quantity, _on,
    nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $fn$;

-- Readers ------------------------------------------------------------------------------------------
CREATE FUNCTION public.meal_kitchens_at(_on date)
RETURNS TABLE(kitchen_id uuid, version integer, name text, host_school_id text, valid_from date, valid_to date, served_schools text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE net boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:date-required'; END IF;
  net := EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL AND c.scope_level = 'rede'
           AND c.capability_id IN ('manter-unidades-de-alimentacao','acompanhar-alimentacao-rede','consultar-alimentacao-escolar'));
  RETURN QUERY WITH heads AS (
      SELECT DISTINCT ON (v.kitchen_id) v.* FROM public.meal_kitchen_versions v ORDER BY v.kitchen_id, v.version DESC),
    links AS (
      SELECT l.kitchen_id, l.school_id FROM public.meal_kitchen_school_links l WHERE l.event_kind <> 'encerramento'
        AND NOT EXISTS (SELECT 1 FROM public.meal_kitchen_school_links x WHERE x.supersedes_id = l.id)
        AND l.valid_from <= _on AND (l.valid_to IS NULL OR l.valid_to >= _on)),
    mine AS (
      SELECT c.school_id FROM public.effective_scope_capabilities(CURRENT_DATE) c
       WHERE c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.capability_id = 'consultar-alimentacao-escolar')
    SELECT h.kitchen_id, h.version, h.name, h.host_school_id, h.valid_from, h.valid_to,
      coalesce((SELECT array_agg(l.school_id ORDER BY l.school_id) FROM links l WHERE l.kitchen_id = h.kitchen_id
                 AND (net OR l.school_id IN (SELECT school_id FROM mine))), '{}')
      FROM heads h
     WHERE net OR EXISTS (SELECT 1 FROM links l WHERE l.kitchen_id = h.kitchen_id AND l.school_id IN (SELECT school_id FROM mine))
     ORDER BY h.name;
END $fn$;

CREATE FUNCTION public.meal_menu_publications_at(_school text)
RETURNS TABLE(menu_logical_id uuid, menu_version_id uuid, sequence integer, action text, reason text, recorded_at timestamptz, current_version boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.meal_grant('consultar-alimentacao-escolar', _school);
  RETURN QUERY SELECT p.menu_logical_id, p.menu_version_id, p.sequence, p.action, p.reason, p.recorded_at,
      NOT EXISTS (SELECT 1 FROM public.meal_menu_versions x WHERE x.supersedes_id = p.menu_version_id)
    FROM public.meal_menu_publications p WHERE p.school_id = _school ORDER BY p.menu_logical_id, p.sequence;
END $fn$;

-- Família: só cardápio publicado (última ação = publicação da versão vigente), da escola de educando com autorização vigente.
CREATE FUNCTION public.family_published_menus(_student text, _on date)
RETURNS TABLE(school_id text, starts_on date, ends_on date, entries jsonb, published_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sch text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:date-required'; END IF;
  SELECT a.school_id INTO sch FROM public.guardian_authorizations a
   WHERE a.guardian_user_id = auth.uid() AND a.student_id = _student AND a.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
     AND a.valid_from <= _on AND (a.valid_until IS NULL OR a.valid_until >= _on)
   ORDER BY a.recorded_at DESC LIMIT 1;
  IF sch IS NULL THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  RETURN QUERY SELECT m.school_id, m.starts_on, m.ends_on, m.entries, p.recorded_at
    FROM (SELECT DISTINCT ON (q.menu_logical_id) q.* FROM public.meal_menu_publications q WHERE q.school_id = sch ORDER BY q.menu_logical_id, q.sequence DESC) p
    JOIN public.meal_menu_versions m ON m.id = p.menu_version_id
   WHERE p.action = 'publicacao' AND m.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.meal_menu_versions x WHERE x.supersedes_id = m.id)
     AND m.ends_on >= _on - 31 AND m.starts_on <= _on + 62
   ORDER BY m.starts_on;
END $fn$;

CREATE FUNCTION public.meal_inventory_at(_school text, _from date, _to date, _known_at timestamptz)
RETURNS SETOF public.meal_inventory_movements LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF public.meal_grant('registrar-estoque-alimentar', _school) IS NULL THEN RAISE EXCEPTION 'capability:registrar-estoque-alimentar'; END IF;
  RETURN QUERY SELECT m.* FROM public.meal_inventory_movements m
   WHERE m.school_id = _school AND m.recorded_at <= k AND m.moved_on BETWEEN _from AND _to
     AND NOT EXISTS (SELECT 1 FROM public.meal_inventory_movements s WHERE s.supersedes_id = m.id AND s.recorded_at <= k)
   ORDER BY m.moved_on LIMIT 2000;
END $fn$;

-- 7 — rede: grandezas separadas por escola; null = não informado, nunca zero; sem cobertura nutricional.
CREATE FUNCTION public.meal_network_overview(_from date, _to date)
RETURNS TABLE(school_id text, forecast_total integer, forecast_days integer, served_total integer, served_days integer,
  served_unknown_records integer, menu_days integer, published_menus integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.meal_network_grant('acompanhar-alimentacao-rede');
  IF _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > 370 THEN RAISE EXCEPTION 'meal:period-invalid'; END IF;
  RETURN QUERY WITH f AS (
      SELECT x.school_id, sum(x.forecast_count)::int t, count(DISTINCT x.served_on)::int d FROM public.meal_forecasts x
       WHERE x.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.meal_forecasts y WHERE y.supersedes_id = x.id)
         AND x.served_on BETWEEN _from AND _to GROUP BY 1),
    s AS (
      SELECT x.school_id, CASE WHEN count(x.served_count) = 0 THEN NULL ELSE sum(x.served_count)::int END t,
             count(DISTINCT x.served_on) FILTER (WHERE x.served_count IS NOT NULL)::int d,
             count(*) FILTER (WHERE x.served_count IS NULL)::int u FROM public.meal_service_records x
       WHERE x.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.meal_service_records y WHERE y.supersedes_id = x.id)
         AND x.served_on BETWEEN _from AND _to GROUP BY 1),
    m AS (
      SELECT x.school_id, count(DISTINCT (e->>'date'))::int d FROM public.meal_menu_versions x, jsonb_array_elements(x.entries) e
       WHERE x.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.meal_menu_versions y WHERE y.supersedes_id = x.id)
         AND (e->>'date')::date BETWEEN _from AND _to GROUP BY 1),
    p AS (
      SELECT q.school_id, count(*)::int n FROM (SELECT DISTINCT ON (z.menu_logical_id) z.* FROM public.meal_menu_publications z ORDER BY z.menu_logical_id, z.sequence DESC) q
       WHERE q.action = 'publicacao' GROUP BY 1),
    sc AS (SELECT school_id FROM f UNION SELECT school_id FROM s UNION SELECT school_id FROM m UNION SELECT school_id FROM p)
    SELECT sc.school_id, f.t, f.d, s.t, s.d, s.u, m.d, p.n
      FROM sc LEFT JOIN f USING (school_id) LEFT JOIN s USING (school_id) LEFT JOIN m USING (school_id) LEFT JOIN p USING (school_id)
     ORDER BY 1;
END $fn$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_meal_kitchen(uuid,integer,text,text,date,date,text)','record_meal_kitchen_link(uuid,text,uuid,text,date,date,text)',
    'record_meal_menu_publication(uuid,integer,text,text)','record_meal_inventory_movement(uuid,text,text,text,text,text,numeric,date,text,text)',
    'meal_kitchens_at(date)','meal_menu_publications_at(text)','family_published_menus(text,date)','meal_inventory_at(text,date,date,timestamptz)',
    'meal_network_overview(date,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
