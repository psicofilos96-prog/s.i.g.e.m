# Reauditoria de validação — Lote corretivo 18 (2026-10-12)

Situação atual: Registro de lote. Reexecução da auditoria de `docs/sigem-relatorio-pendencias-2026-10-12.md` após os lotes corretivos 01–17. Não é fonte normativa nem homologação; nenhuma decisão foi tomada em nome de pessoa.

## 1. Evidência coletada nesta execução

| Verificação | Comando / fonte | Resultado |
|---|---|---|
| GitHub sync | API pública `repos/psicofilos96-prog/s.i.g.e.m/commits/main` | `main` remoto = HEAD local `141f6075` no início da auditoria → **sincronizado** |
| CI | API `actions/runs` | 3 últimos runs **falharam** (`141f6075`, `15b55e4d`, `54468e08`), passo `check:migrations`; causa: migrations 0502/0503 não congeladas com `SIGEM_REQUIRE_FROZEN=1`. Último verde: `cdf5ed6e` |
| Correção CI | `invariants:freeze-migrations` (só adiciona hashes, nenhum existente reescrito) | local `SIGEM_REQUIRE_FROZEN=1 check:migrations` → ok. **Run verde do novo SHA ainda não conferido** |
| Suíte rápida | `vitest run` | 987 arquivos, 7306 passaram, 7 pulados, 0 falhas, 216,8 s (< 5 min) |
| Typecheck | `tsgo --noEmit` | exit 0 |
| Invariantes + acessibilidade | `vitest run src/test/invariants src/components/a11y.test.tsx` | 29 arquivos / 150 testes ok (antes da correção abaixo) |
| Migrations | `drizzle/migrations` | 505 arquivos; todas congeladas; journal íntegro |
| SQL/RLS | linter do banco + consulta ao catálogo | 765 tabelas, 0 sem RLS; 183 com RLS e sem política (fechadas por padrão, acesso só por função); 1 view `admin_case_events_safe` com privilégio do criador; 1 função sem `search_path` (`ops_no_truncate`) → corrigida em 0504; 27 funções privilegiadas abertas a anônimo — todas de verificação pública de documento/portal/inscrição (intencionais por projeto) |
| E2E autenticado | `lote12-authenticated-e2e.mjs` (contas `@bo-fixture.invalid`, JWT real) | 29/29 PASS, 0 resíduos |
| Concorrência | `lote16-concurrency-e2e.mjs` | 2 PASS, 0 FAIL, 2 BLOQUEADO (sem regra de numeração aprovada; sem quadro de vagas) |
| Performance sem sessão | `perf-loading-gate-bench.py` em 12 rotas | **regressão achada**: `/matriculas/parametros`, `/tecnologia/cadastros`, `/tecnologia/decisoes` liam o banco antes da sessão (2–4 leituras recusadas). Corrigido no portão; remedição das 4 rotas: 0 leituras, 0 "Carregando" preso |
| Dados institucionais | consulta | 2 atuações, 8 políticas de capacidade, 0 espaços de acervo, 0 parâmetros de Tecnologia, 75 emissões de relatório |

## 2. Correções feitas neste lote

- `src/features/authority/session-read-gate.ts`: +5 rotas do console operacional (parâmetros de Matrículas, cadastros/decisões de Tecnologia, operação da Permanência e do Centro de Operações).
- `src/test/invariants/session-read-gate-console.test.ts` (novo): toda rota que monta o console operacional precisa estar no portão, porque a lista manual foi esquecida 3 vezes.
- `drizzle/migrations/0504_l18_ops_no_truncate_search_path.sql`: `search_path` fixo na única função apontada.
- `src/test/invariants/migration-hashes.json`: congeladas 0502, 0503, 0504.

## 3. Pendências atualizadas

Classes: **C** concluído com evidência · **P** parcial · **B** bloqueado · **V** aguarda decisão humana · **X** não verificável aqui.

| ID | Pendência | Classe | Evidência | Próximo passo | Critério |
|---|---|---|---|---|---|
| P0-01 | CI vermelho | P | causa achada e corrigida localmente | conferir run do novo SHA | run verde em `main` |
| P0-02 | 11 invariantes falhando | C | 0 falhas na suíte | — | — |
| P0-03 | suíte > 590 s | C | 216,8 s | — | — |
| P0-04 | `.env` | C | auditoria NSEC.ENV1 + teste no CI | — | — |
| P1-01 | PERF.LOADING.1 | C* | 12/12 rotas sem leitura nem spinner preso após correção; benchmark com sessão não executado | medir com sessão real | tempo com sessão registrado |
| P1-02 | capacidades sem titular | V | 262 no inventário; 2 atuações no banco | decisão institucional de quem recebe cada permissão | atribuição registrada por pessoa competente |
| P1-03 | caminhos positivos não testados (gravação) | B | E2E só prova recusas | depende de P1-02 e de dados reais | E2E positivo PASS |
| P1-04 | telas de leitura ausentes (Mediador 17, Desenvolvimento 19, Rede 37, Gestão de Pessoas 26, Secretaria 22 módulos) | P | `docs/data/sector-evidence-matrix.json` | telas de leitura por setor | módulo importado por tela + teste |
| P1-05 | exportações de Matrículas (22) e Tecnologia t01–t22 sem leitor de linhas | P | Lote 10 | ligar leitores ao motor | exportação emitida com registro |
| P1-06 | Acervo: nenhum espaço criado, sem antivírus | B/V | `acv_spaces` = 0 | decisão sobre espaços e verificação de arquivos | espaço criado por pessoa autorizada |
| P1-07 | teste no navegador com conta logada | X | sem sessão injetada nesta execução | rodar com sessão aprovada pelo usuário | capturas das telas novas |
| P2-01 | 7 decisões de Tecnologia sem valor | V | `tech_parameter_versions` = 0 | proposta + aprovação por pessoas distintas | versão aprovada vigente |
| P2-02 | 5 parâmetros de Matrículas | V | sem ato assinado | ato real + aprovação | versão aprovada |
| P2-03 | numeração e reservas sob concorrência | B | Lote 16 BLOQUEADO ×2 | regra de numeração e quadro de vagas aprovados | 2 BLOQUEADO → PASS |
| P2-04 | especificação de 49 seções/18 critérios de Tecnologia | B | documento ausente | o usuário enviar o documento | mapeamento `mapped: true` |
| P2-05 | conflito "ato verificável" (Lote 14) × regra "nunca exigir ato" | V | Lote 14 | decisão do proprietário | regra única registrada |
| P3-01 | módulos sem teste (Docente 35, Família 13) | P | matriz do Lote 17 | testes por módulo | 0 sem teste |
| P3-02 | view com privilégio do criador `admin_case_events_safe` | P | linter | confirmar que é projeção redigida intencional ou trocar por leitor INVOKER | linter sem ERROR |
| P3-03 | 183 tabelas com RLS sem política | X | linter (INFO) | confirmar que todas são só escritas/lidas por função | lista justificada |

## 4. Totais

| Severidade | C | P | B | V | X | Total |
|---|---|---|---|---|---|---|
| P0 | 3 | 1 | 0 | 0 | 0 | 4 |
| P1 | 1 | 2 | 2 | 1 | 1 | 7 |
| P2 | 0 | 0 | 2 | 3 | 0 | 5 |
| P3 | 0 | 2 | 0 | 0 | 1 | 3 |
| **Total** | 4 | 5 | 4 | 4 | 2 | 19 |

(P1-06 contado como B.)

## 5. Decisões humanas pendentes (não tomadas por este lote)

1. Quem recebe cada uma das 262 permissões (P1-02).
2. Valores das 7 decisões de Tecnologia e dos 5 parâmetros de Matrículas, com aprovação por pessoa diferente do autor.
3. Regra de numeração de documentos e quadro de vagas.
4. Criação dos espaços do Acervo e política de verificação de arquivos.
5. Exigir ou não ato assinado para os parâmetros de Matrículas (P2-05).

## 6. Ordem de dependência

P0-01 (conferir CI) → P1-02 (permissões) → P2-01/P2-02/P2-03 (valores aprovados) → P1-03 (E2E positivo) → P1-07 (navegador) → P1-04/P1-05 (telas e exportações) → P3.
