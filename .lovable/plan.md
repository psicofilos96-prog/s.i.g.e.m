# Etapa 12B.3 — Calendário como sistema integrado e construtor configurável

## Causa raiz da divergência 99 × 100 (auditoria)
Há hoje **duas derivações diferentes** para "semestre":
- **Grade / documento** (`buildGrid`): divide o ano por um corte fixo de data (`semesterCut` = 25/07) e rótulos escritos no código ("TOTAL DE DIAS LETIVOS DO 1°/2° SEMESTRE"); o 2º total é "ano − 1º".
- **Períodos / validação** (`periodBlocks`): soma os dias letivos dos períodos de cada agrupamento.

Quando o intervalo de um período muda (ou um dia fora dos períodos muda), as duas contas divergem. Outros acoplamentos encontrados: campo `layout: "anual" | "semestral"` decide a forma da grade; `councilLabel` é texto digitado; tipos de dia são uma lista fechada com conjuntos por sigla (`POINT_EVENTS`); a política de validação tem campos fixos (`councilWeekday`, `minDaysPerBlock`, `januaryVacationDays`). Nenhum total numérico está escrito no código operacional — os números 100/200/52… só existem nas fixtures e testes de reprodução, e continuarão lá.

## O que muda para a Supervisão
Editor reorganizado em abas, no padrão visual atual: **Calendário · Períodos · Agrupamentos · Regras e validações · Tipos de dia · Documento · Validação · Histórico**.
- **Períodos**: adicionar, remover, renomear, reordenar (IDs preservados), mudar datas, mover entre agrupamentos ou deixar sem agrupamento. Dias letivos sempre calculados.
- **Agrupamentos**: criar, remover, renomear, reordenar. Total = soma dos períodos do agrupamento.
- **Regras e validações**: cada regra liga/desliga, com valor e severidade próprios: mínimo anual, mínimo por agrupamento (um valor por agrupamento), mínimo por período, mínimo de férias, Conselho ao final do período, dia da semana esperado do Conselho. Regra não configurada não existe (sem padrões).
- **Tipos de dia**: tabela de consulta com sigla, cor, "conta como letivo", aparece na grade/legenda/rodapé.
- **Documento**: título, subtítulo, textos institucionais, observações, assinaturas, e exibir/ocultar feriados, períodos, Conselhos, resumos de agrupamento e itens de legenda. Layout A4 continua controlado pelo sistema.
- Escolas e professores continuam só consultando; só RASCUNHO é editável; homologação congela fatos + estrutura + regras + documento.

## Fonte única
Uma única função `deriveCalendarProjection(calendar)` produz: dias resolvidos, linhas da grade, períodos com dias letivos, agrupamentos com totais, total anual, dias letivos fora de período, Conselhos, feriados, validações e dados do documento. Grade, editor, resumos, validação, documento, impressão e consultas de outros módulos passam a ler só dela.
- A grade deixa de usar corte fixo: as linhas "TOTAL DE DIAS LETIVOS DO …" saem dos agrupamentos configurados (rótulo derivado do nome do agrupamento; mês dividido na fronteira entre agrupamentos, como julho na EJA). Sem agrupamentos → uma linha de total anual com divisão por período, como hoje no Regular.
- `layout` e `semesterCut` deixam de decidir estrutura (removidos; a forma vem de períodos/agrupamentos).
- Conselho do período continua sendo o dia CC dentro do intervalo; texto do rodapé gerado a partir dele.
- Nenhum `if` por modalidade.

Resultado esperado: as grades Regular e EJA 2027 originais continuam idênticas ao modelo (200; 100/100; 67/67/66; 52/48, 49/51).

## Testes
- Integração EJA: 100/100/200 → remover um dia letivo do 2º semestre → 100/99/199 em período, agrupamento, validação, documento e editor → reverter → 100/100/200; e o inverso (+1).
- Alterar término de período: período, agrupamento, fora-de-período, validação, documento reagem juntos.
- Flexibilidade (cenários artificiais): 3, 4 e 5 períodos; 2 agrupamentos; sem agrupamento; mínimos diferentes por agrupamento; sem mínimo; mínimo anual 200 → outro valor; adicionar/remover período; renomear agrupamento; reordenar mantendo IDs; duplicar e remodelar sem alterar o original.
- Governança: mudanças de estrutura/regras/documento recusadas fora de RASCUNHO e por escola/professor; snapshot homologado imutável.
- Browser (Playwright): reproduzir 99/199 no EJA e conferir tela, documento e impressão; checar cada "100"/"200" restante (ex.: "mínimo configurado de 100" é legítimo).

## Detalhes técnicos
- `calendar-types.ts`: `DayTypeInfo` ganha `showInGrid`, `showInFooter`, `category`; códigos continuam estáveis mas o motor usa só atributos (remover `POINT_EVENTS` por sigla → `category: "evento-pontual"`). `CalendarValidationPolicy` vira lista de regras `{ id, kind, enabled, value?, targetId?, severity }`. Novo `documentConfig`. Remover `layout`/`semesterCut`/`councilLabel` (migrar fixtures).
- `calendar-engine.ts`: `deriveCalendarProjection` + seletores finos; `buildGrid`, `periodBlocks`, `validateCalendar` passam a ser internos a ela.
- `calendar-governance.ts`: mutações novas (período add/remove/reorder/move, grupo CRUD/reorder, regra set/toggle, documentConfig set), todas pela guarda única com auditoria; validações estruturais (datas invertidas, fora do ano, ID duplicado, grupo inexistente).
- `calendar-pages.tsx`: dividir em abas/componentes; todos os números via `useMemo(() => deriveCalendarProjection(cal))`.
- `calendar-document.tsx`: renderiza só `projection.documentData`.
- `calendar-queries.ts` e `calendar-assessment-link.ts`: consumir a projeção.
- Testes antigos ajustados sem mudar o significado; ao fim: vitest, tsgo, eslint, build; relatório final com os 13 itens pedidos. Não iniciar a próxima etapa.
