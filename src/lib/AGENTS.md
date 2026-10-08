## Formatação (NFORMAT.1)
- Números/percentuais/plurais só por `format-ptbr.ts` e datas por `academic-date.ts`, porque cópias locais divergiam entre tela e PDF.
- Filtros de lista: opções na URL só via `useListUrlFilters` (`src/lib/list-url-state.ts`); busca livre só na sessão, porque contém nomes de pessoas.
- Telas chamam funções do banco por `callRpc` (`rpc-call.ts`), nunca helper local, porque 17 cópias idênticas divergiriam.
