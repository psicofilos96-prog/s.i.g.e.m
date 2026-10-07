# NSEARCH.2 — Busca global e avisos

## Busca
- O banco (`global_search`, RLS de quem pesquisa) decide escola e capability; nada é lido para filtrar depois.
- Conta de setor: só aparecem resultados cujo destino pertence à estação (ex.: CIECE não vê estudantes nem turmas). O filtro só reduz.
- Conta humana (inclusive administrador geral): vê o que suas capabilities permitem no banco.
- Sem resultado: "Nenhum registro ao seu alcance" — mesma resposta para inexistente e fora do escopo.

## Avisos (`/avisos`)
- Só eventos já emitidos pelos módulos; a tela não cria evento.
- Filtros: tipo (Devoluções, Aprovações, Prazos, Pendências, Documentos, Outros — pelo tipo do evento) e situação (lidos/não lidos).
- "Abrir destino" revalida o acesso no banco; acesso revogado bloqueia o link.

## Testes
`src/features/notifications/nsearch2.test.ts`: escopo por estação (Secretaria × CIECE), Admin transversal por capability, resultado sem destino oculto, categorias, filtros lido/não lido, tela sem escrita.

## Pendente
A/B com login real (escola A não vê escola B), Admin transversal logado e celular com login = INTERACTIVE_BROWSER_VALIDATION_PENDING.
