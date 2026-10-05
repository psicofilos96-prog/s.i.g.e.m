-- Frente A: referência documental deixa de ser autorização (decisão do proprietário).
-- Gates artificiais "act-required" viram normalização blank -> NULL. Sessão, capability,
-- escopo, vigência, base esperada, unicidade e auditoria permanecem intactos.
-- Preservados: install_sigem (história da instalação, categoria 3) e
-- register_assessment_results (rectification-act-required = objeto de retificação, não documento).
DO $mig$
DECLARE
  f record; d text; n text; total int := 0;
  targets text[] := ARRAY['end_engagement','record_engagement','register_student','register_curricular_component_version',
    'register_institutional_class','record_institutional_class_version','record_school_link','register_academic_period_version',
    'register_academic_year_version','register_period_organization_version','record_credential_reset',
    'record_attribute_value_version','record_movement_type_definition','save_network_calendar','record_calendar_version',
    'record_calendar_day_type_version','record_calendar_council_configuration','record_calendar_composition_norm_version',
    'homologate_calendar_version','homologate_network_calendar','homologate_calendar_composition_norm',
    'record_class_period_organization_version'];
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_catalog.pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(targets) LOOP
    d := pg_catalog.pg_get_functiondef(f.oid);
    n := d;
    -- padrão geral
    n := pg_catalog.regexp_replace(n,
      'IF coalesce\((pg_catalog\.)?btrim\(_act_ref\),\s*''''\) = '''' THEN RAISE EXCEPTION ''[a-z-]+:act-required''; END IF;',
      '_act_ref := pg_catalog.nullif(pg_catalog.btrim(_act_ref), ''''); -- 0103: referência documental opcional', 'g');
    -- catálogo: homologação sem ato
    n := pg_catalog.replace(n,
      'IF _status = ''homologada'' AND coalesce(pg_catalog.btrim(_act_ref), '''') = '''' THEN RAISE EXCEPTION ''catalog:homologation-act-required''; END IF;',
      '_act_ref := pg_catalog.nullif(pg_catalog.btrim(_act_ref), ''''); -- 0103: referência documental opcional');
    -- tipo de movimentação: mantém exigência de vigência
    n := pg_catalog.replace(n,
      'IF _status = ''homologada'' AND (coalesce(btrim(_act_ref), '''') = '''' OR _valid_from IS NULL) THEN RAISE EXCEPTION ''movement-type:homologation-act-required''; END IF;',
      '_act_ref := pg_catalog.nullif(pg_catalog.btrim(_act_ref), ''''); IF _status = ''homologada'' AND _valid_from IS NULL THEN RAISE EXCEPTION ''movement-type:homologation-valid-from-required''; END IF;');
    -- organização de períodos da turma: motivo continua obrigatório
    n := pg_catalog.replace(n,
      'IF coalesce(pg_catalog.btrim(_reason), '''') = '''' OR coalesce(pg_catalog.btrim(_act_ref), '''') = ''''',
      '_act_ref := pg_catalog.nullif(pg_catalog.btrim(_act_ref), ''''); IF coalesce(pg_catalog.btrim(_reason), '''') = ''''');
    n := pg_catalog.replace(n, '''class-period:act-and-reason-required''', '''class-period:reason-required''');
    -- editor do calendário
    n := pg_catalog.replace(n,
      'IF _act = '''' THEN RAISE EXCEPTION ''calendar-save:act-required''; END IF;',
      '_act := pg_catalog.nullif(_act, ''''); -- 0103: referência documental opcional');
    IF n = d THEN RAISE EXCEPTION '0103: nenhum gate encontrado em %', f.proname; END IF;
    EXECUTE n;
    total := total + 1;
  END LOOP;
  IF total < 22 THEN RAISE EXCEPTION '0103: esperadas >= 22 funções, reescritas %', total; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname <> ALL(ARRAY['install_sigem','register_assessment_results'])
             AND pg_catalog.pg_get_functiondef(p.oid) ~ 'act-required') THEN
    RAISE EXCEPTION '0103: gate act-required remanescente';
  END IF;
END $mig$;

-- Colunas de referência passam a aceitar ausência; CHECK btrim<>'' continuam recusando texto vazio.
ALTER TABLE public.calendar_composition_norm_homologations ALTER COLUMN homologation_act_ref DROP NOT NULL;
ALTER TABLE public.calendar_composition_norm_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.calendar_day_type_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.calendar_version_council_configurations ALTER COLUMN act_ref DROP NOT NULL;
ALTER TABLE public.calendar_version_homologations ALTER COLUMN homologation_act_ref DROP NOT NULL;
ALTER TABLE public.calendar_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.curricular_component_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.engagement_endings ALTER COLUMN act_ref DROP NOT NULL;
ALTER TABLE public.institutional_academic_period_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.institutional_academic_year_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.institutional_period_organization_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.institutional_school_links ALTER COLUMN originating_act_ref DROP NOT NULL;