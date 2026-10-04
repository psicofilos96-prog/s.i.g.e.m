# B4.6.5b — Motor puro de composição de calendários

Status: **só TypeScript puro** (`src/features/calendar/calendar-composition-engine.ts`). Esta etapa não criou migration, writer, capacidade, norma, alteração de leitor, consumidor institucional nem implantação. `calendar_at` e `calendar_day_at` continuam `access-denied`. As políticas v1=108 e v2=119 continuam draft.

## Contrato `composeCalendarDeclarations(input)`
- **Entrada:** `{ snapshot: { on, knownAt }, norm, candidates }`.
  - O shape é validado em tempo de execução, com chaves exatas. Qualquer chave a mais é recusada, por exemplo uma flag `authorized` simulada.
  - `on` é uma data civil.
  - `knownAt` é um instante com fuso e precisão de µs (`instantMicros`).
- **Norma:** só `norma-homologada`, com evidência completa, é aceita. A evidência inclui norma, versão, vigência, ato, `recordedAt`, configuração e homologação com registro, sequência, vigência, `recordedAt` e capacidade exercida.
  - Os outros estados de B4.6.5a bloqueiam: `sem-norma`, `configuracao-*`, `nao-homologada` e `ambigua:*`.
  - Também bloqueiam a revogação, a configuração não registrada, incompleta ou incoerente, a data fora da vigência e uma versão ou homologação posterior ao `knownAt` (µs inclusivo).
- **Candidatos:** `candidato` participa.
  - `nao-corresponde` e `fora-da-janela` aparecem em `excluded`.
  - `aplicabilidade-nao-registrada`, `janela-nao-registrada`, `referencia-indeterminada:*` e `referencia-invalida:*` bloqueiam (`candidato-indeterminado`). Esses candidatos nunca são descartados.
  - Qualquer outro estado gera entrada inválida.
- **Mesmo calendário:** vários recortes da mesma versão se fundem, sem multiplicidade. Uma versão diferente ou declarações divergentes geram entrada inválida.
- **`exigir-exclusividade`:** com mais de um calendário efetivo, o resultado é `multiplicidade-proibida`.
- **`compor-por-dimensao`:**
  - Toda dimensão declarada precisa ter regra. Sem regra, o estado é `dimensao-sem-regra`, e a dimensão não é eliminada.
  - `exigir-concordancia`: o valor só fica determinado se todos concordarem.
  - `uniao-com-diagnostico`: preserva todos os valores e proveniências. Quando há mais de um valor, o estado é `divergente`, nunca determinado.
  - `on_absence`: `indeterminado`, ou `desconsiderar-*`. Se todos estiverem ausentes, o resultado continua indeterminado.
- **Valores:** a dimensão é um token aberto.
  - `null` conta como ausência.
  - `false` é um valor válido.
  - `true` e `false` conflitam.
  - `true` e `"true"` são valores distintos.
- **Saída:** congelada em profundidade, com ordenação lexical determinística que não confere prioridade. A entrada não é mutada. A saída sempre traz `authorizes: false` e `publishes: false`.
- O resultado só é `determinado` quando todas as dimensões estão determinadas.

## Limites
- Não há produtor de produção, e nada está conectado aos consumidores. O adaptador para `institutional-calendar-effects` não foi feito, porque aquele motor recebe linhas de dia e não dimensões compostas, e o contrato de tradução dependeria de uma semântica de dimensão ainda não fixada.
- A semântica de cada `dimension_id` (ex.: efeito letivo, conselho) não tem catálogo.
- A evidência é afirmada pelo chamador. O motor confere coerência, não autenticidade, e a autenticidade cabe ao banco.
- Valores admitidos: boolean, texto, número finito e null.
