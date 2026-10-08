# NTEMP.1 — Auditoria de consistência temporal (2026-10-08)

## Achado corrigido (gap técnico inequívoco)
40 telas/funções calculavam "hoje" com `new Date().toISOString().slice(0,10)`, que é o dia **UTC**.
Entre 21h e 24h de Brasília isso devolvia o dia seguinte, deslocando `asOf`/`validOn`/`knownAt`
de leituras (Secretaria, Vagas/Livro, Calendário, Inclusão, Transporte, Supervisão, Acessos,
Regras institucionais, CIECE, Assistente, Pendências etc.). Agora todas usam
`operationalToday()` (`src/lib/academic-date.ts`, fuso `America/Sao_Paulo`).
Nenhum fato oficial foi reescrito; nenhuma migration nova.

## Já consistente (sem mudança)
- Alunos, matrículas, turmas, vínculos profissionais, calendário, documentos e regras leem por
  readers bitemporais (`*_at(validOn, knownAt)`), com versões append-only e cabeça esperada.
- Aritmética de dias (`addDay`, expansão de grade) é feita em UTC sobre datas ISO puras — correta.
- Avaliações e fechamentos guardam `usedEntryVersions`/regra histórica: leitura reproduzível.
- Horários e Calendário já usavam hoje operacional local.

## Testes de fronteira
`src/lib/temporal-boundaries-ntemp1.test.ts`: 23h30/00h00 de Brasília, virada de ano, 29/02,
início/término inclusivos, e varredura que falha se o cálculo UTC de "hoje" voltar.

## Pendências
- REVISAR: funções SQL que usam `CURRENT_DATE` dependem do fuso do banco (UTC); não alteradas
  (migrations congeladas, efeito só em defaults) — avaliar em lote próprio.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferir telas após 21h com login real.
