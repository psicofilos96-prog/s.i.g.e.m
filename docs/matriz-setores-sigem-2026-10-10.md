# Matriz de setores do SIGEM — Lote A (10/10/2026)

**Situação atual:** Registro de lote. Fotografia do código e do banco Lovable Cloud em 10/10/2026; não é fonte normativa.

Legenda: **Implementado** = telas e gravação existem no código; **Verificado** = há dado real no banco e teste/consulta conferiu; **Parcial** = existe, mas falta dado, atuação ou fluxo; **Ausente** = não existe.
"Verificado em sessão" ainda não vale para nenhum setor: não houve conta de escola/setor real autenticada nos testes.

| Setor | Telas (rotas) | Dados reais no banco | Situação | Bloqueio real |
|---|---|---|---|---|
| Docente (Diário) | `/diario/*` (35 rotas), `/meus-diarios` | turmas 698, enturmações 10.295; registros de frequência 0, avaliações 0 | Implementado · Parcial | Só 2 atuações institucionais no banco: nenhum professor tem turma atribuída, então não há diário em uso |
| Secretaria | `/secretaria*`, `/matriculas`, `/transferencias` | matrículas 9.811; movimentações 0 | Implementado · Verificado (leitura) | Sem movimentação datada de 2026 (fonte do Censo não traz datas) |
| Orientação Pedagógica (OP) | `/orientacao`, `/atuacoes-pedagogicas` | casos 0 | Implementado · Parcial | Sem atuações de OP atribuídas |
| Direção | `/direcao`, `/gestao-escolar` | projeção de fontes canônicas | Implementado · Parcial | Sem atuações de direção vigentes no banco |
| Mediador | `/inclusao` (mediação) | registros de inclusão 0, AEE 0 | Implementado · Parcial | Dados de inclusão não importados (exigem política de supressão) |
| Supervisão | `/supervisao-escolar` | registros 0 | Implementado · Parcial | Capacidade de registrar acompanhamento sem política atribuída |
| Estatística / CIECE | `/ciece`, `/mapa-mensal-2026`, `/mapa-censo-2026`, `/censo-escolar` | 440 mapas declarados de 55 escolas; Censo 55/55 | Implementado · Verificado (leitura técnica) | Meses de 2026 não apurados por falta de evidência datada; nenhuma regra do Mapa homologada |
| Alimentação / NAE | `/alimentacao-escolar`, `/alimentacao-escolar/cozinha` | todas as 27 tabelas de alimentação vazias | Implementado · Parcial | Documentos de referência recebidos aguardam comando; sem cozinhas, cardápios ou atuações cadastradas |
| Acompanhamento / Avaliação | `/acompanhamento-avaliacao`, `/acompanhamento-diarios`, `/avaliacao-desempenho` | 0 lançamentos | Implementado · Parcial | Depende do Diário em uso |
| NEI (Educação Inclusiva) | `/inclusao`, `/paineis` | 0 | Implementado · Parcial | Mesmo bloqueio do Mediador |
| DP administrativo | `/departamento-pessoal`, `/profissionais/*`, `/pessoal-2026`, `/conciliacao-pessoal` | vínculos funcionais 551, registros administrativos 2.016, lotações 0 | Implementado · Parcial | Lotação e atuação exigem identificação humana; nada é criado por nome |
| Família | `/familia`, `/autorizacoes-familia` | autorizações de responsável 0 | Implementado · Parcial | Sem vínculo responsável↔estudante comprovado |
| Transversal: início por perfil | `/` | — | Implementado neste lote | Atalhos filtrados por perfil; avisos e tarefas lidos com a sessão; falha aparece como "Não foi possível ler" |
| Transversal: avisos, tarefas, calendário | `/avisos`, `/tarefas`, `/calendario-escolar*` | 25 versões de calendário; 0 tarefas; 0 avisos | Implementado · Parcial | Sem eventos emitidos enquanto não houver uso real |

## Rede: urbana, rural e conveniada
- A rede vem do cadastro da escola em duas dimensões: localização (urbana/rural) e dependência (municipal/conveniada).
- Cadastro atual: 27 municipais urbanas, 13 municipais rurais, 14 conveniadas urbanas e 1 conveniada rural (15 conveniadas).
- A conveniada rural aparece em "Conveniada" e em "Zona rural"; nunca é excluída por pertencer às duas. Classificação ausente fica "não classificada", sem presumir.

## O que não foi feito neste lote
- Não foram criados vínculos, atuações ou acessos: a falta de atuações é o principal bloqueio de todos os setores.
- Não houve teste com conta real de escola ou setor.
