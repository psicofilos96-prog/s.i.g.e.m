# NQA.1 — Simulação operacional integrada (estado em 2026-10-07)

Situação: **sem PASS**. A simulação ponta a ponta com fixtures efêmeras no banco NÃO foi executada neste lote.

## Por que não foi executada
- O acesso ao banco disponível nesta sessão é só leitura e não pode executar as funções do banco (`permission denied for function has_capability`). Os writers canônicos (matrícula, enturmação, remanejamento, transferência, carteirinha etc.) são funções SECURITY DEFINER; sem executá-las não há como montar o cenário pelos mesmos caminhos da tela.
- Gravar linhas diretamente nas tabelas contornaria os writers e as capabilities, o que este lote proíbe ("nenhuma capability afrouxada").
- O que falta: executar como pessoa natural real (ou em transação que termina em RAISE) os roteiros por módulo que já existem em `supabase/tests/*_e2e.sql`, encadeando-os num único cenário.

## O que foi verificado
- Suíte completa: 345 arquivos / 3967 testes PASS. Typecheck limpo.
- Roteiros por módulo que já existem (cada um termina em RAISE, nada persiste), mas não foram re-executados agora: avaliação (aa2), acompanhamento (ab2), família (ac2), indicadores de rede (ad2), Secretaria (af), Censo (ag), inclusão (ah), alimentação (ai), comunicação (aj), gestão escolar (ak), supervisão (al), perfil da escola (aq).

## Módulos que entrariam no cenário, e o estado de cada um
| Módulo | Pronto para simular? |
|---|---|
| Secretaria (matrícula → enturmação → remanejamento → transferência → renovação) | Sim (backend) |
| Docente: agenda/próxima aula | Só leitura pura; chamada/registro existentes |
| SIPE/SIA docente e OP | Não construídos |
| Avaliação: ciclo | Sim (0227); importação/agregados não ligados |
| Inclusão: fila de termos | Sim, mas sem revisor atribuído (ASSIGNMENT_PENDING) |
| AEE/mediador/PEI | Backend parcial; telas não construídas |
| Carteirinha | Sim, mas sem emissor atribuído (ASSIGNMENT_PENDING) |
| Autorizações/portaria | Não construídas |
| Mapa/Livro/Censo | Sim (leituras e ciclo do Censo) |
| Transporte/infra/relatórios de apoio | Não prontos — fora do cenário |

## Não rodados
deep 31/31, build, security scan, prova de zero resíduo.
