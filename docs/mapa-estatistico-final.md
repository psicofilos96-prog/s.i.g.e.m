# Mapa Estatístico — NMAP.FINAL.1 (Remanejados e I–VI)

**Situação atual:** Registro de lote — parcial (PASS — STATISTICAL_MAP_FULLY_OPERATIONAL não declarado).

## Entregue
- `src/features/statistical-map/map-movements.ts`: Estrutura IV com cinco grupos explícitos (Recebidos, Transferidos, Evadidos, Desistentes/Cancelados, Remanejados). Cada evento cai em exatamente um grupo; tipo mapeado para dois grupos vira conflito e não é contado. Remanejamento interno vem do encerramento canônico `reason_label = 'remanejamento'` (writer `secretariat_reassign_class`); entre unidades, por tipo homologado declarado na regra; encerramento + movimento do mesmo aluno/dia contam uma vez.
- Grupos 1–4 só contam com tipos homologados mapeados em `structureIVGroups` da regra da competência; sem mapeamento ficam "sem regra" (nunca zero).
- Remanejados explica e não altera o total. Nova célula "Reconciliação II × IV": anterior herdado + recebidos − transferidos − evadidos − cancelados + saldo de remanejamentos entre unidades = matrícula atual (estado canônico); divergência é exibida, não corrigida.
- Montagem do servidor lê movimentações e encerramentos com a sessão do usuário (RLS); falha vira fonte não lida.
- PDF oficial já existente passa a trazer os cinco grupos na Estrutura IV, com valor calculado e motivo do ajuste visíveis.
- Já existiam e continuam: fluxo rascunho → enviar → aprovar/devolver → reenviar → aprovado (snapshot imutável) e retificação; ajuste auditável da CIECE com calculado × ajustado × motivo; herança travada do mês anterior; mediadores lidos de `map_mediation_projection_at`; regentes; visitas.
- 12 testes novos; 100 testes do Mapa passam.

## Por que o Mapa ainda não opera de ponta a ponta
- MAP_RULE_PENDING: não há nenhuma regra de competência (`map_competence_rules` = 0). Sem regra homologada o Mapa não define data, células nem herança.
- MOVEMENT_TYPES_PENDING: `movement_type_definitions` vazio — grupos 1–4 não podem contar.
- ENROLLMENT_EPISODES_2026_PENDING: 0 enturmações; matrícula por turma em 2026 e remanejados ficam vazios.
- MAP_REPORTS_PENDING: Mapa ainda não é assunto do gerador universal.
- Testes autenticados (duas escolas, CIECE rede, Direção leitura) não executados; PDF não rasterizado.
