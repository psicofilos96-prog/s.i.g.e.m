# Direção Escolar — produto final (NDIRECAO.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — SCHOOL_DIRECTION_FULLY_OPERATIONAL.

## Estado do banco (conferido)
institutional_engagements 2 (nenhuma Direção registrada; GESTORES_MATRIZ_DECISAO_PENDENTE) · collegial_session_events 0 · cycle_closing_versions 0 · school_pedagogical_records 0 · institutional_visit_records 0. Enturmações 2026 = 10.295 (convertidas em 2026-10-09).

## Itens × situação
| Item | Existente | Bloqueio |
|---|---|---|
| Home "o que depende da sua decisão" | `school-followup` + DecisionDesk (13I) | sem atuação de Direção ⇒ nada autorizado |
| Providências por turma | DecisionDesk | idem |
| Dossiê + PDF | `dossierPrintHtml` (N7.2.4) | adendos/documentos privados sem writer próprio (DOSSIER_ADDENDA_PENDING) |
| Fiscalização do Diário | `diary-oversight` (somente leitura) | sem grade publicada ⇒ nada previsto |
| Conselho / presença | módulo colegiado | 0 sessões; Conselho sem período da sessão (pendência BQ.5) |
| Aprovação do Diário após Conselho | `approve_teacher_diary` | regra BQ.5 gravada sem rascunho/homologação (pendência BQ.5) |
| Fechamento OP + Direção | `record_period_closing_act` | idem |
| Alimentação da escola | bloco de leitura no painel | capabilities não atribuídas; atalhos ausentes (DIRECAO_MEAL_ACTIONS_PENDING) |
| Relatórios | pacotes Direção: panorama de turmas, execução da alimentação | pendências/prazos/diários/movimentações bloqueados |
| Histórico de decisões | projeção da cadeia 13I | sem decisões |

## Regras preservadas (BQ.5)
Direção não altera o Diário; participa e registra presença no Conselho; aprova após o Conselho; fechamento só com OP + Direção; Direção não reabre.

## Decisões necessárias
1. Gestores da Matriz → atuações de Direção registradas (quem dirige cada escola).
2. Homologar a regra BQ.5 pelo fluxo rascunho → homologação.
3. Testes autenticados em 2 escolas — ambiente sem login.
