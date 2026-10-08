# B4.2.2b — Correspondência E3: chave de posição individual → matriz lógica + coluna

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Migration `0013_b4_2_2b_position_matrix_correspondence_structure.sql` (aditiva). Teste `supabase/tests/b4_2_2b_position_matrix_correspondence.sql` (rollback; `b422b-tests-ok`).

## Estrutura
- `curricular_position_matrix_correspondences` (id `cpm-<uuid>`, pertence a um perfil E2).
- `..._versions`: append-only, cadeia linear (constituição/sucessão/retificação, predecessor da mesma correspondência, versão +1 por trigger), vigência, ato, alvo = `target_matrix_id` lógico + `target_column_key`.
- `..._keys`: filhos imutáveis `(scheme_id, value_id, value_version)`, um valor por esquema; nomes abertos `[a-z0-9-]`, nenhum semeado.
- `..._homologations`: ledger próprio (mesmo padrão E1/E2), cadeia linear por trigger.

## Leitura
- `curricular_position_matrix_correspondences_at(validOn, knownAt)`: versão vigente de cada correspondência, rascunho ou homologada; retificação oculta a retificada sem herdar homologação; cadeia inválida ⇒ `correspondence:ambiguous-chain`; >1 versão vigente ⇒ `ambiguous-temporal-state`.
- `resolve_position_matrix_correspondence_at(perfil, chave, validOn, knownAt)`: só homologadas, chave exatamente igual (inclui versão do valor). Zero ⇒ ausência; >1 ⇒ `correspondence:ambiguous-homologated` (falha fechada). Rascunhos nunca resolvem nem geram ambiguidade.
- A coluna **não** é exigida no registro; é validada na resolução contra a versão vigente da matriz: `coluna-presente` | `bloqueada:coluna-inexistente` | `bloqueada:matriz-sem-versao-vigente`. Sucessão da matriz mantém a correspondência.
- Múltiplas matrizes na mesma turma/data são preservadas: chaves distintas → matrizes distintas.

## Fora desta etapa / bloqueado
- **Sem writer de rascunho**: a competência de construir E3 é só proposta técnica (`manter-matrizes-curriculares`), não decisão institucional.
- **Sem writer de homologação**: R5 pendente.
- Completude da chave contra os esquemas E2a do perfil, natureza da turma, aplicabilidade (E/OU) e matching por estudante: B4.2.4.
- E4 (associação explícita específica): B4.2.3.
- Nenhum dado, valor de catálogo, política ou deploy.


## R5 — RESOLVIDO (2026-10-04)
A Supervisão Escolar (`gestao-pedagogica-da-rede`) constrói e homologa E1–E4. A implementação está em `0059_r5_curricular_writers_policy_v4.sql`; a v4 nasce **draft** e não autoriza as novas operações até homologação posterior com ato institucional real. E1 construção preserva a capability `manter-matrizes-curriculares` já homologada na v3. Nenhum dado curricular real foi importado; a publicação da Deliberação CME nº 3/2026 segue pendente para `valid_from`. Gate: `docs/r5-gate-operacional.md`.
