# N2026 — Reconciliação Censo Escolar 2026 × base individualizada

## Situação atual (2026-10-09)
- Classe: **Registro de lote** (N2026.IMPORT.FINAL). Fonte oficial de totais: 55 recibos de fechamento Educacenso 2026 (emitidos 11/09/2026), gravados em `census_official_receipt_snapshots` (v1 cada, migration 0257).
- Em conflito, prevalecem os `AGENTS.md` e `docs/n2026-importacao-base-oficial.md`.

## Resultado por indicador (55 escolas)
| Indicador | Recibos | Base individualizada | Classe |
|---|---|---|---|
| Turmas | 698 | 698 | MATCH 55/55 |
| Alunos por escola | 9.811 | 9.811 matrículas escolares (9.763 pessoas; 48 em 2 escolas) | MATCH 55/55 |
| Matrículas (vínculos aluno-turma) | 10.295 | 10.295 | MATCH 55/55 |
| Curricular / AEE / AC | 9.762 / 351 / 182 | idem | MATCH 55/55 |
| EI / EF / EJA | por escola | idem | MATCH 55/55 |
| Docentes | 708 | 708 nominais em turma (1.057 profissionais no total) | MATCH |
| Educação especial | 1.122 | sem fonte nominal | NÃO COMPARÁVEL (ausência ≠ zero) |
| Transporte escolar | 1.738 | sem fonte nominal | NÃO COMPARÁVEL |

0 SOURCE_TIMING_DIFFERENCE, 0 MISSING_IN_NOMINAL, 0 MISSING_IN_CENSO, 0 AMBIGUOUS, 0 CONFLICT.

## Painel municipal
1 snapshot (`census_official_panel_snapshots`, atualizado 15/09). Inclui redes estadual e privada; é estatística de referência e nunca gerou entidade individual. Painéis por escola só conferidos visualmente.

## Divergências que permanecem reportadas (não corrigidas)
- Mapas Estatísticos × Censo nominal de docentes divergem em 28/38 escolas: o Mapa conta toda a equipe docente, o Censo só quem está em turma.
- Painel das Urbanas sem 3 escolas (INEP 33002045, 33002460, 33185689) — os recibos cobrem as 55.
- A reconciliação ainda não é exibida em Qualidade dos Dados/CIECE (CIECE_QUALIDADE_INTEGRACAO_PENDENTE).
