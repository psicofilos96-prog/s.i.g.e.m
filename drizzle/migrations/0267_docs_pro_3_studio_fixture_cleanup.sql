-- Limpeza só de fixtures efêmeras do harness (template_id 'bo-…'); demais linhas continuam append-only.
CREATE OR REPLACE FUNCTION public.studio_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE tid text;
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('sigem.studio_fixture_cleanup', true) = 'on' THEN
    IF TG_TABLE_NAME = 'studio_template_versions' THEN tid := OLD.template_id;
    ELSIF TG_TABLE_NAME = 'studio_template_events' THEN SELECT template_id INTO tid FROM public.studio_template_versions WHERE id = OLD.version_id;
    ELSIF TG_TABLE_NAME = 'studio_emissions' THEN SELECT template_id INTO tid FROM public.studio_template_versions WHERE id = OLD.template_version_id;
    ELSE SELECT v.template_id INTO tid FROM public.studio_emissions e JOIN public.studio_template_versions v ON v.id = e.template_version_id WHERE e.id = OLD.emission_id;
    END IF;
    IF tid LIKE 'bo-%' THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'studio:append-only';
END $$;

CREATE OR REPLACE FUNCTION public.studio_fixture_cleanup(_prefix text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE n integer;
BEGIN
  IF _prefix !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'studio:fixture-prefix'; END IF;
  PERFORM set_config('sigem.studio_fixture_cleanup', 'on', true);
  DELETE FROM public.studio_emission_events x USING public.studio_emissions e, public.studio_template_versions v WHERE x.emission_id = e.id AND e.template_version_id = v.id AND v.template_id LIKE _prefix || '%';
  DELETE FROM public.studio_emission_events x USING public.studio_emissions e, public.studio_template_versions v WHERE x.replaced_by = e.id AND e.template_version_id = v.id AND v.template_id LIKE _prefix || '%';
  DELETE FROM public.studio_emissions e USING public.studio_template_versions v WHERE e.template_version_id = v.id AND v.template_id LIKE _prefix || '%';
  DELETE FROM public.studio_template_events x USING public.studio_template_versions v WHERE x.version_id = v.id AND v.template_id LIKE _prefix || '%';
  WITH RECURSIVE d AS (SELECT id FROM public.studio_template_versions WHERE template_id LIKE _prefix || '%') SELECT count(*) INTO n FROM d;
  -- versões em ordem decrescente por causa de supersedes_id
  DELETE FROM public.studio_template_versions WHERE template_id LIKE _prefix || '%' AND id NOT IN (SELECT supersedes_id FROM public.studio_template_versions WHERE supersedes_id IS NOT NULL AND template_id LIKE _prefix || '%');
  WHILE EXISTS (SELECT 1 FROM public.studio_template_versions WHERE template_id LIKE _prefix || '%') LOOP
    DELETE FROM public.studio_template_versions WHERE template_id LIKE _prefix || '%' AND id NOT IN (SELECT supersedes_id FROM public.studio_template_versions WHERE supersedes_id IS NOT NULL AND template_id LIKE _prefix || '%');
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.studio_fixture_cleanup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_fixture_cleanup(text) TO service_role;