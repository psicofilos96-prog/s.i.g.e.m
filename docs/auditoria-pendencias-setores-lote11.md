# Auditoria de pendências por setor — A&A Lote 11 (2026-10-11)

Situação atual: Registro de lote (2026-10-11). Fotografia do HEAD; não substitui os AGENTS.md por diretório.

## Método (evidência real, não declaração)
- Suíte completa executada: `bunx vitest run` — antes: **9 falhas / 5.457 aprovados** (610 arquivos); depois das correções: arquivos afetados 70/70, 409 testes aprovados.
- Typecheck `tsgo --noEmit`: limpo. Build do preview: OK.
- Permissões consultadas no banco (políticas homologadas, `capability_policy_rules` × `capability_policies.status='homologated'`): 6 políticas homologadas, 1.430 regras; 2 rascunhos (229 regras, sem efeito).
- Migrations no repositório: 372 arquivos em `drizzle/migrations` (aplicação afirmada pelo CI, não pela tela).
- E2E: scripts em `scripts/*-e2e.mjs` exigem `SIGEM_TEST_HARNESS=1` + `SIGEM_HARNESS_ACK`; **não executados neste lote**.

## Defeitos corrigidos neste lote (maior impacto transversal)
| Defeito | Telas | Correção |
|---|---|---|
| Campo de data nativo (formato do navegador, não DD/MM/AAAA) | 18 telas: DocServ, Educacenso, A&A, carteirinha, NEI, Tabelas SEMED, livro de vagas | `DateInput` compartilhado |
| "Hoje" calculado em UTC (após 21h de Brasília virava o dia seguinte; prazos e "vencido" errados) | intervenções, calendário A&A, DocServ, AEE, ficha NEI, livro de vagas | `operationalToday()` |
| `window.confirm/prompt` cru (sem consequência, sem correlação) | saúde declarada (Família), revogação NEI, anexos SEMED | `confirmAction`/`askText` |
| "Carregando" solto, sem estado padronizado | DocServ (5), Educacenso (3) | `LoadingState` |
| Cabeçalho de tabela sem `scope` (leitor de tela) | DocServ rede/escola, A&A programas/habilidades/intervenções | `scope="col"` |
| Testes desatualizados: seção `saude` hoje é válida; carteirinha pública não expõe nome; 67 pacotes de relatório | — | testes ajustados ao comportamento vigente |

## Checklist por setor
Legenda: OK = evidência no HEAD · PARCIAL · BLOQ = depende de decisão/dado externo.

| Setor | Rota | Backend/RLS | Dado real × demonstração | Permissão homologada | E2E (script) | PDF/XLSX | Bloqueios |
|---|---|---|---|---|---|---|---|
| Secretaria | `/secretaria`, `/matriculas`, `/carteirinhas` | OK (writers DEFINER) | real com sessão | parcial; `emitir-carteirinha-estudantil` **não** | `secretaria-docs-e2e`, `student-card-e2e`, `semed-tables-e2e` | OK | etapa nas turmas, datas de matrícula |
| CIECE | `/ciece` | OK | real | sim | `integration-acceptance-e2e` | OK | conciliação de servidores |
| Direção | `/direcao`, `/gestao-escolar` | OK (projeção, sem DEFINER próprio) | real | parcial | `sector-boards-e2e` | dossiê PDF | intervenções A&A não exibidas |
| Docente / Diário | `/diario/*` | OK | real com sessão | sim | `lote12-diary-positive-e2e`, `diary-book-e2e`, `lote7-final-sheet-e2e` | OK | — |
| Mediador / NEI | `/inclusao/nei/*` | OK | real | via `nei_role_grants` | `nei-homologation-e2e` | parcial | papéis NEI a conceder |
| Família | `/familia` | OK | real | `manter-autorizacao-de-responsavel` **não** | `student-card-e2e` (parcial) | — | sem concessão, nenhuma família vincula |
| Supervisão | `/supervisao-escolar` | OK | real | `registrar-acompanhamento-da-supervisao` **não** | — | relatório | decisão institucional |
| Alimentação | `/alimentacao-escolar` | OK | real | `consultar-alimentacao-escolar` **não** | `lote14-meals-e2e`, `lote16-meals-flow-e2e` | OK | concessão |
| Acompanhamento e Avaliação | `/acompanhamento-avaliacao` | OK (0367, 0369, 0370) | calendário 166 ações reais; importação 220 linhas em revisão; sem resultado oficial | **nenhuma** das 5 capacidades do setor | **sem script** | 4 de 13 relatórios | permissões, supressão, gabaritos, CIEP 264, Produção Textual |
| SIA | `/avaliacoes-do-professor` | OK (0292, 0323, 0324) | real | parcial | — | impressão | aprovação OP real não exercitada |
| SIPE | `/acompanhamento-planejamento` | OK (0325) | real | `consultar-planejamento-docente` sim; `manter-quadro-permanente-op` **não** | `lote13-sipe-board-e2e` | — | — |
| Mapa Estatístico | `/mapa-estatistico*`, `/mapa-mensal-2026` | OK | declarados reais; apuração "não apurado" sem histórico | parcial | — | OK | competência de oficialização |
| Departamento Pessoal | `/departamento-pessoal`, `/docserv` | OK (0361–0366) | planilhas 2026 como registro administrativo; 0 lotações | DocServ: `gerir-documentos-funcionais`/`administrar-docserv`/`validar-documentos-funcionais` **não** | `docserv-*-e2e` (3) | relatórios | lotações ausentes, fila do DP |

## Pendências que este lote NÃO resolve (exigem decisão do proprietário)
1. Atribuir em política homologada as capacidades marcadas **não** acima; sem isso as telas mostram estado vazio governado.
2. Mínimo de grupo para supressão (A&A), gabaritos Simula, identidade CIEP 264, regra de Produção Textual.
3. Executar os E2E com harness (contas sintéticas) após as concessões; A&A ainda não tem script E2E.
4. Envio ao GitHub: realizado pela sincronização do projeto, não por comando nesta sessão.
