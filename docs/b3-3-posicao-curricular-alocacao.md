# B3.3 — Posição curricular individual da alocação

Migrations aditivas `0008_b3_3_allocation_curricular_position.sql` e `0009_b3_3_1_position_annul_without_dates.sql` (a 0009 corrige só a anulação, que exigia datas). Alocações, writers B3, policies, matrizes e migrations históricas foram preservados.

## Decisões do usuário aplicadas
- A posição (etapa/ano/fase) pertence à **alocação/enturmação** do estudante, nunca à turma.
- A posição é corrigível/versionada, e posições sucessivas na mesma alocação são suportadas.
- A ausência é explícita e nunca inferida.
- O registro usa a capacidade escolar `manter-matricula-e-enturmacao`. A competência da Supervisão sobre matrizes não muda.

## Modelo
- `allocation_curricular_positions`: append-only e imutável por trigger, com `position_logical_id`+`version`, `supersedes_id`, `valid_from/valid_until`, `annulled`, ato, motivo e `recorded_by`.
- `allocation_curricular_position_axes`: filho imutável. Cada eixo é `scheme_id`/`value_id`/`value_version` de catálogo homologado (eixos abertos).
- Writer `record_allocation_curricular_position` (SECURITY DEFINER, `search_path=''`):
  - exige sessão e capacidade na escola da alocação;
  - exige alocação head;
  - a vigência deve caber na alocação: alocação com término exige fim ≤ término;
  - cada valor deve estar homologado em toda a vigência, verificado por segmentos;
  - não aceita esquema repetido;
  - recusa sobreposição entre posições da mesma alocação;
  - correção exige base esperada e motivo, e não troca a alocação;
  - a anulação é nova versão.
- Reader `allocation_curricular_positions_at(school, class, validOn, knownAt)` (SECURITY INVOKER):
  - devolve toda alocação vigente; sem posição, os campos vêm nulos;
  - posição ambígua ⇒ `position:ambiguous-temporal-state`;
  - a posição só aparece enquanto a alocação vigora;
  - correção posterior não reescreve uma consulta com knownAt anterior.
- RLS: SELECT por `can_read_class_roster` ou `consultar-matricula-e-movimentacao`. Sem DML direto, sem acesso anon e sem EXECUTE para PUBLIC/anon.
- UI: painel na tela de enturmações.
  - Sem posição, mostra "Posição curricular não registrada".
  - O esquema do catálogo é digitado, e só valores homologados são oferecidos.
  - Permite registrar, corrigir, registrar posição sucessiva e anular.

## Fronteiras
- A natureza da participação **não** classifica sozinha AEE/complementar, e nada aqui a usa como etapa.
- Nenhuma matriz é associada. Nenhum valor ou esquema é semeado. Nenhuma inferência é feita por nome, código ou etapa da turma.

## Pendente (institucional)
- D1: quais esquemas do catálogo representam etapa/segmento, ano/fase etc. O writer hoje aceita qualquer esquema homologado.
- Homologação dos valores.
- Natureza da turma (AEE/complementar) como fato próprio.
- Correspondência posição→matriz (B4.2).
- Homologação das políticas v1/v2, ainda draft. Por isso não há acesso real.
- O término posterior de uma alocação não encerra a posição gravada: o reader a esconde fora da alocação. Uma eventual política de truncamento é decisão futura.

## Evidências
- SQL Cloud com rollback: `b33-tests-ok: acl sem-sessao catalogo-vazio-recusa sem-capability rejeicoes ausencia-explicita sucessivas sem-sobreposicao correcao-append-only knownat imutavel anulacao limitada-pela-alocacao rls`.
- Resíduos zero. v1 = 108 draft, v2 = 117 draft.
