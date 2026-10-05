# B4.2.5 — Projeção da turma, fonte TS e painel somente leitura

Status: implementado (read-only). Sem writers, sem dados normativos, sem homologação.

## Reader `class_curricular_matrices_at(_school, _class_id, _on, _known_at)`
Migrations `0016_b4_2_5_class_curricular_projection.sql` + `0017_b4_2_5_1_class_projection_access_boundary.sql`
(a 0017 corrige a fronteira de acesso: a 0016 usava só `can_read_class_roster` e negava a secretaria que lê as
posições B3.3; agora é exatamente a fronteira de `allocation_curricular_positions`).
Projeção pura sobre B4.2.4 — nenhuma tabela, cache ou materialização. SECURITY INVOKER, STABLE, `search_path=''`,
EXECUTE só `authenticated`; anon/PUBLIC sem EXECUTE. `_known_at` nulo é capturado UMA vez (`now()`) e repassado
a todos os readers de origem; a fonte TS sempre envia valor explícito.

Linhas tipadas por `result_kind` (campos não aplicáveis nulos):

| result_kind | conteúdo |
|---|---|
| `access-denied` | única linha; sem contexto, contagens ou estados (conta sem `can_read_class_roster` nem `consultar-matricula-e-movimentacao` na turma) |
| `context` | `context_state`, `gate_effect`, `total_allocations`, `resolved_allocations` (cobertura derivada; não bloqueia — R7 aberto) |
| `matrix` | uma por matriz/versão `resolvida-por-posicao`: `allocation_count`, `column_keys[]`, `correspondence_ids[]` (sem identificador de estudante); várias são válidas, sem dominante |
| `unresolved-state` | uma por estado não resolvido, com `allocation_count` |
| `specific-link` | vínculo E4 da turma (`state`, matriz, coluna opcional, associação/homologação); sem contagem por estudante; nesse ramo não há linhas `matrix`/`unresolved-state` |

Ambiguidade/exceção dos readers de origem continua fail-closed (propagada como erro).

## Fonte TS — `src/features/student-life/curricular-resolution-source.ts`
`readClassContext`, `readStudentResolutions`, `readSpecificResolution`, `readClassSummary`, `readMatrixVersionNames`.
Dicionário fechado `RESOLUTION_STATES` (todos os estados de 0014/0015, verificado por teste contra o SQL);
estado desconhecido ⇒ `nao-mapeado` (erro no console em dev, texto visível), nunca ausência nem sucesso.
`validOn` e `knownAt` obrigatórios; `captureKnownAt()` uma vez por carregamento. Sem fallback de laboratório.

## Tela
Matrícula → Enturmações (`institutional-enrollment-workspace.tsx`), abaixo da posição curricular individual:
`ClassCurricularResolutionPanel`. Mostra data de referência, situação da turma, matrizes resolvidas com
quantidade de estudantes, quantidade por situação não resolvida, vínculo específico da turma identificado como
tal, posição registrada e resultado por estudante, e aviso de que ausência de configuração/homologação impede
conclusão. IDs técnicos só no detalhe de auditoria. Nenhuma ação de configurar, homologar ou corrigir.

## Editor previsto originalmente em B4.2.5: NÃO implementado
E2 (perfil), E3 (correspondência) e E4 (associação específica) não têm writers; a competência de construção e
a homologação (R5) estão abertas. Qualquer editor fica bloqueado até essas decisões.

## Testes
- `supabase/tests/b4_2_5_class_curricular_projection.sql` → `b425-tests-ok` (ACL, sem permissão sem vazamento,
  duas matrizes, mesma matriz com 2, estados agregados, cobertura, fora-de-correspondência, bloqueio de contexto,
  ramo específico, knownAt/validOn).
- `src/features/student-life/curricular-resolution.test.tsx`.

## B4.2.5.1 — Rótulos humanos no painel (correção de auditoria)

- **Estudante:** nome vem de `institutional_students.display_name`, a mesma fonte do roster institucional (`institutional-roster.ts`), lido sob o RLS vigente; nada amplia autorização. Sem nome legível ⇒ "Estudante sem nome legível".
- **Posição:** rótulo de cada eixo vem de `attribute_value_definitions.label` na tupla exata `scheme_id + value_id + version` registrada na posição; nunca outra versão. Sem rótulo ⇒ "Valor sem rótulo legível".
- IDs técnicos (alocação, estudante, esquema/valor/versão) aparecem só em "Detalhe técnico (auditoria)".
- **Limitação temporal:** `display_name` não é versionado — o nome é a leitura atual, não reconstrução no knownAt. O rótulo do valor é estável por versão (linha imutável por trigger), então a versão registrada fornece o rótulo correto sem precisar de knownAt; o catálogo não tem rótulo próprio de esquema, portanto o esquema aparece só na auditoria.
- Sem SQL/migration nova.


## R5 — RESOLVIDO (2026-10-04)
A Supervisão Escolar (`gestao-pedagogica-da-rede`) constrói e homologa E1–E4. A implementação está em `0059_r5_curricular_writers_policy_v4.sql`; a v4 nasce **draft** e não autoriza as novas operações até homologação posterior com ato institucional real. E1 construção preserva a capability `manter-matrizes-curriculares` já homologada na v3. Nenhum dado curricular real foi importado; a publicação da Deliberação CME nº 3/2026 segue pendente para `valid_from`. Gate: `docs/r5-gate-operacional.md`.
