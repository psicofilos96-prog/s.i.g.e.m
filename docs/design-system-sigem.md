# Design System SIGEM — consolidação (2026-10-05)

## Auditoria
- Tokens: cores semânticas (`primary`, `success`, `warning`, `info`, `destructive`, `muted`) em `src/styles.css`; `badge-*` e `state-*` para tons. Uma cor crua (amber) em Vida Funcional foi trocada por token; um teste agora proíbe cores cruas fora de `components/ui`.
- Identidade institucional: emblema, localidade e nomes do órgão saíram do app-shell e foram para `src/config/institution.ts`. Um teste impede que componentes genéricos citem município/emblema.
- Já consolidados (sem mudança): `PageHeader`, `SectionHeader`, `FilterBar`, `StatCard`, `StatusBadge`, `EmptyState`, `StatePanel`, `status-continuity`, `decision-desk`, `follow-up-workspace`, `attendance-speed`, tabelas/forms/dialogs do shadcn, command palette (Ctrl/⌘+K), impressão sem navegação.

## Novas primitivas (`src/components/sigem/states.tsx`)
| Padrão | Primitiva | Regra |
|---|---|---|
| Estado versionado | `VersionStateBadge` | rascunho / em revisão / efetivo / revogado / histórico; o estado vem do dado |
| Ausente ≠ zero | `FactValue` | `null`/vazio → "Não informado"; `0` → 0 |
| Proveniência | `ProvenanceLine` | fonte, autor, momento; sem dado → "Proveniência não informada" |
| Aviso | `WarningNote` | tom `warning`, ícone decorativo |
| Ação perigosa | `DangerAction` | confirmação explícita com consequência descrita |
| Concorrência otimista | `ConcurrencyConflictNotice` | nada é sobrescrito; recarregar a versão atual |
| Carregamento / erro | `LoadingState` (`role=status`) / `ErrorState` (`role=alert`, tentar novamente) | animação respeita movimento reduzido |

Adoção é incremental: telas existentes migram quando forem tocadas; nenhuma regra de negócio foi alterada.

## Verificação
- axe em `src/components/sigem/states.test.tsx` e `src/components/a11y.test.tsx`.
- Regressão visual por screenshot: não há infraestrutura de baseline no projeto; não executada.
