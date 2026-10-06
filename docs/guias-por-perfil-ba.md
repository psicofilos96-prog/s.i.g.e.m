# Guias operacionais por perfil (Frente BA)

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
| RH | Registro funcional | /quadro-docente | atuação; fonte DP pendente |
| Família | Consulta seções autorizadas e publicadas | portal da família | autorização explícita do responsável |
| Mediador/AEE | Lê registros marcados para mediação | /inclusao | mediação vigente; elegibilidade pendente |
| Alimentação | Cardápio/estoque | cardápios | capability sem política; MENU_CONTENT pendente |

## CONTENT_SOURCE_PENDING
BNCC/SAEB integral, regras de avaliação/publicação/alertas, layout Educacenso, DP/GPE, cardápios,
catálogo de estoque, templates oficiais, retenção/base legal LGPD, elegibilidade AEE, limiar CIECE.
