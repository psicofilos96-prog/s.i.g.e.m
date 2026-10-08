# Frente Y — Repositório curricular canônico (BNCC + SAEB + glossário + relações)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Status: **PASS — READY_FOR_GOVERNED_CURRICULAR_REFERENCE_IMPORT** · **CONTENT — BLOCKED_BY_OFFICIAL_SOURCE**

- Migrations: 0133 (hardening da 0068, cadeias, writers v2, relação com origem, ausência de correspondência, palavras-chave, glossário, homologação, readers INVOKER) e 0134 (policy v8: seis capabilities curriculares de rede, sem wildcard).
- 0068: DML de anon/authenticated/service_role revogado; writers v1 aposentados; `CURRENT_DATE` substituído por data declarada da operação.
- Contrato `sigem.curricular-reference-source.v2` (v1 continua legível): contagem declarada, hierarquia por `parent_code`, vínculos com versão do valor canônico, hash SHA-256 idempotente, cabeça esperada.
- Contrato consumidor: `CurricularReferenceRef` (Planejamento/Aula/Avaliação/Intervenção futuras guardam IDs, não texto).
- Conteúdo oficial: antes 0 itens, adicionados 0 — nenhuma fonte documental verificável no projeto. O legado EI em código ficou marcado como não canônico.
- Teste transacional `supabase/tests/y_curricular_reference.sql` (rollback, zero resíduos).
- Pendências humanas: fornecer documentos oficiais; importar e homologar por pessoas distintas com a capability.

## Y.1 — Fechamento e hardening (0146–0147)

Status: **PASS — READY_FOR_GOVERNED_CURRICULAR_REFERENCE_IMPORT** · **CONTENT — BLOCKED_BY_OFFICIAL_SOURCE** (0 itens oficiais; nenhuma fonte buscada nem fabricada).

1. **Cadeia de edições.** Coluna aditiva `revision_no` (raiz = 1, sucessor = predecessor + 1, preenchida/validada por `cre_chain_guard`), índice único `(source_id, revision_no)`, além de raiz única e sucessor único já existentes. Ciclos são impossíveis por construção (predecessor tem de existir antes; linhas imutáveis). Nova edição não pode ter vigência anterior à predecessora. `curricular_reference_edition_chain(source, knownAt)` devolve a cadeia ordenada e falha com `reference:ambiguous-chain` diante de qualquer incoerência (revisão ausente, salto, raiz múltipla, nó inalcançável).
2. **Hash e idempotência.** `source_sha256` = SHA-256 dos bytes do arquivo-fonte. `manifest_sha256` = SHA-256 do manifesto canônico (contrato, metadados da edição, itens normalizados na ordem da fonte, vínculos ordenados), calculado no banco. Mesmo arquivo + mesmo manifesto ⇒ idempotente; mesmo arquivo com conteúdo diferente ⇒ `hash-context-conflict`; mesmo rótulo de edição ⇒ `edition-label-conflict`; mesmo manifesto sob outro arquivo ⇒ `manifest-already-recorded`. O mesmo hash em outra fonte cria uma edição distinta, sem equivalência.
3. **Vigência.** `attribute_value_state_on(esquema, valor, versão, data)` (precedente b33): vale a maior versão com `valid_from ≤ data`; resultado `vigente` / `nao-vigente` / `nao-definido` / `ambiguo` (histórico não monotônico); data nula ⇒ erro. O writer e a guarda `crb_guard` (agora com a data efetiva da edição, antes nula) só aceitam `vigente`. Readers `curricular_reference_item_bindings_on(item, data)` e `curricular_reference_edition_applicable_on(fonte, data, knownAt)` (zero ⇒ não definido; incoerente ⇒ ambíguo). Nenhum relógio civil é usado.
4. **ACL/governança.** Writer só para authenticated; anon/service_role sem EXECUTE; readers novos são INVOKER; guardas sem EXECUTE. Autoria por pessoa natural, homologação por pessoa distinta, policy v8 por `decisao-do-proprietario` (sem homologador nominal), texto oficial imutável, camadas editoriais separadas, relação oficial ≠ editorial, ausência de correspondência versionada e `ReferencePicker` guardando IDs — revalidados sem alteração.
5. **Prova transacional.** `supabase/tests/y1_curricular_reference_closure.sql` (só strings SINTETICO, termina em RAISE): `y1-reference-tests-ok: acl value-validity binding-validity hash-identity chain editorial-relations homologation fail-closed-chain`. A 0147 corrigiu um defeito do reader de edição aplicável que o teste encontrou. Resíduos depois: 0 edições, 0 valores sintéticos, 0 pessoas sintéticas.
6. **Gates.** 3.518/3.518 testes (269 arquivos), tsgo, build, integridade (0146–0147 congeladas), auditoria SQL, diff-check OK. Advisor 340 → 340 (nenhum achado novo).
