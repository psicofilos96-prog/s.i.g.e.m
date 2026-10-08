# NSEC.3 — Reavaliação das leituras amplas por contas autenticadas (2026-10-08)

## Situação atual
Classe: Registro de lote. Complementa `security-definer-function-inventory.md` (NSEC.2).

## Resultado
- Varredura completa antes: 26 achados (20 erro, 6 info), todos `RLS_EXPOSURE` de leitura autenticada sem filtro; nenhum dá acesso a `anon`.
- Varredura depois: 25 achados (21 erro, 4 info). Saiu `temporal_stand_in_neutralizations`. `map_competence_rules` e `movement_type_definitions` foram reclassificadas pelo scanner de info para erro, sem mudança de política.
- Linter: 140 tabelas com RLS e sem política (fechadas, só writers DEFINER/leitores), 4 funções DEFINER executáveis por anon e 431 por autenticados — todas já inventariadas no NSEC.2.

## Tabela de substituições temporárias (estreitada)
`temporal_stand_in_neutralizations` (10.568 linhas: marca campos de turmas, anos e declarações censitárias de 2026 como "não sustentado pela fonte") era legível em bloco, com motivo e ID de operação técnica.
- Migration `0247_nsec3_stand_in_neutralization_read_narrowing`: política `leitura autenticada` removida e `SELECT` revogado de `authenticated`.
- O único consumidor é `temporal_field_unknown(tabela, id, campo)`, chamado por `class_at`, `calendar_year_state_at` e `b41_year_active_throughout`. Ela passou a SECURITY DEFINER com `search_path = ''` e devolve só um booleano para a chave exata. Sem EXECUTE para PUBLIC/anon.
- Nenhum código de tela lê a tabela (só aparece em `types.ts`). Os leitores continuam vendo "data desconhecida" como antes.

## Classificação das demais (mantidas, com justificativa)
| Tabela | Classe | Por que a leitura ampla é necessária |
|---|---|---|
| attribute_value_definitions, movement_type_definitions, workflow_definitions | Catálogo normativo | Opções homologadas consumidas por todas as estações; sem dado pessoal |
| class_designation_policy_versions / _homologations | Norma versionada | Prévia de designação e writer leem a política vigente |
| curricular_reference_* (editions, items, item_bindings, glossary, keyword, relations, simplifications, homologations, correspondence_assessments), curriculum_objectives | Referência curricular | BNCC/referencial da rede, lida por Docente, Avaliação, Matrizes |
| map_competence_rules | Norma do Mapa | Escolas e OP precisam saber a regra aplicável |
| academic_year_operational_states | Estado do ano | Toda tela decide escrita pelo estado do ano |
| sigem_installation_state / _acts | Estado da instalação | Telas exibem o bloqueio de instalação; não contém senha nem pessoa |
| institutional_schools, _school_identifiers, _school_record_versions, _school_links | Cadastro de escolas | Identidade pública das unidades (nome, INEP, vínculos), usada em seletores de toda a rede |
| school_infrastructure_attribute_versions / _observations | Fato da escola | Infraestrutura física declarada; sem dado de pessoa — REVISAR se a rede quiser restringir por escola (DEPENDE_DECISAO) |

## Verificação
- Banco: `authenticated` sem SELECT na tabela, 0 políticas; função DEFINER com EXECUTE só para autenticados.
- Suíte: 429 arquivos / 4.414 testes; um teste de horários (`schedule-session.test.tsx`, por tempo) falha de forma intermitente, sem relação com o banco (passa ao repetir) — REVISAR.
- Login com contas sintéticas pelo harness: INTERACTIVE_BROWSER_VALIDATION_PENDING (a sandbox não pode assumir o papel autenticado nem gerar sessão para o usuário requisitante).
