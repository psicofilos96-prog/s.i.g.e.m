CREATE TABLE public.curricular_component_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id text NOT NULL REFERENCES public.institutional_curricular_components(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.curricular_component_versions(id),
  official_name text NOT NULL CHECK (btrim(official_name) <> ''),
  short_name text,
  is_active boolean NOT NULL,
  valid_from date NOT NULL,
  change_reason text,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id text,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (component_id, version),
  UNIQUE (supersedes_id),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK (version = 1 OR coalesce(btrim(change_reason),'') <> '')
);
GRANT SELECT ON public.curricular_component_versions TO authenticated;
GRANT ALL ON public.curricular_component_versions TO service_role;
ALTER TABLE public.curricular_component_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "component versions readable by linked accounts" ON public.curricular_component_versions
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE TRIGGER curricular_component_versions_immutable BEFORE UPDATE OR DELETE ON public.curricular_component_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Denominação e situação válidas numa data: última versão cuja vigência já começou.
CREATE OR REPLACE FUNCTION public.curricular_components_at(_on date)
RETURNS TABLE(component_id text, version integer, official_name text, short_name text, is_active boolean, valid_from date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT DISTINCT ON (v.component_id) v.component_id, v.version, v.official_name, v.short_name, v.is_active, v.valid_from
  FROM curricular_component_versions v WHERE v.valid_from <= _on
  ORDER BY v.component_id, v.version DESC
$$;
REVOKE ALL ON FUNCTION public.curricular_components_at(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curricular_components_at(date) TO authenticated;

-- Único caminho de gravação: cria a identidade na 1ª versão; depois só versões encadeadas.
CREATE OR REPLACE FUNCTION public.register_curricular_component_version(
  _component text, _base_version_id uuid, _official_name text, _short_name text,
  _is_active boolean, _valid_from date, _reason text, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid; _cid text; b curricular_component_versions%ROWTYPE; _n text := nullif(btrim(coalesce(_official_name,'')),'');
  _s text := nullif(btrim(coalesce(_short_name,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(current_date) c
    WHERE c.capability_id = 'manter-componentes-curriculares' AND c.scope_level = 'rede' LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-componentes-curriculares'; END IF;
  IF _n IS NULL THEN RAISE EXCEPTION 'component:name-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'component:valid-from-required'; END IF;
  IF _is_active IS NULL THEN RAISE EXCEPTION 'component:status-required'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'component:act-required'; END IF;
  IF _component IS NULL THEN
    _cid := 'comp-' || gen_random_uuid();
    INSERT INTO institutional_curricular_components(id, label) VALUES (_cid, _n);
    INSERT INTO curricular_component_versions(component_id, version, official_name, short_name, is_active, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
      VALUES (_cid, 1, _n, _s, _is_active, _valid_from, _act_ref, auth.uid(), public.current_person_id(), g);
    RETURN _cid;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('component:' || _component));
  SELECT * INTO b FROM curricular_component_versions WHERE component_id = _component ORDER BY version DESC LIMIT 1;
  IF b.id IS NULL THEN RAISE EXCEPTION 'component:not-found'; END IF;
  IF _base_version_id IS DISTINCT FROM b.id THEN RAISE EXCEPTION 'component:base-superseded'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'component:reason-required'; END IF;
  IF _valid_from < b.valid_from THEN RAISE EXCEPTION 'component:valid-from-before-base'; END IF;
  IF b.official_name = _n AND b.short_name IS NOT DISTINCT FROM _s AND b.is_active = _is_active AND b.valid_from = _valid_from THEN
    RAISE EXCEPTION 'component:no-change'; END IF;
  INSERT INTO curricular_component_versions(component_id, version, supersedes_id, official_name, short_name, is_active, valid_from, change_reason, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_component, b.version + 1, b.id, _n, _s, _is_active, _valid_from, btrim(_reason), _act_ref, auth.uid(), public.current_person_id(), g);
  RETURN _component;
END $$;
REVOKE ALL ON FUNCTION public.register_curricular_component_version(text, uuid, text, text, boolean, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_curricular_component_version(text, uuid, text, text, boolean, date, text, text) TO authenticated;

-- Rascunho v2 (não homologado): acrescenta a capacidade aprovada.
INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
SELECT id, 'cadastro-institucional-da-rede', 'manter-componentes-curriculares', '{network}'
FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 2 AND status = 'draft';