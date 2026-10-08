# Rotina única de verificação (`npm run verify`)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


`node scripts/verify.mjs` executa todas as etapas em sequência, mostra OK / FALHOU / NÃO EXECUTADA com tempo e um resumo final; sai com código 1 se alguma falhar. Não publica, não grava no banco, não mexe no histórico e remove do ambiente dos subprocessos qualquer variável de senha/segredo/token.

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
| diff | `git diff --stat HEAD` somente leitura. |
| build | `vite build` (empacota, não publica). |
| rotas | Requisições sem login a rotas públicas e principais; falha em 5xx. Se o servidor não responde, a etapa fica NÃO EXECUTADA. |

Fora da rotina (exigem login real ou contas sintéticas via `scripts/harness-gate.mjs`): smoke autenticado por estação, a11y com Playwright (`bo-a11y-smoke.py`) e a varredura de segurança da plataforma.
