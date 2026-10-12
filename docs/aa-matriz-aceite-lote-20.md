# Acompanhamento e Avaliação — Matriz de aceite técnico (Lote 20)

**Situação atual:** Registro de lote (2026-10-12). Não é homologação institucional humana.

Status: **Tela** = existe tela ligada ao backend; **Núcleo** = regra pura testada sem tela/persistência própria; **Bloqueado** = depende de decisão/dado externo. Telas são abas de `/acompanhamento-avaliacao`.

| # | Seção | Tela | Fonte | Teste | Status |
|---|---|---|---|---|---|
| 1 | Finalidade | — | — | — | Texto descritivo |
| 2 | Objetivos estratégicos | — | — | — | Coberto pelas seções 6–28 |
| 3 | Princípios | — | regras `AGENTS.md` | `normative-configurability.test.ts` | Núcleo |
| 4 | Estrutura organizacional | — | `aa-architecture.ts` (perfis propostos) | `aa-architecture.test.ts` | Bloqueado: política de capacidades não homologada |
| 5 | Arquitetura | abas do Estúdio | `aa-architecture.ts` | `aa-architecture.test.ts` | Núcleo |
| 6 | Painel geral | Hoje, Visão Geral | `aa_intervention_*`, `aa_import_batches`, `ext_result_versions`; `aa-dashboard.ts` | `aa-daily-operation.test.ts`, `aa-dashboard.test.ts` | Tela parcial |
| 7 | Panorama | Painéis | `aa-dashboard.ts` | `aa-dashboard.test.ts` | Núcleo |
| 8 | Planejamento | Calendário | `aa_calendar_items`; `aa-assessment-plan.ts` | `aa-assessment-plan.test.ts` | Tela parcial |
| 9 | Banco de itens | — | `assessment_item_versions/keys`; `aa-item-bank.ts` | `aa-item-bank.test.ts` | Núcleo (editor do professor existe em /avaliacoes-do-professor) |
| 10 | Matrizes | Matrizes e Regras | `aa_calc_rule_versions`; `aa-skill-mapping.ts` | `aa-skill-mapping.test.ts` | Tela parcial |
| 11 | Criação de avaliações | Diagnóstica/Formativa | `lc_instrument_versions`; `aa-assessment-plan.ts` | `aa-assessment-plan.test.ts` | Tela parcial |
| 12 | Aplicação | — | `aa-application.ts` | `aa-application.test.ts`, `aa-acceptance-l20.test.ts` | Núcleo |
| 13 | Correção/resultados | Diagnóstica/Saber Ler | `lc_record_entry`, `sl_record_entry`; `aa-correction.ts`, `aa-omr-import.ts` | `aa-correction.test.ts`, `aa-omr-import.test.ts` | Tela parcial; OMR sem amostras reais |
| 14 | Diagnóstico | Habilidades | `aa-skill-diagnosis.ts` | `aa-skill-diagnosis.test.ts` | Núcleo; faixas sem regra homologada |
| 15 | Individual | Alunos (aviso) | `student_trajectory_at`; `aa-student-record.ts` | `aa-student-record.test.ts` | Núcleo |
| 16–17 | Turmas/Escolas | Escolas e Turmas (aviso) | `aa-unit-panels.ts`, `aa-learning-map.ts` | `aa-unit-panels.test.ts`, `aa-learning-map.test.ts`, `aa-acceptance-l20.test.ts` | Núcleo; limiar de supressão ausente |
| 18 | Intervenções | Intervenções | `aa_record_intervention*`; `aa-intervention-flow.ts` | `aa-intervention-flow.test.ts` | Tela |
| 19 | Monitoramento | Intervenções, Hoje | `aa-monitoring.ts` | `aa-monitoring.test.ts` | Tela parcial |
| 20 | Reavaliações | Intervenções (evento reavaliação) | `aa_intervention_events` | `aa-monitoring.test.ts` | Tela parcial |
| 21 | Externas | Avaliações externas, Importação | `ext_record_result`, `aa_import_batches`; `aa-external-import.ts` | `aa-external-import.test.ts` | Tela; sem arquivos oficiais |
| 22 | BNCC/SAEB | Habilidades | repositório curricular; `aa-skill-mapping.ts` | `aa-skill-mapping.test.ts` | Bloqueado: relações homologadas ausentes |
| 23 | Indicadores | Painéis | `aa-indicator-library.ts` | `aa-indicator-library.test.ts` | Núcleo |
| 24 | Séries | Evolução Histórica (aviso) | `external-results.ts` | `aa-indicator-library.test.ts` | Núcleo |
| 25 | Painéis | Painéis | `intelligence_dashboards_visible` | testes do estúdio | Tela |
| 26 | Relatórios | Relatórios | gerador universal; `aa-reports-ged.ts` | `aa-reports-ged.test.ts` | Tela (gerador); PDF não testado E2E |
| 27 | Agenda | Calendário | `aa_calendar_*`; `aa-security-integration.ts` | `aa-security-integration.test.ts` | Tela |
| 28 | Documentos | — | `aa-reports-ged.ts` | `aa-reports-ged.test.ts` | Núcleo; retenção sem decisão |
| 29 | Perfis/permissões | — | `aa-security-integration.ts` | `aa-security-integration.test.ts`, `aa-acceptance-l20.test.ts` | Bloqueado: capacidades não atribuídas |
| 30 | Integração | — | `INTEGRATIONS` (só leitura) | `aa-security-integration.test.ts` | Núcleo |
| 31 | Integridade | Qualidade dos Dados | writers append-only | `supabase/tests/aa2_assessment_e2e.sql` | Não executado nesta sessão |
| 32 | Segurança/auditoria | — | `auditEvent`, RLS | `aa-security-integration.test.ts` | RLS real não provada |
| 33 | Interface | todas | `aa-daily-panel.tsx` | `src/components/a11y.test.tsx` | Tela parcial |
| 34 | Plano de implementação | — | Lotes 01–20 | — | Registro |
| 35 | Critérios de aceitação | — | esta matriz | 38 arquivos / 204 testes | Parcial |
| 36 | Resultado esperado | — | — | — | Depende de homologação humana |

## Execução (2026-10-12)
- `vitest src/features/educational-intelligence`: 38 arquivos, 204 testes, todos passando; typecheck sem erros.
- Falha corrigida: `canOpen` do Mapa de Aprendizagem permitia abrir nível "escola" de escola fora do alcance (dados eram filtrados, mas a permissão afirmava acesso).
- SHA de referência anterior às mudanças: `5823268e`.

## Bloqueios reais
- E2E autenticado: harness ausente (`SIGEM_TEST_HARNESS` não definido; sessão `signed_out`); `scripts/aa-acceptance-e2e.ts` não executado.
- SQL `aa2_assessment_e2e.sql`: o papel de leitura da sessão não pode executar funções; precisa ser rodado no CI.
- PDF real, OMR com digitalizações reais, capacidades atribuídas, limiares de supressão e relações BNCC/SAEB homologadas.
