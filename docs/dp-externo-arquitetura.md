# DP — fronteira do SIGEM

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Atualização: decisão N12.1: DP administrativo é do SIGEM (fora só folha/previdência/pensão/consignações); a fronteira "DP externo" descrita aqui é histórica.


> **Correção N12.1 (2026-10-07), prevalece sobre o texto abaixo:** o DP administrativo é do SIGEM (vínculos, lotações, atos, eventos, férias/licenças, designações e PAD). Ficam fora só folha de pagamento, previdência, pensão e consignações. O texto da Frente BC abaixo é histórico.

## Histórico — Frente BC (2026-10-06)

Decisão institucional vigente: RH/DP **não** é módulo operacional do SIGEM.

| Papel | Quem |
|---|---|
| Autoridade funcional | Departamento Pessoal externo (sistema próprio) |
| Fronteira de integração | Planilha oficial periódica do DP |
| SIGEM | staging → validação → diff → versionamento → aplicação governada → consumo educacional |

O SIGEM não administra vida funcional.

## Contrato da planilha
DP_FILE_CONTRACT_PENDING / BLOCKED_BY_SOURCE_FILE. Nenhuma coluna é presumida (`dp-quadro-funcional` recusa parse).
Até se saber se o arquivo é snapshot completo ou delta, ausência de pessoa **não** significa desligamento.

## Separação obrigatória
pessoa permanente ≠ vínculo funcional ≠ lotação administrativa ≠ presença educacional (`school_staff_presence`) ≠ atribuição/regência.
Regência, turma, componente, horário e carga curricular nunca são inferidos do DP.

## Legado preservado
Atuação `rh-profissionais-da-rede`, capability `manter-registro-funcional`, tabelas `professional_*` (0076/14.12) e a rota
`/departamento-pessoal` ficam por compatibilidade histórica; a rota é só consulta. Migrations e políticas homologadas não foram
reescritas. Nenhum desses itens é perfil operacional futuro.

## GPE
Não há decisão institucional de arquivo GPE. Fica EXTERNAL_INTEGRATION_UNDEFINED (sem contrato), fora das listas de arquivos aguardados.

## N11.2.2 parte 2 (2026-10-07)
- /departamento-pessoal ganhou "O que precisa de atenção (próximos 30 dias)": só términos DECLARADOS de vínculo/lotação (vencidos ou em até 30 dias); nada calculado; probatório/quinquênio/aposentadoria/acúmulo = DEPENDE_DECISAO. Descrição da página corrigida (DP administrativo no SIGEM).
- Pendentes: transporte, infraestrutura, construtor de documentos, assistente de relatórios, UX NAE. Não passou: SUPPORT_MODULES_IMPLEMENTABLE_CORE_COMPLETE.
