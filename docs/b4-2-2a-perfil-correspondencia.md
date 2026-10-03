# B4.2.2a — Estrutura do perfil de correspondência (E2)

Contrato: `docs/b4-2-0-contrato-correspondencia-posicao-matriz.md` (E2). Migration aditiva `drizzle/migrations/0012_b4_2_2a_correspondence_profile_structure.sql`.

## Implementado
- `curricular_correspondence_profiles` (id `ccp-<uuid>`) e `curricular_correspondence_profile_versions`.
  - Versões append-only: constituição, sucessão ou retificação.
  - Cada versão tem vigência, ato e motivo.
  - Proveniência: `recorded_by`, `recorded_by_person_id` e `recorded_via_engagement_id`.
- Filhos imutáveis da versão:
  - **E2a** `..._position_keys`: esquemas da posição B3.3 que formam a chave.
  - **E2b** `..._nature_axis`: 0 ou 1 esquema da Oferta B2.6 designado como natureza da turma.
  - **E2c** `..._nature_gates`: um portão por valor (`value_id` + `value_version`), restrito ao esquema designado por FK composta.
    - O efeito é uma primitiva técnica: `matching-regular` | `associacao-explicita` | `fora-de-correspondencia`.
    - Nenhum nome de etapa, natureza ou AEE existe no motor.
- **E2d**: `applicability_rule_*` na versão é uma referência opcional a valor de catálogo. Nula significa aplicabilidade não avaliável; não existe literal E/OU.
- `curricular_correspondence_profile_homologations`: ledger de homologação próprio do perfil, no padrão E1, com `homologada`/`revogada`, ato, efeito e competência exercida.
- Cadeias por trigger, para qualquer papel:
  - versão: mesmo perfil e versão +1;
  - homologação: mesma versão de perfil e sequência +1.
- Todas as tabelas são imutáveis (`forbid_mutation`). RLS de leitura exige pessoa vinculada; não há DML para `authenticated`/`sandbox_exec` nem acesso para `anon`.
- Readers SECURITY INVOKER, `search_path=''`:
  - `curricular_correspondence_profiles_at(validOn, knownAt)`: devolve a versão vigente de cada perfil, com estado `nao-homologada`/`homologada`/`revogada`, chaves, eixo, portões e regra de aplicabilidade.
    - A retificação oculta a retificada e não herda a homologação dela.
    - Cadeia inválida ⇒ `profile:ambiguous-chain`.
    - Mais de uma versão vigente por perfil ⇒ `profile:ambiguous-temporal-state`.
  - `homologated_correspondence_profile_at(validOn, knownAt)`: zero linhas = ausência; mais de um perfil homologado vigente ⇒ `profile:ambiguous-homologated`. Nunca escolhe arbitrariamente.

## Não implementado (fronteira)
- **Nenhum writer**, nem de rascunho nem de homologação:
  - a competência de **construção** do perfil não foi decidida; o contrato B4.2.0 apenas propõe `manter-matrizes-curriculares`;
  - a de **homologação** (R5) também não.
  - Por isso, nenhum caminho de aplicação cria perfil ou o torna homologado. Base esperada, lock e validação de que eixos e valores estejam homologados em toda a vigência ficam para o writer.
- A estrutura não exige pelo menos uma chave nem um eixo de natureza no momento da gravação; o futuro reader de resolução tratará a ausência como `bloqueada:*`, conforme o contrato.
- Correspondência E3, associação específica E4, resolução por estudante e por turma, TS e UI: não iniciadas.
- Nenhum esquema, valor, perfil ou dado real foi criado; políticas v1/v2 intactas.

## Validação
`supabase/tests/b4_2_2a_correspondence_profile.sql`, executado na Cloud como bloco único com rollback ⇒ `b422a-tests-ok: acl ausencia rascunho constraints cadeia homologado knownat retificacao ambiguidade legado append-only`.
- Fixtures fictícias.
- O trigger desligado no cenário legado é religado e confirmado ativo.
- Pós-teste: zero resíduos; v1 draft 108, v2 draft 117.
