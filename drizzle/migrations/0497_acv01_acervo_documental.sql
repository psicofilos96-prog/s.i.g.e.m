-- ACERVO DOCUMENTAL POR SETOR (ACV.1). Espaço = estação setorial (+ escola); bytes no bucket privado acervo-documental,
-- metadados aqui; toda escrita só por funções DEFINER (sem DML para authenticated); eventos append-only; sem eliminação.
CREATE TABLE public.acv_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_code text NOT NULL,
  school_id text,
  quota_bytes bigint CHECK (quota_bytes IS NULL OR quota_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX acv_spaces_uq ON public.acv_spaces (station_code, coalesce(school_id, ''));

CREATE TABLE public.acv_space_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.acv_spaces(id),
  person_id uuid, principal_id uuid,
  role text NOT NULL,
  granted_by_person uuid, granted_by_principal uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz, revoked_by_person uuid, revoked_by_principal uuid,
  CHECK ((person_id IS NULL) <> (principal_id IS NULL))
);

CREATE TABLE public.acv_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.acv_spaces(id),
  parent_id uuid REFERENCES public.acv_nodes(id),
  kind text NOT NULL CHECK (kind IN ('pasta','arquivo')),
  name text NOT NULL,
  name_key text NOT NULL,
  current_version int,
  is_official boolean NOT NULL DEFAULT false,
  trashed_at timestamptz, trashed_by_person uuid, trashed_by_principal uuid,
  created_by_person uuid, created_by_principal uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX acv_nodes_name_uq ON public.acv_nodes (space_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name_key) WHERE trashed_at IS NULL;
CREATE INDEX acv_nodes_parent ON public.acv_nodes (parent_id);
CREATE INDEX acv_nodes_space ON public.acv_nodes (space_id);

CREATE TABLE public.acv_file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.acv_nodes(id),
  version int NOT NULL CHECK (version >= 1),
  storage_path text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  mime text NOT NULL, ext text NOT NULL,
  copied_from uuid REFERENCES public.acv_file_versions(id),
  created_by_person uuid, created_by_principal uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, version)
);
CREATE INDEX acv_versions_path ON public.acv_file_versions (storage_path);

CREATE TABLE public.acv_acl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.acv_nodes(id),
  person_id uuid, principal_id uuid,
  role text NOT NULL,
  granted_by_person uuid, granted_by_principal uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz, revoked_by_person uuid, revoked_by_principal uuid,
  CHECK ((person_id IS NULL) <> (principal_id IS NULL))
);
CREATE INDEX acv_acl_node ON public.acv_acl (node_id);

CREATE TABLE public.acv_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  auth_user uuid NOT NULL,
  space_id uuid NOT NULL REFERENCES public.acv_spaces(id),
  parent_id uuid REFERENCES public.acv_nodes(id),
  node_id uuid REFERENCES public.acv_nodes(id),
  name text NOT NULL, storage_path text NOT NULL UNIQUE,
  sha256 text NOT NULL, size_bytes bigint NOT NULL, mime text NOT NULL, ext text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido')),
  result_node uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.acv_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.acv_nodes(id),
  case_id uuid NOT NULL,
  person_id uuid, principal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, case_id)
);

CREATE TABLE public.acv_events (
  id bigserial PRIMARY KEY,
  space_id uuid NOT NULL,
  node_id uuid,
  action text NOT NULL,
  actor_person uuid, actor_principal uuid, auth_user uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX acv_events_space ON public.acv_events (space_id, created_at DESC);

CREATE TABLE public.acv_favorites (
  auth_user uuid NOT NULL DEFAULT auth.uid(),
  node_id uuid NOT NULL REFERENCES public.acv_nodes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_user, node_id)
);

GRANT ALL ON public.acv_spaces, public.acv_space_members, public.acv_nodes, public.acv_file_versions, public.acv_acl, public.acv_uploads, public.acv_links, public.acv_events, public.acv_favorites TO service_role;
GRANT USAGE ON SEQUENCE public.acv_events_id_seq TO service_role;
REVOKE ALL ON public.acv_spaces, public.acv_space_members, public.acv_nodes, public.acv_file_versions, public.acv_acl, public.acv_uploads, public.acv_links, public.acv_events, public.acv_favorites FROM anon, authenticated;
GRANT SELECT ON public.acv_spaces, public.acv_space_members, public.acv_nodes, public.acv_file_versions, public.acv_acl, public.acv_uploads, public.acv_links, public.acv_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.acv_favorites TO authenticated;
ALTER TABLE public.acv_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_favorites ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER acv_events_imm BEFORE UPDATE OR DELETE ON public.acv_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER acv_versions_imm BEFORE UPDATE OR DELETE ON public.acv_file_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER acv_links_imm BEFORE UPDATE OR DELETE ON public.acv_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE OR REPLACE FUNCTION public.acv_no_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'acervo:sem-eliminacao'; END $$;
CREATE TRIGGER acv_nodes_nodel BEFORE DELETE ON public.acv_nodes FOR EACH ROW EXECUTE FUNCTION public.acv_no_delete();
CREATE TRIGGER acv_spaces_nodel BEFORE DELETE ON public.acv_spaces FOR EACH ROW EXECUTE FUNCTION public.acv_no_delete();
CREATE TRIGGER acv_members_nodel BEFORE DELETE ON public.acv_space_members FOR EACH ROW EXECUTE FUNCTION public.acv_no_delete();
CREATE TRIGGER acv_acl_nodel BEFORE DELETE ON public.acv_acl FOR EACH ROW EXECUTE FUNCTION public.acv_no_delete();

-- ===== Primitivas de autorização =====
CREATE OR REPLACE FUNCTION public.acv_role_rank(_role text) RETURNS int LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE _role WHEN 'visualizar' THEN 1 WHEN 'enviar' THEN 2 WHEN 'editar' THEN 3 WHEN 'organizar' THEN 4
    WHEN 'excluir' THEN 5 WHEN 'compartilhar' THEN 6 WHEN 'administrar' THEN 7 ELSE 0 END $$;

CREATE OR REPLACE FUNCTION public.acv_person_eligible(_person uuid, _school text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _person IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_engagements e
    WHERE e.person_id = _person AND e.valid_from <= CURRENT_DATE AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
      AND (_school IS NULL OR e.school_id = _school)) $$;

CREATE OR REPLACE FUNCTION public.acv_space_rank(_space uuid) RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _s public.acv_spaces; _p uuid; _pr uuid; _r int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT * INTO _s FROM public.acv_spaces WHERE id = _space;
  IF _s.id IS NULL THEN RETURN 0; END IF;
  _p := public.current_person_id(); _pr := public.current_principal_id();
  IF _pr IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_sector_principals x WHERE x.id = _pr
       AND x.station_code = _s.station_code AND x.school_id IS NOT DISTINCT FROM _s.school_id) THEN RETURN 7; END IF;
  IF _pr IS NOT NULL THEN
    SELECT coalesce(max(public.acv_role_rank(m.role)), 0) INTO _r FROM public.acv_space_members m
     WHERE m.space_id = _space AND m.principal_id = _pr AND m.revoked_at IS NULL;
  END IF;
  IF _p IS NOT NULL AND public.acv_person_eligible(_p, _s.school_id) THEN
    SELECT greatest(_r, coalesce(max(public.acv_role_rank(m.role)), 0)) INTO _r FROM public.acv_space_members m
     WHERE m.space_id = _space AND m.person_id = _p AND m.revoked_at IS NULL;
  END IF;
  RETURN _r;
END $$;

CREATE OR REPLACE FUNCTION public.acv_node_rank(_node uuid) RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _space uuid; _r int; _a int; _p uuid; _pr uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT space_id INTO _space FROM public.acv_nodes WHERE id = _node;
  IF _space IS NULL THEN RETURN 0; END IF;
  _r := public.acv_space_rank(_space);
  IF _r >= 7 THEN RETURN 7; END IF;
  _p := public.current_person_id(); _pr := public.current_principal_id();
  WITH RECURSIVE anc AS (
    SELECT n.id, n.parent_id FROM public.acv_nodes n WHERE n.id = _node
    UNION ALL SELECT n.id, n.parent_id FROM public.acv_nodes n JOIN anc ON n.id = anc.parent_id)
  SELECT coalesce(max(public.acv_role_rank(a.role)), 0) INTO _a FROM public.acv_acl a JOIN anc ON a.node_id = anc.id
   WHERE a.revoked_at IS NULL AND ((_pr IS NOT NULL AND a.principal_id = _pr)
      OR (_p IS NOT NULL AND a.person_id = _p AND public.acv_person_eligible(_p, NULL)));
  RETURN greatest(_r, _a);
END $$;

CREATE OR REPLACE FUNCTION public.acv_node_trashed(_node uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH RECURSIVE anc AS (
    SELECT n.id, n.parent_id, n.trashed_at FROM public.acv_nodes n WHERE n.id = _node
    UNION ALL SELECT n.id, n.parent_id, n.trashed_at FROM public.acv_nodes n JOIN anc ON n.id = anc.parent_id)
  SELECT EXISTS (SELECT 1 FROM anc WHERE trashed_at IS NOT NULL) $$;

CREATE OR REPLACE FUNCTION public.acv_node_visible(_node uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _r int := public.acv_node_rank(_node);
BEGIN RETURN _r >= 1 AND (_r >= 5 OR NOT public.acv_node_trashed(_node)); END $$;

CREATE OR REPLACE FUNCTION public.acv_target_rank(_space uuid, _parent uuid) RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _n public.acv_nodes;
BEGIN
  IF _parent IS NULL THEN RETURN public.acv_space_rank(_space); END IF;
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _parent;
  IF _n.id IS NULL OR _n.kind <> 'pasta' OR _n.space_id <> _space OR public.acv_node_trashed(_parent) THEN RETURN 0; END IF;
  RETURN public.acv_node_rank(_parent);
END $$;

CREATE OR REPLACE FUNCTION public.acv_has_share_in_space(_space uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.acv_acl a JOIN public.acv_nodes n ON n.id = a.node_id
    WHERE n.space_id = _space AND a.revoked_at IS NULL AND (
      (a.principal_id IS NOT NULL AND a.principal_id = public.current_principal_id())
      OR (a.person_id IS NOT NULL AND a.person_id = public.current_person_id() AND public.acv_person_eligible(a.person_id, NULL)))) $$;

CREATE OR REPLACE FUNCTION public.acv_name_ok(_name text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT _name IS NOT NULL AND length(_name) BETWEEN 1 AND 180 AND _name = btrim(_name)
    AND _name !~ '[[:cntrl:]/\\<>:"|?*]' AND _name NOT IN ('.', '..') AND right(_name, 1) <> '.' $$;

CREATE OR REPLACE FUNCTION public.acv_mime_ok(_ext text, _mime text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (lower(_ext), lower(_mime)) IN (
    ('pdf','application/pdf'),
    ('docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ('xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ('pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    ('odt','application/vnd.oasis.opendocument.text'),
    ('ods','application/vnd.oasis.opendocument.spreadsheet'),
    ('odp','application/vnd.oasis.opendocument.presentation'),
    ('txt','text/plain'), ('csv','text/csv'),
    ('png','image/png'), ('jpg','image/jpeg'), ('jpeg','image/jpeg'), ('webp','image/webp'), ('gif','image/gif')) $$;

CREATE OR REPLACE FUNCTION public.acv_ext_of(_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _name ~ '\.[A-Za-z0-9]{1,8}$' THEN lower(substring(_name from '\.([A-Za-z0-9]{1,8})$')) ELSE '' END $$;

CREATE OR REPLACE FUNCTION public.acv_log(_space uuid, _node uuid, _action text, _detail jsonb, _key text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.acv_events(space_id, node_id, action, actor_person, actor_principal, auth_user, detail, idempotency_key)
  VALUES (_space, _node, _action, public.current_person_id(), public.current_principal_id(), auth.uid(), coalesce(_detail, '{}'::jsonb), _key) $$;

CREATE OR REPLACE FUNCTION public.acv_replay(_key text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _e public.acv_events;
BEGIN
  IF _key IS NULL OR length(_key) < 8 THEN RAISE EXCEPTION 'chave-invalida'; END IF;
  SELECT * INTO _e FROM public.acv_events WHERE idempotency_key = _key;
  IF _e.id IS NULL THEN RETURN NULL; END IF;
  IF _e.auth_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'chave-de-outra-sessao'; END IF;
  RETURN coalesce(_e.node_id, _e.space_id);
END $$;

CREATE OR REPLACE FUNCTION public.acv_require_actor() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR (public.current_person_id() IS NULL AND public.current_principal_id() IS NULL) THEN RAISE EXCEPTION 'sem-autor'; END IF;
END $$;

-- ===== Espaços e membros =====
CREATE OR REPLACE FUNCTION public.acv_ensure_space() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _pr uuid := public.current_principal_id(); _x public.institutional_sector_principals; _id uuid;
BEGIN
  IF _pr IS NULL THEN RAISE EXCEPTION 'somente-conta-de-setor'; END IF;
  SELECT * INTO _x FROM public.institutional_sector_principals WHERE id = _pr;
  SELECT id INTO _id FROM public.acv_spaces WHERE station_code = _x.station_code AND school_id IS NOT DISTINCT FROM _x.school_id;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.acv_spaces(station_code, school_id) VALUES (_x.station_code, _x.school_id) RETURNING id INTO _id;
  PERFORM public.acv_log(_id, NULL, 'espaco-criado', jsonb_build_object('station', _x.station_code, 'school', _x.school_id), NULL);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.acv_add_member(_space uuid, _person uuid, _principal uuid, _role text, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _s public.acv_spaces; _id uuid;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  IF public.acv_space_rank(_space) < 7 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF public.acv_role_rank(_role) = 0 THEN RAISE EXCEPTION 'papel-invalido'; END IF;
  IF (_person IS NULL) = (_principal IS NULL) THEN RAISE EXCEPTION 'destinatario-invalido'; END IF;
  SELECT * INTO _s FROM public.acv_spaces WHERE id = _space;
  IF _person IS NOT NULL AND NOT public.acv_person_eligible(_person, _s.school_id) THEN RAISE EXCEPTION 'destinatario-sem-vinculo'; END IF;
  IF _principal IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals x WHERE x.id = _principal
     AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principal_revocations r WHERE r.principal_id = x.id AND r.revoked_on <= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'destinatario-invalido'; END IF;
  UPDATE public.acv_space_members SET revoked_at = now(), revoked_by_person = public.current_person_id(), revoked_by_principal = public.current_principal_id()
   WHERE space_id = _space AND revoked_at IS NULL AND person_id IS NOT DISTINCT FROM _person AND principal_id IS NOT DISTINCT FROM _principal;
  INSERT INTO public.acv_space_members(space_id, person_id, principal_id, role, granted_by_person, granted_by_principal)
  VALUES (_space, _person, _principal, _role, public.current_person_id(), public.current_principal_id()) RETURNING id INTO _id;
  PERFORM public.acv_log(_space, NULL, 'membro-definido', jsonb_build_object('member', _id, 'role', _role), _key);
  RETURN _space;
END $$;

CREATE OR REPLACE FUNCTION public.acv_revoke_member(_member uuid, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _m public.acv_space_members;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _m FROM public.acv_space_members WHERE id = _member;
  IF _m.id IS NULL OR public.acv_space_rank(_m.space_id) < 7 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF _m.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'ja-revogado'; END IF;
  UPDATE public.acv_space_members SET revoked_at = now(), revoked_by_person = public.current_person_id(), revoked_by_principal = public.current_principal_id() WHERE id = _member;
  PERFORM public.acv_log(_m.space_id, NULL, 'membro-revogado', jsonb_build_object('member', _member), _key);
  RETURN _m.space_id;
END $$;

CREATE OR REPLACE FUNCTION public.acv_set_quota(_space uuid, _bytes bigint, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key);
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  IF public.acv_space_rank(_space) < 7 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF _bytes IS NOT NULL AND _bytes <= 0 THEN RAISE EXCEPTION 'cota-invalida'; END IF;
  UPDATE public.acv_spaces SET quota_bytes = _bytes WHERE id = _space;
  PERFORM public.acv_log(_space, NULL, 'cota-definida', jsonb_build_object('bytes', _bytes), _key);
  RETURN _space;
END $$;

CREATE OR REPLACE FUNCTION public.acv_space_usage(_space uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT sum(v.size_bytes) FROM public.acv_file_versions v JOIN public.acv_nodes n ON n.id = v.node_id WHERE n.space_id = _space AND v.copied_from IS NULL), 0)
       + coalesce((SELECT sum(v.size_bytes) FROM public.acv_file_versions v JOIN public.acv_nodes n ON n.id = v.node_id WHERE n.space_id = _space AND v.copied_from IS NOT NULL), 0)
       + coalesce((SELECT sum(u.size_bytes) FROM public.acv_uploads u WHERE u.space_id = _space AND u.status = 'pendente' AND u.created_at > now() - interval '24 hours'), 0) $$;

-- ===== Pastas =====
CREATE OR REPLACE FUNCTION public.acv_create_folder(_space uuid, _parent uuid, _name text, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _id uuid;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  IF public.acv_target_rank(_space, _parent) < 4 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF NOT public.acv_name_ok(_name) THEN RAISE EXCEPTION 'nome-invalido'; END IF;
  BEGIN
    INSERT INTO public.acv_nodes(space_id, parent_id, kind, name, name_key, created_by_person, created_by_principal)
    VALUES (_space, _parent, 'pasta', _name, lower(_name), public.current_person_id(), public.current_principal_id()) RETURNING id INTO _id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'nome-em-uso'; END;
  PERFORM public.acv_log(_space, _id, 'pasta-criada', jsonb_build_object('name', _name, 'parent', _parent), _key);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.acv_rename(_node uuid, _name text, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _n public.acv_nodes;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
  IF _n.id IS NULL OR public.acv_node_rank(_node) < 4 OR public.acv_node_trashed(_node) THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF NOT public.acv_name_ok(_name) THEN RAISE EXCEPTION 'nome-invalido'; END IF;
  IF _n.kind = 'arquivo' AND public.acv_ext_of(_name) <> public.acv_ext_of(_n.name) THEN RAISE EXCEPTION 'extensao-nao-pode-mudar'; END IF;
  BEGIN
    UPDATE public.acv_nodes SET name = _name, name_key = lower(_name), updated_at = now() WHERE id = _node;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'nome-em-uso'; END;
  PERFORM public.acv_log(_n.space_id, _node, 'renomeado', jsonb_build_object('de', _n.name, 'para', _name), _key);
  RETURN _node;
END $$;

CREATE OR REPLACE FUNCTION public.acv_move(_node uuid, _space uuid, _parent uuid, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _n public.acv_nodes;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
  IF _n.id IS NULL OR public.acv_node_rank(_node) < 4 OR public.acv_node_trashed(_node) THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF public.acv_target_rank(_space, _parent) < 4 THEN RAISE EXCEPTION 'sem-permissao-no-destino'; END IF;
  IF _parent IS NOT NULL AND EXISTS (
    WITH RECURSIVE anc AS (SELECT id, parent_id FROM public.acv_nodes WHERE id = _parent
      UNION ALL SELECT n.id, n.parent_id FROM public.acv_nodes n JOIN anc ON n.id = anc.parent_id)
    SELECT 1 FROM anc WHERE id = _node) THEN RAISE EXCEPTION 'ciclo'; END IF;
  BEGIN
    UPDATE public.acv_nodes SET parent_id = _parent, updated_at = now() WHERE id = _node;
    IF _space <> _n.space_id THEN
      WITH RECURSIVE sub AS (SELECT id FROM public.acv_nodes WHERE id = _node
        UNION ALL SELECT n.id FROM public.acv_nodes n JOIN sub ON n.parent_id = sub.id)
      UPDATE public.acv_nodes SET space_id = _space WHERE id IN (SELECT id FROM sub);
    END IF;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'nome-em-uso'; END;
  PERFORM public.acv_log(_n.space_id, _node, 'movido', jsonb_build_object('de_espaco', _n.space_id, 'de_pasta', _n.parent_id, 'para_espaco', _space, 'para_pasta', _parent), _key);
  IF _space <> _n.space_id THEN
    PERFORM public.acv_log(_space, _node, 'recebido', jsonb_build_object('de_espaco', _n.space_id), NULL);
  END IF;
  RETURN _node;
END $$;

CREATE OR REPLACE FUNCTION public.acv_copy_internal(_src uuid, _space uuid, _parent uuid, _name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _n public.acv_nodes; _id uuid; _v public.acv_file_versions; _c record;
BEGIN
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _src;
  BEGIN
    INSERT INTO public.acv_nodes(space_id, parent_id, kind, name, name_key, current_version, created_by_person, created_by_principal)
    VALUES (_space, _parent, _n.kind, _name, lower(_name), CASE WHEN _n.kind = 'arquivo' THEN 1 END, public.current_person_id(), public.current_principal_id()) RETURNING id INTO _id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'nome-em-uso'; END;
  IF _n.kind = 'arquivo' THEN
    SELECT * INTO _v FROM public.acv_file_versions WHERE node_id = _src AND version = _n.current_version;
    INSERT INTO public.acv_file_versions(node_id, version, storage_path, sha256, size_bytes, mime, ext, copied_from, created_by_person, created_by_principal)
    VALUES (_id, 1, _v.storage_path, _v.sha256, _v.size_bytes, _v.mime, _v.ext, _v.id, public.current_person_id(), public.current_principal_id());
  ELSE
    FOR _c IN SELECT id, name FROM public.acv_nodes WHERE parent_id = _src AND trashed_at IS NULL LOOP
      PERFORM public.acv_copy_internal(_c.id, _space, _id, _c.name);
    END LOOP;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.acv_copy(_node uuid, _space uuid, _parent uuid, _name text, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _n public.acv_nodes; _id uuid; _size bigint; _q bigint;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
  IF _n.id IS NULL OR public.acv_node_rank(_node) < 1 OR public.acv_node_trashed(_node) THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF public.acv_target_rank(_space, _parent) < 2 THEN RAISE EXCEPTION 'sem-permissao-no-destino'; END IF;
  IF NOT public.acv_name_ok(coalesce(_name, _n.name)) THEN RAISE EXCEPTION 'nome-invalido'; END IF;
  IF _parent IS NOT NULL AND EXISTS (
    WITH RECURSIVE anc AS (SELECT id, parent_id FROM public.acv_nodes WHERE id = _parent
      UNION ALL SELECT n.id, n.parent_id FROM public.acv_nodes n JOIN anc ON n.id = anc.parent_id)
    SELECT 1 FROM anc WHERE id = _node) THEN RAISE EXCEPTION 'ciclo'; END IF;
  WITH RECURSIVE sub AS (SELECT id FROM public.acv_nodes WHERE id = _node
    UNION ALL SELECT n.id FROM public.acv_nodes n JOIN sub ON n.parent_id = sub.id WHERE n.trashed_at IS NULL)
  SELECT coalesce(sum(v.size_bytes), 0) INTO _size FROM public.acv_nodes n JOIN sub ON sub.id = n.id
    JOIN public.acv_file_versions v ON v.node_id = n.id AND v.version = n.current_version;
  SELECT quota_bytes INTO _q FROM public.acv_spaces WHERE id = _space;
  IF _q IS NOT NULL AND public.acv_space_usage(_space) + _size > _q THEN RAISE EXCEPTION 'cota-excedida'; END IF;
  _id := public.acv_copy_internal(_node, _space, _parent, coalesce(_name, _n.name));
  PERFORM public.acv_log(_space, _id, 'copiado', jsonb_build_object('origem', _node, 'origem_espaco', _n.space_id), _key);
  RETURN _id;
END $$;

-- ===== Lixeira (sem eliminação) =====
CREATE OR REPLACE FUNCTION public.acv_trash(_node uuid, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _n public.acv_nodes;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
  IF _n.id IS NULL OR public.acv_node_rank(_node) < 5 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF _n.trashed_at IS NOT NULL THEN RAISE EXCEPTION 'ja-na-lixeira'; END IF;
  UPDATE public.acv_nodes SET trashed_at = now(), trashed_by_person = public.current_person_id(), trashed_by_principal = public.current_principal_id() WHERE id = _node;
  PERFORM public.acv_log(_n.space_id, _node, 'lixeira', jsonb_build_object('oficial', _n.is_official), _key);
  RETURN _node;
END $$;

CREATE OR REPLACE FUNCTION public.acv_restore(_node uuid, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _n public.acv_nodes;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
  IF _n.id IS NULL OR public.acv_node_rank(_node) < 5 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF _n.trashed_at IS NULL THEN RAISE EXCEPTION 'fora-da-lixeira'; END IF;
  IF _n.parent_id IS NOT NULL AND public.acv_node_trashed(_n.parent_id) THEN RAISE EXCEPTION 'pasta-de-origem-na-lixeira'; END IF;
  BEGIN
    UPDATE public.acv_nodes SET trashed_at = NULL, trashed_by_person = NULL, trashed_by_principal = NULL, updated_at = now() WHERE id = _node;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'nome-em-uso'; END;
  PERFORM public.acv_log(_n.space_id, _node, 'restaurado', '{}'::jsonb, _key);
  RETURN _node;
END $$;

-- ===== Compartilhamento =====
CREATE OR REPLACE FUNCTION public.acv_share(_node uuid, _person uuid, _principal uuid, _role text, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _n public.acv_nodes; _mine int; _id uuid;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
  _mine := public.acv_node_rank(_node);
  IF _n.id IS NULL OR _mine < 6 OR public.acv_node_trashed(_node) THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF public.acv_role_rank(_role) = 0 OR public.acv_role_rank(_role) > least(_mine, 6) THEN RAISE EXCEPTION 'papel-acima-do-proprio'; END IF;
  IF (_person IS NULL) = (_principal IS NULL) THEN RAISE EXCEPTION 'destinatario-invalido'; END IF;
  IF _person IS NOT NULL AND NOT public.acv_person_eligible(_person, NULL) THEN RAISE EXCEPTION 'destinatario-sem-vinculo'; END IF;
  IF _principal IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals x WHERE x.id = _principal
     AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principal_revocations r WHERE r.principal_id = x.id AND r.revoked_on <= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'destinatario-invalido'; END IF;
  UPDATE public.acv_acl SET revoked_at = now(), revoked_by_person = public.current_person_id(), revoked_by_principal = public.current_principal_id()
   WHERE node_id = _node AND revoked_at IS NULL AND person_id IS NOT DISTINCT FROM _person AND principal_id IS NOT DISTINCT FROM _principal;
  INSERT INTO public.acv_acl(node_id, person_id, principal_id, role, granted_by_person, granted_by_principal)
  VALUES (_node, _person, _principal, _role, public.current_person_id(), public.current_principal_id()) RETURNING id INTO _id;
  PERFORM public.acv_log(_n.space_id, _node, 'compartilhado', jsonb_build_object('acl', _id, 'role', _role), _key);
  RETURN _node;
END $$;

CREATE OR REPLACE FUNCTION public.acv_revoke_share(_acl uuid, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _a public.acv_acl; _space uuid;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _a FROM public.acv_acl WHERE id = _acl;
  IF _a.id IS NULL OR public.acv_node_rank(_a.node_id) < 6 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF _a.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'ja-revogado'; END IF;
  UPDATE public.acv_acl SET revoked_at = now(), revoked_by_person = public.current_person_id(), revoked_by_principal = public.current_principal_id() WHERE id = _acl;
  SELECT space_id INTO _space FROM public.acv_nodes WHERE id = _a.node_id;
  PERFORM public.acv_log(_space, _a.node_id, 'compartilhamento-revogado', jsonb_build_object('acl', _acl), _key);
  RETURN _a.node_id;
END $$;

-- ===== Upload em duas fases (reserva → bytes no storage → confirmação) =====
CREATE OR REPLACE FUNCTION public.acv_begin_upload(_key text, _space uuid, _parent uuid, _node uuid, _name text, _sha text, _size bigint, _mime text)
RETURNS TABLE (upload_id uuid, storage_path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _u public.acv_uploads; _ext text; _q bigint; _n public.acv_nodes; _id uuid := gen_random_uuid();
BEGIN
  IF _key IS NULL OR length(_key) < 8 THEN RAISE EXCEPTION 'chave-invalida'; END IF;
  SELECT * INTO _u FROM public.acv_uploads WHERE idempotency_key = _key;
  IF _u.id IS NOT NULL THEN
    IF _u.auth_user <> auth.uid() THEN RAISE EXCEPTION 'chave-de-outra-sessao'; END IF;
    RETURN QUERY SELECT _u.id, _u.storage_path; RETURN;
  END IF;
  PERFORM public.acv_require_actor();
  IF _node IS NOT NULL THEN
    SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
    IF _n.id IS NULL OR _n.kind <> 'arquivo' OR _n.space_id <> _space OR public.acv_node_rank(_node) < 3 OR public.acv_node_trashed(_node) THEN RAISE EXCEPTION 'sem-permissao'; END IF;
    _name := _n.name;
  ELSE
    IF public.acv_target_rank(_space, _parent) < 2 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
    IF NOT public.acv_name_ok(_name) THEN RAISE EXCEPTION 'nome-invalido'; END IF;
    IF EXISTS (SELECT 1 FROM public.acv_nodes WHERE space_id = _space AND parent_id IS NOT DISTINCT FROM _parent AND name_key = lower(_name) AND trashed_at IS NULL) THEN RAISE EXCEPTION 'nome-em-uso'; END IF;
  END IF;
  _ext := public.acv_ext_of(_name);
  IF NOT public.acv_mime_ok(_ext, _mime) THEN RAISE EXCEPTION 'tipo-nao-permitido'; END IF;
  IF _sha IS NULL OR _sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'checksum-invalido'; END IF;
  IF _size IS NULL OR _size < 0 OR _size > 52428800 THEN RAISE EXCEPTION 'tamanho-excedido'; END IF;
  SELECT quota_bytes INTO _q FROM public.acv_spaces WHERE id = _space;
  IF _q IS NOT NULL AND public.acv_space_usage(_space) + _size > _q THEN RAISE EXCEPTION 'cota-excedida'; END IF;
  INSERT INTO public.acv_uploads(id, idempotency_key, auth_user, space_id, parent_id, node_id, name, storage_path, sha256, size_bytes, mime, ext)
  VALUES (_id, _key, auth.uid(), _space, _parent, _node, _name, _space::text || '/' || _id::text, _sha, _size, lower(_mime), _ext);
  RETURN QUERY SELECT _id, _space::text || '/' || _id::text;
END $$;

CREATE OR REPLACE FUNCTION public.acv_commit_upload(_upload uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _u public.acv_uploads; _osize bigint; _omime text; _node uuid; _ver int;
BEGIN
  SELECT * INTO _u FROM public.acv_uploads WHERE id = _upload FOR UPDATE;
  IF _u.id IS NULL OR _u.auth_user <> auth.uid() THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _u.status = 'concluido' THEN RETURN _u.result_node; END IF;
  IF _u.created_at < now() - interval '24 hours' THEN RAISE EXCEPTION 'reserva-expirada'; END IF;
  PERFORM public.acv_require_actor();
  SELECT (o.metadata->>'size')::bigint, lower(o.metadata->>'mimetype') INTO _osize, _omime
    FROM storage.objects o WHERE o.bucket_id = 'acervo-documental' AND o.name = _u.storage_path;
  IF _osize IS NULL THEN RAISE EXCEPTION 'arquivo-nao-enviado'; END IF;
  IF _osize <> _u.size_bytes THEN RAISE EXCEPTION 'tamanho-divergente'; END IF;
  IF _omime IS DISTINCT FROM _u.mime THEN RAISE EXCEPTION 'tipo-divergente'; END IF;
  IF _u.node_id IS NOT NULL THEN
    IF public.acv_node_rank(_u.node_id) < 3 OR public.acv_node_trashed(_u.node_id) THEN RAISE EXCEPTION 'sem-permissao'; END IF;
    PERFORM 1 FROM public.acv_nodes WHERE id = _u.node_id FOR UPDATE;
    SELECT coalesce(max(version), 0) + 1 INTO _ver FROM public.acv_file_versions WHERE node_id = _u.node_id;
    _node := _u.node_id;
    UPDATE public.acv_nodes SET current_version = _ver, updated_at = now() WHERE id = _node;
  ELSE
    IF public.acv_target_rank(_u.space_id, _u.parent_id) < 2 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
    _ver := 1;
    BEGIN
      INSERT INTO public.acv_nodes(space_id, parent_id, kind, name, name_key, current_version, created_by_person, created_by_principal)
      VALUES (_u.space_id, _u.parent_id, 'arquivo', _u.name, lower(_u.name), 1, public.current_person_id(), public.current_principal_id()) RETURNING id INTO _node;
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'nome-em-uso'; END;
  END IF;
  INSERT INTO public.acv_file_versions(node_id, version, storage_path, sha256, size_bytes, mime, ext, created_by_person, created_by_principal)
  VALUES (_node, _ver, _u.storage_path, _u.sha256, _u.size_bytes, _u.mime, _u.ext, public.current_person_id(), public.current_principal_id());
  UPDATE public.acv_uploads SET status = 'concluido', result_node = _node WHERE id = _upload;
  PERFORM public.acv_log(_u.space_id, _node, CASE WHEN _ver = 1 THEN 'arquivo-enviado' ELSE 'nova-versao' END,
    jsonb_build_object('version', _ver, 'sha256', _u.sha256, 'size', _u.size_bytes), 'upload:' || _upload::text);
  RETURN _node;
END $$;

CREATE OR REPLACE FUNCTION public.acv_upload_slot_ok(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.acv_uploads u WHERE u.storage_path = _name AND u.auth_user = auth.uid()
    AND u.status = 'pendente' AND u.created_at > now() - interval '24 hours') $$;

CREATE OR REPLACE FUNCTION public.acv_object_readable(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.acv_file_versions v WHERE v.storage_path = _name AND public.acv_node_visible(v.node_id)) $$;

CREATE OR REPLACE FUNCTION public.acv_log_download(_version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _v public.acv_file_versions; _space uuid;
BEGIN
  PERFORM public.acv_require_actor();
  SELECT * INTO _v FROM public.acv_file_versions WHERE id = _version;
  IF _v.id IS NULL OR NOT public.acv_node_visible(_v.node_id) THEN RAISE EXCEPTION 'indisponivel'; END IF;
  SELECT space_id INTO _space FROM public.acv_nodes WHERE id = _v.node_id;
  PERFORM public.acv_log(_space, _v.node_id, 'download', jsonb_build_object('version', _v.version), NULL);
END $$;

-- ===== Integração GED: referência, nunca conversão em documento oficial =====
CREATE OR REPLACE FUNCTION public.acv_link_case(_node uuid, _case uuid, _key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _n public.acv_nodes;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  SELECT * INTO _n FROM public.acv_nodes WHERE id = _node;
  IF _n.id IS NULL OR _n.kind <> 'arquivo' OR public.acv_node_rank(_node) < 3 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  IF NOT public.admin_case_readable(_case) THEN RAISE EXCEPTION 'indisponivel'; END IF;
  BEGIN
    INSERT INTO public.acv_links(node_id, case_id, person_id, principal_id) VALUES (_node, _case, public.current_person_id(), public.current_principal_id());
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-vinculado'; END;
  UPDATE public.acv_nodes SET is_official = true WHERE id = _node;
  PERFORM public.acv_log(_n.space_id, _node, 'vinculado-processo', jsonb_build_object('case', _case), _key);
  RETURN _node;
END $$;

-- ===== RLS de leitura =====
CREATE POLICY "acv spaces read" ON public.acv_spaces FOR SELECT TO authenticated USING (public.acv_space_rank(id) >= 1 OR public.acv_has_share_in_space(id));
CREATE POLICY "acv members read" ON public.acv_space_members FOR SELECT TO authenticated USING (public.acv_space_rank(space_id) >= 7 OR person_id = public.current_person_id() OR principal_id = public.current_principal_id());
CREATE POLICY "acv nodes read" ON public.acv_nodes FOR SELECT TO authenticated USING (public.acv_node_visible(id));
CREATE POLICY "acv versions read" ON public.acv_file_versions FOR SELECT TO authenticated USING (public.acv_node_visible(node_id));
CREATE POLICY "acv acl read" ON public.acv_acl FOR SELECT TO authenticated USING (public.acv_node_rank(node_id) >= 6 OR person_id = public.current_person_id() OR principal_id = public.current_principal_id());
CREATE POLICY "acv uploads read" ON public.acv_uploads FOR SELECT TO authenticated USING (auth_user = auth.uid());
CREATE POLICY "acv links read" ON public.acv_links FOR SELECT TO authenticated USING (public.acv_node_visible(node_id));
CREATE POLICY "acv events read" ON public.acv_events FOR SELECT TO authenticated USING (public.acv_space_rank(space_id) >= 7);
CREATE POLICY "acv fav read" ON public.acv_favorites FOR SELECT TO authenticated USING (auth_user = auth.uid());
CREATE POLICY "acv fav ins" ON public.acv_favorites FOR INSERT TO authenticated WITH CHECK (auth_user = auth.uid() AND public.acv_node_visible(node_id));
CREATE POLICY "acv fav del" ON public.acv_favorites FOR DELETE TO authenticated USING (auth_user = auth.uid());

-- ===== Storage privado: escrita só na reserva própria; leitura só com acesso ao arquivo; sem update/delete =====
CREATE POLICY "acervo insert reservado" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'acervo-documental' AND public.acv_upload_slot_ok(name));
CREATE POLICY "acervo select autorizado" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'acervo-documental' AND public.acv_object_readable(name));

DO $$ DECLARE f text; BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'acv\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
-- internas: sem chamada direta
REVOKE EXECUTE ON FUNCTION public.acv_copy_internal(uuid, uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.acv_log(uuid, uuid, text, jsonb, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.acv_no_delete() FROM authenticated;