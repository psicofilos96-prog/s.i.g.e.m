# NDATE.1 — datas, horários e fuso

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Em conflito, prevalecem os `AGENTS.md`.

## Regra
- Data civil (dia letivo, vigência, matrícula) é `YYYY-MM-DD` sem fuso; aritmética só em UTC sobre a string (`addDays`, `eachDate`), nunca pelo fuso da máquina.
- "Hoje" da rede = `operationalToday()` (America/Sao_Paulo).
- Instante (timestamptz) é exibido em America/Sao_Paulo por `formatDateTime` ou `toLocale*String("pt-BR", { timeZone: "America/Sao_Paulo" })`.
- Vigências: início e fim inclusivos nas datas civis (já padronizado no NTEMP.1); nada alterado.

## Bugs técnicos corrigidos
- `formatDateTime` usava -3h fixo: hora errada em instantes do horário de verão histórico (até 2019). Agora usa Intl com America/Sao_Paulo.
- Alimentação escolar: "hoje" e limites do mês vinham de `toISOString()` (dia seguinte após 21h). Agora usam `operationalToday()` e componentes locais.
- 61 exibições de instantes em 47 arquivos dependiam do fuso do navegador ou servidor; passaram a fixar America/Sao_Paulo. Números formatados não foram tocados.

## Testes
`src/lib/academic-date.ndate1.test.ts`: virada de dia após 21h, virada de ano, horário de verão de 2018, virada de mês e ano bissexto.

## Pendências
- REVISAR: rotinas de banco com `current_date` em migrations congeladas (herdado do NTEMP.1).
- INTERACTIVE_BROWSER_VALIDATION_PENDING.
