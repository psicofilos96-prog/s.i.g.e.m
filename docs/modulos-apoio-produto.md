# Módulos de apoio — produto

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


| Módulo | Estado |
|---|---|
| Alimentação/NAE | Motores NAE.0–8 preservados; título revisto |
| Transporte | Pendente de UX; sem coordenadas inventadas |
| Infraestrutura | Pendente |
| DP | Só consulta do DP externo (decisão vigente); vida funcional = DECISÃO PENDENTE |
| Construtor de documentos | Pendente: paginação de assinaturas longas |
| Relatórios | Central com título de tarefa; gerador pendente |
| Testes autenticados | Bloqueado: sessão indisponível |

## N11.2 — PARTIAL (CONTINUE_FROM=N11.2.1)
| Domínio | Situação |
|---|---|
| DP | Regras "O que precisa de atenção?" (só prazos declarados) e linha do tempo funcional em `src/features/professionals/functional-attention.ts`, testadas; tela PENDENTE. Probatório, quinquênio, aposentadoria e acúmulo: aguardando regra institucional (não calculados) |
| Transporte, Infraestrutura, Construtor, Relatórios passo a passo, Alimentação | PENDENTES neste lote |
Nenhum domínio declarado PASS.

## N11.2.1 (parcial)
- Documentação corrigida: DP administrativo está DENTRO do SIGEM (fora só folha/previdência/pensão/consignações); a nota antiga "DP externo" em `src/features/professionals/AGENTS.md` foi substituída.
- DEPENDE_DECISAO: probatório, quinquênio, aposentadoria, acúmulo.
- PENDENTE técnico: UI do DP sobre as projeções, transporte, infraestrutura, construtor de documentos, assistente de relatórios, UX final da Alimentação.

## N11.2.4 (2026-10-08)
- Transporte: relatório "rotas e pontos" (`TRANSPORTE_ROTAS`) no motor comum e na Central (`transporte-rotas-escola`, tela dona `/transporte-escolar`); CSV/PDF na tela, só contagem de vínculos (sem nome de estudante), rota sem ponto = "não disponível", fórmula neutralizada — FEITO (`transport-report.test.ts`).
- Home do DP (`/departamento-pessoal`): já existente (vida funcional + "O que precisa de atenção?"); sem mudança. Probatório/quinquênio/aposentadoria/acúmulo: DEPENDE_DECISAO.
- Infraestrutura: tela de cobertura por escola sem mudança; manutenção DEPENDE_DECISAO; relatório PENDENTE (sem definição de colunas homologada).
- Navegação: "Serviços da escola" lista Transporte/Infraestrutura, mas as contas de setor da Secretaria não alcançam essas telas (teste vigente recusa `/alimentacao-escolar` para a Secretaria) — REVISAR/DEPENDE_DECISAO, não alterado.
- NAE revisão visual automatizada e escopos com login: INTERACTIVE_BROWSER_VALIDATION_PENDING. Capacidades de transporte: ASSIGNMENT_PENDING.
