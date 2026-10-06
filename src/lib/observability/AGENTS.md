## Diagnóstico (AV)
- Erros para o usuário passam por `governError` (categoria + mensagem genérica + código `op-…`), porque detalhe interno revelaria existência ou estrutura.
- `/diagnostico` é só leitura e só para Administrador Geral; aplicação de migrations é afirmada pelo CI, nunca pela tela, porque a sessão não lê o histórico do banco.
