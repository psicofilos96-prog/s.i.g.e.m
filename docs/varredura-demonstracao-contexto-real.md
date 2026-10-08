# Varredura: demonstração × contexto real (2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Regra: com sessão, só dado do banco; demonstração apenas sem sessão (laboratório), via `ClassRouteGate` / `useSessionUser` / `sessionActor`.

## Corrigido
- `/` (início): com sessão some "Contexto demonstrativo", o texto demonstrativo e os "Registros demonstrativos A/B/C"; aparece estado vazio honesto. Indicadores já eram "—".
- `/regras-avaliativas/*`: usava regras e autores de fixture sem checar sessão. Com sessão agora mostra estado vazio; as fixtures ficam só sem sessão.
- Teste guarda: `src/routes/real-context-demo.test.ts`.

## Conferido sem mudança
- Painéis (`executive-dashboard-page.tsx`), Busca global (`global_search`, RLS) e Gerador de relatórios: só leem o banco; sem linha ⇒ "Nenhuma linha visível à sua conta".
- Orientação, Conselho, Situação acadêmica, Percurso do estudante, Projeções: demonstração só no ramo sem sessão.

## Pendente
- Tela real de regras avaliativas da rede (hoje vazia com sessão) — PENDENTE.
- Varredura linha a linha das 210 rotas foi por amostragem além dos achados acima — REVISAR.
- Conferência com login real — INTERACTIVE_BROWSER_VALIDATION_PENDING.
