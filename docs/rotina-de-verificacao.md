# Rotina única de verificação (`npm run verify`)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- NVERIFY.2 (2026-10-08): rotina consolidada com todos os gates da campanha; saída PASS / FAIL / NOT RUN por etapa.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


`node scripts/verify.mjs` executa todas as etapas em sequência, mostra PASS / FAIL / NOT RUN por etapa, com tempo e resumo final. Veredito: `FAIL` se qualquer etapa falhar (código 1); `PASS PARCIAL` se nada falhou mas há etapa NOT RUN (não equivale a PASS); `PASS` só com todas executadas. Exceção, tempo esgotado ou ferramenta ausente contam como FAIL, nunca como PASS. Não publica, não grava no banco, não mexe no histórico e remove do ambiente dos subprocessos qualquer variável de senha/segredo/token.

Opções: `--only=tipos,testes`, `--skip=build,rotas`, `SIGEM_BASE_URL` (padrão `http://localhost:8080`).

| Etapa (id) | O que valida |
|---|---|
| migrations | Migration congelada não foi editada (hash), journal = arquivos, novas migrations listadas para `invariants:freeze-migrations`. |
| tipos | `tsgo --noEmit`: 0 erros de tipo. |
| testes | `vitest run`: suíte completa (regras, modelos, telas, vocabulário, a11y por componente, invariantes rápidas). |
| profundas | `SIGEM_DEEP=1` em `src/test/invariants`: writers, grants, migrations. |
| acessibilidade | `a11y.test.tsx` (componentes compartilhados) + varredura de vocabulário pt-BR. |
| seguranca | `audit-sql-security.mjs`: funções DEFINER sem search_path seguro e tabelas sem RLS nas migrations (inventário de arquivos, não do banco vivo). |
| segredos | Procura chave secreta do backend, JWT de service_role, chave privada, AWS/GitHub/OpenAI, senha literal. Só nomeia o arquivo; o valor nunca é impresso. Testes e docs são ignorados. |
| diff | `git diff --stat HEAD` somente leitura; sem histórico = NOT RUN. |
| pdfs | `pdf-render-audit.test.ts` + `school-documents/*`: geração e conteúdo dos PDFs (não abre o arquivo renderizado). |
| dados | `cal-count-1` (total de dias letivos), `nimport4-audit`, `ntest4-anon-surface`, `ops-readiness`. |
| harness | `institutional-harness.mjs` só com `SIGEM_TEST_HARNESS=1` e `SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup`; única etapa que recebe credenciais. Sem isso: NOT RUN. |
| navegador | Sempre NOT RUN (INTERACTIVE_BROWSER_VALIDATION_PENDING): smoke por estação e axe com login exigem contas sintéticas pelo `harness-gate`. |
| build | `vite build` (empacota, não publica). |
| rotas | Requisições sem login a rotas públicas e principais; falha em 5xx. Se o servidor não responde, a etapa fica NÃO EXECUTADA. |

Fora da rotina: a varredura de segurança da plataforma (ferramenta do agente) e as provas SQL `supabase/tests/*.sql` (acesso privilegiado). A rotina nunca publica.

- Etapa `docs`: `node scripts/docs-index.mjs --check` (índice técnico atualizado, sem referência quebrada).
