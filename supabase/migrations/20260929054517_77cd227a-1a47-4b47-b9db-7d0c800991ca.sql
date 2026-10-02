DELETE FROM public.capability_policy_rules
 WHERE policy_id = 'b424c230-8ee8-4d5a-b5f0-afe9c981c565' AND engagement_kind_id = 'direcao-escolar' AND capability_id = 'registrar-situacao-academica';
INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
SELECT 'b424c230-8ee8-4d5a-b5f0-afe9c981c565', k, c, d::text[] FROM (VALUES
 ('secretaria-escolar','manter-matricula-e-enturmacao','{school}'),('secretaria-escolar','registrar-movimentacao-escolar','{school}'),
 ('secretaria-escolar','consultar-matricula-e-movimentacao','{school}'),('secretaria-escolar','manter-identidade-cadastral-do-estudante','{school}'),
 ('secretaria-escolar','consultar-identidade-cadastral-do-estudante','{school}'),('secretaria-escolar','manter-turno-da-turma','{school}'),
 ('secretaria-escolar','manter-organizacao-da-oferta-da-turma','{school}'),('secretaria-escolar','registrar-visita-institucional','{school}'),
 ('orientacao-pedagogica','consultar-matricula-e-movimentacao','{school,class}'),
 ('direcao-escolar','consultar-matricula-e-movimentacao','{school}'),('direcao-escolar','consultar-identidade-cadastral-do-estudante','{school}'),
 ('direcao-escolar','consultar-registro-de-visitas','{school}'),('direcao-escolar','consultar-registro-funcional','{school}'),
 ('direcao-escolar','consultar-indicador-agregado','{school}'),
 ('cadastro-institucional-da-rede','manter-cadastro-unidade-escolar','{network}'),('cadastro-institucional-da-rede','manter-catalogos-institucionais','{network}'),
 ('cadastro-institucional-da-rede','registrar-norma-homologada','{network}'),
 ('rh-profissionais-da-rede','manter-registro-funcional','{network}'),('rh-profissionais-da-rede','consultar-registro-funcional','{network}'),
 ('ciece-estatistica','consultar-indicador-agregado','{network}'),('ciece-estatistica','consultar-decomposicao-analitica','{network}'),
 ('ciece-estatistica','consultar-mapa-estatistico','{network}'),('ciece-estatistica','consultar-historico-mapa-estatistico','{network}'),
 ('ciece-estatistica','consultar-registro-de-visitas','{network}'),
 ('ciece-auditoria-coordenacao','consultar-indicador-agregado','{network}'),('ciece-auditoria-coordenacao','consultar-decomposicao-analitica','{network}'),
 ('ciece-auditoria-coordenacao','consultar-mapa-estatistico','{network}'),('ciece-auditoria-coordenacao','consultar-historico-mapa-estatistico','{network}'),
 ('ciece-auditoria-coordenacao','consultar-registro-de-visitas','{network}'),('ciece-auditoria-coordenacao','consultar-proveniencia-analitica','{network}'),
 ('ciece-auditoria-coordenacao','manter-regra-de-competencia-do-mapa','{network}'),('ciece-auditoria-coordenacao','manter-politica-de-divulgacao-analitica','{network}')
) AS t(k,c,d)
WHERE NOT EXISTS (SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id='b424c230-8ee8-4d5a-b5f0-afe9c981c565' AND r.engagement_kind_id=t.k AND r.capability_id=t.c);