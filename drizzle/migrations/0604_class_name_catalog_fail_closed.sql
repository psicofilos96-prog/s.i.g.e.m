CREATE OR REPLACE FUNCTION public.validate_class_name_catalog() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE year_id text; school text; start_date date; first_start date; catalog_id uuid; option_id uuid; n integer;
BEGIN
 IF NEW.version<>1 AND NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions r WHERE r.class_id=NEW.class_id AND r.name_catalog_entry_id IS NOT NULL) THEN RETURN NEW; END IF;
 SELECT c.academic_year_id,c.school_id INTO year_id,school FROM public.institutional_classes c WHERE c.id=NEW.class_id;
 SELECT y.starts_on INTO start_date FROM public.institutional_academic_year_versions y WHERE y.academic_year_id=year_id ORDER BY y.version DESC LIMIT 1;
 IF start_date IS NULL THEN RAISE EXCEPTION 'class-name-catalog:year-not-found'; END IF;
 SELECT min(v.first_cycle_start) INTO first_start FROM public.class_name_catalog_versions v;
 IF first_start IS NULL THEN RAISE EXCEPTION 'class-name-catalog:unavailable'; END IF;
 IF start_date<first_start THEN RETURN NEW; END IF;
 SELECT count(*) INTO n FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 IF n=0 THEN RAISE EXCEPTION 'class-name-catalog:unavailable'; END IF;
 IF n<>1 THEN RAISE EXCEPTION 'class-name-catalog:ambiguous'; END IF;
 SELECT v.id INTO catalog_id FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 SELECT e.id INTO option_id FROM public.class_name_catalog_entries e WHERE e.catalog_version_id=catalog_id AND e.name=NEW.name AND e.code=NEW.code;
 IF option_id IS NULL THEN RAISE EXCEPTION 'class-name-catalog:selection-required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class-name:' || year_id || ':' || school,0));
 IF EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.school_id=school AND c.academic_year_id=year_id AND c.id<>NEW.class_id AND pg_catalog.lower(pg_catalog.btrim(c.name))=pg_catalog.lower(pg_catalog.btrim(NEW.name))) OR EXISTS (SELECT 1 FROM public.institutional_class_record_versions r JOIN public.institutional_classes c ON c.id=r.class_id WHERE c.school_id=school AND c.academic_year_id=year_id AND c.id<>NEW.class_id AND pg_catalog.lower(pg_catalog.btrim(r.name))=pg_catalog.lower(pg_catalog.btrim(NEW.name))) THEN RAISE EXCEPTION 'class:duplicate-name'; END IF;
 NEW.name_catalog_entry_id:=option_id;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.validate_class_name_catalog_amendment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 -- The unified validation trigger covers initial and catalog-bound amendment writes.
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.class_name_catalog_for_year(_year text)
RETURNS TABLE(entry_id uuid,code text,name text,modality_label text,series_labels jsonb,ordinal_label text,catalog_version integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $$
DECLARE start_date date; first_start date; version_id uuid; n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'class-name-catalog:unauthenticated'; END IF;
 SELECT y.starts_on INTO start_date FROM public.institutional_academic_year_versions y WHERE y.academic_year_id=_year ORDER BY y.version DESC LIMIT 1;
 IF start_date IS NULL THEN RAISE EXCEPTION 'class-name-catalog:year-not-found'; END IF;
 SELECT min(v.first_cycle_start) INTO first_start FROM public.class_name_catalog_versions v;
 IF first_start IS NULL THEN RAISE EXCEPTION 'class-name-catalog:unavailable'; END IF;
 IF start_date<first_start THEN RETURN; END IF;
 SELECT count(*) INTO n FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 IF n=0 THEN RAISE EXCEPTION 'class-name-catalog:unavailable'; END IF;
 IF n<>1 THEN RAISE EXCEPTION 'class-name-catalog:ambiguous'; END IF;
 SELECT v.id INTO version_id FROM public.class_name_catalog_versions v WHERE v.status='owner-directed' AND v.first_cycle_start<=start_date AND NOT EXISTS (SELECT 1 FROM public.class_name_catalog_versions newer WHERE newer.catalog_key=v.catalog_key AND newer.version>v.version AND newer.status='owner-directed' AND newer.first_cycle_start<=start_date);
 IF NOT EXISTS(SELECT 1 FROM public.class_name_catalog_entries e WHERE e.catalog_version_id=version_id) THEN RAISE EXCEPTION 'class-name-catalog:unavailable'; END IF;
 RETURN QUERY SELECT e.id,e.code,e.name,e.modality_label,e.series_labels,e.ordinal_label,v.version FROM public.class_name_catalog_entries e JOIN public.class_name_catalog_versions v ON v.id=e.catalog_version_id WHERE e.catalog_version_id=version_id ORDER BY e.modality_label,e.ordinal_label,e.name;
END $$;