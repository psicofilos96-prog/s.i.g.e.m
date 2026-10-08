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

Os 12 documentos do primeiro SIGEM enviados pelo usuário estão sintetizados em `docs/sigem-memoria-fontes-historicas.md`. Consulte essa memória ao retomar requisitos de produto; ela é contexto histórico, não descrição do estado atual nem autorização para importar regras, dados ou código do modelo abandonado.

Outros 16 documentos, incluindo especificação setorial do SIGEM 2.0, guias de DP, auditoria do primeiro modelo e matriz de rastreabilidade, estão sintetizados em `docs/sigem-memoria-setorial-e-auditoria.md`. Consulte as duas memórias ao tratar requisitos setoriais; preserve a origem, a vigência e a diferença entre proposta, decisão e entrega comprovada.

Toda norma escolar é DADO configurado, homologado e versionado; nunca código. A cadeia é sempre:
`fato → capacidade do motor → configuração → homologação → aplicação → resultado versionado`.

- Motores só conhecem primitivas (comparar, compor, somar, agregar, tratar ausência). Nenhum motor conhece etapa, modalidade, segmento, ano, escola, cargo, colegiado, patamar, fórmula, prazo ou efeito institucional.
- Enumerações ficam abertas sem necessidade estrutural de fechá-las; listas de interface são opções, não limites do domínio.
- Configurabilidade ≠ edição irrestrita: liberdade estrutural coexiste com governança (rascunho → revisão → homologação), vigência, versão imutável, competência e auditoria.
- Sem regra homologada o sistema não conclui: impedimentos são exibidos por extenso; dado ausente nunca vira zero.
- Renomeações e migrações preservam IDs, versões, snapshots e proveniência; a nomenclatura de ciclo substitui "anual", com adaptador de compatibilidade na leitura (`adoptCycleNomenclature`).
- Auditoria do princípio: `src/features/assessment/normative-configurability.test.ts`.

## Regras por diretório
Regras detalhadas vivem no `AGENTS.md` de cada diretório: `src/components/sigem/`, `supabase/` e as pastas de `src/features/` que o tenham (`ls src/features/*/AGENTS.md`).

## Continuidade técnica
Estado, provas e pendências das etapas B4.x: `docs/sigem-continuidade-tecnica-2026-10-03.md`. É um registro de continuidade, **não** fonte normativa; regras vivem nos `AGENTS.md` e as normas, no dado homologado.

## Mobile/PWA/Acessibilidade
- PWA é só manifest, sem service worker nem cache, porque dados são privados e não há sincronização offline.
- Correções de acessibilidade vão primeiro nos componentes compartilhados, guardadas por `src/components/a11y.test.tsx`, porque patch por tela regride.

## Invariantes
- Invariantes arquiteturais em `src/test/invariants/` (rápida no `test`, profunda em `test:deep`); migrations novas entram no manifesto por `invariants:freeze-migrations`, nunca reescrevendo hash, porque migration aplicada é história.

## Release / CI
- Releases passam por `.github/workflows/ci.yml` (migration integrity, typecheck, testes, build; suíte profunda separada), sem segredos; mudanças de banco são forward-fix e compatíveis com o app publicado, porque a plataforma aplica migrations antes da publicação e não há staging de banco. Detalhes em `docs/engenharia-de-release.md`.

## Observabilidade
- Logs do servidor saem só por `src/lib/observability/telemetry.ts` (JSON com requestId, redaction por chave e padrão, sem objetos/payloads) e erros são classificados em `expected.*` × `incident.*`, porque negar acesso ou validar é comportamento correto, não incidente. Detalhes em `docs/observabilidade-e-incidentes.md`.

## Ambiente
- Banco canônico = Lovable Cloud do projeto (`supabase/config.toml`); mutações de scripts técnicos passam por `scripts/environment-gate.mjs`, porque o nome do banco não prova o destino.
- Conta de setor: tela organiza por estação só via `src/features/authority/station-navigation.ts` (menu + StationGate); o banco segue a garantia, porque filtro de tela não autoriza.

- Testes com contas sintéticas só via `scripts/harness-gate.mjs` (fail-closed, declara a camada provada), porque login interativo nem sempre existe.

## Verificação
- `npm run verify` (`scripts/verify.mjs`) é a rotina única de checagem local; etapas novas entram nela e em `docs/rotina-de-verificacao.md`, porque checagens espalhadas deixam de ser rodadas.

## Documentação
- Todo doc em `docs/` abre com "Situação atual" (classe: Canônico, Referência vigente, Registro de lote ou Histórico) e entra em `docs/mapa-documentacao-vigente.md`; texto antigo fica como histórico, porque doc stale vira instrução contraditória.

## Listas
- >1000 linhas só por `readPages` (`src/lib/list-paging.ts`, ordem estável, `truncated`), porque o servidor corta em 1000 e contagem parcial não pode parecer total.
- Índice técnico da documentação é gerado por `scripts/docs-index.mjs` e conferido no `verify`, nunca editado à mão, porque índice manual fica stale.
- Fronteira crítica de dados usa `parseBoundary` (src/lib/runtime-shape.ts), não só `as T`, porque tipo não confere execução.

## Segurança web
- Cabeçalhos de segurança e no-store saem só de `src/lib/security-headers.ts` via middleware em `src/start.ts`, porque cabeçalho por rota é esquecido; CSP de script fica fora até haver nonce, porque quebraria a hidratação.
