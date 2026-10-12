# Lotes corretivos 24–31 — reconciliação e homologação técnica (2026-10-12)

Situação atual: Registro de lote. Homologação **técnica** apenas; nenhuma aprovação institucional humana ocorreu ou foi registrada. SHA base `8026fe24`; dados lidos no banco às 20:52 UTC.

## Comandos executados nesta rodada

| Comando | Resultado |
|---|---|
| `bunx vitest run` | 992 arquivos, 7.337 passaram, 7 pulados, 0 falhas, 246 s |
| `scripts/lote12-authenticated-e2e.mjs` (harness BO) | 29/29 PASS, 0 resíduos |
| `scripts/lote16-concurrency-e2e.mjs` | 2 PASS, 0 FAIL, 2 BLOQUEADO |
| `scripts/lote20-development-e2e.mjs` | 19/19 PASS, 0 resíduos |
| `SIGEM_REQUIRE_FROZEN=1 scripts/check-migrations.mjs` | ok (após registrar 0507) |
| CI GitHub | `8026fe24`, `b5241a3f`, `ecd46f3b` success |
| Consultas de catálogo/contagem no banco | abaixo |

Não executado: lint isolado (coberto pelo CI), provas `supabase/tests/*.sql` (exigem papel privilegiado indisponível), navegador com conta logada (sem sessão), responsividade visual.

## L24 — Banco × migrations

- Arquivos drizzle 507 = journal 507; registro aplicado no banco 508 (uma entrada a mais, histórica; não há arquivo pendente). Após este lote: 508 arquivos.
- 765 tabelas, todas com RLS; 638 políticas; 1.564 funções; 0 FKs não validadas.
- **Corrigido (0507):** `authenticated` tinha INSERT/UPDATE/DELETE de tabela em `institutional_persons` e `institutional_engagements` sem política de escrita (bloqueado pela RLS, mas inconsistente com "escrita só por writer"). Revogado; nenhuma tela gravava direto (busca no código).
- Tabelas sensíveis conferidas sem SELECT para anon e sem INSERT para authenticated: autorizações de responsável, inclusão (pedagógico/clínico/mediação), NEI, regências, frequência, inscrições, identificadores de pessoa.

## L25 — Censo Escolar 2026

| Entidade | Esperado (recibo oficial) | Encontrado | Validado | Divergente |
|---|---|---|---|---|
| Escolas | 55 recibos | 55 | 55 INEP iguais ao recibo, 55 distintos | 0 |
| Turmas | 698 | 698 | por escola | 0 escolas |
| Alunos (por escola) | 9.811 | 9.811 | por escola | 0 escolas |
| Matrículas | 10.295 | 10.295 enturmações | — | 0 |
| Estudantes distintos na rede | — | 9.763 (sem pessoa duplicada) | — | — |
| Profissionais / vínculos | recibo traz contagens | 2 atuações | — | pendente: relação de servidores não importada |
| Jornadas / grade | — | 0 versões de grade | — | pendente de fonte |
| Infraestrutura | — | não reconciliada nesta rodada | — | pendente |

A afirmação de 55 escolas está confirmada. Visibilidade por perfil não verificada no navegador.

## L26 — Matrículas e vagas

Writers, protocolo, busca por nome, bloqueio de publicação e concorrência existem (L14, L21, L16). No banco: 0 campanhas, 0 inscrições, 0 quadros de vagas. Recusas provadas por E2E; caminho positivo **BLOQUEADO** por falta de campanha, quadro de vagas, regra de prazo e titulares. Parâmetros normativos pendentes: os 5 de L14.

## L27 — Gestão de Pessoas

10.822 pessoas; só 2 atuações; 0 grades; 0 matrizes. Verificações de sobreposição/carga existem nos módulos `staffing/` e `offer-organization/` (testes no CI), mas **sem dados** para produzir relatório real de lotação ou necessidade docente. Bloqueio: importar servidores e vínculos com fonte.

## L28 — Docente e Mediador

0 regências vigentes cadastradas, 0 mediações, 0 frequências. Regras por lote estão testadas (CI verde); nenhuma conta docente ou mediadora real tem vínculo, logo nenhum fluxo positivo pode ser exercitado. Recusa a acesso indevido: RLS sem leitura anônima nas tabelas conferidas.

## L29 — NEI/AEE e Família

0 papéis NEI, 0 autorizações de responsável. Matriz de segurança: anon sem leitura em todas as tabelas sensíveis; escrita só por writer DEFINER; negação uniforme na família (testes). Revogação/histórico só provados em teste unitário; caminho positivo **BLOQUEADO** (sem vínculo familiar real; nenhum foi inventado).

## L30 — Relatórios e indicadores

75 emissões auditadas registradas. Totais conferidos com origem: turmas/alunos/matrículas do Censo batem com o banco (L25). Indicadores de frequência, profissionais, aulas ofertadas e necessidade docente dão "não disponível" porque as fontes estão vazias — correto, nunca zero. 22 relatórios de Matrículas e t01–t22 de Tecnologia seguem só catálogo (P1-07).

## L31 — Homologação técnica

**Pronto tecnicamente:** integridade de migrations, RLS em 100% das tabelas, suíte 0 falhas, E2E de isolamento, reconciliação Censo 2026 (escolas/turmas/alunos/matrículas).

**Pendências remanescentes**

| P | Item | Causa | Responsável | Próxima ação |
|---|---|---|---|---|
| P1 | Titulares das 262 capacidades | decisão institucional | Administração da rede | atribuir em `/central-de-acessos` |
| P1 | Servidores/vínculos/grade | fonte não importada | DP + técnico | importar relação de servidores por staging |
| P1 | Caminhos positivos (matrícula, docente, mediador, NEI, família) | depende das duas linhas acima | técnico | repetir E2E |
| P1 | Navegador com conta logada | sem sessão nesta sessão | técnico | Playwright com sessão |
| P2 | Parâmetros de Matrículas, decisões de Tecnologia, numeração, quadro de vagas | norma ausente | autoridades | propor e aprovar por outra pessoa |
| P2 | Infraestrutura do Censo | não reconciliada | técnico | confrontar com recibo |
| P3 | Módulos sem teste/tela; provas SQL privilegiadas | volume / papel | técnico | rodar com papel adequado |

Riscos: o sistema não opera de verdade enquanto houver só 2 atuações. Telas demonstrativas não foram aceitas como conclusão.
