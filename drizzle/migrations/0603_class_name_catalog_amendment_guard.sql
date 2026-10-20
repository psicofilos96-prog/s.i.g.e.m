CREATE FUNCTION public.validate_class_name_catalog_amendment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE original_catalog uuid; option_id uuid;
BEGIN
 IF NEW.version=1 THEN RETURN NEW; END IF;
 SELECT e.catalog_version_id INTO original_catalog FROM public.institutional_class_record_versions r JOIN public.class_name_catalog_entries e ON e.id=r.name_catalog_entry_id WHERE r.class_id=NEW.class_id ORDER BY r.created_at,r.id LIMIT 1;
 -- Legacy identities retain their original contract; catalog-bound identities never revert to free text.
 IF original_catalog IS NULL THEN RETURN NEW; END IF;
 SELECT e.id INTO option_id FROM public.class_name_catalog_entries e WHERE e.catalog_version_id=original_catalog AND e.name=NEW.name AND e.code=NEW.code;
 IF option_id IS NULL THEN RAISE EXCEPTION 'class-name-catalog:selection-required'; END IF;
 NEW.name_catalog_entry_id:=option_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_class_name_catalog_amendment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER class_name_catalog_amendment BEFORE INSERT ON public.institutional_class_record_versions FOR EACH ROW EXECUTE FUNCTION public.validate_class_name_catalog_amendment();