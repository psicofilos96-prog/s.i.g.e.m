# Matriz fluxo → teste de regressão

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Método: para cada fluxo crítico, procurei teste que exercite a regra (motor puro, adaptador de gravação/leitura, prova SQL ou invariante). Depois listei todo módulo `.ts` das áreas prioritárias sem nenhum teste que o importe. Só preenchi lacunas com regra real: writer canônico, cabeça esperada, erro de leitura ≠ vazio. Não testei texto nem visual.

| Fluxo | Regras protegidas | Testes |
|---|---|---|
| Matrícula guiada | rascunho append-only, cabeça esperada, conclusão única | `school-secretariat/enrollment-wizard*.test.ts`, `supabase/tests/n5_2_1_enrollment_wizard.sql` |
| Enturmação/remanejamento/saída | writer único, término na véspera | `school-secretariat/secretariat*.test.ts`, `supabase/tests/af_secretariat_e2e.sql`, `n5_4_*.sql` |
| Vagas e Livro | reader canônico, erro ≠ "sem vagas", INEP curado | `vacancies-book.test.ts`, **`src/test/flows/critical-source-contracts.test.ts` (novo)** |
| Nova turma | writer transacional, composição com cabeça esperada | `classes/class-wizard-model.test.ts`, **`critical-source-contracts.test.ts` (novo)** |
| Turma: histórico, oferta/turno, atribuição | bitemporal, stale-head | `classes/*.test.ts` (11), `b2_5_2_*.sql`, `n5_3_2_*.sql` |
| Mapa Estatístico | regra única, digest, devolução/ajuste, segregação | `statistical-map/*.test.ts` (7), `t1_*.sql`, `n4_3_*.sql` |
| Calendário | efeito do dia, composição, homologação, modelos externos | `calendar/*.test.ts` (46), `b4_6_*.sql` |
| Documentos escolares | fatos do banco, idempotência de emissão | `school-documents/document-engine.test.ts`, `idempotencia` (NIDEM.1), `n5_4_*.sql` |
| Avaliação | resultados, fechamento, situação acadêmica | `assessment/*.test.ts` (52), `aa2_assessment_e2e.sql` |
| Diário | chamada, retificação, sessão, referência temporal | `diary/*.test.ts` (26), `w2_diary_e2e.sql` |
| Acessos | capacidade efetiva, sessão, rascunho/homologação de política | `authority/*.test.ts`, `institutional-admin/*.test.ts`, `concurrency-nconc1.test.ts` |
| Importações | staging por hash, matching, exceções, compensação | `data-import/*.test.ts`, `import-kernel.test.ts`, **`critical-source-contracts.test.ts` (novo)** |
| Concorrência transversal | trava antes da cabeça, ordem de travas | `src/test/invariants/concurrency-nconc1.test.ts` |

## Lacunas fechadas nesta rodada (9 testes)
- **Nova turma:** só `secretariat_create_class_with_journey`; recusa chega à tela; a composição repassa `_expected_head`.
- **Vagas/Livro:** readers e argumentos corretos; erro de leitura não vira "sem vagas"; INEP só do identificador curado.
- **Importações:** staging envia o hash e respeita `already_staged`; falha de leitura do cadastro não vira "tudo novo"; matching usa a versão cadastral mais recente.

## Sem teste, deliberadamente
- `classes/class-draft.ts`: rascunho do laboratório (demonstração), sem efeito institucional.
- `classes/institutional-class-contract.ts`: só tipos e constantes.
- `diary/attendance-formula-fixtures.ts`, `diary-journey-hooks.ts`: fixtures e ganchos sem regra.

## Pendências
- **PENDENTE:** as provas SQL `supabase/tests/*.sql` não rodam na suíte local. Precisam de acesso privilegiado ao banco; hoje são executadas à parte.
- **INTERACTIVE_BROWSER_VALIDATION_PENDING:** os fluxos ponta a ponta com login real não são automatizados.
