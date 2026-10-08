# NPAG.1 — listas e tabelas de grande volume

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Em conflito, prevalecem os `AGENTS.md`.

## Bugs técnicos corrigidos
- **Corte silencioso em 1000 linhas:** o servidor de dados devolve no máximo 1000 linhas por requisição. Leituras com `.limit(5000/20000/50000)` contavam errado acima disso. Agora usam `readPages` (`src/lib/list-paging.ts`), com ordem estável por `id` e sinal `truncated`. Trocado em: indicador "matrículas vigentes" e "lotações vigentes" (dashboards), vida funcional, transporte e infraestrutura da rede. No limite, o indicador fica "não disponível", nunca parcial.
- **Seleção atravessando página:** em `DataGrid`, "marcar todos" substituía e "desmarcar" apagava a seleção de outras páginas. Agora `toggleVisibleSelection` só mexe nas linhas visíveis.
- **Turmas (sessão real):** ordenação estável (nome + id), paginação de 50 com contagem "1–50 de N", busca persistente na aba, estado vazio que distingue "sem turmas" de "nada corresponde à pesquisa", `aria-busy` e legenda acessível.

## Já conformes (conferido)
- Auditoria: paginação de 25, contagem e limite por fonte (NAUD.2).
- Relatórios: leitura paginada no gerador (NREL.2/NEXP, 12.345 linhas sem perda).
- Prontidão 2027: leitura em páginas de 1000.

## Pendências
- PENDENTE: listas de alunos e profissionais com sessão real ainda passam por telas próprias sem paginador comum; as listas de demonstração usam `DataGrid`.
- PENDENTE: CIECE com sessão lê por readers agregados (sem lista nominal grande); laboratório é demonstrativo.
- REVISAR: `anomaly-sources`, `teacher-assessment/authoring-source`, `diary-overview-page`, `planning-source`, `diary/infant-draft-cloud` ainda usam `.limit(>1000)`; trocar por `readPages` quando a tabela tiver ordem estável comprovada.
- INTERACTIVE_BROWSER_VALIDATION_PENDING.

## Testes
`src/lib/list-paging.test.ts`: 12.345 linhas sem perda nem repetição, desempate estável, página fora do intervalo, contagem honesta, seleção por página, leitura além de 1000 e erro ≠ vazio.
