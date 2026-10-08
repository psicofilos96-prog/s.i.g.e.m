# Senhas temporárias no desenvolvimento — NACCESS.3

## Situação atual
- Classe: **Registro de lote** (2026-10-08).

- Central de Acessos → Logins: escolher contas de setor → painel "Senhas temporárias" → marcar a confirmação, digitar GERAR → baixa a planilha com login, estação e senha temporária.
- Liga só com as duas condições: interruptor do servidor `SIGEM_DEV_CREDENTIAL_TOOL=enabled` e endereço de pré-visualização/local. Site publicado e domínio próprio: o painel não aparece e o servidor recusa.
- Uma senha diferente por conta (16 caracteres, sorteio criptográfico). Aplicada pelo Auth após a autorização do banco (`access_center_authorize_reset`); a auditoria guarda ator, quantidade e contas, nunca o valor.
- A senha não vai para tabela de domínio, log, tela, docs ou commit; existe só na planilha baixada.
- A exportação da lista de logins/situação (sem senhas) e a redefinição individual com senha escolhida continuam como antes.
- Testes: `src/features/institutional-admin/dev-credentials.test.ts` (sem imprimir valores).
- Validação interativa pendente: gerar com login real na pré-visualização.
