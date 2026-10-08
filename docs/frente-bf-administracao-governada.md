# Frente BF — administração governada, matriz de acesso e escalada de privilégio

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


## Entregue
- `/estacao-administrativa`: "Por que pode / por que não pode" (`access-explainer.ts`): regra, escopo, atuação, vigência e motivo (sem política, sem regra, sem atuação, fora da vigência, escopo insuficiente). Só explica; o banco revalida no ato.
- Linha do tempo administrativa pesquisável: reutiliza os adaptadores da Auditoria (contas e políticas), sem fonte paralela nem PII.
- Defeito técnico corrigido: a estação filtrava `status = 'homologada'`, mas o banco grava `homologated`; a matriz sempre mostrava "ninguém". Agora usa `effectiveVersion`.

## GOVERNANCE_REVIEW_PENDING
- Política vigente v8: 271 regras; `administrador-geral-do-sigem` recebe 110, inclusive `registrar-politica-de-capacidades`, `homologar-politica-de-capacidades`, `manter-atuacoes-institucionais`, `manter-contas-institucionais` e diversas homologações normativas.
- Impacto: uma conta pode redigir e homologar a norma que a autoriza; não há segregação. Decisão institucional; nada alterado.

## SECURITY_GOVERNANCE_REVIEW_PENDING — tabelas legíveis por qualquer autenticado (política `true`)
| Grupo | Tabelas | PII/sensível |
|---|---|---|
| Estado de ano | academic_year_operational_states | não (ids de registro) |
| Catálogos/normas | attribute_value_definitions, movement_type_definitions, map_competence_rules, workflow_definitions, class_designation_policy_versions/_homologations, temporal_stand_in_neutralizations | não |
| Referência curricular | curricular_reference_* (9), curriculum_objectives | não |
| Cadastro escolar | institutional_schools, _school_identifiers, _school_record_versions, _school_links, school_infrastructure_* | contato institucional da unidade (não pessoal) |
| Instalação | sigem_installation_state, sigem_installation_acts | ids técnicos de executor/pessoa/atuação (não nome/e-mail) |
Nenhuma é exposição técnica inequívoca; restringir é decisão institucional.

## DEFINER executáveis por authenticated
- 315 (mesma contagem). EXECUTE não é autorização: E2E desta frente mostrou toda escrita administrativa recusada com `capability:` sem atuação, e com capability de escola sintética a função de rede recusa ampliação.

## E2E sintético (rollback, zero resíduos) — `supabase/tests/bf_admin_privilege_e2e.sql`
permitido (própria escola), outra escola, vigência (amanhã), self-grant, scope widening, stale head, homologação, DML direto, service_role, anon: todos conforme o esperado. Não coberto aqui: revogação por `end_engagement` real e conta de órgão sem pessoa natural (coberta em b4_6_7g_institutional_actor_nature.sql, não reexecutado).

REAL_ROLE_ASSIGNMENT_PENDING · GOVERNANCE_REVIEW_PENDING · SECURITY_GOVERNANCE_REVIEW_PENDING · HUMAN_ROLE_VALIDATION_PENDING
