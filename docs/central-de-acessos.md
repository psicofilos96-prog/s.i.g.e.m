# Central de acessos — inventário de logins e redefinição de senha (Lote N1)

## O que o Administrador Geral vê
Em `/central-de-acessos`, seção **Logins do SIGEM** (só aparece para o titular):
- Conta (login + tipo: conta de setor, órgão institucional, pessoa, técnica), Onde acessa (estação + escola/INEP ou "toda a rede"), Situação (pode entrar / revogada / bloqueada), Último acesso.
- Filtros: busca (login, escola, INEP), estação, escola, tipo, situação.
- Ação principal: **Exportar lista de logins** (Excel ou CSV) pelo `report-engine` (`LOGINS_REPORT`), com as contas filtradas. Nunca contém senha, hash ou token.
- Ação sensível: **Redefinir senha** (uma ou várias contas).

## Quem pode
`access_center_holder()`: capacidade `manter-contas-institucionais` em rede pela perna humana (pessoa × atuação × política homologada). Conta setorial nunca é titular, mesmo que a estação inclua a capacidade (ex.: CIECE). Sem e-mail fixo. Anônimo: sem EXECUTE (verificado: `permission denied`).

## Redefinição
- A senha atual não pode ser consultada; o administrador define uma nova que conheça (12+ caracteres, letras e números, confirmação).
- `access_center_authorize_reset` valida no banco, sob a sessão de quem pede, antes de qualquer efeito: titular, contas existentes, nenhuma revogada, lote (>1) só de contas de setor; pessoa/órgão/técnica só individualmente; máximo 500.
- O servidor repassa o valor ao Auth uma vez e não o grava, registra nem devolve. Senha recusada por vazamento (proteção de senhas vazadas) interrompe o lote.
- Auditoria: `access_credential_reset_batches` (ator, solicitadas, concluídas, modo) + `access_credential_reset_targets` (contas atingidas). Append-only.

## Testes
- `access-inventory.test.ts`: filtros, elegibilidade de lote, regra de senha, colunas da exportação sem segredo, ausência de log/retorno da senha no servidor e na migration.
- Recusa anônima verificada pela API.
- **UNVERIFIED**: execução autenticada como Administrador Geral (inventário com as 169 contas setoriais + 2 de órgão, reset de conta de teste). A sessão de teste exige aprovação do usuário, indisponível nesta execução.
