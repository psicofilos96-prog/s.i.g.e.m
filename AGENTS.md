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

- Motores só conhecem primitivas (comparar, compor, somar, dividir, agregar, tratar ausência de dado). Nenhum motor conhece etapa, modalidade, segmento, ano, escola, cargo, colegiado, patamar, fórmula, prazo ou efeito institucional.
- Enumerações permanecem abertas (identificadores) quando não há necessidade estrutural de fechá-las; listas de interface são opções, não limites do domínio.
- Configurabilidade ≠ edição irrestrita: liberdade estrutural coexiste com governança (rascunho → revisão → homologação), vigência, versionamento imutável, competência institucional e auditoria.
- Sem regra homologada o sistema não conclui: impedimentos são exibidos por extenso; dado ausente nunca vira zero.
- Renomeações e migrações preservam IDs, versões, snapshots e proveniência; a nomenclatura de ciclo substitui "anual", com adaptador de compatibilidade na leitura (`adoptCycleNomenclature`).
- Auditoria automática do princípio: `src/features/assessment/normative-configurability.test.ts`.

## Regras por diretório
Regras detalhadas vivem no `AGENTS.md` de cada diretório: `src/components/sigem/`, `src/features/academic-projections/`, `src/features/assessment/`, `src/features/calendar/`, `src/features/ciece/`, `src/features/classes/`, `src/features/collegial/`, `src/features/cycle-closing/`, `src/features/diary/`, `src/features/institutional-admin/`, `src/features/institutional-decisions/`, `src/features/pedagogical-guidance/`, `src/features/student-life/`, `src/features/workspace/`, `src/features/dashboards/`, `src/features/teaching-planning/`, `src/features/teacher-assessment/`, `src/features/reports/`, `src/features/audit/`, `src/features/public-portal/`, `src/features/onboarding/`, `src/features/pilot/`, `src/features/help/`, `src/features/privacy/`, `src/features/data-quality/`, `src/features/workflows/`, `src/features/integration/`, `src/features/assistant/`, `src/features/anomalies/`, `supabase/`.

## Continuidade técnica
Estado, provas e pendências das etapas B4.x: `docs/sigem-continuidade-tecnica-2026-10-03.md`. É um registro de continuidade, **não** fonte normativa; regras vivem nos `AGENTS.md` e as normas, no dado homologado.

## Mobile/PWA/Acessibilidade
- PWA é só manifest (instalável), sem service worker nem cache de respostas, porque dados são privados e transacionais e não há sincronização offline.
- Correções de acessibilidade vão primeiro nos componentes compartilhados, guardadas por `src/components/a11y.test.tsx`, porque patch por tela regride.

## Invariantes
- Invariantes arquiteturais em `src/test/invariants/` (rápida no `test`, profunda em `test:deep`); migrations novas entram no manifesto por `invariants:freeze-migrations`, nunca reescrevendo hash, porque migration aplicada é história.

## Release / CI
- Releases passam por `.github/workflows/ci.yml` (migration integrity, typecheck, testes, build; suíte profunda separada), sem segredos; mudanças de banco são forward-fix e compatíveis com o app publicado, porque a plataforma aplica migrations antes da publicação e não há staging de banco. Detalhes em `docs/engenharia-de-release.md`.

## Observabilidade
- Logs do servidor saem só por `src/lib/observability/telemetry.ts` (JSON com requestId, redaction por chave e padrão, sem objetos/payloads) e erros são classificados em `expected.*` × `incident.*`, porque negar acesso ou validar é comportamento correto, não incidente. Detalhes em `docs/observabilidade-e-incidentes.md`.
