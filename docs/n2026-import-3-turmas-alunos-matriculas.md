# N2026.IMPORT.3 — Turmas, alunos, matrículas e enturmação 2026

## Situação atual (2026-10-09)
- Classe: **Registro de lote**. Nenhuma escrita no banco; conferência contra os 55 recibos de fechamento Educacenso 2026.
- Em conflito, prevalecem os `AGENTS.md` e `docs/n2026-importacao-base-oficial.md`.

## Fontes
| Fonte | SHA-256 (12) | Uso |
|---|---|---|
| Todas_as_turmas (≡ Consolidado Turmas) | 43b79beb6a33 | Primária; carregada em 05/10 |
| Todos_os_alunos (≡ Consolidado Alunos) | 11cdd65a8c6e | Primária; carregada em 05/10 |
| Matriz_Escolas_Itaperuna_Censo2026 | fd2e288bf598 | Só escola; não traz turma/aluno |
| Relatórios Urbanas / Fechamento Rurais / Conveniadas (PDF) | — | Recibos oficiais por escola (55 lidos) |
Nenhuma coluna comparativa de 2025 foi usada.

## Reconciliação por escola (recibo × banco)
| Medida | MATCH | Outras |
|---|---|---|
| Turmas | 55 | 0 |
| Alunos (pessoas por escola, incluindo só-AEE) | 55 | 0 |
| Matrículas totais | 55 | 0 |
| Curricular (EI+EF+EJA) | 55 | 0 |
| AEE + atividade complementar | 55 | 0 |
| Educação infantil / Fundamental / EJA | 55 / 55 / 55 | 0 |
Classificações SOURCE_TIMING_DIFFERENCE, MISSING_IN_NOMINAL, MISSING_IN_CENSO, AMBIGUOUS e CONFLICT: **0**.
Educação especial e transporte: o recibo traz "alunos com deficiência", mas a fonte nominal carregada não os declara; não comparado (ausência ≠ zero). Transporte: nenhuma fonte.

Rede: soma dos recibos = 9.811 alunos por escola; 9.763 pessoas distintas → 48 alunos em duas escolas, preservados como duas matrículas escolares (nunca fundidos).

## Provas no banco
- 698 turmas, todas na escola do recibo; 0 vínculo aluno-turma apontando turma de outra escola.
- 9.763 alunos, 0 INEP duplicado, 0 aluno sem pessoa; 9.811 matrículas escolares, 0 duplicada por aluno+escola.
- 10.295 vínculos aluno-turma (9.762 curriculares + 533 AEE/AC classificados "Não se aplica" — não geram matrícula curricular extra), 0 duplicados.
- Etapa individual vem do registro do aluno (`stage_literal`), nunca do nome da turma; 836 vínculos multietapa preservam a etapa declarada.
- Idempotência: 7 operações técnicas únicas por (tipo, hash); reexecução devolve a mesma.
- Fixtures: 0 contas de fixture; todo vínculo tem operação técnica.

## O que NÃO foi feito e por quê
- **Enturmação canônica (`class_enrollment_episodes`) = 0; participações = 0; turno e composição de turma = 0.** Os vínculos existem só como observação de fonte. Não há writer governado para enturmação de ano histórico: `secretariat_allocate_to_class` exige pessoa/principal e ano aberto, e 2026 está `historico-importado`. Criar um caminho próprio é decisão de arquitetura.
- Consequência: Diário, Mapa e Livro, que leem a enturmação canônica, mostram 2026 **sem alunos em turma**; a busca exata e a matrícula escolar por escola funcionam.
- Início dos vínculos (`valid_from`) vazio: a fonte é fotografia de 31/07, não declara data de ingresso.

## Pendências
- ENTURMACAO_HISTORICA_WRITER_AUSENTE — operação técnica para converter os 10.295 vínculos em enturmação/participação 2026 (fotografia 31/07, sem data de ingresso inventada).
- TURNO_COMPOSICAO_NAO_PROJETADOS — dependem da mesma decisão.
- EDUCACAO_ESPECIAL_NOMINAL_AUSENTE · TRANSPORTE_FONTE_AUSENTE.
