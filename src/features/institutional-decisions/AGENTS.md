## Decisão institucional e Direção Escolar (13I — `src/features/institutional-decisions/`, `src/features/school-leadership/`)

Regra transversal: **hierarquia organizacional não implica autorização informacional
nem competência operacional. Toda visualização, decisão, ato ou alteração
institucional decorre de capacidade explícita, escopo, vigência, finalidade e
política aplicável.** O cargo é rótulo de leitura (`positionLabelSnapshot`), nunca
critério de autorização — duas pessoas com o mesmo cargo têm capacidades diferentes.

- Domínio (`institutional-decisions/`) e perspectiva (`school-leadership/`) são
  separados: decisão institucional serve qualquer instância decisória, não só a Direção.
- Cadeia obrigatória `fato → política que exige a decisão → alternativas admissíveis
  → competência exercida → decisão fundamentada → ato → efeitos`; sem regra exigente
  nada é decidido.
- Decisão nunca reescreve o fato que a motivou: ela o referencia e congela o
  instantâneo (`consideredFactSnapshot`); `unchangedProcess` prova a preservação.
- Falha fechada: definição não homologada, fundamentação ausente, capacidade
  faltante ou executor de ato não registrado ⇒ nenhuma decisão é registrada.
- Substituição temporária da Direção é nova concessão com vigência própria
  (`delegationOfGrantId`), nunca troca de regra nem cargo herdado.
- Exceção autorizada não altera a regra geral (`exceptionPreservesGeneralRule`);
  configuração local só muda dentro de override declarado, com delegação vigente,
  restrição por executor registrado e homologação superior quando exigida.
- Estado do processo e versão vigente da decisão são projeções da cadeia; nenhum
  campo de estado é persistido, e retificação não reaproveita o ato anterior.
- A tela é terceira perspectiva do Workspace Projection Framework (13G): filas,
  conformidade, navegação e histórico são projeções de itens AUTORIZADOS, contam
  objetos concretos e nunca publicam taxa, série, ranking ou indicador (CIECE, Cap. 14).
- Conteúdo confidencial da Orientação (13H) não chega à Direção por hierarquia:
  exige capacidade específica declarada, com supressão por campo caso contrário.
