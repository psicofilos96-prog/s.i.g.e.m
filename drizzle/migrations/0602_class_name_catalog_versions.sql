CREATE TABLE public.class_name_catalog_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_key text NOT NULL, version integer NOT NULL,
 first_cycle_start date NOT NULL, status text NOT NULL,
 source_name text NOT NULL, source_sha256 text NOT NULL, decision_source text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(catalog_key,version)
);
GRANT SELECT ON public.class_name_catalog_versions TO authenticated;
GRANT ALL ON public.class_name_catalog_versions TO service_role;
ALTER TABLE public.class_name_catalog_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY class_name_catalog_read ON public.class_name_catalog_versions FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE TABLE public.class_name_catalog_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_version_id uuid NOT NULL REFERENCES public.class_name_catalog_versions(id),
 code text NOT NULL, name text NOT NULL, modality_label text NOT NULL, series_labels jsonb NOT NULL,
 source_rows jsonb NOT NULL, ordinal_label text NOT NULL, UNIQUE(catalog_version_id,name)
);
GRANT SELECT ON public.class_name_catalog_entries TO authenticated;
GRANT ALL ON public.class_name_catalog_entries TO service_role;
ALTER TABLE public.class_name_catalog_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY class_name_catalog_entry_read ON public.class_name_catalog_entries FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE FUNCTION public.class_name_catalog_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'class-name-catalog:immutable'; END $$;
CREATE TRIGGER class_name_catalog_version_immutable BEFORE UPDATE OR DELETE ON public.class_name_catalog_versions FOR EACH ROW EXECUTE FUNCTION public.class_name_catalog_immutable();
CREATE TRIGGER class_name_catalog_entry_immutable BEFORE UPDATE OR DELETE ON public.class_name_catalog_entries FOR EACH ROW EXECUTE FUNCTION public.class_name_catalog_immutable();
ALTER TABLE public.institutional_class_record_versions ADD COLUMN name_catalog_entry_id uuid REFERENCES public.class_name_catalog_entries(id);
CREATE FUNCTION public.class_name_catalog_for_year(_year text)
RETURNS TABLE(entry_id uuid, code text, name text, modality_label text, series_labels jsonb, ordinal_label text, catalog_version integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $$
DECLARE start_date date; version_id uuid; n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'class-name-catalog:unauthenticated'; END IF;
 SELECT y.starts_on INTO start_date FROM public.institutional_academic_year_versions y WHERE y.academic_year_id=_year ORDER BY y.version DESC LIMIT 1;
 IF start_date IS NULL THEN RAISE EXCEPTION 'class-name-catalog:year-not-found'; END IF;
 SELECT count(*) INTO n FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 IF n>1 THEN RAISE EXCEPTION 'class-name-catalog:ambiguous'; END IF;
 SELECT v.id INTO version_id FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 RETURN QUERY SELECT e.id,e.code,e.name,e.modality_label,e.series_labels,e.ordinal_label,v.version FROM public.class_name_catalog_entries e JOIN public.class_name_catalog_versions v ON v.id=e.catalog_version_id WHERE e.catalog_version_id=version_id ORDER BY e.modality_label,e.ordinal_label,e.name;
END $$;
REVOKE ALL ON FUNCTION public.class_name_catalog_for_year(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.class_name_catalog_for_year(text) TO authenticated;
CREATE FUNCTION public.validate_class_name_catalog() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE year_id text; start_date date; catalog_id uuid; option_id uuid; n integer;
BEGIN
 -- Existing identities and historical versions are never renamed by this migration.
 IF NEW.version<>1 THEN RETURN NEW; END IF;
 SELECT c.academic_year_id INTO year_id FROM public.institutional_classes c WHERE c.id=NEW.class_id;
 SELECT y.starts_on INTO start_date FROM public.institutional_academic_year_versions y WHERE y.academic_year_id=year_id ORDER BY y.version DESC LIMIT 1;
 SELECT count(*) INTO n FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 IF n=0 THEN RETURN NEW; END IF;
 IF n<>1 THEN RAISE EXCEPTION 'class-name-catalog:ambiguous'; END IF;
 SELECT v.id INTO catalog_id FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 SELECT e.id INTO option_id FROM public.class_name_catalog_entries e WHERE e.catalog_version_id=catalog_id AND e.name=NEW.name AND e.code=NEW.code;
 IF option_id IS NULL THEN RAISE EXCEPTION 'class-name-catalog:selection-required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class-name:' || year_id || ':' || (SELECT c.school_id FROM public.institutional_classes c WHERE c.id=NEW.class_id),0));
 IF EXISTS(SELECT 1 FROM public.institutional_class_record_versions r JOIN public.institutional_classes c ON c.id=r.class_id JOIN public.institutional_classes current_class ON current_class.id=NEW.class_id WHERE c.school_id=current_class.school_id AND c.academic_year_id=year_id AND r.name_catalog_entry_id=option_id AND r.class_id<>NEW.class_id) THEN RAISE EXCEPTION 'class:duplicate-name'; END IF;
 NEW.name_catalog_entry_id:=option_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_class_name_catalog() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER class_name_catalog_on_create BEFORE INSERT ON public.institutional_class_record_versions FOR EACH ROW EXECUTE FUNCTION public.validate_class_name_catalog();
COMMENT ON TABLE public.class_name_catalog_versions IS 'Immutable selectable-name configuration; owner-directed records cite the actual owner request, not a fabricated human homologation. Historical census counts and school instances are not imported.';