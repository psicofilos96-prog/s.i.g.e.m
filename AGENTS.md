<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Configurabilidade Normativa (princípio transversal do SIGEM)

- Component system defaults are separate owner-authorized data linked to existing component IDs; canonical readers prefer all institutional versions and never turn defaults into human-authored versions or homologations, because restoration must not fabricate provenance.

Memórias de requisitos (`docs/sigem-memoria-*.md`): contexto histórico, nunca autorização para importar regras/dados/código antigos.

Toda norma escolar é DADO configurado, homologado e versionado; nunca código. A cadeia é sempre:
`fato → capacidade do motor → configuração → homologação → aplicação → resultado versionado`.

- Motores só conhecem primitivas (comparar, compor, somar, agregar, tratar ausência). Nenhum motor conhece etapa, modalidade, segmento, ano, escola, cargo, colegiado, patamar, fórmula, prazo ou efeito institucional.
- Enumerações ficam abertas sem necessidade estrutural de fechá-las; listas de interface são opções, não limites do domínio.
- Configurabilidade ≠ edição irrestrita: liberdade estrutural coexiste com governança (rascunho → revisão → homologação), vigência, versão imutável, competência e auditoria.
- Sem regra homologada não conclui; ausência nunca vira zero. Notices translate diagnostics only, never editable values or records.
- Renomeações e migrações preservam IDs, versões, snapshots e proveniência; a nomenclatura de ciclo substitui "anual", com adaptador de compatibilidade na leitura (`adoptCycleNomenclature`).
- Auditoria do princípio: `src/features/assessment/normative-configurability.test.ts`.

## Regras por diretório
- Family notices use explicit recipients; infrequency configuration in Parameters versions canonical rules atomically, never assumes delivery; see sector AGENTS.md.
- Enrollment uses a shared validator and trigger; browser uses the same cutoff, so alternate writers cannot bypass it.
- Vaccination events freeze the parameter's deadline; reports use it, so later parameters cannot rewrite deadlines.
Read nested AGENTS.md: map transport, supervision gates, admin paging.
- Teacher counts use authorized reads/distinct units; reads use deadlines/session keys; stale reviews fail closed.
- Calendar presentation uses server time throughout; browser clock skew is not access denial.

## Continuidade técnica
B4.x: `docs/sigem-continuidade-tecnica-2026-10-03.md` (registro, não fonte normativa).

## Mobile/PWA/Acessibilidade
- PWA é só manifest, sem service worker nem cache, porque dados são privados e não há sincronização offline.
- Correções de acessibilidade vão primeiro nos componentes compartilhados, guardadas por `src/components/a11y.test.tsx`, porque patch por tela regride.

## Invariantes
- Invariantes arquiteturais em `src/test/invariants/` (rápida no `test`, profunda em `test:deep`); migrations novas entram no manifesto por `invariants:freeze-migrations`, nunca reescrevendo hash, porque migration aplicada é história.

## Release / CI
- Releases passam por `.github/workflows/ci.yml`, sem segredos; mudanças de banco são forward-fix e compatíveis com o app publicado, porque a plataforma aplica migrations antes da publicação e não há staging de banco. Detalhes em `docs/engenharia-de-release.md`.

## Observabilidade
- Logs do servidor saem só por `src/lib/observability/telemetry.ts` (JSON, requestId, redaction) e erros são classificados em `expected.*` × `incident.*`, porque negar acesso ou validar é comportamento correto, não incidente. Detalhes em `docs/observabilidade-e-incidentes.md`.

## Ambiente
- Banco canônico = Lovable Cloud do projeto (`supabase/config.toml`); mutações de scripts técnicos passam por `scripts/environment-gate.mjs`, porque o nome do banco não prova o destino.

- Testes com contas sintéticas só via `scripts/harness-gate.mjs` (fail-closed, declara a camada provada), porque login interativo nem sempre existe.

## Verificação
- `npm run verify` (`scripts/verify.mjs`) é a checagem local única; etapas novas entram nela e em `docs/rotina-de-verificacao.md` — checagens espalhadas deixam de ser rodadas.

## Documentação
- Todo doc em `docs/` abre com "Situação atual" (Canônico, Referência vigente, Registro de lote ou Histórico) e entra em `docs/mapa-documentacao-vigente.md`; texto antigo fica como histórico — doc stale vira instrução contraditória.

## Listas
- >1000 linhas só por `readPages` (`src/lib/list-paging.ts`, ordem estável, `truncated`) — o servidor corta em 1000 e parcial não pode parecer total.
- Índice de docs só por `scripts/docs-index.mjs` (no `verify`) — índice manual fica stale.
- Fronteira de dados usa `parseBoundary` (src/lib/runtime-shape.ts), não só `as T` — tipo não confere execução.
- RLS: função STABLE SECURITY DEFINER constante entra em `(SELECT ...)`; sem embrulho é reexecutada por linha (0601).

- Cabeçalhos de segurança/no-store só via `src/lib/security-headers.ts` (em `src/start.ts`) — cabeçalho por rota é esquecido.

## Aceitação integrada
- Aceitação entre setores só por `scripts/integration-acceptance-e2e.mjs` — suítes soltas deixam de rodar juntas.

- Testes: `.test.ts` em node e `.test.tsx` em jsdom (`vitest.config.ts`; `.ts` com DOM entra em `DOM_TS_TESTS`) — jsdom em tudo custava 70% da suíte.


## Sessão no navegador (PERF.LOADING.1)
- Leitura da sessão de login passa por `src/lib/auth-session-read-cache.ts` (instalado em `src/router.tsx`, memória de 10 s; gravação/remoção vão direto ao armazenamento), porque no preview cada consulta lia a sessão via editor em fila e as telas estouravam o prazo.

## Agentes (MCP)
- Servidor MCP em `src/lib/mcp/` só com ferramentas de leitura, OAuth do próprio usuário e cliente com o token dele, porque assistente externo nunca pode ver além da conta nem contornar RLS.
