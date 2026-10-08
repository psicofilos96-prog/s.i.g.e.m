# NPERM.3 — Menu × rotas × capacidades

## Situação atual
Classe: Registro de lote (2026-10-08). Política de capacidades inalterada.

## Como está
- Conta de setor: menu, busca e conteúdo da rota passam por `stationAllowsPath`; deep link fora da estação mostra "Esta página é de outro setor" (`StationGate`) — o bloqueio não depende do menu.
- Administração Geral: link só por `general_admin_session()`.
- Conta humana: o menu mostra as telas e o banco filtra os dados (RLS/DEFINER) e recusa gravações; telas com ação exigem a capacidade (ex.: Publicações, calendário da Supervisão, pendências, assistente).

## Corrigido
- "Publicações" aparecia para quem não podia publicar (a tela inteira recusa). Agora o menu usa a mesma capacidade da tela (`src/features/authority/nav-capabilities.ts`); deep link continua recusado pela tela e pelo banco.
- Teste `nav-capabilities.test.ts`: regra de menu = capacidade da tela, todo item de menu tem rota real, deep link entre estações, estação desconhecida recusada.

## Pendências
- DEPENDE_DECISAO: catálogo rota → capacidade de leitura para contas humanas. Hoje a maioria das telas não tem capacidade de leitura própria (os dados vêm filtrados pelo banco); esconder essas opções exigiria definir a regra, o que é decisão de política.
- PENDENTE (teste de perfis com login): os 69 perfis exigem credencial técnica privilegiada, indisponível nesta sessão; rodou só a parte sem login.
- INTERACTIVE_BROWSER_VALIDATION_PENDING.
