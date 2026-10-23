CREATE TABLE public.curricular_component_system_defaults (
 component_id text PRIMARY KEY REFERENCES public.institutional_curricular_components(id),
 display_name text NOT NULL CHECK (btrim(display_name) <> ''),
 valid_from date NOT NULL,
 source_ref text NOT NULL CHECK (btrim(source_ref) <> ''),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.curricular_component_system_defaults TO authenticated;
GRANT ALL ON public.curricular_component_system_defaults TO service_role;
ALTER TABLE public.curricular_component_system_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY component_defaults_read ON public.curricular_component_system_defaults FOR SELECT TO authenticated USING ((SELECT public.current_person_id()) IS NOT NULL);
CREATE TRIGGER component_defaults_immutable BEFORE UPDATE OR DELETE ON public.curricular_component_system_defaults FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
COMMENT ON TABLE public.curricular_component_system_defaults IS 'Owner-authorized system defaults, not official component versions or human homologations. Existing versioned records always take precedence; stable component IDs are preserved.';
CREATE OR REPLACE FUNCTION public.curricular_components_at(_on date)
RETURNS TABLE(component_id text, version integer, official_name text, short_name text, is_active boolean, valid_from date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
 WITH versioned AS (
 SELECT DISTINCT ON (v.component_id) v.component_id, v.version, v.official_name, v.short_name, v.is_active, v.valid_from
 FROM public.curricular_component_versions v WHERE v.valid_from <= _on
 ORDER BY v.component_id, v.version DESC
 )
 SELECT * FROM versioned
 UNION ALL
 SELECT d.component_id, 0, d.display_name || ' — Padrão do sistema', d.display_name, true, d.valid_from
 FROM public.curricular_component_system_defaults d
 WHERE d.valid_from <= _on AND NOT EXISTS (SELECT 1 FROM public.curricular_component_versions v WHERE v.component_id = d.component_id)
$function$;
CREATE OR REPLACE FUNCTION public.b41_component_active_throughout(_component text, _from date, _until date)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $function$
 SELECT CASE WHEN EXISTS (SELECT 1 FROM public.curricular_component_versions v WHERE v.component_id = _component)
 THEN NOT EXISTS (
 SELECT 1 FROM public.b41_segment_points(_from, _until,
 ARRAY(SELECT v.valid_from FROM public.curricular_component_versions v WHERE v.component_id = _component)) s
 WHERE (SELECT v.is_active FROM public.curricular_component_versions v
 WHERE v.component_id = _component AND v.valid_from <= s.at_date ORDER BY v.version DESC LIMIT 1) IS DISTINCT FROM true)
 ELSE EXISTS (SELECT 1 FROM public.curricular_component_system_defaults d WHERE d.component_id = _component AND d.valid_from <= _from AND _from <= _until)
 END
$function$;