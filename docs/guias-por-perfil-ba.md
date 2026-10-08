# Guias operacionais por perfil (Frente BA)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Baseados em `docs/matriz-de-acesso-az.md`. Hoje só a Administração geral tem atuação atribuída; os demais
perfis ficam bloqueados até a atribuição real (REAL_ROLE_ASSIGNMENT_PENDING).

| Perfil | O que faz (quando atribuído) | Telas | Depende de |
|---|---|---|---|
| Administração geral | Atuações, contas, política de capabilities, diagnóstico | /administracao, /central-de-acessos, /diagnostico | — |
| Cadastro da rede | Escolas, pessoas, estudantes, anos/períodos, componentes | /unidades, /alunos | atuação atribuída |
| Gestão pedagógica da rede | Matrizes, correspondências, referências, calendário da rede | /matrizes-curriculares, /calendario-escolar | atuação; BNCC/SAEB CONTENT_SOURCE_PENDING |
| Supervisão | Constrói e homologa o calendário | /supervisao-escolar, /calendario-escolar | designação |
| CIECE | Mapa estatístico, indicadores, qualidade de dados | /ciece, /mapa-estatistico-rede | atuação; limiar mínimo pendente |
| Secretaria escolar | Matrícula, alocação, documentos, mapa da escola | /secretaria, /matriculas, /enturmacoes, /documentos-escolares | atuação; 2027 aberto; templates oficiais pendentes |
| Direção | Grade, jornada, atribuição docente, homologações de fechamento | /gestao-escolar | atuação |
| Orientação | Conferência de pautas, acompanhamento | /orientacao | atuação |
| Professor | Diário, frequência, avaliações, parecer | /diario, /avaliacoes-do-professor, /planejamento | atribuição vigente; regras de avaliação pendentes |
| Família | Consulta seções autorizadas e publicadas | portal da família | autorização explícita do responsável |
| Mediador/AEE | Lê registros marcados para mediação | /inclusao | mediação vigente; elegibilidade pendente |
| Alimentação | Cardápio/estoque | cardápios | capability sem política; MENU_CONTENT pendente |

RH/DP não é perfil do SIGEM: o Departamento Pessoal externo é a autoridade funcional e envia planilha oficial; ver `docs/dp-externo-arquitetura.md`.

## CONTENT_SOURCE_PENDING
BNCC/SAEB integral, regras de avaliação/publicação/alertas, layout Educacenso, planilha oficial do DP externo (DP_FILE_CONTRACT_PENDING), cardápios,
catálogo de estoque, templates oficiais, retenção/base legal LGPD, elegibilidade AEE, limiar CIECE.
