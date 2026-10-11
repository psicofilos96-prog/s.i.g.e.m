# Secretaria Escolar por unidade — Lote 01: auditoria e arquitetura

**Situação atual:** Registro de lote.

Evidência em 2026-10-11 22:20 UTC. Documento-base: "SIGEM — Secretaria Escolar: tudo o que foi pedido, decidido e combinado" (arquivo enviado, 18 seções). O documento de 34 seções citado no pedido não está nos uploads.

## Política de capacidades
A política homologada vigente é a **v8** (a memória "v1/v2 draft" está superada). Tipos de atuação com regras: secretaria-escolar (37), direcao-escolar (36), ciece-estatistica (5), cadastro-institucional-da-rede (13), entre outros.

| Papel | Tipo de atuação | Situação |
|---|---|---|
| Secretário | secretaria-escolar | núcleo do documento coberto (aluno, matrícula/enturmação, turmas, movimentação, Mapa) |
| Auxiliar de secretaria | **não existe** | lacuna; nunca herda do secretário por cargo — exige nova versão homologada da política |
| Direção | direcao-escolar | não edita aluno nem matrícula (conforme documento); oficializa Mapa; mantém atribuição docente e grade |
| Supervisão | por designação explícita (fora da política) | conforme memória do projeto |
| Estatística | ciece-estatistica + cadastro-institucional-da-rede | leitura analítica; criação de contas pelo cadastro da rede |

**Divergência registrada, não alterada:** a secretaria-escolar tem `consultar-frequencia`, `consultar-resultado-avaliativo` e `consultar-parecer-descritivo`; o §1 do documento diz que a Secretaria não acessa o painel de Rendimento/Frequência. Os documentos oficiais (declarações, histórico) dependem dessas leituras, então retirar exigiria decisão da rede.

## Falhas reais corrigidas (lotes de Direção)
Três nomes de capacidade inventados nos núcleos da Direção não existiam na política e recusariam toda decisão:
- `enturmar-estudantes` → `manter-matricula-e-enturmacao`
- `atribuir-docente` → `manter-atribuicao-docente`
- `manter-vida-funcional` → `manter-registro-funcional` (rh-profissionais-da-rede)

## Reuso (sem duplicar)
estudante → matrícula → participação → alocação → posição curricular histórica, writers `secretariat_*`, documentos `emit_school_document_v3`, Tabelas SEMED, Livro e vagas já existem (ver `src/features/school-secretariat/AGENTS.md`). Nenhuma estrutura nova foi criada.

## Não feito
- Migrations e RLS: nenhuma alteração (RLS por escola e função já passa por `has_school_capability` sobre a política homologada).
- Logs: a trilha existente (central de auditoria por projeção dos ledgers) não foi alterada.
- Testes autenticados: não executados (portão de contas sintéticas desligado).
