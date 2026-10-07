# Módulos de apoio — produto

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
