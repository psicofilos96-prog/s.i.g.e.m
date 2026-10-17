# Secretaria — identificação documental

## Situação atual
Classe: Registro de lote. A primeira frente da complementação está implementada; os demais módulos do plano não estão concluídos por este lote.

## Implementado
- Corte inclusivo configurável, padrão 01/12/2017, no catálogo versionado de parâmetros. A matrícula lê o valor vigente; alteração exige a autorização de rede já utilizada pelo escritor de parâmetros.
- CPF obrigatório na faixa; certidão alternativa somente para anteriores. INEP sozinho não substitui nenhum deles. Nascimento ausente não presume dispensa.
- Conclusão canônica mantém transação, autoria da sessão, escopo escolar e controle de concorrência. Nascimento informado entra na cadeia de identidade existente; CPF e certidão têm impressão HMAC no registro de pessoa, sem novo cadastro paralelo.
- Um trigger de nova matrícula aplica a mesma validação aos demais escritores, incluindo transferência e renovação. Matrículas históricas não são alteradas; versões corretivas preservam o histórico.
- Matrícula de estudante existente na escola consulta nascimento e indicadores documentais autorizados, permitindo informar CPF faltante no rascunho.

## Provas executadas
- 21 testes automatizados passaram (modelo, campos, tela e parâmetros).
- Conta escolar autorizada: formulário aberto, 01/12/2017 com certidão continuou exigindo CPF; 30/11/2017 aceitou certidão. Seis casos de limite foram executados pela função do banco com a sessão dessa conta.
- Rascunho sintético descartado; nenhuma matrícula oficial foi criada. Nenhum erro de página na navegação. Verificação automática do projeto: build OK.

## Limites e próximas provas
- Criação completa de matrícula, concorrência da certidão, transferência e renovação com a nova exigência ainda precisam de fixtures descartáveis pela porta de testes institucional. A validação isolada não prova a transação inteira.
- Relatórios específicos de CPF, aniversariantes, vacinação e renovação ainda não foram adicionados por este lote.
- Fila, consentimentos, medidas protetivas, atestados, notificações, vacinação, ofícios e atendimento domiciliar/hospitalar continuam no plano de complementação.
- Os arquivos enviados são referências de estrutura. Não se importaram nomes, assinaturas, números de ofício, suspensões ou fórmulas da Bolsa Família como fatos ou normas.