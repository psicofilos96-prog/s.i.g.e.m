# DP externo — autoridade funcional (Frente BC, 2026-10-06)

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
