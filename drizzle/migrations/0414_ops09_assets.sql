-- Centro de Operações L09: bens permanentes. Identificador interno (gerado) ≠ tombamento oficial (registrado só com fonte
-- e documento, único na rede, nunca gerado). Sem valor contábil, depreciação ou empenho: o SIGEM não é cadastro contábil.
CREATE TABLE public.ops_asset_category_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL CHECK (category_key ~ '^[a-z0-9-]{2,80}$'),
  version int NOT NULL CHECK (version >= 1),
  label text NOT NULL CHECK (length(btrim(label)) >= 2),
  allowed_conditions text[] NOT NULL DEFAULT '{}',
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, version), CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.ops_asset_category_approvals (
  category_version_id uuid PRIMARY KEY REFERENCES public.ops_asset_category_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE public.ops_asset_internal_seq;
CREATE TABLE public.ops_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_code text NOT NULL UNIQUE,
  category_version_id uuid NOT NULL REFERENCES public.ops_asset_category_versions(id),
  description text NOT NULL CHECK (length(btrim(description)) >= 3),
  origin text NOT NULL CHECK (origin IN ('aquisicao','doacao','transferencia','cessao','comodato','producao-propria','outra')),
  origin_ref text NOT NULL CHECK (length(btrim(origin_ref)) >= 3),
  incorporated_on date NOT NULL,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('localizacao','responsavel','estado','tombamento-oficial','documento','baixa')),
  school_id text REFERENCES public.institutional_schools(id),
  space_id uuid REFERENCES public.ops_spaces(id),
  engagement_id uuid REFERENCES public.institutional_engagements(id),
  condition text,
  official_tag text,
  official_source text,
  doc_ref uuid REFERENCES public.admin_case_events(id),
  effective_on date NOT NULL,
  note text,
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, seq),
  CHECK (kind <> 'localizacao' OR school_id IS NOT NULL),
  CHECK (kind <> 'responsavel' OR engagement_id IS NOT NULL),
  CHECK (kind <> 'estado' OR condition IS NOT NULL),
  CHECK (kind <> 'tombamento-oficial' OR (length(btrim(coalesce(official_tag,''))) >= 1 AND length(btrim(coalesce(official_source,''))) >= 3 AND doc_ref IS NOT NULL)),
  CHECK (kind NOT IN ('documento','baixa') OR doc_ref IS NOT NULL),
  CHECK (kind <> 'baixa' OR length(btrim(coalesce(note,''))) >= 10)
);
CREATE UNIQUE INDEX ops_asset_official_tag_unique ON public.ops_asset_events (official_tag) WHERE kind = 'tombamento-oficial';
CREATE INDEX ops_asset_events_school ON public.ops_asset_events (school_id) WHERE school_id IS NOT NULL;

-- Escola corrente do bem (última localização) para RLS e writers.
CREATE OR REPLACE FUNCTION public.ops_asset_school(_a uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT school_id FROM public.ops_asset_events WHERE asset_id = _a AND kind = 'localizacao' ORDER BY seq DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.ops_asset_readable(_a uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.ops_asset_events e WHERE e.asset_id = _a AND e.kind = 'localizacao' AND public.ops_can_read('patrimonio', e.school_id))
$$;

GRANT SELECT ON public.ops_asset_category_versions, public.ops_asset_category_approvals, public.ops_assets TO authenticated;
GRANT SELECT (id, asset_id, seq, kind, school_id, space_id, engagement_id, condition, official_tag, official_source, effective_on, note, actor_person, idempotency_key, created_at) ON public.ops_asset_events TO authenticated;
GRANT ALL ON public.ops_asset_category_versions, public.ops_asset_category_approvals, public.ops_assets, public.ops_asset_events TO service_role;
ALTER TABLE public.ops_asset_category_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_asset_category_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_asset_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset categories readable" ON public.ops_asset_category_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "asset category approvals readable" ON public.ops_asset_category_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets by school" ON public.ops_assets FOR SELECT TO authenticated USING (public.ops_asset_readable(id));
CREATE POLICY "asset events by school" ON public.ops_asset_events FOR SELECT TO authenticated USING (public.ops_asset_readable(asset_id));
CREATE TRIGGER opsacv_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_category_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsaca_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_category_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsa_immutable BEFORE UPDATE OR DELETE ON public.ops_assets FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsae_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_ops_asset_category(_key text, _expected_version int, _label text, _conditions text[], _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsac:no-person'; END IF;
  IF NOT public.has_capability('configurar-categorias-patrimoniais') THEN RAISE EXCEPTION 'opsac:forbidden'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_asset_category_versions WHERE category_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opsac:conflict'; END IF;
  INSERT INTO public.ops_asset_category_versions(category_key, version, label, allowed_conditions, author_person, reason)
  VALUES (_key, _last + 1, btrim(_label), coalesce(_conditions,'{}'), _p, nullif(btrim(_reason),'')) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsac:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_asset_category(_cv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.ops_asset_category_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsac:no-person'; END IF;
  IF NOT public.has_capability('aprovar-categorias-patrimoniais') THEN RAISE EXCEPTION 'opsac:approve-forbidden'; END IF;
  SELECT * INTO _v FROM public.ops_asset_category_versions WHERE id = _cv;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'opsac:not-found'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'opsac:self-approval'; END IF;
  INSERT INTO public.ops_asset_category_approvals(category_version_id, approver_person, decision_ref) VALUES (_cv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsac:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opsac:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.ops_asset_category_usable(_cv uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.ops_asset_category_versions v JOIN public.ops_asset_category_approvals a ON a.category_version_id = v.id
    WHERE v.id = _cv AND v.version = (SELECT max(version) FROM public.ops_asset_category_versions x WHERE x.category_key = v.category_key))
$$;

-- Incorporação: cria identidade com código interno e primeira localização numa transação.
CREATE OR REPLACE FUNCTION public.incorporate_ops_asset(_cv uuid, _description text, _origin text, _origin_ref text, _incorporated date,
  _school text, _space uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsa:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_assets WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('incorporar-bens', _school) THEN RAISE EXCEPTION 'opsa:forbidden'; END IF;
  IF NOT public.ops_asset_category_usable(_cv) THEN RAISE EXCEPTION 'opsa:category-not-approved'; END IF;
  IF _incorporated > current_date THEN RAISE EXCEPTION 'opsa:future-date'; END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _school) THEN RAISE EXCEPTION 'opsa:invalid-space'; END IF;
  INSERT INTO public.ops_assets(internal_code, category_version_id, description, origin, origin_ref, incorporated_on, author_person, idempotency_key)
  VALUES ('SIGEM-BEM-' || lpad(nextval('public.ops_asset_internal_seq')::text, 8, '0'), _cv, btrim(_description), _origin, btrim(_origin_ref), _incorporated, _p, _key)
  RETURNING id INTO _id;
  INSERT INTO public.ops_asset_events(asset_id, seq, kind, school_id, space_id, effective_on, actor_person, idempotency_key)
  VALUES (_id, 1, 'localizacao', _school, _space, _incorporated, _p, _key || '#loc');
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsa:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_asset_event(_a uuid, _expected_seq int, _kind text, _school text, _space uuid, _engagement uuid,
  _condition text, _tag text, _source text, _doc uuid, _on date, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _asset public.ops_assets; _cur text; _last int; _seq int; _target text; _conds text[];
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsa:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_asset_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _asset FROM public.ops_assets WHERE id = _a FOR UPDATE;
  IF _asset.id IS NULL THEN RAISE EXCEPTION 'opsa:unavailable'; END IF;
  _cur := public.ops_asset_school(_a);
  IF NOT public.has_school_capability('manter-bens', _cur) THEN RAISE EXCEPTION 'opsa:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _a AND kind = 'baixa') THEN RAISE EXCEPTION 'opsa:written-off'; END IF;
  SELECT max(seq) INTO _last FROM public.ops_asset_events WHERE asset_id = _a;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsa:conflict'; END IF;
  IF _on > current_date OR _on < _asset.incorporated_on THEN RAISE EXCEPTION 'opsa:invalid-date'; END IF;
  _target := CASE WHEN _kind = 'localizacao' THEN _school ELSE _cur END;
  IF _kind = 'localizacao' AND _school <> _cur AND NOT public.has_school_capability('manter-bens', _school) THEN RAISE EXCEPTION 'opsa:target-forbidden'; END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _target) THEN RAISE EXCEPTION 'opsa:invalid-space'; END IF;
  IF _kind = 'responsavel' AND NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement AND e.school_id = _cur
     AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)) THEN RAISE EXCEPTION 'opsa:responsible-not-active'; END IF;
  IF _kind = 'estado' THEN
    SELECT allowed_conditions INTO _conds FROM public.ops_asset_category_versions WHERE id = _asset.category_version_id;
    IF NOT (_condition = ANY(_conds)) THEN RAISE EXCEPTION 'opsa:condition-not-in-category'; END IF;
  END IF;
  IF _kind = 'tombamento-oficial' AND NOT public.has_school_capability('registrar-tombamento-oficial', _cur) THEN RAISE EXCEPTION 'opsa:tag-forbidden'; END IF;
  IF _kind = 'tombamento-oficial' AND EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _a AND kind = 'tombamento-oficial') THEN RAISE EXCEPTION 'opsa:already-tagged'; END IF;
  IF _kind = 'baixa' AND NOT public.has_school_capability('baixar-bens', _cur) THEN RAISE EXCEPTION 'opsa:writeoff-forbidden'; END IF;
  INSERT INTO public.ops_asset_events(asset_id, seq, kind, school_id, space_id, engagement_id, condition, official_tag, official_source, doc_ref, effective_on, note, actor_person, idempotency_key)
  VALUES (_a, _last + 1, _kind, CASE WHEN _kind = 'localizacao' THEN _school END, CASE WHEN _kind = 'localizacao' THEN _space END,
    _engagement, _condition, nullif(btrim(_tag),''), nullif(btrim(_source),''), _doc, _on, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsa:tag-in-use';
  WHEN check_violation THEN RAISE EXCEPTION 'opsa:invalid';
END $$;

REVOKE ALL ON FUNCTION public.ops_asset_school(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_asset_readable(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ops_asset_category_usable(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_ops_asset_category(text,int,text,text[],text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_asset_category(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.incorporate_ops_asset(uuid,text,text,text,date,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_asset_event(uuid,int,text,text,uuid,uuid,text,text,text,uuid,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_asset_readable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_asset_category_usable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_ops_asset_category(text,int,text,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_asset_category(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incorporate_ops_asset(uuid,text,text,text,date,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_asset_event(uuid,int,text,text,uuid,uuid,text,text,text,uuid,date,text,text) TO authenticated;
REVOKE SELECT ON public.ops_asset_events FROM authenticated;
GRANT SELECT (id, asset_id, seq, kind, school_id, space_id, engagement_id, condition, official_tag, official_source, effective_on, note, actor_person, idempotency_key, created_at) ON public.ops_asset_events TO authenticated;
REVOKE ALL ON SEQUENCE public.ops_asset_internal_seq FROM PUBLIC, anon, authenticated;