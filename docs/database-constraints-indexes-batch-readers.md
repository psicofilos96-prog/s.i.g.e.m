# NDB.1.1 — Índices, FKs, constraints e readers em lote

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Migration aditiva `drizzle/migrations/0235_ndb1_1_fk_indexes_classes_batch.sql` (sem DROP, sem constraint nova sobre dado oficial).

## Auditoria
- FKs no schema `public` sem índice de suporte: **329**. A maioria aponta para colunas de proveniência (`technical_operation_id`, `recorded_by_*`, `supersedes_id`, `authorizing_*`), que não são chaves de leitura nem de exclusão (os ledgers são append-only, o pai nunca é apagado) → **não indexadas** de propósito, porque índice sem consulta só pesa na escrita.
- **64 índices criados** (`ndb11_*`) nas FKs que são chave de leitura pela tela/RLS: `class_id`, `school_id`, `student_id`, `person_id`, `academic_year_id`, `enrollment_id`, `engagement_id`.
- Índices redundantes: 7 índices não únicos > 100 kB sem uso registrado (`idx_scan = 0`). **Não removidos**: estatística de ambiente sem tráfego real não prova inutilidade; reavaliar em NPERF.2 com uso real.
- Unicidade lógica / sobreposição temporal: os ledgers já garantem `unique(logical_id, version)` e as regras de vigência ficam nos writers/triggers (decisões anteriores). **Nenhuma constraint nova**: adicionar sem prova poderia invalidar dado oficial (regra do lote).

## Reader em lote
- `classes_at_batch(_class_ids text[], _valid_on date, _known_at timestamptz)` — **SECURITY INVOKER**, `search_path = ''`, chama `class_at` por turma (mesma RLS, mesmo validOn/knownAt); teto de 2.000 IDs; EXECUTE só para authenticated/service_role.
- Cliente único `src/features/classes/class-names-batch.ts` (`classNamesAt`): 1 linha = nome, 0 = sem cadastro, >1 = inconsistente; se o lote falhar, volta à leitura individual para que a recusa de uma turma não apague as demais.

## N+1 removidos (N chamadas → 1)
| Tela/servidor | Antes | Depois |
|---|---|---|
| Mapa Estatístico — nomes das turmas (`statistical-map.functions.ts`) | 1 `class_at` por turma | 1 `classes_at_batch` |
| Projeção da rede do Mapa (`network-projection.functions.ts`) | 1 por turma, por escola | 1 por escola |
| CIECE — escopos de turma (`ciece-query.functions.ts`) | 1 por turma | 1 |
| Calendário — escolher estudante (`institutional-calendar-management.tsx`) | 1 por turma da escola | 1 |

O Diário (`institutional-teaching.ts`) segue com cadastro + turno por turma: não há reader de turno em lote; fica para NPERF.2.

## Medição
- Ida e volta: para uma escola com 30 turmas, eram 30 requisições e agora é 1. Na rede inteira (698 turmas), eram cerca de 698 e agora é 1 por escola.
- EXPLAIN com dados reais não pôde ser medido: a sessão técnica não vê as linhas (RLS) e as estatísticas ficam vazias, então o planejador mostra varredura sequencial com custo trivial. Tempo real com login = **INTERACTIVE_BROWSER_VALIDATION_PENDING**.

## Testes
- `src/features/classes/class-names-batch.test.ts`: uma chamada para N turmas; 0/1/>1 linhas; queda para leitura individual com erro isolado; ausência nunca vira nome.
