# Central de acessos — inventário de logins e redefinição de senha (Lote N1)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


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

## NACCESS.1 — fechamento da experiência (2026-10-07)
Política institucional, regras de estação e contas intocadas; só leitura nova.
- **Quem age:** cada conta mostra "Principal institucional — conta de setor/órgão (não é pessoa)", "Pessoa natural" ou "Conta técnica — sem vínculo, sem capacidade"; a mesma coluna "Quem age" sai na exportação.
- **Permissões efetivas e origem:** "Ver permissões e histórico" chama `access_center_account_detail(_user, _on)` (migration 0239, DEFINER somente leitura, exige `access_center_holder()`, sem EXECUTE para PUBLIC/anon). Conta de setor: regras da estação na versão vigente. Pessoa/órgão: atuação vigente × política homologada vigente. Sem capacidade ⇒ explicação por extenso, nunca vazio.
- **Histórico:** revogações de principal, encerramentos de atuação e eventos de provisionamento, do mais recente ao mais antigo.
- **Busca e filtros:** login, escola, INEP, pessoa; estação, escola, tipo, situação; "Limpar filtros". No celular a lista vira uma coluna (estação/escopo/situação abaixo do login), sem rolagem lateral.
- **Exportação:** CSV/Excel pelo `report-engine`, sem senha, hash ou token (teste confere os nomes de coluna).
- **Senha:** só o caminho já autorizado (`access_center_authorize_reset` → servidor → `access_center_record_reset`); nada novo.

Prova (`scripts/naccess1-access-center.mjs`, contas temporárias Admin × Secretaria escola A × Direção escola B): 9/9 — Admin é titular e lê inventário (173 contas) e permissões da Direção (36 linhas, todas com origem); Secretaria não é titular, não lê inventário nem permissões alheias; anônimo recusado; inventário sem credencial. Navegador headless: desktop e celular (390 px, largura da página 390) com busca, detalhe e "Limpar filtros"; Secretaria não vê o inventário. Limpeza: 0 contas, 0 resíduos. Testes `access-naccess1.test.ts`.
Pendente: INTERACTIVE_BROWSER_VALIDATION_PENDING — conferência com o login real do Administrador Geral.
