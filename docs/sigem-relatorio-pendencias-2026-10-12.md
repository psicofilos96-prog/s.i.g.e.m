# Relatório exaustivo de pendências — SIGEM 2.0 (2026-10-12)

Situação atual: Registro de lote. Fotografia da auditoria de 2026-10-12 sobre o HEAD `ed9ca339`. Não é fonte normativa nem homologação.

## 1. Escopo e método

- Fila verificada: nenhuma solicitação de desenvolvimento em execução no momento da auditoria; todos os lotes recebidos (Tecnologia 01–24, Matrículas 01–24, Gestão de Pessoas, Organização da Rede, Documentos, Permanência, Centro de Operações, Desenvolvimento, Acervo Documental, sincronização GitHub) já tinham resposta registrada.
- Evidência coletada nesta auditoria (não presumida):
  - GitHub: `main` remoto = local = `ed9ca3396c140ddefc31ba3c30fea2efb5dc6c05`; árvore local limpa (0 arquivos pendentes); sem divergência Lovable × GitHub.
  - CI (`.github/workflows/ci.yml`): os 5 últimos runs concluídos falharam (`7ccbaaaf`, `84d6a0d5`, `9052b0d9`, `ee66d332`, `256d5b85`), sempre no passo `bun run test`; run de `ed9ca339` em andamento. Run de referência: https://github.com/psicofilos96-prog/s.i.g.e.m/actions/runs/38267385628
  - Suíte local completa (`bun run test`): estourou 590 s sem terminar; até o corte, ~1266 testes passaram e 11 falharam em 10 arquivos (lista na seção 3).
  - 498 migrations SQL em `drizzle/migrations/`; 10 marcadores TODO/FIXME em `src/`.
  - Banco: `acv_spaces` = 0 (nenhum acervo setorial criado); 8 políticas de capacidade registradas; a leitura de regras de capacidade pelo papel de auditoria é negada (não verificável por esta via).
- Não executado nesta auditoria: E2E autenticado pela interface, teste de concorrência real, varredura de segurança nova, build de produção.

Classes: **C** implementado e comprovado · **P** parcial · **N** não iniciado · **B** bloqueado · **V** aguardando validação institucional · **X** não verificável.

## 2. Ordens aceitas × entregas efetivas

| Módulo / ordem | Entregue de fato | Classe | Falta |
|---|---|---|---|
| Matrículas L01–L24 | domínio TS + migrations 0452–0476, matriz 45×22 técnica, SQL RLS | P | telas operacionais, capabilities atribuídas, exportações auditadas no motor, E2E autenticado, concorrência |
| Tecnologia L01–L24 | domínio TS + migrations 0477–0496, `/painel-de-tecnologia`, `/relatorios-de-tecnologia`, SQL `tech24_technology_rls.sql` | P | telas por lote (SLA, fila, sessões, mudanças, inventário, conectividade, catálogo, acessos, incidentes, backups, conhecimento, recursos, licenças), capabilities, matriz 49×18 (especificação ausente) |
| Gestão de Pessoas / Rede / Documentos / Permanência / Centro de Operações / Desenvolvimento | domínios e migrations por lote, documentados nos `AGENTS.md` de cada pasta | P | telas e capabilities atribuídas; `development-closure.test.ts` falhando |
| Acervo Documental (0497) | bucket privado, RLS, `acv_*`, rota `/acervo-documental`, SQL `acv01_acervo_e2e.sql` | P | UI de compartilhamento/membros, limpeza de reservas órfãs, E2E pela UI, scanner de malware, retenção/quota decididas; nenhum espaço criado |
| Sincronização GitHub | `main` igual nos dois lados (prova: SHA acima) | C | — (CI vermelho é pendência própria, P0-01) |
| PERF.LOADING.1 (prioridade máxima declarada) | não há registro de fechamento com benchmark | N/X | ver P1-01 |

## 3. Pendências

### P0 — impedem release confiável

| ID | Descrição | Evidência | Impacto | Responsável | Próximo passo | Critério de conclusão |
|---|---|---|---|---|---|---|
| P0-01 | CI vermelho há ≥5 commits | runs acima; passo `bun run test` | nenhum release tem prova automática; regressões passam | técnico | corrigir P0-02 e reexecutar CI | run verde em `main` |
| P0-02 | 11 invariantes falhando | `harness/institutional-harness.test.ts` (app importa harness/fixtures); `error-surfaces-nobs2.test.ts` ×2 (erro do backend direto na tela; window.confirm/alert); `loading-states-adoption.test.ts` ("Carregando" solto); `academic-date.br.test.ts` (`type="date"` direto); `temporal-boundaries-ntemp1.test.ts` ("hoje" UTC); `report-catalog.test.ts` (CPF/exportação fora do motor); `school-documents.test.ts` (assinatura/QR); `map-domain.test.ts` (campo legado de modalidade); `mediator-acceptance.test.ts` e `development-closure.test.ts` (módulo/evidência citado ausente) | violações reais de LGPD, UX e arquitetura nas telas recentes | técnico | corrigir cada tela apontada pelo teste, sem afrouxar o teste | 0 falhas na suíte |
| P0-03 | Suíte não termina em 590 s localmente | log desta auditoria | verificação local inviável; `npm run verify` não fecha | técnico | medir arquivos lentos (`--reporter=verbose`), separar em `test:deep` | suíte rápida < 5 min |
| P0-04 | `.env` versionado no repositório | observado na sincronização anterior | publicação de configuração; política "nunca enviar .env" | técnico + proprietário | confirmar conteúdo (apenas chaves públicas?) e remover do índice com `.gitignore` | `.env` fora do repositório, sem segredo no histórico |

### P1 — funcionalidade aceita sem uso real

| ID | Descrição | Evidência | Impacto | Responsável | Próximo passo | Critério |
|---|---|---|---|---|---|---|
| P1-01 | PERF.LOADING.1 sem prova de fechamento (8 rotas lendo antes do portão de sessão) | prioridade declarada; teste de "Carregando" falhando | páginas lentas/spinner infinito para usuário real | técnico | auditar rotas, corrigir portão, benchmark antes/depois | relatório com medição e 0 rotas pré-sessão — **sem sessão: comprovado em 2026-10-12** (0/202 rotas com 401; A/B 33→0 leituras nas 8 rotas; `docs/hotfix-performance-loading.md`); autenticado em navegador ainda não verificado |
| P1-02 | Capabilities dos lotes novos não atribuídas a nenhuma política homologada | Tecnologia (`gerir-tecnologia-da-rede`, `aprovar-mudancas-de-tecnologia`, `gerir-licencas`, etc.), Matrículas, Acervo; leitura de regras negada para auditoria | funções existem mas ninguém pode usá-las (fail-closed) | proprietário (decisão) + técnico (nova versão de política) | listar capabilities por lote e decidir titulares | cada capability ligada a política vigente ou registrada como "sem titular por decisão" |
| P1-03 | Telas operacionais ausentes para a maioria dos lotes de Tecnologia e Matrículas | só `/painel-de-tecnologia`, `/relatorios-de-tecnologia`, `/acervo-documental` | domínio inacessível ao usuário | técnico | priorizar telas de chamados, fila e inscrição | fluxo completo usado por conta real |
| P1-04 | E2E autenticado pela interface inexistente nos módulos novos | apenas SQL ao vivo e smoke signed-out | fluxo do usuário não comprovado | técnico | scripts Playwright via `harness-gate.mjs` com contas de setor | E2E verde para 2 setores + servidor sem vínculo |
| P1-05 | Acervo: sem UI de compartilhamento e sem limpeza de reservas expiradas | `archive-page.tsx`; `acv_spaces`=0 | ACL só por banco; objetos órfãos acumulam | técnico | botão Membros/Compartilhar; rotina manual de limpeza | compartilhar pela tela e órfãos removidos |
| P1-06 | Exportações auditadas de Matrículas/Tecnologia fora do motor de relatórios | `report-catalog.test.ts` falha; relatórios só catálogo | risco LGPD e números sem fonte | técnico | ligar catálogos ao motor comum | exportação só pelo motor, com trilha |

### P2 — decisões institucionais e fontes

| ID | Descrição | Responsável | Critério |
|---|---|---|---|
| P2-01 | Especificação formal de Tecnologia (49 seções/18 critérios) não está no projeto | proprietário | documento anexado e matriz preenchida |
| P2-02 | Regras sem decisão: SLA, recorrência, categorias de equipamento, vida útil, limiar do mapa, mínimo de conhecimento, rubrica pedagógica, periodicidade de revisão de acesso, notificação de incidente | proprietário | versão aprovada por pessoa ≠ autor em cada registro |
| P2-03 | Matrículas: alocação, agrupamento EI, idades, aviso oficial, limiar de supressão | proprietário | regra homologada |
| P2-04 | Acervo: retenção legal, quotas por setor, scanner de malware | proprietário + técnico | configuração aprovada; scanner ou risco aceito por escrito |
| P2-05 | Dados reais ausentes: contratos/licenças, links de conectividade, coordenadas, planos de backup, serviços do catálogo | setores | registros reais cadastrados |

### P3 — dívida técnica

| ID | Descrição | Critério |
|---|---|---|
| P3-01 | 10 TODO/FIXME em `src/` | revisados ou convertidos em pendência |
| P3-02 | Actions em Node 20 (aviso do GitHub) | `actions/checkout` atualizado |
| P3-03 | Painel de Tecnologia limita leitura a 500 linhas | uso de `readPages` |
| P3-04 | Concorrência real dos writers (reservas, numeração) só por lock declarado | teste paralelo SQL |

## 4. Totais

| Prioridade | Qtde |
|---|---|
| P0 | 4 |
| P1 | 6 |
| P2 | 5 |
| P3 | 4 |
| **Total** | **19** |

Módulos: C = 1 (sincronização), P = 5, N/X = 1 (PERF.LOADING.1). Nenhuma homologação institucional foi realizada ou é alegada.

## 5. Plano em ordem de dependências

1. P0-02 → P0-01 (CI verde) → P0-03 (suíte rápida).
2. P0-04 (`.env`).
3. P1-01 (PERF.LOADING.1).
4. P2-02/P2-03 decisões → P1-02 capabilities.
5. P1-03 telas → P1-06 exportações → P1-05 acervo.
6. P1-04 E2E autenticado; P2-05 dados reais.
7. P3.

### Atualização — Lote corretivo 07 (Família × Matrículas)
- Entregue: turno/oferta por escola (só da política aprovada; `enr_submit_application_v2`, migration 0498, escolhas append-only), página pública `/publico/acompanhar-inscricao` (comprovante, situação, lista de espera, próximos passos, envio de documentos com SHA-256 no bucket privado, confirmação de interesse na vaga), resposta única "indisponível" para código inexistente ou errado.
- Verificado: testes focais (82 arquivos, 430 testes), tipos, consulta com código inexistente no navegador.
- Não verificado: fluxo com pedido real (não há campanha publicada com política de preferência aprovada); nomes oficiais de turno/oferta (sem catálogo homologado, exibe o identificador legível).
