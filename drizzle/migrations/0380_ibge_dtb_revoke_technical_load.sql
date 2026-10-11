DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['territorial_dtb_sources','territorial_ufs','territorial_municipalities','territorial_districts','territorial_subdistricts','territorial_district_changes'] LOOP
    EXECUTE format('REVOKE INSERT ON public.%I FROM sandbox_exec', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_load', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO sandbox_exec USING (true)', t||'_tech_read', t);
  END LOOP;
END $$;