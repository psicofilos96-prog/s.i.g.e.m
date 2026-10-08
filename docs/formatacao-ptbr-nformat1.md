# NFORMAT.1 — Formatação pt-BR

## Situação atual
Classe: Referência vigente (2026-10-08). Só apresentação; nenhum valor armazenado mudou.

## Regra
- Números, percentuais, contagens, plurais, listas e competência: `src/lib/format-ptbr.ts`.
- Datas e horas: `src/lib/academic-date.ts` (`formatDateTime`, Brasília, sem segundos), igual em tela e PDF.
- Ausente ⇒ "—", nunca "0". 1 é singular; 0 e demais, plural.

## Feito
- 20 exibições de data/hora em 17 arquivos passaram a `formatDateTime` (antes "dd/mm/aaaa, hh:mm:ss").
- Seis listas próprias de meses passaram a usar a lista única.
- "(s)" trocado por plural correto em início, Secretaria, Turmas, Censo e regras de situação; percentuais da alimentação e de anomalias com vírgula decimal.
- Testes: `src/lib/format-ptbr.test.ts` (milhar, decimais, zero negativo, ausente, 0/1/2, meses 0/13, virada de ano em Brasília).

## Pendências
- REVISAR: ainda há "(s)" em textos de explicação dos motores (avaliação, CIECE, trajetória) e alguns `toLocaleString` de números locais; migrar quando tocados.
- INTERACTIVE_BROWSER_VALIDATION_PENDING.
