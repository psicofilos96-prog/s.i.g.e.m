# B4.2.3 — Associação explícita específica da turma (E4)

Migration `0014_b4_2_3_class_specific_matrix_association_structure.sql` (aditiva). Teste `supabase/tests/b4_2_3_class_specific_association.sql` (rollback; `b423-tests-ok`).

## Estrutura
- `class_specific_matrix_associations` (id `csa-<uuid>`, `class_id` → `institutional_classes`).
- `class_specific_matrix_association_versions`: append-only, cadeia linear por trigger (constituição/sucessão/retificação, +1, mesma associação), vigência, `target_matrix_id` lógico B4.1, `target_column_key` **opcional**, `specific_act_ref` obrigatório, proveniência.
- `class_specific_matrix_association_homologations`: ledger próprio (padrão E1/E2/E3), cadeia linear por trigger.
- RLS/ACL: SELECT a `authenticated` vinculado; sem DML direto; nada a anon/PUBLIC; guards sem EXECUTE do cliente; `forbid_mutation` em tudo.

## Leitura
- `class_specific_matrix_associations_at(validOn, knownAt)`: versão vigente de cada associação (rascunho ou homologada); retificação oculta a retificada sem herdar homologação; cadeia inválida ⇒ `association:ambiguous-chain`; sobreposição ⇒ `ambiguous-temporal-state`.
- `resolve_class_specific_matrix_association_at(turma, validOn, knownAt)` — **estritamente estrutural**:
  - só associações homologadas; zero ⇒ ausência; >1 vigente na turma ⇒ `association:ambiguous-homologated`;
  - resolve a versão vigente da matriz e exige E1 homologada;
  - estados: `vinculo-especifico-vigente` | `bloqueada:matriz-sem-versao-vigente` | `bloqueada:matriz-nao-homologada` | `bloqueada:elemento-da-fonte-inexistente` (só se `column_key` informado e ausente na versão vigente).

## Fronteira (fica para B4.2.4)
- Portão de natureza E2 (`associacao-explicita`), sinalização `inconsistente:associacao-explicita-em-turma-regular`, aplicabilidade B4.1 e matching integrado **não** são avaliados aqui.
- Não exige posição B3.3 nem correspondência E3; não infere E4 de AEE/complementar/literal.
- Não há marcador de "matriz oficial específica da oferta": isso só poderá vir de configuração/ato institucional futuro; a estrutura apenas aponta para matriz B4.1 existente.

## Bloqueado
- Sem writer de rascunho: competência de construir E4 não definida.
- Sem writer de homologação: R5 / competência E4 pendentes.
- Nenhum dado, catálogo, matriz, associação, política ou deploy.
