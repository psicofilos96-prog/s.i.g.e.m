# Supervisão Escolar — produto (NSUP.1)

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
