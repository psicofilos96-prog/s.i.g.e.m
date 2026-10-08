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

## NPERM.4 (2026-10-08) — revalidação pós-módulos
- Varridas as telas que recusam por inteiro: Publicações (já coberta), Diagnóstico (fora do menu; exige Administrador Geral), Integrações e Central de integrações.
- Corrigido: "Integrações" e "Central de integrações" apareciam para todos, mas o banco (`integration_require_admin`, 0091/0092) recusa sem `administrar-integracoes` em alcance de rede. O menu agora exige essa capacidade em rede (`NAV_NETWORK_SCOPE`); deep link continua recusado pela tela e pelo banco.
- Demais telas novas (Comunicação, Inclusão, Alimentação, Transporte, Acompanhamento, Painéis) mostram dados filtrados pelo banco e estado "sem acesso" — permanecem no menu (DEPENDE_DECISAO, igual NPERM.3).
- Matriz de permissões inalterada; nenhuma capacidade concedida.
- Testes negativos em `nav-capabilities.test.ts` (sem capacidade, capacidade só de escola, capacidade de rede).
- NOT RUN: harness por estação/escola com login (credencial técnica indisponível nesta sessão); INTERACTIVE_BROWSER_VALIDATION_PENDING.
