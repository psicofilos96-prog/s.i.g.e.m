# NNAV.2 — Continuidade de navegação e contexto

## Situação atual
Classe: Registro de lote (2026-10-08). Nenhuma permissão alterada.

## Verificado (navegador automático, sem login, 1280 px e 390 px)
- 9 links diretos (alunos, turmas, unidades, grades, calendário, matrizes, relatórios, vagas, rota inexistente) abrem e sobrevivem a recarregar; rota inexistente mostra "Página não encontrada".
- Voltar do navegador retorna à página anterior; filtro na URL (`/alunos?q=ana`) permanece após recarregar.
- Sem erros de página.

## Corrigido
- Trilha de navegação (`OperationalHeader`): para conta de setor, o nível intermediário só vira link se a estação permitir o destino; senão aparece como texto (nunca link para área sem acesso).
- Menu: item ativo anuncia `aria-current="page"` (antes só a cor indicava).

## Conferido sem mudança
- Escola/ano escolhidos nas telas ficam na própria tela ou na URL; o menu e a busca já respeitam a estação (NPERM.3/4).

## Pendências
- NOT RUN: harness com login por estação/escola (credencial técnica indisponível); rascunhos ao voltar só verificados no código (Diário e matrícula guiada guardam rascunho próprio).
- INTERACTIVE_BROWSER_VALIDATION_PENDING.
