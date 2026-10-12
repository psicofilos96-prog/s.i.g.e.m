-- Centro de Operações L03: hierarquia física escola → prédio/bloco → pavimento → ambiente → instalação/equipamento.
-- Escola vem só de institutional_schools. Tipos são configuração versionada aprovada por pessoa ≠ autor.
-- Espaço = identidade + versões append-only (base esperada); nada é sobrescrito.

CREATE TABLE public.ops_space_type_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL CHECK (type_key ~ '^[a-z0-9-]{2,60}$'),
  version int NOT NULL CHECK (version >= 1),
  level text NOT NULL CHECK (level IN ('predio','pavimento','ambiente','instalacao')),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 120),
  allowed_conditions text[] NOT NULL DEFAULT '{}',
  accessibility_features text[] NOT NULL DEFAULT '{}',
  capacity_unit text,
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type_key, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.ops_space_type_approvals (
  type_version_id uuid PRIMARY KEY REFERENCES public.ops_space_type_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ops_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  parent_id uuid REFERENCES public.ops_spaces(id),
  level text NOT NULL CHECK (level IN ('predio','pavimento','ambiente','instalacao')),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((level = 'predio') = (parent_id IS NULL))
);
CREATE INDEX ops_spaces_school_idx ON public.ops_spaces(school_id, parent_id);

CREATE TABLE public.ops_space_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.ops_spaces(id),
  version int NOT NULL CHECK (version >= 1),
  type_version_id uuid NOT NULL REFERENCES public.ops_space_type_versions(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  capacity numeric CHECK (capacity IS NULL OR capacity >= 0),
  capacity_source text,
  accessibility text[] NOT NULL DEFAULT '{}',
  condition text,
  condition_assessed_on date,
  restrictions text CHECK (restrictions IS NULL OR length(btrim(restrictions)) >= 5),
  valid_from date NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','desativado')),
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, version),
  CHECK (version = 1 OR reason IS NOT NULL),
  CHECK ((capacity IS NULL) = (capacity_source IS NULL)),
  CHECK ((condition IS NULL) = (condition_assessed_on IS NULL))
);

GRANT SELECT ON public.ops_space_type_versions, public.ops_space_type_approvals, public.ops_spaces, public.ops_space_versions TO authenticated;
GRANT ALL ON public.ops_space_type_versions, public.ops_space_type_approvals, public.ops_spaces, public.ops_space_versions TO service_role;
ALTER TABLE public.ops_space_type_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_space_type_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_space_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "space types readable by persons" ON public.ops_space_type_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "space type approvals readable by persons" ON public.ops_space_type_approvals FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "spaces by school" ON public.ops_spaces FOR SELECT TO authenticated USING (public.ops_can_read('infraestrutura', school_id));
CREATE POLICY "space versions by school" ON public.ops_space_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = space_id AND public.ops_can_read('infraestrutura', s.school_id)));

CREATE TRIGGER opsst_immutable BEFORE UPDATE OR DELETE ON public.ops_space_type_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssta_immutable BEFORE UPDATE OR DELETE ON public.ops_space_type_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opss_immutable BEFORE UPDATE OR DELETE ON public.ops_spaces FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssv_immutable BEFORE UPDATE OR DELETE ON public.ops_space_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_ops_space_type_version(_key text, _expected_version int, _level text, _label text,
  _conditions text[], _features text[], _capacity_unit text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstype:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-tipos-de-espaco') THEN RAISE EXCEPTION 'opstype:forbidden'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_space_type_versions WHERE type_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opstype:conflict'; END IF;
  IF _last > 0 AND EXISTS (SELECT 1 FROM public.ops_space_type_versions WHERE type_key = _key AND level <> _level) THEN RAISE EXCEPTION 'opstype:level-change'; END IF;
  INSERT INTO public.ops_space_type_versions(type_key, version, level, label, allowed_conditions, accessibility_features, capacity_unit, author_person, reason)
  VALUES (_key, _last + 1, _level, btrim(_label), coalesce(_conditions,'{}'), coalesce(_features,'{}'), nullif(btrim(_capacity_unit),''), _p, nullif(btrim(_reason),''))
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opstype:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_space_type_version(_type_version uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstype:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-tipos-de-espaco') THEN RAISE EXCEPTION 'opstype:approve-forbidden'; END IF;
  SELECT author_person INTO _author FROM public.ops_space_type_versions WHERE id = _type_version;
  IF _author IS NULL THEN RAISE EXCEPTION 'opstype:unavailable'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'opstype:self-approval'; END IF;
  INSERT INTO public.ops_space_type_approvals(type_version_id, approver_person, decision_ref) VALUES (_type_version, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opstype:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opstype:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.ops_space_type_usable(_tv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.ops_space_type_versions t JOIN public.ops_space_type_approvals a ON a.type_version_id = t.id
    WHERE t.id = _tv AND t.version = (SELECT max(version) FROM public.ops_space_type_versions x WHERE x.type_key = t.type_key))
$$;

CREATE OR REPLACE FUNCTION public.ops_space_parent_level(_level text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE _level WHEN 'pavimento' THEN 'predio' WHEN 'ambiente' THEN 'pavimento' WHEN 'instalacao' THEN 'ambiente' ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.register_ops_space(_school text, _parent uuid, _level text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _par public.ops_spaces;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsspace:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_spaces WHERE idempotency_key = _key AND school_id = _school;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('manter-espacos-escolares', _school) THEN RAISE EXCEPTION 'opsspace:unavailable'; END IF;
  IF _parent IS NOT NULL THEN
    SELECT * INTO _par FROM public.ops_spaces WHERE id = _parent;
    IF _par.id IS NULL OR _par.school_id <> _school OR _par.level IS DISTINCT FROM public.ops_space_parent_level(_level) THEN RAISE EXCEPTION 'opsspace:invalid-parent'; END IF;
  END IF;
  INSERT INTO public.ops_spaces(school_id, parent_id, level, author_person, idempotency_key) VALUES (_school, _parent, _level, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'opsspace:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_space_version(_space uuid, _expected_version int, _type_version uuid, _name text,
  _capacity numeric, _capacity_source text, _accessibility text[], _condition text, _assessed_on date, _restrictions text,
  _valid_from date, _status text, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s public.ops_spaces; _t public.ops_space_type_versions; _last int; _v int; _prev date;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsspace:no-person'; END IF;
  SELECT version INTO _v FROM public.ops_space_versions WHERE idempotency_key = _key AND space_id = _space;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  SELECT * INTO _s FROM public.ops_spaces WHERE id = _space FOR UPDATE;
  IF _s.id IS NULL OR NOT public.has_school_capability('manter-espacos-escolares', _s.school_id) THEN RAISE EXCEPTION 'opsspace:unavailable'; END IF;
  SELECT coalesce(max(version),0), max(valid_from) INTO _last, _prev FROM public.ops_space_versions WHERE space_id = _space;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opsspace:conflict'; END IF;
  IF _prev IS NOT NULL AND _valid_from < _prev THEN RAISE EXCEPTION 'opsspace:retroactive'; END IF;
  SELECT * INTO _t FROM public.ops_space_type_versions WHERE id = _type_version;
  IF _t.id IS NULL OR _t.level <> _s.level OR NOT public.ops_space_type_usable(_type_version) THEN RAISE EXCEPTION 'opsspace:type-not-approved'; END IF;
  IF _condition IS NOT NULL AND NOT (_condition = ANY (_t.allowed_conditions)) THEN RAISE EXCEPTION 'opsspace:condition-not-configured'; END IF;
  IF _assessed_on IS NOT NULL AND _assessed_on > current_date THEN RAISE EXCEPTION 'opsspace:invalid-date'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_accessibility,'{}')) f WHERE NOT (f = ANY (_t.accessibility_features))) THEN RAISE EXCEPTION 'opsspace:feature-not-configured'; END IF;
  INSERT INTO public.ops_space_versions(space_id, version, type_version_id, name, capacity, capacity_source, accessibility, condition, condition_assessed_on,
    restrictions, valid_from, status, author_person, reason, idempotency_key)
  VALUES (_space, _last + 1, _type_version, btrim(_name), _capacity, nullif(btrim(_capacity_source),''), coalesce(_accessibility,'{}'), _condition, _assessed_on,
    nullif(btrim(_restrictions),''), _valid_from, coalesce(_status,'ativo'), _p, nullif(btrim(_reason),''), _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsspace:invalid';
END $$;

REVOKE ALL ON FUNCTION public.register_ops_space_type_version(text,int,text,text,text[],text[],text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_space_type_version(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_ops_space(text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_space_version(uuid,int,uuid,text,numeric,text,text[],text,date,text,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ops_space_type_version(text,int,text,text,text[],text[],text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_space_type_version(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_ops_space(text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_space_version(uuid,int,uuid,text,numeric,text,text[],text,date,text,date,text,text,text) TO authenticated;
