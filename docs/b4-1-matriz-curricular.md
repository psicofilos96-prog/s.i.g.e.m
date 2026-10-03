# B4.1 — Matriz curricular canônica (estrutura institucional)

Migration: `drizzle/migrations/0005_b4_1_curricular_matrix_structure.sql` (aditiva; anteriores intactas).

## Decisão institucional D4 (explícita, aprovada pelo usuário em 2026-10-03)
- Nova capability `manter-matrizes-curriculares`, escopo `{network}`.
- Concedida somente à nova atuação `gestao-pedagogica-da-rede`, somente na política v2 **draft**
  (v1 intacta: 108 regras, md5 `a9f922024fe7dd2e2db2fa49ae85057c`; v2: 116 → 117 regras, continua draft).
- Não reutiliza `manter-componentes-curriculares`: manter o catálogo de componentes e manter a
  estrutura da matriz são competências distintas. Nenhuma atuação existente recebeu a capability.
- Tipos de atuação não têm catálogo próprio no banco (são `engagement_kind_id` nas regras da política);
  por isso a atuação nasce só como regra da v2. Nenhuma pessoa/atuação real foi criada; política não homologada.

## Modelo
- `institutional_curricular_matrices` — identidade lógica (`mat-<uuid>`), imutável.
- `curricular_matrix_versions` — append-only; `version`, `supersedes_id`, `change_kind`
  (`constituicao` | `sucessao` | `retificacao` — natureza estrutural do registro, não estado normativo),
  `valid_from`/`valid_until`, ato, `recorded_by`/pessoa/atuação, `created_at` (knownAt).
- `curricular_matrix_items` — filhos imutáveis da versão: componente B2.3 por ID (nome só como
  `component_label_snapshot`, evidência) OU elemento do catálogo `elemento-de-matriz-curricular`;
  quantidade separada da unidade (catálogo `unidade-de-carga-da-matriz`). Mudança de item = nova versão.
- `curricular_matrix_applicability` — ano letivo (B2.4), escola (B2.1) ou valor homologado de catálogo
  (B2.6) por ID. Não escolhe qual eixo é "oferta educacional" (D1 continua aberta).
- Sem estado rascunho/homologada da matriz: não existe mecanismo genérico; workflow de homologação fica para decisão posterior.

## Reader / writer
- `curricular_matrices_at(on, knownAt)`, `curricular_matrix_items_at(matrix, on, knownAt)`,
  `curricular_matrix_applicability_at(matrix, on, knownAt)` — SECURITY INVOKER; datas obrigatórias.
  Retificação conhecida oculta a retificada; sucessão encerra a anterior na véspera (derivado, nunca gravado);
  mais de uma versão na data ⇒ `matrix:ambiguous` (estruturalmente inalcançável pela cadeia linear; guarda defensiva).
- `record_curricular_matrix_version(...)` — SECURITY DEFINER, `search_path=''`, auth.uid, capability de rede,
  base esperada + advisory lock, valida componente existente e ativo em toda a vigência, ano/escola ativos,
  catálogos homologados; catálogo vazio ⇒ recusa explícita, nunca default.
- ACL: EXECUTE só `authenticated`; PUBLIC/anon revogados; DML direto revogado; triggers `forbid_mutation`.

## Testes
- `supabase/tests/b4_1_curricular_matrix.sql` — executado na Cloud (`b41-tests-ok`), fixture descartado.
- `src/features/curriculum/b4-1-curricular-matrix.test.ts` — unitários de TS (não provam regra do banco).

## Não decidido (continua bloqueado)
Eixo da oferta (D1), cardinalidade turma→matriz (D2, B4.2), unidade de carga, elementos não disciplinares,
etapa/modalidade, regras de composição/carga (D7), homologação/publicação da matriz e da política (D4 parcial: só quem mantém).

## Relação com B4.2
B4.2 vinculará turma → versão de matriz consumindo `curricular_matrices_at`; não iniciada.
