-- BQ.1C — Principal institucional/setorial (conta de setor ≠ pessoa). Segunda perna ADITIVA de autoridade:
-- principal persistido × regras de estação versionadas × escopo. Caminho humano (pessoa/atuação/policy) inalterado.

CREATE TABLE public.sector_station_rules (
  rules_version integer NOT NULL CHECK (rules_version > 0),
  station_code text NOT NULL CHECK (station_code IN ('ciece','supervisao','alimentacao','avaliacao','orientacao_pedagogica','direcao_escolar','secretaria_escolar','administracao_geral')),
  capability_id text NOT NULL CHECK (capability_id ~ '^[a-z0-9][a-z0-9-]+$'),
  decision_ref text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rules_version, station_code, capability_id)
);
CREATE TABLE public.sector_station_rule_versions (
  rules_version integer PRIMARY KEY,
  status text NOT NULL CHECK (status = 'homologated'),
  valid_from date NOT NULL,
  decision_ref text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.institutional_sector_principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  principal_kind text NOT NULL DEFAULT 'sector_account' CHECK (principal_kind = 'sector_account'),
  station_code text NOT NULL CHECK (station_code IN ('ciece','supervisao','alimentacao','avaliacao','orientacao_pedagogica','direcao_escolar','secretaria_escolar')),
  scope_kind text NOT NULL CHECK (scope_kind IN ('network','school')),
  school_id text REFERENCES public.institutional_schools(id),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  provenance text NOT NULL,
  provisioning_operation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_kind = 'school') = (school_id IS NOT NULL)),
  CHECK ((scope_kind = 'school') = (station_code IN ('orientacao_pedagogica','direcao_escolar','secretaria_escolar'))),
  UNIQUE (station_code, school_id)
);
CREATE UNIQUE INDEX institutional_sector_principals_network_station ON public.institutional_sector_principals(station_code) WHERE school_id IS NULL;
CREATE TABLE public.institutional_sector_principal_revocations (
  principal_id uuid PRIMARY KEY REFERENCES public.institutional_sector_principals(id),
  revoked_on date NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.institutional_sector_provisioning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  principal_id uuid NOT NULL REFERENCES public.institutional_sector_principals(id),
  outcome text NOT NULL CHECK (outcome IN ('created','reconciled')),
  executor text NOT NULL DEFAULT 'automacao-tecnica-provisionamento',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sector_station_rules, public.sector_station_rule_versions, public.institutional_sector_principals,
  public.institutional_sector_principal_revocations, public.institutional_sector_provisioning_events TO service_role;
REVOKE ALL ON public.sector_station_rules, public.sector_station_rule_versions, public.institutional_sector_principals,
  public.institutional_sector_principal_revocations, public.institutional_sector_provisioning_events FROM anon, authenticated;
ALTER TABLE public.sector_station_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_station_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_sector_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_sector_principal_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_sector_provisioning_events ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.sector_principal_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'sector-principal:immutable'; END $$;
CREATE TRIGGER sector_station_rules_immutable BEFORE UPDATE OR DELETE ON public.sector_station_rules FOR EACH ROW EXECUTE FUNCTION public.sector_principal_immutable();
CREATE TRIGGER sector_station_rule_versions_immutable BEFORE UPDATE OR DELETE ON public.sector_station_rule_versions FOR EACH ROW EXECUTE FUNCTION public.sector_principal_immutable();
CREATE TRIGGER institutional_sector_principals_immutable BEFORE UPDATE OR DELETE ON public.institutional_sector_principals FOR EACH ROW EXECUTE FUNCTION public.sector_principal_immutable();
CREATE TRIGGER institutional_sector_principal_revocations_immutable BEFORE UPDATE OR DELETE ON public.institutional_sector_principal_revocations FOR EACH ROW EXECUTE FUNCTION public.sector_principal_immutable();
CREATE TRIGGER institutional_sector_provisioning_events_immutable BEFORE UPDATE OR DELETE ON public.institutional_sector_provisioning_events FOR EACH ROW EXECUTE FUNCTION public.sector_principal_immutable();

-- Regras v1 (decisão expressa do usuário, 2026-10-06, matriz A–H da frente BQ.1).
INSERT INTO public.sector_station_rule_versions VALUES (1, 'homologated', DATE '2026-10-06', 'decisao-usuario-2026-10-06-bq1-matriz-estacoes', now());
INSERT INTO public.sector_station_rules(rules_version, station_code, capability_id, decision_ref)
SELECT 1, s, c, 'decisao-usuario-2026-10-06-bq1-matriz-estacoes' FROM (VALUES
 ('ciece', ARRAY['consultar-mapa-estatistico','consultar-historico-mapa-estatistico','conferir-mapa-estatistico','oficializar-mapa-estatistico','manter-regra-de-competencia-do-mapa','revisar-qualidade-dos-dados','administrar-integracoes','consultar-indicador-agregado','consultar-decomposicao-analitica','consultar-proveniencia-analitica','manter-politica-de-divulgacao-analitica','consultar-registro-de-visitas','manter-contas-institucionais','consultar-identidade-cadastral-do-estudante','manter-identidade-cadastral-do-estudante']),
 ('supervisao', ARRAY['registrar-acompanhamento-da-supervisao','consultar-acompanhamento-da-supervisao']),
 ('alimentacao', ARRAY['acompanhar-alimentacao-rede','consultar-alimentacao-escolar','manter-catalogo-tecnico-alimentar','conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar','manter-referencias-contratuais-alimentacao','manter-unidades-de-alimentacao','designar-inspetor-alimentacao','consolidar-demanda-alimentar','administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar','registrar-programacao-de-entrega-alimentar','registrar-nao-conformidade-alimentar','manter-cardapio-escolar','publicar-cardapio-escolar','gerir-documentos-alimentacao','exportar-relatorios-alimentacao']),
 ('avaliacao', ARRAY['manter-programa-avaliativo','manter-avaliacao-institucional','registrar-resultado-avaliacao-institucional','manter-metrica-desempenho','consultar-desempenho-educacional','consultar-indicador-agregado','consultar-decomposicao-analitica','consultar-banco-de-itens']),
 ('secretaria_escolar', ARRAY['preparar-mapa-estatistico','consultar-mapa-estatistico','consultar-historico-mapa-estatistico','consultar-identidade-cadastral-do-estudante','manter-identidade-cadastral-do-estudante','cadastrar-estudante-na-escola','localizar-estudante-para-matricula','consultar-matricula-e-movimentacao','manter-matricula-e-enturmacao','registrar-movimentacao-escolar','manter-cadastro-de-turmas','manter-organizacao-da-oferta-da-turma','manter-organizacao-de-periodos-da-turma','manter-turno-da-turma','consultar-organizacao-da-oferta','manter-atribuicao-docente','manter-grade-da-turma','manter-jornada-da-turma','localizar-servidor-por-identificador','manter-lotacao-da-escola','consultar-quadro-profissional-da-escola','registrar-visita-institucional','gerir-tarefas-operacionais','consultar-estudantes-da-turma','registrar-situacao-academica','encerrar-ciclo-turma','consultar-encerramento-do-ciclo']),
 ('direcao_escolar', ARRAY['consultar-mapa-estatistico','consultar-historico-mapa-estatistico','consultar-identidade-cadastral-do-estudante','consultar-matricula-e-movimentacao','consultar-indicador-agregado','consultar-registro-de-visitas','consultar-registro-funcional','consultar-quadro-profissional-da-escola','consultar-organizacao-da-oferta','consultar-planejamento-docente','consultar-banco-de-itens','consultar-instrumento-docente','revisar-qualidade-dos-dados','gerir-tarefas-operacionais','consultar-estudantes-da-turma','consultar-frequencia','consultar-registro-de-aula','consultar-resultado-avaliativo','consultar-parecer-descritivo','consultar-experiencia-infantil','consultar-encerramento-do-ciclo','consultar-auditoria-de-frequencia','consultar-auditoria-de-situacao','consultar-auditoria-fechamentos','registrar-ocorrencia-no-prontuario','homologar-encerramento','homologar-fechamento-de-frequencia','homologar-fechamento-oficial','autorizar-retificacao-pos-fechamento','reabrir-frequencia-fechada','reabrir-periodo-fechado','reabrir-turma-encerrada','retificar-encerramento-turma']),
 ('orientacao_pedagogica', ARRAY['consultar-planejamento-docente','consultar-banco-de-itens','consultar-instrumento-docente','gerir-tarefas-operacionais','consultar-matricula-e-movimentacao','consultar-estudantes-da-turma','consultar-frequencia','consultar-registro-de-aula','consultar-resultado-avaliativo','consultar-parecer-descritivo','consultar-experiencia-infantil','consultar-encerramento-do-ciclo','devolver-pauta-com-apontamentos','devolver-pauta-de-frequencia','realizar-conferencia-de-frequencia','realizar-conferencia-escolar'])
) v(s, cs) CROSS JOIN LATERAL unnest(cs) c;
-- Administrador Geral: cobertura explícita de toda capability de estação (sem curinga), materializada linha a linha.
INSERT INTO public.sector_station_rules(rules_version, station_code, capability_id, decision_ref)
SELECT DISTINCT 1, 'administracao_geral', capability_id, 'cobertura-explicita-administrador-geral-bq1'
FROM public.sector_station_rules WHERE rules_version = 1;

CREATE FUNCTION public.current_sector_rules_version(_on date DEFAULT CURRENT_DATE) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT max(rules_version) FROM public.sector_station_rule_versions WHERE status = 'homologated' AND valid_from <= _on $$;

CREATE FUNCTION public.current_principal_id(_on date DEFAULT CURRENT_DATE) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id FROM public.institutional_sector_principals p
  WHERE auth.uid() IS NOT NULL AND p.auth_user_id = auth.uid() AND p.valid_from <= _on
    AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principal_revocations r WHERE r.principal_id = p.id AND r.revoked_on <= _on) $$;

-- Linhas de estação vigentes para o chamador: principal setorial OU atuação humana de Administrador Geral (cobertura explícita).
CREATE FUNCTION public.sector_station_grants(_on date DEFAULT CURRENT_DATE)
RETURNS TABLE(capability_id text, principal_id uuid, engagement_id uuid, rules_version integer, scope_level text, school_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.capability_id, p.id, NULL::uuid, r.rules_version,
         CASE p.scope_kind WHEN 'network' THEN 'rede' ELSE 'escola' END, p.school_id
  FROM public.institutional_sector_principals p
  JOIN public.sector_station_rules r ON r.station_code = p.station_code AND r.rules_version = public.current_sector_rules_version(_on)
  WHERE p.id = public.current_principal_id(_on)
    AND (p.scope_kind = 'network' OR (p.school_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = p.school_id)))
  UNION ALL
  SELECT r.capability_id, NULL::uuid, e.id, r.rules_version, 'rede', NULL::text
  FROM public.institutional_engagements e
  JOIN public.sector_station_rules r ON r.station_code = 'administracao_geral' AND r.rules_version = public.current_sector_rules_version(_on)
  WHERE e.person_id = public.current_person_id() AND e.engagement_kind_id = 'administrador-geral-do-sigem' AND e.scope_level = 'rede'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= _on) $$;

CREATE OR REPLACE FUNCTION public.effective_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, school_id text, class_id text, component_id text, period_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, cls.school_id, cls.id,
    CASE WHEN 'component' = ANY(r.scope_dimensions) THEN e.component_id END,
    CASE WHEN 'period' = ANY(r.scope_dimensions) THEN e.period_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  JOIN public.institutional_classes cls ON
       (e.scope_level = 'turma'  AND cls.id = e.class_id AND (e.school_id IS NULL OR cls.school_id = e.school_id))
    OR (e.scope_level = 'turmas' AND cls.school_id = e.school_id
        AND EXISTS (SELECT 1 FROM public.institutional_engagement_scope_classes s WHERE s.engagement_id = e.id AND s.class_id = cls.id))
    OR (e.scope_level = 'escola' AND cls.school_id = e.school_id)
    OR (e.scope_level = 'rede')
  WHERE e.person_id = public.current_person_id()
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::text
  FROM public.calendar_designated_capabilities(_on) d
  UNION ALL
  SELECT g.capability_id, g.engagement_id, NULL::uuid, NULL::integer, cls.school_id, cls.id, NULL::text, NULL::text
  FROM public.sector_station_grants(_on) g
  JOIN public.institutional_classes cls ON g.scope_level = 'rede' OR (g.scope_level = 'escola' AND cls.school_id = g.school_id)
$function$;

CREATE OR REPLACE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, e.scope_level, CASE WHEN e.scope_level = 'escola' THEN e.school_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  WHERE e.person_id = public.current_person_id()
    AND e.scope_level IN ('escola','rede')
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, 'rede', NULL::text
  FROM public.calendar_designated_capabilities(_on) d
  UNION ALL
  SELECT g.capability_id, g.engagement_id, NULL::uuid, NULL::integer, g.scope_level, g.school_id
  FROM public.sector_station_grants(_on) g
$function$;

-- Concessões que devolvem atuação: preferem a atuação humana; principal setorial não tem atuação (NULL) e
-- writers que exigem atuação/pessoa falham fechados (HUMAN_ONLY por construção).
CREATE OR REPLACE FUNCTION public.capability_grant(_capability text, _class text, _component text DEFAULT NULL::text, _period text DEFAULT NULL::text)
 RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.engagement_id, c.policy_id, c.policy_version FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = _capability
     AND (c.class_id IS NULL OR c.class_id = _class)
     AND (_component IS NULL OR c.component_id IS NULL OR c.component_id = _component)
     AND (_period IS NULL OR c.period_id IS NULL OR c.period_id = _period)
   ORDER BY c.engagement_id NULLS LAST
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.school_capability_grant(_capability text, _school text)
 RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.engagement_id, c.policy_id, c.policy_version FROM public.effective_scope_capabilities(current_date) c
  WHERE _school IS NOT NULL AND c.capability_id = _capability
    AND ((c.scope_level = 'escola' AND c.school_id = _school)
      OR (c.scope_level = 'rede' AND EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school)))
  ORDER BY (c.scope_level = 'escola') DESC, c.engagement_id NULLS LAST LIMIT 1
$function$;

-- Ator autenticado canônico: nunca afirma que principal setorial é pessoa.
CREATE FUNCTION public.current_actor()
RETURNS TABLE(actor_kind text, actor_id uuid, person_id uuid, institutional_principal_id uuid, station_code text, scope_kind text, school_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN pr.id IS NOT NULL THEN 'institutional' WHEN public.current_person_id() IS NOT NULL THEN 'human' END,
         coalesce(pr.id, public.current_person_id()),
         CASE WHEN pr.id IS NULL THEN public.current_person_id() END,
         pr.id, pr.station_code, pr.scope_kind, pr.school_id
  FROM (SELECT 1) one
  LEFT JOIN public.institutional_sector_principals pr ON pr.id = public.current_principal_id()
  WHERE auth.uid() IS NOT NULL $$;

-- Cobertura do Administrador Geral sobre capabilities de estação (deve ser vazia).
CREATE FUNCTION public.sector_admin_coverage_issues() RETURNS TABLE(capability_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT r.capability_id FROM public.sector_station_rules r
  WHERE r.rules_version = public.current_sector_rules_version() AND r.station_code <> 'administracao_geral'
    AND NOT EXISTS (SELECT 1 FROM public.sector_station_rules a WHERE a.rules_version = r.rules_version AND a.station_code = 'administracao_geral' AND a.capability_id = r.capability_id) $$;

-- Provisionamento técnico (só service_role): idempotente; recusa divergência; nunca cria pessoa.
CREATE FUNCTION public.provision_sector_principal(_auth_user uuid, _station text, _school text, _operation text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid; ex public.institutional_sector_principals%ROWTYPE; school_scoped boolean := _station IN ('orientacao_pedagogica','direcao_escolar','secretaria_escolar');
BEGIN
  IF _auth_user IS NULL OR coalesce(btrim(_operation),'') = '' THEN RAISE EXCEPTION 'sector-principal:args'; END IF;
  IF school_scoped AND (_school IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.institutional_school_identifiers i WHERE i.school_id = _school AND i.identifier_kind = 'inep' AND i.value ~ '^\d{8}$')) THEN
    RAISE EXCEPTION 'sector-principal:school-ineligible'; END IF;
  IF NOT school_scoped AND _school IS NOT NULL THEN RAISE EXCEPTION 'sector-principal:network-with-school'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sector-principal:' || _auth_user::text));
  SELECT * INTO ex FROM public.institutional_sector_principals WHERE auth_user_id = _auth_user;
  IF FOUND THEN
    IF ex.station_code <> _station OR ex.school_id IS DISTINCT FROM _school THEN RAISE EXCEPTION 'sector-principal:divergent-existing'; END IF;
    INSERT INTO public.institutional_sector_provisioning_events(operation, principal_id, outcome) VALUES (_operation, ex.id, 'reconciled');
    RETURN ex.id;
  END IF;
  INSERT INTO public.institutional_sector_principals(auth_user_id, station_code, scope_kind, school_id, provenance, provisioning_operation)
  VALUES (_auth_user, _station, CASE WHEN school_scoped THEN 'school' ELSE 'network' END, _school,
          'decisao-usuario-2026-10-06-contas-setoriais-compartilhadas', _operation)
  RETURNING id INTO pid;
  INSERT INTO public.institutional_sector_provisioning_events(operation, principal_id, outcome) VALUES (_operation, pid, 'created');
  RETURN pid;
END $$;

-- Exemplo INSTITUTIONAL_ACTOR_ALLOWED: revisão de qualidade dos dados registra o principal real (pessoa fica NULL).
ALTER TABLE public.data_quality_review_events ADD COLUMN recorded_by_principal uuid REFERENCES public.institutional_sector_principals(id);
CREATE OR REPLACE FUNCTION public.record_data_quality_review(_fingerprint text, _evidence_sha256 text, _rule_id text, _rule_version integer, _school uuid, _state text, _reason text, _expected_head uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _head uuid; _id uuid; _person uuid := public.current_person_id(); _principal uuid := public.current_principal_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'data-quality:auth-required'; END IF;
  IF _person IS NULL AND _principal IS NULL THEN RAISE EXCEPTION 'data-quality:actor-required'; END IF;
  IF NOT public.data_quality_can_review(_school) THEN RAISE EXCEPTION 'data-quality:capability-missing'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('dq:' || _fingerprint));
  SELECT e.id INTO _head FROM public.data_quality_review_events e WHERE e.fingerprint = _fingerprint
    AND NOT EXISTS (SELECT 1 FROM public.data_quality_review_events n WHERE n.supersedes_id = e.id);
  IF _head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'data-quality:stale-head'; END IF;
  INSERT INTO public.data_quality_review_events (fingerprint, evidence_sha256, rule_id, rule_version, school_id, state, reason, supersedes_id, recorded_by, recorded_by_person, recorded_by_principal)
  VALUES (_fingerprint, _evidence_sha256, _rule_id, _rule_version, _school, _state, pg_catalog.btrim(_reason), _head, auth.uid(),
          CASE WHEN _principal IS NULL THEN _person END, _principal)
  RETURNING id INTO _id;
  RETURN _id;
END; $function$;

REVOKE ALL ON FUNCTION public.sector_principal_immutable(), public.current_sector_rules_version(date), public.current_principal_id(date),
  public.sector_station_grants(date), public.current_actor(), public.sector_admin_coverage_issues(),
  public.provision_sector_principal(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_principal_id(date), public.current_actor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sector_admin_coverage_issues(), public.provision_sector_principal(uuid, text, text, text) TO service_role;
