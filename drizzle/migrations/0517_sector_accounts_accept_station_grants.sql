-- Decisão do proprietário 2026-10-13: toda conta de setor opera com as funções da sua estação
-- (sector_station_rules homologadas). As portas que só aceitavam política de pessoa passam a
-- aceitar também a concessão da estação; autoria continua por author_principal_id onde existe.
-- Ficam de fora portas pessoais/administrativas (admin geral, contas, diário do docente,
-- painel pessoal, oficialização, candidatos de atribuição, carteirinha).
DO $do$
DECLARE f record; def text;
  sector_ok constant text := '(c.policy_id IS NOT NULL OR (c.engagement_id IS NULL AND public.current_principal_id() IS NOT NULL))';
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('ab_scope_allows','ah_grant','al_supervision_grant','b4_class_time_grant',
      'class_time_capability_grant','comm_author_grant','diary_school_overview_at','ei_can_read','import_grant','inclusion_grant',
      'inclusion_term_grant','inst_assessments_at','intelligence_dashboards_visible','notif_grant','offer_capability_on',
      'performance_goals_at','performance_metrics_at','r5_network_grant','record_guardian_authorization',
      'record_guardian_authorization_v2','reference_actor','school_communications_at','school_document_grant',
      'school_followup_grant','school_followup_grant_on','teacher_work_reviewer','teaching_assignment_grant','teaching_plans_overview_at')
  LOOP
    def := pg_get_functiondef(f.oid);
    def := replace(def, 'c.policy_id IS NOT NULL', sector_ok);
    def := replace(def, 'n.policy_id IS NOT NULL', '(n.policy_id IS NOT NULL OR (n.engagement_id IS NULL AND public.current_principal_id() IS NOT NULL))');
    def := replace(def, 'n.engagement_id = c.engagement_id', 'n.engagement_id IS NOT DISTINCT FROM c.engagement_id');
    IF f.proname = 'school_document_grant' THEN
      def := replace(def, 'IF g IS NULL THEN RAISE EXCEPTION ''capability:%''', 'IF g IS NULL AND NOT public.sector_holds_on(_capability, _school, CURRENT_DATE) THEN RAISE EXCEPTION ''capability:%''');
    ELSE
      def := replace(def, 'IF g IS NULL THEN RAISE EXCEPTION ''capability:', 'IF g IS NULL AND NOT (FOUND AND public.current_principal_id() IS NOT NULL) THEN RAISE EXCEPTION ''capability:');
    END IF;
    EXECUTE def;
  END LOOP;
END $do$;