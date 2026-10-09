-- BQ.1 — Configuração institucional real de autoridades e estações (decisão do gestor 2026-10-09).
-- 1) Estação central de Inclusão/NEI (sem conta: identificador pendente).
ALTER TABLE public.sector_station_rules DROP CONSTRAINT sector_station_rules_station_code_check;
ALTER TABLE public.sector_station_rules ADD CONSTRAINT sector_station_rules_station_code_check CHECK (station_code = ANY (ARRAY['ciece','supervisao','alimentacao','avaliacao','orientacao_pedagogica','direcao_escolar','secretaria_escolar','administracao_geral','inclusao_nei']));
ALTER TABLE public.institutional_sector_principals DROP CONSTRAINT institutional_sector_principals_station_code_check;
ALTER TABLE public.institutional_sector_principals ADD CONSTRAINT institutional_sector_principals_station_code_check CHECK (station_code = ANY (ARRAY['ciece','supervisao','alimentacao','avaliacao','orientacao_pedagogica','direcao_escolar','secretaria_escolar','inclusao_nei']));

-- 2) Catálogo explícito de capabilities do produto (append-only). Admin precisa cobrir todas.
CREATE TABLE public.sigem_capability_catalog (
  capability_id text PRIMARY KEY CHECK (capability_id ~ '^[a-z0-9][a-z0-9-]+$'),
  origin text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.sigem_capability_catalog FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sigem_capability_catalog TO service_role;
ALTER TABLE public.sigem_capability_catalog ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sigem_capability_catalog_immutable BEFORE DELETE OR UPDATE ON public.sigem_capability_catalog FOR EACH ROW EXECUTE FUNCTION public.sector_principal_immutable();

INSERT INTO public.sigem_capability_catalog(capability_id, origin)
WITH src AS (SELECT prosrc s FROM pg_proc WHERE pronamespace = 'public'::regnamespace),
lit AS (
  SELECT capability_id c FROM public.capability_policy_rules
  UNION SELECT capability_id FROM public.sector_station_rules
  UNION SELECT unnest(capabilities) FROM public.calendar_authority_designations
  UNION SELECT capability_id FROM public.sigem_master_reserved_capabilities
  UNION SELECT (regexp_matches(s, '(?:capabilit[a-z_]*|_grant|_grant_on)\s*\(\s*''([a-z]+(?:-[a-z0-9]+)+)''', 'g'))[1] FROM src
  UNION SELECT (regexp_matches(s, 'capability_id\s*(?:=|IN\s*\()\s*''([a-z]+(?:-[a-z0-9]+)+)''', 'gi'))[1] FROM src
  UNION SELECT btrim(x, E' \n''') FROM src, regexp_matches(s, '_capability NOT IN \(([^)]*)\)', 'g') m, unnest(string_to_array(m[1], ',')) x
  UNION SELECT unnest(ARRAY['consultar-auditoria','exportar-auditoria'])
)
SELECT DISTINCT c, 'bq1-referenciada-pelo-sigem-2026-10-09' FROM lit WHERE c ~ '^[a-z0-9][a-z0-9-]+$';

-- 3) Regras v3 (homologadas por decisão do gestor; sem curinga).
INSERT INTO public.sector_station_rule_versions(rules_version, status, valid_from, decision_ref)
VALUES (3, 'homologated', DATE '2026-10-09', 'decisao-gestor-bq1-2026-10-09');

INSERT INTO public.sector_station_rules(rules_version, station_code, capability_id, decision_ref)
SELECT 3, r.station_code, r.capability_id, 'decisao-gestor-bq1-2026-10-09'
FROM public.sector_station_rules r WHERE r.rules_version = 2 AND r.station_code <> 'administracao_geral'
UNION
SELECT 3, s, c, 'decisao-gestor-bq1-2026-10-09' FROM (VALUES
  ('supervisao','construir-calendario-da-rede'),('supervisao','homologar-calendario-da-rede'),
  ('supervisao','construir-norma-composicao-calendario-da-rede'),('supervisao','homologar-norma-composicao-calendario-da-rede'),
  ('supervisao','manter-anos-e-periodos-letivos'),
  ('avaliacao','consultar-resultados-avaliativos'),('avaliacao','consultar-resultado-avaliativo'),('avaliacao','declarar-comparabilidade-avaliativa'),
  ('avaliacao','definir-analise-avaliativa'),('avaliacao','manter-painel-inteligencia'),('avaliacao','consultar-proveniencia-analitica'),
  ('avaliacao','consultar-identidade-cadastral-do-estudante'),('avaliacao','consultar-estudantes-da-turma'),('avaliacao','consultar-matricula-e-movimentacao'),
  ('avaliacao','consultar-organizacao-da-oferta'),('avaliacao','revisar-qualidade-dos-dados'),('avaliacao','gerir-importacao-de-dados'),
  ('avaliacao','manter-politica-de-divulgacao-analitica'),
  ('ciece','consultar-censo-escolar'),('ciece','conferir-censo-escolar'),('ciece','preparar-censo-escolar'),('ciece','consultar-pendencias-do-censo'),
  ('ciece','gerir-importacao-de-dados'),('ciece','corrigir-mapa-estatistico'),('ciece','consultar-desempenho-educacional'),('ciece','consultar-resultado-avaliativo'),
  ('ciece','consultar-resultados-avaliativos'),('ciece','consultar-matricula-e-movimentacao'),('ciece','consultar-estudantes-da-turma'),('ciece','consultar-frequencia'),
  ('ciece','consultar-organizacao-da-oferta'),('ciece','consultar-encerramento-do-ciclo'),('ciece','consultar-quadro-profissional-da-escola'),
  ('alimentacao','registrar-estoque-alimentar'),('alimentacao','conferir-recebimento-alimentar'),('alimentacao','fechar-estoque-alimentar'),
  ('alimentacao','aprovar-inventario-alimentar'),('alimentacao','ajustar-estoque-alimentar'),('alimentacao','transferir-estoque-alimentar'),
  ('alimentacao','registrar-execucao-alimentacao'),('alimentacao','manter-parametros-nutricionais'),('alimentacao','manter-planejamento-nutricional'),
  ('alimentacao','consultar-restricao-alimentar'),
  ('direcao_escolar','consultar-alimentacao-escolar'),('direcao_escolar','submeter-pedido-alimentar'),('direcao_escolar','registrar-restricao-alimentar'),
  ('direcao_escolar','consultar-restricao-alimentar'),('direcao_escolar','registrar-execucao-alimentacao'),('direcao_escolar','conferir-recebimento-alimentar'),
  ('direcao_escolar','registrar-nao-conformidade-alimentar'),
  ('inclusao_nei','acompanhar-educacao-inclusiva-rede'),('inclusao_nei','consultar-apoio-inclusivo'),('inclusao_nei','registrar-apoio-inclusivo'),
  ('inclusao_nei','consultar-documento-sensivel-inclusao'),('inclusao_nei','anexar-documento-inclusao'),('inclusao_nei','revisar-termos-inclusao'),
  ('inclusao_nei','manter-mediacao-escolar'),('inclusao_nei','organizar-atendimento-aee'),('inclusao_nei','registrar-sessao-aee')
) v(s, c)
UNION
SELECT 3, 'administracao_geral', k.capability_id, 'decisao-gestor-bq1-2026-10-09' FROM public.sigem_capability_catalog k;

-- 4) Cobertura do Admin: toda capability do catálogo e de qualquer estação.
CREATE OR REPLACE FUNCTION public.sector_admin_coverage_issues()
 RETURNS TABLE(capability_id text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT DISTINCT x.c FROM (
    SELECT r.capability_id c FROM public.sector_station_rules r
     WHERE r.rules_version = public.current_sector_rules_version() AND r.station_code <> 'administracao_geral'
    UNION SELECT k.capability_id FROM public.sigem_capability_catalog k) x
  WHERE NOT EXISTS (SELECT 1 FROM public.sector_station_rules a WHERE a.rules_version = public.current_sector_rules_version()
                     AND a.station_code = 'administracao_geral' AND a.capability_id = x.c) $function$;

-- 5) Ator institucional: pessoa natural OU principal de setor (nunca pessoa fictícia).
CREATE OR REPLACE FUNCTION public.institutional_actor_person()
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  me := public.s_current_person();
  IF me IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = me AND p.actor_nature = 'pessoa-natural') THEN RETURN me; END IF;
  IF public.current_principal_id() IS NOT NULL THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'secretariat:natural-person-required';
END $function$;
REVOKE ALL ON FUNCTION public.institutional_actor_person() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.bq1_stamp_author_principal()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  NEW.author_principal_id := coalesce(NEW.author_principal_id, public.current_principal_id());
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.bq1_stamp_author_principal() FROM PUBLIC, anon, authenticated;

-- 5b) Tabelas de Alimentação e Avaliação aceitam autoria por principal (CHECK pessoa+atuação OU principal).
DO $bq1$
DECLARE t record; c text; cond text;
BEGIN
  FOR t IN SELECT cl.relname, array_agg(a.attname::text ORDER BY a.attname) cols
    FROM pg_attribute a JOIN pg_class cl ON cl.oid = a.attrelid
   WHERE cl.relnamespace = 'public'::regnamespace AND cl.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
     AND (cl.relname ~ '^(meal_|dietary_)' OR cl.relname IN ('assessment_analysis_definitions','assessment_edition_versions','assessment_edition_cycle_events',
          'assessment_program_versions','assessment_metric_comparability','intelligence_dashboard_versions','inst_assessment_versions','inst_assessment_results'))
     AND a.attname IN ('author_person_id','author_engagement','actor_person_id','actor_engagement')
   GROUP BY cl.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS author_principal_id uuid', t.relname);
    cond := '';
    FOREACH c IN ARRAY t.cols LOOP
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', t.relname, c);
      cond := cond || CASE WHEN cond = '' THEN '' ELSE ' AND ' END || format('%I IS NOT NULL', c);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (author_principal_id IS NOT NULL OR (%s)) NOT VALID', t.relname, left(t.relname, 40) || '_bq1_actor', cond);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bq1_stamp_author_principal()', left(t.relname, 40) || '_bq1_stamp', t.relname);
  END LOOP;
END $bq1$;

-- 5c) Writers de Alimentação/Avaliação: ator institucional (pessoa natural OU principal); autoavaliação vedada só entre pessoas.
DO $bq1$
DECLARE f record; d text;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%public.af_natural_person()%'
     AND (p.proname ~ '(meal|dietary)' OR p.proname IN ('record_assessment_edition_cycle_event','record_assessment_program','record_assessment_edition',
          'record_metric_comparability','record_intelligence_dashboard','record_assessment_analysis_definition'))
  LOOP
    d := replace(pg_get_functiondef(f.oid), 'public.af_natural_person()', 'public.institutional_actor_person()');
    d := regexp_replace(d, 'IF (_status = ''aprovada'' AND )?(head|st)\.author_person_id = me THEN', 'IF \1me IS NOT NULL AND \2.author_person_id = me THEN', 'g');
    EXECUTE d;
  END LOOP;
  -- Grants de domínio reconhecem a perna do principal (atuação NULL), sem curinga e sem exigir política humana.
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('meal_grant_on','meal_network_grant_on','ei_grant','perf_grant')
  LOOP
    d := pg_get_functiondef(f.oid);
    IF position('AND c.policy_id IS NOT NULL' IN d) = 0 OR position('IF g IS NULL THEN RAISE' IN d) = 0 THEN RAISE EXCEPTION 'bq1:unexpected-grant-shape %', f.proname; END IF;
    d := replace(d, ' AND c.policy_id IS NOT NULL', '');
    d := replace(d, 'ORDER BY c.policy_version DESC, c.engagement_id', 'ORDER BY c.policy_version DESC NULLS LAST, c.engagement_id NULLS LAST');
    d := replace(d, 'IF g IS NULL THEN RAISE', 'IF NOT FOUND THEN RAISE');
    EXECUTE d;
  END LOOP;
END $bq1$;

-- 6) Família: o contexto escolar acompanha a matrícula ativa (fato canônico), nunca o school_id gravado na concessão.
CREATE OR REPLACE FUNCTION public.family_enrollment_school(_student text, _on date)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT e.school_id FROM public.school_enrollments e
  WHERE e.student_id = _student AND _on IS NOT NULL AND (e.opened_on IS NULL OR e.opened_on <= _on)
    AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id AND x.ended_on <= _on)
    AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions h
                     WHERE h.enrollment_logical_id = e.logical_id AND coalesce(h.annulled, false) = false AND h.ended_on <= _on
                       AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions n WHERE n.supersedes_id = h.id))
  ORDER BY e.opened_on DESC NULLS LAST, e.created_at DESC LIMIT 1 $function$;
REVOKE ALL ON FUNCTION public.family_enrollment_school(text, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.family_authorization(_student text)
 RETURNS guardian_authorizations LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE a public.guardian_authorizations; sch text;
BEGIN
  SELECT x.* INTO a FROM public.guardian_authorizations x
   WHERE x.student_id = _student AND x.guardian_user_id = auth.uid() AND x.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = x.id)
     AND x.valid_from <= CURRENT_DATE AND (x.valid_until IS NULL OR x.valid_until >= CURRENT_DATE)
     AND (x.guardian_person_id IS NULL OR EXISTS (SELECT 1 FROM public.user_person_links l WHERE l.user_id = auth.uid() AND l.person_id = x.guardian_person_id))
   ORDER BY x.recorded_at DESC LIMIT 1;
  IF a.id IS NULL THEN RETURN NULL; END IF;
  sch := public.family_enrollment_school(_student, CURRENT_DATE);
  IF sch IS NULL THEN RETURN NULL; END IF;
  a.school_id := sch;
  RETURN a;
END $function$;

DO $bq1$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.family_communications(text)'::regprocedure);
  IF position('SELECT a.school_id INTO sch FROM public.guardian_authorizations a' IN d) = 0 THEN RAISE EXCEPTION 'bq1:shape family_communications'; END IF;
  EXECUTE replace(d, 'SELECT a.school_id INTO sch FROM public.guardian_authorizations a', 'SELECT public.family_enrollment_school(a.student_id, CURRENT_DATE) INTO sch FROM public.guardian_authorizations a');
  d := pg_get_functiondef('public.family_published_menus(text,date)'::regprocedure);
  IF position('SELECT a.school_id INTO sch FROM public.guardian_authorizations a' IN d) = 0 THEN RAISE EXCEPTION 'bq1:shape family_published_menus'; END IF;
  EXECUTE replace(d, 'SELECT a.school_id INTO sch FROM public.guardian_authorizations a', 'SELECT public.family_enrollment_school(a.student_id, _on) INTO sch FROM public.guardian_authorizations a');
  d := pg_get_functiondef('public.notif_guardians(text,text,text,date)'::regprocedure);
  IF position('a.school_id = _school' IN d) = 0 THEN RAISE EXCEPTION 'bq1:shape notif_guardians'; END IF;
  EXECUTE replace(d, 'a.school_id = _school', 'public.family_enrollment_school(a.student_id, _on) = _school');
END $bq1$;

-- 7) CIECE: correção cadastral do estudante pelo writer oficial, autoria = principal institucional.
ALTER TABLE public.student_identity_versions ADD COLUMN IF NOT EXISTS recorded_by_principal_id uuid;
DO $bq1$
DECLARE d text; o text;
BEGIN
  d := pg_get_functiondef('public.record_student_identity_version(text,uuid,text,text,date,text,integer,text,text)'::regprocedure);
  o := 'DECLARE g uuid; b record;'; IF position(o IN d) = 0 THEN RAISE EXCEPTION 'bq1:shape sid 1'; END IF;
  d := replace(d, o, 'DECLARE g uuid; ok boolean; pr uuid; b record;');
  o := E'  g := public.student_identity_authority(_student, ''manter-identidade-cadastral-do-estudante'');\n  IF g IS NULL THEN RAISE EXCEPTION ''capability:manter-identidade-cadastral-do-estudante''; END IF;';
  IF position(o IN d) = 0 THEN RAISE EXCEPTION 'bq1:shape sid 2'; END IF;
  d := replace(d, o, E'  SELECT c.engagement_id, true INTO g, ok FROM public.effective_scope_capabilities(current_date) c\n   WHERE c.capability_id = ''manter-identidade-cadastral-do-estudante'' AND (c.scope_level = ''rede'' OR (_student IS NOT NULL AND c.scope_level = ''escola''\n     AND EXISTS (SELECT 1 FROM school_enrollments e WHERE e.student_id = _student AND e.school_id = c.school_id)))\n   ORDER BY (c.scope_level = ''rede'') DESC, c.engagement_id NULLS LAST LIMIT 1;\n  IF ok IS NULL THEN RAISE EXCEPTION ''capability:manter-identidade-cadastral-do-estudante''; END IF;\n  IF g IS NULL THEN pr := public.current_principal_id(); IF pr IS NULL THEN RAISE EXCEPTION ''capability:manter-identidade-cadastral-do-estudante''; END IF; END IF;');
  o := 'recorded_by, recorded_by_person_id, recorded_via_engagement_id)'; IF position(o IN d) = 0 THEN RAISE EXCEPTION 'bq1:shape sid 3'; END IF;
  d := replace(d, o, 'recorded_by, recorded_by_person_id, recorded_via_engagement_id, recorded_by_principal_id)');
  o := 'auth.uid(), public.current_person_id(), g)'; IF position(o IN d) = 0 THEN RAISE EXCEPTION 'bq1:shape sid 4'; END IF;
  d := replace(d, o, 'auth.uid(), CASE WHEN g IS NOT NULL THEN public.current_person_id() END, g, pr)');
  EXECUTE d;
END $bq1$;
