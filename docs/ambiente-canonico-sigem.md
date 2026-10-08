# Ambiente canônico do SIGEM

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Decisão do proprietário (05/10/2026). Este documento não contém credenciais, tokens, senhas nem connection strings.

| Item | Valor |
|---|---|
| Projeto Lovable | `a5d0ed94-feb8-485b-8fe0-2d52377f3418` |
| Repositório | `psicofilos96-prog/s.i.g.e.m` |
| Banco canônico/oficial | Lovable Cloud, ref `crfqhyqkujhhlbiyhdbc` |
| Configuração versionada | `supabase/config.toml` → `project_id = "crfqhyqkujhhlbiyhdbc"` (obrigatório) |
| Uso | o mesmo banco serve o preview e o app publicado |
| `vwhvqtdvzbnfffkgoaen` | EXTERNO não canônico / não conectado / NÃO USAR. Sem cópia, sem migrations, sem exclusão por esta ordem. |

## Gate fail-closed

`scripts/environment-gate.mjs` resolve o project ref do destino (ref puro, `https://<ref>.supabase.co`, host `db.<ref>.supabase.co` ou usuário `postgres.<ref>` do pooler) e recusa mutações quando:
- o ref diverge do canônico;
- não é possível resolver ref (o nome do banco `postgres` não prova destino);
- host e usuário indicam refs diferentes.

Uso: `import { assertCanonicalTarget } from "scripts/environment-gate.mjs"` antes de qualquer escrita, ou `node scripts/environment-gate.mjs` (lê `LOVABLE_DB_MIGRATION_URL`/`SUPABASE_DB_URL`/`SUPABASE_URL`/`SUPABASE_PROJECT_ID` e `supabase/config.toml`). Só o ref é impresso. O gate não concede nada: RLS, capabilities e writers canônicos continuam valendo. Prova: `src/test/invariants/environment-gate.test.ts`.

## O que pertence ao Cloud canônico (verificado em 05/10/2026, sem PII)

55 escolas, 9.763 alunos, 9.811 matrículas, 698 turmas, migrations `drizzle/migrations` 0000–0118 (mais o histórico de `supabase/migrations`). Ano 2026 = `historico-importado`; ano 2027 cadastrado e **sem estado operacional** (aguarda ato humano). Frente S: READY_FOR_2027_HUMAN_OPERATION.

Observação (05/10/2026): no sandbox de desenvolvimento a URL de banco disponível passa por um proxy sem ref resolvível; o gate recusa mutações por ela (comportamento esperado, fail-closed). O destino só é aceito quando o ref canônico é comprovado.
