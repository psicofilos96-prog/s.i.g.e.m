# B4.2.4 — Resolução integrada E1–E4 (somente leitura)

Status: **implementado estruturalmente, read-only.** Migration `0015_b4_2_4_integrated_resolution_readers.sql`. Nenhum writer, seed, catálogo, policy, matriz, associação ou deploy.

## Funções (SECURITY INVOKER, `search_path=''`, STABLE; EXECUTE só `authenticated`; anon/PUBLIC sem EXECUTE)

| Função | Passo do contrato | Assinatura |
|---|---|---|
| `class_curricular_resolution_context_at` | 3.0 contexto comum | `(_class_id text, _on date, _known_at timestamptz)` → 1 linha |
| `student_curricular_matrix_at` | 3.1 ramo regular | `(_school text, _class_id text, _on date, _known_at timestamptz)` → 1 linha por alocação vigente (mesma ordem de argumentos de `allocation_curricular_positions_at`; `_class_id` obrigatório) |
| `class_specific_curricular_matrix_at` | 3.2 ramo específico | `(_class_id text, _on date, _known_at timestamptz)` → 1 linha |

`_on` e `_known_at` são obrigatórios e propagados a todos os readers de origem (E1, E2, E3, E4, B2.6, B3.3, B4.1, B4.1.2).

## Contexto comum (`context_state`)
1. perfil E2 homologado: 0 ⇒ `bloqueada:perfil-ausente`; >1 ⇒ `inconsistente:perfil-ambiguo` (contagem explícita sobre `curricular_correspondence_profiles_at`; nunca vira ausência).
2. eixo de natureza do perfil ausente ⇒ `bloqueada:natureza-nao-designada`.
3. valor do eixo na Oferta B2.6 (`class_offering_at`): ausente ⇒ `ausente:natureza-nao-registrada`; >1 ⇒ `inconsistente:natureza-ambigua`.
4. valor não homologado no catálogo ⇒ `bloqueada:natureza-nao-homologada`.
5. portão E2 exato (valor + versão): ausente ⇒ `bloqueada:natureza-sem-portao`; >1 ⇒ `inconsistente:portao-ambiguo`.
6. efeito já existente no E2: `matching-regular | associacao-explicita | fora-de-correspondencia` (nenhum efeito novo).
7. `matching-regular` com E4 **homologada** vigente na turma ⇒ `inconsistente:associacao-explicita-em-turma-regular` (E4 nunca é usada; rascunho E4 não contamina). Estado final de sucesso: `portao-resolvido`.

## Ramo regular (`resolution_state` por alocação)
Contexto não resolvido ⇒ repete `context_state`. `fora-de-correspondencia` ⇒ `nao-aplicavel:natureza`. `associacao-explicita` ⇒ `nao-aplicavel:ramo-especifico` + referência ao estado/vínculo da turma.
Em `matching-regular`, na ordem:
`ausente:posicao` → `bloqueada:chave-nao-designada` (perfil sem esquemas E2a) → `ausente:posicao-incompleta` (só esquemas E2a formam a chave; eixos extras ignorados) → `ausente:correspondencia` → `inconsistente:correspondencia-ambigua` → `ausente:matriz-vigente` (normaliza `bloqueada:matriz-sem-versao-vigente` do E3) → `bloqueada:matriz-nao-homologada` (E1) → `bloqueada:coluna-inexistente` → `bloqueada:coluna-nao-referenciada` → `inconsistente:coluna-ref-divergente` (a ref declarada da coluna deve coincidir exatamente com UM par esquema/valor/versão da chave) → `bloqueada:aplicabilidade-nao-homologada` → `resolvida-por-posicao`.
Sucesso carrega alocação, versão de posição, perfil/versão/homologação, oferta/natureza, correspondência/versão/homologação, matriz/versão/homologação e `column_key`. Várias matrizes na mesma turma/data são válidas.

## Ramo específico (`resolution_state` da turma)
Não exige posição B3.3 nem E3. `nao-registrada:associacao-especifica` (zero E4 homologada) / `inconsistente:associacao-ambigua` / estados do resolver E4 (`bloqueada:matriz-sem-versao-vigente`, `bloqueada:matriz-nao-homologada`, `bloqueada:elemento-da-fonte-inexistente`, `vinculo-especifico-vigente`) / `bloqueada:aplicabilidade-nao-homologada`. Fora do ramo: `nao-aplicavel:natureza` ou `nao-aplicavel:ramo-regular`.

## Aplicabilidade B4.1 — limitação deliberada
Nenhuma semântica E/OU é implementada. Matriz sem linhas de aplicabilidade vigentes não bloqueia. Matriz com qualquer linha ⇒ `bloqueada:aplicabilidade-nao-homologada`, **mesmo que o perfil E2 tenha `applicability_rule_*`**: a referência existe, mas não há semântica institucional nem mapeamento técnico homologado; referência sem semântica não autoriza interpretação. Hoje só matriz sem aplicabilidade chega a `resolvida-por-posicao`/`vinculo-especifico-vigente`.

## Ambiguidade e erros
Ambiguidade de perfil, natureza, portão, E3 e E4 vira estado explícito por contagem nos readers bitemporais, sem capturar texto de erro. Falhas de cadeia/temporais que os readers de origem já levantam (`*:ambiguous-chain`, `*:ambiguous-temporal-state`, `offering:ambiguous-temporal-state`, `position:ambiguous-temporal-state`, permissão) são **propagadas** como exceção fail-closed — nunca convertidas em ausência.

## Limitações temporais reais do catálogo
`attribute_value_definitions` é imutável (trigger `forbid_mutation`): cada linha nasce com `status` fixo e `created_at` (= `now()` da transação). O reader usa `status='homologada' AND valid_from <= validOn AND created_at <= knownAt`. Não há fim de vigência nem revogação de valor no catálogo: uma revogação só pode ser expressa por nova versão do valor, e a oferta/posição que cite a versão antiga continua citando-a. `knownAt` do catálogo tem resolução de transação, não de instrução.

## Privacidade
Readers INVOKER: o roster continua protegido pelo RLS de B3 (teste: conta com capacidade lê 12 alocações; conta sem capacidade lê 0).

## Teste
`supabase/tests/b4_2_4_integrated_resolution.sql` → `b424-tests-ok: acl perfil-ausente eixo-ausente knownat-perfil oferta-ausente sem-portao natureza-nao-homologada fora regular-estados duas-matrizes proveniencia e4-rascunho-nao-contamina e4-em-regular especifico-vigente especifico-ausente especifico-coluna aplicabilidade knownat roster perfil-ambiguo`.

## Bloqueado / fora desta etapa
Writers (competências E2/E3/E4 e R5), semântica de aplicabilidade, cadastro das 22 posições, homologação D1 e policy v2, R1–R8, B4.2.5 (UI/agregação).


## R5 — RESOLVIDO (2026-10-04)
A Supervisão Escolar (`gestao-pedagogica-da-rede`) constrói e homologa E1–E4. A implementação está em `0059_r5_curricular_writers_policy_v4.sql`; a v4 nasce **draft** e não autoriza as novas operações até homologação posterior com ato institucional real. E1 construção preserva a capability `manter-matrizes-curriculares` já homologada na v3. Nenhum dado curricular real foi importado; a publicação da Deliberação CME nº 3/2026 segue pendente para `valid_from`. Gate: `docs/r5-gate-operacional.md`.
