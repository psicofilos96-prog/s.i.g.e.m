# Supervisão Escolar — produto (NSUP.1)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Estação: `/supervisao-escolar`. Nenhuma capability nova; nenhuma decisão alterada; 2027 não configurado.

| Ferramenta | Página dona | Estado técnico |
|---|---|---|
| Home "o que depende da Supervisão" | `/supervisao-escolar` (`supervision-home.ts`) | COMPLETO_TECNICAMENTE |
| Calendários e publicações | `/calendario-escolar` | COMPLETO_TECNICAMENTE (construir/homologar pela conta Supervisão) |
| Matrizes curriculares | `/matrizes-curriculares` | Consulta completa; homologação = ASSIGNMENT_PENDING (R5) |
| Catálogos institucionais | `/administracao` | Consulta; manutenção só com `manter-catalogos-institucionais` |
| Preparação do ano letivo | `/preparacao-ano` | Somente leitura; abrir 2027 fora de escopo |
| Escolas / pendências | `/supervisao-escolar` | COMPLETO_TECNICAMENTE (5 naturezas, sem ranking) |
| Relatórios | `SUPERVISAO_ACOMPANHAMENTO` via motor | COMPLETO_TECNICAMENTE (CSV pelo motor) |
| Histórico de atos | `/auditoria` | Consulta; exportação = ASSIGNMENT_PENDING (`exportar-auditoria`) |
| Registros de acompanhamento | `record_school_supervision` | Writer pronto; capability sem política = ASSIGNMENT_PENDING |

Estado de cada ferramenta vem só das capacidades efetivas (`toolState`); a tela nunca concede ação.
Testes: `supervision-home.test.ts` (negativa de perfil escolar, exportação pendente, relatório só consulta).
Pendente: INTERACTIVE_BROWSER_VALIDATION_PENDING para PDF/tela com login.

## Rodada 2 (2026-10-07)
- Home ganhou "Publicações" (/publicacoes, age só com `publicar-conteudo-publico`) e "Regras institucionais homologadas" (/regras-institucionais, só consulta). Total: 9 ferramentas.
- Testes: toda ferramenta aponta para página existente; perfil escolar e sessão sem capacidades nunca ficam "pode-agir" (13/13).
- Gates: suite completa 4.027/4.027; deep 31/31; auditoria SQL ok; integridade de migrations ok.
- ASSIGNMENT_PENDING: homologar matrizes, exportar histórico (`exportar-auditoria`), registros de acompanhamento da Supervisão.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: relatórios/PDF com login real.

## NTEST.3 (2026-10-08)
- Total atual: 10 ferramentas em `SUPERVISION_TOOLS` (inclui Pendências de configuração e Relatórios). Menus, rotas, export e writer cobertos em `src/test/harness/ntest3-stations.test.ts` (camada static). Camada autenticada: ASSIGNMENT_PENDING (sem tipo de atuação na política v8).
