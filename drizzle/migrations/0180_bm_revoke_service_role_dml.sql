DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['assessment_program_versions','assessment_edition_versions','assessment_metric_comparability','intelligence_dashboard_versions','assessment_analysis_definitions'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM service_role', t);
  END LOOP;
END $$;