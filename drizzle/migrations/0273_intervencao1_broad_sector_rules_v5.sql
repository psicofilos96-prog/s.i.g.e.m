-- INTERVENÇÃO 1/6 — regras de estação v5: permissões amplas por função e escopo.
-- Mantém v4 inteira; acrescenta, por setor, as capacidades das próprias atribuições.
-- Preservados fora dos setores: homologar/registrar política de capacidades, auditoria
-- transversal, reabertura pós-fechamento, atos do professor (aula, frequência, pauta).
INSERT INTO public.sector_station_rule_versions(rules_version, status, valid_from, decision_ref)
VALUES (5, 'homologated', DATE '2026-10-09', 'decisao-gestor-intervencao-1-2026-10-09');
INSERT INTO public.sector_station_rules(rules_version, station_code, capability_id, decision_ref)
SELECT 5, r.station_code, r.capability_id, 'decisao-gestor-intervencao-1-2026-10-09'
  FROM public.sector_station_rules r WHERE r.rules_version = 4 AND r.station_code <> 'administracao_geral'
UNION SELECT 5, v.s, v.c, 'decisao-gestor-intervencao-1-2026-10-09' FROM (VALUES
  ('supervisao','publicar-conteudo-publico'),('supervisao','manter-catalogos-institucionais'),
  ('supervisao','manter-componentes-curriculares'),('supervisao','manter-matrizes-curriculares'),
  ('supervisao','homologar-matrizes-curriculares'),('supervisao','manter-mapeamentos-curriculares'),
  ('supervisao','manter-cadastro-unidade-escolar'),('supervisao','preparar-ano-letivo'),
  ('supervisao','manter-modelo-de-documento-escolar'),('supervisao','manter-comunicacao-institucional'),
  ('supervisao','consultar-matricula-e-movimentacao'),('supervisao','consultar-organizacao-da-oferta'),
  ('supervisao','consultar-indicador-agregado'),('supervisao','consultar-acompanhamento-pedagogico'),
  ('supervisao','revisar-qualidade-dos-dados'),('supervisao','gerir-tarefas-operacionais'),
  ('avaliacao','construir-referencia-curricular'),('avaliacao','consultar-acompanhamento-pedagogico'),
  ('avaliacao','gerir-tarefas-operacionais'),
  ('ciece','cadastrar-estudante-na-rede'),('ciece','manter-cadastro-unidade-escolar'),
  ('ciece','gerir-tarefas-operacionais'),
  ('alimentacao','consultar-identidade-cadastral-do-estudante'),('alimentacao','gerir-tarefas-operacionais'),
  ('direcao_escolar','publicar-comunicacao-escolar'),('direcao_escolar','emitir-notificacao'),
  ('direcao_escolar','consultar-supervisao-da-propria-escola'),('direcao_escolar','consultar-documento-escolar'),
  ('direcao_escolar','emitir-documento-escolar'),('direcao_escolar','emitir-carteirinha-estudantil'),
  ('direcao_escolar','manter-autorizacao-de-responsavel'),('direcao_escolar','consultar-acompanhamento-pedagogico'),
  ('direcao_escolar','manter-transporte-escolar'),
  ('secretaria_escolar','emitir-carteirinha-estudantil'),('secretaria_escolar','manter-autorizacao-de-responsavel'),
  ('secretaria_escolar','manter-transporte-escolar'),('secretaria_escolar','publicar-comunicacao-escolar'),
  ('secretaria_escolar','emitir-notificacao'),('secretaria_escolar','revisar-qualidade-dos-dados'),
  ('orientacao_pedagogica','registrar-acompanhamento-pedagogico'),('orientacao_pedagogica','consultar-acompanhamento-pedagogico'),
  ('orientacao_pedagogica','revisar-trabalho-docente'),('orientacao_pedagogica','consultar-supervisao-da-propria-escola'),
  ('orientacao_pedagogica','emitir-notificacao'),('orientacao_pedagogica','consultar-identidade-cadastral-do-estudante'),
  ('inclusao_nei','consultar-estudantes-da-turma'),('inclusao_nei','consultar-identidade-cadastral-do-estudante'),
  ('inclusao_nei','consultar-matricula-e-movimentacao'),('inclusao_nei','consultar-acompanhamento-pedagogico'),
  ('inclusao_nei','gerir-tarefas-operacionais')) v(s,c)
UNION SELECT 5, 'administracao_geral', k.capability_id, 'decisao-gestor-intervencao-1-2026-10-09' FROM public.sigem_capability_catalog k;