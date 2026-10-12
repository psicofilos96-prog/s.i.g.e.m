# Lotes corretivos 32–36 — servidores, infraestrutura, testes e parâmetros (2026-10-12)

## Situação atual
- Classe: **Registro de lote**. Base analisada: `db3e6fa6`. Contagens lidas do Lovable Cloud em 2026-10-12.
- Nenhuma importação, atribuição, aprovação ou homologação foi feita neste lote.

## L32 — Servidores e vínculos
**Fontes:** os arquivos originais não estão no projeto nem nos envios desta conversa. Já estão em staging append-only (`staff_administrative_records`, INT.8), com hash e linha:
| Fonte | Linhas | Com matrícula | Com escola |
|---|---|---|---|
| Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx | 1.797 | 0 | 1.797 (1.389 nome exato, 408 alias declarado) |
| Relacao_Funcionarios_SEMED_por_Setor.xlsx | 219 | 219 | 0 (setor) |

**Banco antes = depois:** pessoas 10.822 · vínculos funcionais 551 (488 pessoas, 0 com matrícula) · lotações 0 · atuações 2.

**Confronto:**
- Planilha das escolas: 1.797 sem matrícula → sem chave → nenhuma correspondência possível (nome não identifica pessoa).
- Planilha da SEMED: 219 matrículas; 0 coincidem com matrícula de vínculo existente (nenhum vínculo tem matrícula) e não há identificador de matrícula nas pessoas.
- Inconsistências: 1 matrícula repetida na SEMED; 19 pares nome+escola repetidos; 61 linhas "Fora da lista" (exonerado/aposentado/saiu/cedido/remanejado), 1 "CONFERIR".

**Resultado:** 0 registros inequívocos → **0 importados**. As 2.016 linhas ficam rejeitadas com motivo individual reproduzível pela regra de `src/features/professionals/engagement-proposals.ts` (`sem-matricula-funcional` = 1.797; `matricula-sem-pessoa` = 219). Importação **não concluída**.
**Para destravar:** fonte do DP que ligue matrícula funcional a CPF ou INEP-pessoa (ou planilha das escolas com matrícula).

## L33 — Infraestrutura e jornadas
| Item | Situação |
|---|---|
| Recibos oficiais do Censo 2026 | 55 (só contagens de turmas/alunos; não trazem infraestrutura) |
| Observações de infraestrutura | 2.970 em staging; 54 versões de atributo |
| Confronto infraestrutura × Censo | **Corrigido no L37:** fonte oficial INEP 2026 de infraestrutura já importada (2.970 obs.); sem fonte concorrente para comparar |
| Jornadas | 0 jornadas, 0 grades. Nenhuma fonte de jornada recebida; nada inferido nem convertido em grade docente |
Divergências corrigíveis encontradas: 0. Matriz por escola × campo depende da fonte oficial ausente.

## L34 — Identidades técnicas
Mecanismo já existente e compatível: `scripts/harness-gate.mjs` + contas `@bo-fixture.invalid`, `bo_fixture_capability_grants` (escopo limitado, limpeza obrigatória). Resultados reproduzíveis anteriores: 29/29 (`lote12-authenticated-e2e.mjs`), 19/19 (`lote20-development-e2e.mjs`), resíduo 0. Não reexecutados nesta rodada.
Impedimento: caminhos positivos exigem dado de domínio (campanha, quadro de vagas, regra de numeração) que a fixture não pode criar sem inventar norma. Teste no navegador logado: não feito (sem sessão injetada).

## L35 — Perfis
| Perfil | Positivo | Negativo | Bloqueio |
|---|---|---|---|
| Secretaria/Matrículas | bloqueado | recusas provadas (L12) | 0 campanhas, permissões sem titular |
| Gestão de Pessoas | bloqueado | — | L32: 0 lotações |
| Docente/Mediador | bloqueado | — | 0 regências, 0 designações |
| NEI/Família | bloqueado | anônimo recusado (L29) | 0 papéis NEI, 0 vínculos responsáveis |
| Direção/Supervisão/OP | bloqueado | — | 2 atuações |
| Estatística/Relatórios | leitura | — | 75 emissões auditadas |
Defeitos reproduzidos: 0.

## L36 — Parâmetros aguardando decisão
| Questão | Opções | Consequência | Valor atual | Competência |
|---|---|---|---|---|
| 5 parâmetros de Matrículas (EI, idade EJA, distribuição, avisos, supressão) | cadastrar com ato / sem ato | sem valor: só publicar/retomar campanha é bloqueado | nenhum | SEMED (aprovar-parametros-de-matricula) |
| 7 decisões de Tecnologia (SLA, recorrência, categorias, rubrica, vida útil, limiar do mapa, mínimo do autosserviço) | valores a definir em `/tecnologia/decisoes` | sem valor: só cálculo dependente bloqueado | nenhum | gestão de TI da SEMED |
| Regra de numeração | por tipo/ano/unidade | sem regra: só numerar documentos bloqueado | nenhuma | SIGEM Documentos |
| Quadro de vagas | por escola/etapa/turno | sem quadro: só reserva bloqueada | nenhum | Secretaria/Organização da Rede |
| Titulares das 262 permissões | por atuação | sem titular: gravação recusada | 2 atuações | Proprietário/SEMED |
| Fonte do DP com matrícula↔pessoa | — | sem fonte: L32 parado | ausente | DP |
Inscrição, atendimento e registros obrigatórios continuam liberados (não dependem dessas decisões).
