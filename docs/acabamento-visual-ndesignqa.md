# NDESIGN.QA — Revisão de acabamento visual

**Situação atual:** Registro de lote (2026-10-08).

Comparação lado a lado de 19 telas em 4 tamanhos (rotina `scripts/visual-regression.py`, sem sessão).

Corrigido:
- Barra superior mostrava "SIGEM" em Acompanhamento de diários, Autorizações da família, Carteirinhas e Preparação 2027; agora mostra o nome da tela (`pageTitleForPath`).
- Quadro "Você está em" faltava em Inclusão, Família, Acompanhamento de diários, Autorizações da família, Carteirinhas e Preparação (`route-guides.ts`).
- Mapa Estatístico sem login usava cartão estreito diferente das demais telas; agora usa o mesmo aviso centralizado.

Resultado: 76 capturas, 0 achados automáticos. Pendente: telas com login real (INTERACTIVE_BROWSER_VALIDATION_PENDING).
