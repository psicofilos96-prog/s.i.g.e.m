# NQA.1 — Simulação operacional integrada (estado em 2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


> Atualizado por NQA.2: ver `docs/relatorio-interoperabilidade-nqa2.md` (simulação autenticada executada, 39/39).

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

## Reexecução 2026-10-07
- Bloqueio mantido: acesso ao banco nesta sessão só lê; gravação disponível roda sem pessoa autenticada, então os writers canônicos (que exigem pessoa natural + capability) recusariam, e gravar tabelas diretamente contornaria writers/capabilities (proibido). Nenhum dado criado; contagens antes = depois por construção.
- Suíte completa: 3977 de 3978 testes passaram; 1 falhou (instável entre execuções; a primeira execução passou inteira).
- Para destravar: sessão de teste autenticada como pessoa real com as capabilities setoriais, ou executar o roteiro por um runner no servidor com identidade de teste dedicada.
