# NCIECE.FINAL.2 — Censo oficial, Qualidade, Mapa e relatórios

Situação atual: Registro de lote.

- Censo × base: `census_official_reconciliation(knownAt)` (0270/0271, SECURITY INVOKER) compara os 55 recibos Educacenso 2026 com turmas, matrículas (vínculos aluno × turma, semântica do recibo) e alunos. Conferência direta no banco: 55/55 escolas coincidem em matrículas (10.295) e alunos (9.811). A Qualidade mostra por escola: oficial, base, diferença, cobertura, emissão/fonte e classificação (coincide, diverge, recibo sem o dado, base não legível). Classificação é projeção, nunca gravada.
- Mapa no gerador: fonte `gerador-mapa` (versão vigente de cada Mapa gravado; estrutura I–VI; Remanejados; situação; versão; calculado × efetivo × ajustado). Hoje não há Mapa gravado (0 Mapas, 0 regras), então a fonte sai vazia de forma honesta.
- Movimentos: o acervo (docs de memória, Mapa final) só traz os rótulos Recebidos/Transferidos/Evadidos/Desistentes, sem semântica institucional nem tipos homologados (`movement_type_definitions` vazio). Nada foi inventado: o grupo mostra "Regra ainda não homologada".
- Regra do Mapa: botão "Preencher modelo-base do acervo" no editor (fotografia no último dia letivo; Remanejados próprio). Registrar é ato humano; homologar exige outra pessoa (segregação existente). HOMOLOGACAO_PENDING.
- Correção cadastral: a estação CIECE (BQ.1 v4) já tem `manter-identidade-cadastral-do-estudante`, `manter-regra-de-competencia-do-mapa`, `conferir/oficializar/corrigir-mapa-estatistico`, `preparar/conferir-censo-escolar`, `gerir-importacao-de-dados`, `revisar-qualidade-dos-dados`; nenhuma capability nova foi concedida.
- Packs CIECE ligados: Mapa consolidado, Qualidade e cobertura, Censo × snapshot.
