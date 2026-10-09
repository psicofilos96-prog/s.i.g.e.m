# N2026.REFERENCE.2027 — 2026 como referência da preparação de 2027

## Situação atual (2026-10-09)
- Classe: **Referência vigente**. Implementado em `src/features/year-preparation/prior-year-reference.ts` e na seção "Referência 2026" de `/preparacao-2027`.

## Regra
- Leitura só com a sessão do usuário (RLS), `knownAt` capturado uma vez por abertura e exibido: a consulta de 2026 continua reproduzível depois de 2027 configurado.
- Comparação lado a lado: 2026 registrado | 2027 (não configurado / registros próprios). Cadastro e infraestrutura das escolas não têm ano: o mesmo registro serve aos dois.
- "Usar como ponto de partida" só abre a ferramenta do domínio. Nenhum domínio tem hoje writer governado de rascunho a partir de 2026; por isso nada é criado.
- Nunca criado a partir de 2026: matrícula, enturmação, frequência, nota, transferência, professor atribuído, lotação vigente, turma, jornada, calendário, regra, ato, homologação.
- Leitura negada/erro aparece como tal, nunca como zero; 2026 nunca deixa item de 2027 pronto.

## Valores de 2026 conferidos (2026-10-09)
55 escolas · 698 turmas · 9.811 matrículas · 1.057 profissionais · 55 recibos do Censo · 0 lotações · 0 jornadas de turma.

Testes: `prior-year-reference.test.ts`.
