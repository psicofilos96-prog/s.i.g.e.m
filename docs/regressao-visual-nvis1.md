# Regressão visual headless — NVIS.1

**Situação atual:** Registro de lote (2026-10-08).

## Rotina
`python3 scripts/visual-regression.py [url] [saída]` — 19 telas × 4 tamanhos (1440×900, 1366×768, tablet 820×1180, 390×844) = 76 capturas + `report.json`. Detecta rolagem horizontal, elemento cortado à direita (fora de áreas com rolagem própria), "Carregando" preso após 2,5 s, erro de página e tela quase vazia.

Telas: início, login, alunos, turmas, unidades, calendário escolar, relatórios, horários, diário, alimentação, carteirinhas, autorizações da família, acompanhamento de diários, família, inclusão, secretaria, mapa estatístico, verificação de carteirinha, rota inexistente.

## Baseline (sem login)
76 capturas, 0 achados automáticos após a correção abaixo. Telas que exigem login mostram aviso "Entre para…" (estado de ausência correto, não vazio).

## Diferença corrigida
- Tablet (768–1023 px): o título da página ficava cortado ("Cale…", "Secr…", "Inclu…") porque a busca larga e o seletor de unidade ocupavam a barra. Agora a busca vira ícone até 1024 px e o seletor fica com no máximo 10rem nessa faixa. Desktop e celular inalterados.

## Pendente
- INTERACTIVE_BROWSER_VALIDATION_PENDING / harness por estação: com login real, as telas internas de cada setor não foram fotografadas (chave técnica do harness indisponível nesta sessão). Rodar o mesmo script com sessão restaurada pelo `harness-gate`.
- Inclusão não mostra o cartão "Você está em" como as demais (observação, não regressão).
