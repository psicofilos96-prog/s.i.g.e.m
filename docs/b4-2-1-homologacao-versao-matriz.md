# B4.2.1 — Base estrutural da homologação de versões de matriz (E1)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Contrato de origem: `docs/b4-2-0-contrato-correspondencia-posicao-matriz.md` (E1).

## O que foi implementado
Migration aditiva `drizzle/migrations/0010_b4_2_1_matrix_version_homologation_structure.sql`. As migrations 0005–0007 e as funções B4.1 não foram alteradas.

- Tabela `curricular_matrix_version_homologations`: registro que só aceita acréscimos e não pode ser alterado (trigger `forbid_mutation`), ligado a `curricular_matrix_versions`.
  - Cadeia por versão: `sequence` + `supersedes_id UNIQUE`, que impede bifurcação.
  - `decision` ∈ `homologada`/`revogada`. São efeitos técnicos do registro; não fixam norma alguma.
  - `effective_from`: vigência do registro.
  - `homologation_act_ref` obrigatório.
  - `reason` obrigatório para revogação e para sequência > 1.
  - `exercised_capability_id` com formato `[a-z0-9-]`, sem lista fechada de valores. Registra qual competência foi exercida, sem presumir qual será.
  - Proveniência: `recorded_by`, `recorded_by_person_id`, `recorded_via_engagement_id` e `created_at` (`clock_timestamp`).
- Permissões de acesso (ACL) e regras de leitura por linha (RLS):
  - `SELECT` apenas para `authenticated` com pessoa vinculada.
  - Nenhum INSERT/UPDATE/DELETE para `authenticated`/`sandbox_exec`.
  - Nada para `anon`/PUBLIC.
- Readers `SECURITY INVOKER`, `search_path=''`, `EXECUTE` só para `authenticated`:
  - `curricular_matrix_homologation_state_at(validOn, knownAt)`:
    - Para cada versão de matriz vigente (via `curricular_matrices_at`), devolve `nao-homologada`, `homologada` ou `revogada`, com ato, sequência e competência exercida.
    - Registro com efeito posterior a `validOn`, ou criado depois de `knownAt`, não produz efeito.
    - Uma revogação posterior não reescreve consultas feitas com `knownAt` anterior.
  - `curricular_matrix_homologation_history(versionId, knownAt)`: cadeia completa conhecida, para auditoria.
- Teste `supabase/tests/b4_2_1_matrix_homologation.sql`:
  - É um bloco único que termina em `RAISE`, portanto nada persiste.
  - Resultado na Cloud: `b421-tests-ok: acl ausencia argumentos constraints vigencia knownat append-only`.
  - Cobre:
    - ACL/RLS e ausência de writer;
    - versão construída ≠ homologada;
    - argumentos obrigatórios;
    - ato vazio, `decision` fora do domínio técnico e capability com `:`;
    - efeito antes/depois da vigência e revogação;
    - consulta com `knownAt` antes e depois de cada registro;
    - update/delete recusados;
    - bifurcação recusada.
  - As fixtures são fictícias e só existem dentro da transação.
- Pós-teste: 0 homologações, 0 versões, 0 matrizes; v1 draft 108, v2 draft 117.

## O que permanece bloqueado
- **Não há writer de homologação.** Ele foi omitido de propósito, até a decisão institucional R5 (quem homologa). Nenhuma função grava nesta tabela, e nenhuma versão pode aparecer como `homologada` por caminho de aplicação.
  - A competência de construção (`manter-matrizes-curriculares`, Supervisão Escolar) **não** foi reutilizada.
  - Nenhuma capability nova foi criada, e as políticas v1/v2 ficaram intactas.
- Ficam para quando R5 for decidido:
  - criar o writer `SECURITY DEFINER` com base esperada e lock por versão;
  - definir a capability e a atuação competentes;
  - decidir se revogação exige a mesma competência.
- E2–E4, os readers B4.2 por estudante/turma e a UI estão fora desta etapa.

## Análise de suficiência estrutural
A estrutura não depende de R5. Ela registra apenas *que* houve homologação, com qual ato e por qual competência exercida, e não *quem* pode homologar. Por isso pode existir antes da decisão sem fixar norma. A distinção técnica `homologada`/`revogada` é o mínimo para que a revogação seja um fato, e não uma exclusão.

## B4.2.1.1 — Integridade da cadeia (migration `0011_b4_2_1_1_matrix_homologation_chain_integrity.sql`)
Lacuna auditada: `supersedes_id` era FK/UNIQUE, mas não obrigava predecessor da mesma versão de matriz nem `sequence = predecessor + 1`; o reader escolheria o maior número silenciosamente.

Correção aditiva:
- Trigger `BEFORE INSERT` `guard_matrix_homologation_chain`, que vale para qualquer papel, inclusive escrita privilegiada:
  - raiz deve ter `sequence = 1` (`matrix-homologation:root-must-be-sequence-1`);
  - predecessor deve existir (`predecessor-missing`) e pertencer à mesma `matrix_version_id` (`predecessor-other-version`);
  - `sequence` deve ser o predecessor + 1 (`sequence-gap`).
  Com `UNIQUE(matrix_version_id, sequence)` e `supersedes_id UNIQUE`, a cadeia fica linear por versão.
- `curricular_matrix_homologation_state_at` (mesma assinatura, ainda SECURITY INVOKER):
  - antes de escolher o estado, verifica a cadeia conhecida em `knownAt` das versões consultadas;
  - qualquer raiz com sequência ≠ 1, predecessor ausente ou de outra versão, salto ou duplicidade ⇒ `matrix-homologation:ambiguous-chain`, sem seleção arbitrária.
- Sem writer de homologação; políticas e dados intactos.

Testes na Cloud com rollback:
- `supabase/tests/b4_2_1_1_matrix_homologation_chain.sql` ⇒ `b4211-tests-ok: outra-versao salto valida legado-fail-closed`.
  - O cenário legado desliga o trigger só dentro da transação, para simular dado anterior inválido.
- `supabase/tests/b4_2_1_matrix_homologation.sql` foi reexecutado ⇒ `b421-tests-ok: ...`.
  - O caso de bifurcação agora aceita a recusa do trigger (`sequence-gap`), que dispara antes do UNIQUE.


## R5 — RESOLVIDO (2026-10-04)
A Supervisão Escolar (`gestao-pedagogica-da-rede`) constrói e homologa E1–E4. A implementação está em `0059_r5_curricular_writers_policy_v4.sql`; a v4 nasce **draft** e não autoriza as novas operações até homologação posterior com ato institucional real. E1 construção preserva a capability `manter-matrizes-curriculares` já homologada na v3. Nenhum dado curricular real foi importado; a publicação da Deliberação CME nº 3/2026 segue pendente para `valid_from`. Gate: `docs/r5-gate-operacional.md`.
