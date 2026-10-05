# Estado final do SIGEM — gate de integração (2026-10-05)

Registro técnico honesto. Não é fonte normativa; nenhuma regra foi criada ou homologada neste gate.

## Medições executadas neste gate
- HEAD: `e64e3daf` (painéis executivos). Salvamento automático do projeto: não há commits semânticos separados.
- `vitest run`: **221 arquivos, 3056 testes, 0 falhas**. `tsgo --noEmit`: limpo.
- Migrações: 78 arquivos = 78 entradas no journal.
- Cloud: 0 escolas, 0 turmas, 0 estudantes, 0 matrículas, 2 atuações, 2 contas, 0 importações, 0 emissões, 0 autorizações de responsável. Políticas: v1/v2 `draft`, v3 e v4 homologadas (v4 vigente). **Nenhum resíduo de teste**.
- Security Advisor (241 avisos, 3 famílias) — classificação por explorabilidade:
  - *RLS sem policy* (57, INFO): tabelas fechadas por desenho, gravadas/lidas só por funções. **Não explorável** (negação total).
  - *anon executa SECURITY DEFINER* (1): `verify_school_document`, verificação pública minimizada intencional. **Aceito**.
  - *authenticated executa SECURITY DEFINER* (183): writers/readers que validam `auth.uid()` + capability/escopo internamente. Explorável só se uma função omitir a checagem; coberto por testes de corpo SQL por módulo, **não** por revisão linha a linha das 183.
- Busca: nenhum `dangerouslySetInnerHTML` fora de `ui/chart.tsx` (CSS gerado, sem entrada do usuário); nenhum `console.log` de PII encontrado.

## O que NÃO foi executado (e por quê)
- **Jornada sintética total escola → Família em transação**: não executada. O acesso SQL deste ambiente não executa funções e os writers exigem sessão real com capability; inserir direto nas tabelas contornaria exatamente as regras a provar. Existem provas parciais por módulo (testes SQL com rollback, ex. `supabase/tests/b3_1_cycle_enrollment_chain.sql`, e testes que leem as regras do banco).
- **Acesso permitido/negado com contas reais por perfil** (Admin Geral, Supervisão, Secretaria, Direção/OP, Docente, Família, sem capability): **não comprovado**. Só existem 2 contas e as capabilities setoriais novas não estão atribuídas. Negação é provada por teste das regras; permissão positiva aguarda atribuição.
- **Conferência hash migração × Cloud**: a tabela de controle não é legível pelo papel restrito; integridade comprovada só por contagem journal/arquivos. Três arquivos de migração têm mais de um commit (`0057`, `0059`, `supabase/…b2_5_2…`), todos editados no dia da criação; não há prova de edição após aplicação, mas também não há prova contrária — **registrar como risco**.
- Restore de backup, teste com leitor de tela, carga real de produção: não executados.

## Concluído (código + banco, testado por regras)
Identidade/instalação/política de capacidades; escolas, anos/períodos, turmas, oferta/turno; estudante, matrícula, participação, alocação, posição curricular; matrizes E1–E4 e importação D1 governada; jornada/grade (writers fechados); atribuição docente; calendário (Supervisão); Diário oficial sem fixtures com sessão; Secretaria; documentos escolares com snapshot/hash/verificação pública; Mapa/CIECE projetado; importações com staging; referências curriculares; Família read-only fail-closed; OP/Direção; Inclusão; Alimentação; Avaliação e Desempenho; Departamento Pessoal; Notificações; Painéis executivos.

## Parcialmente concluído
- Painéis: 4 métricas; demais perspectivas encaminham às áreas próprias.
- Alimentação: sem formulário de restrição na tela; calendário da escola não resolvido na tela.
- Avaliação: agrupamento por posição e exportação de agregados pendentes; sem telas de cadastro.
- Notificações: nenhum módulo emite eventos ainda.
- Documentos: tipos dependentes de regra pedagógica sem dados; documentos funcionais não suportados.
- ReferencePicker não ligado a planejamento/avaliação.

## Depende apenas de dados reais
Cadastro de escolas (fonte curada do Censo pronta), anos/períodos, turmas, estudantes, matrículas, servidores, matrizes (transcrição D1), BNCC EF/SAEB, valores dos catálogos vazios (categorias, refeições, cargos, funções etc.).

## Depende de decisão de negócio ainda não tomada
Quem recebe cada capability ainda sem regra na v4 (lista em "Próximas decisões").

## Dívida técnica
~90 funções com `search_path=public`; 29 `select("*")`; leitura de matrículas na tela de painéis limitada a 1000 ids por consulta; dependências transitivas com aviso; mensagens fallback podem citar nome de constraint; CSP/HSTS dependem da hospedagem; acessibilidade só com testes automáticos.

## Bloqueadores reais para piloto
1. Nenhuma capability setorial atribuída ⇒ nenhum usuário consegue operar os módulos novos.
2. Base vazia (sem escolas/turmas/estudantes).
3. Sem contas por perfil ⇒ sem prova positiva de acesso.

## Runbook honesto
- Backup: diário gerenciado pela Cloud; **restore nunca testado**. Antes do piloto: restaurar em projeto separado e conferir contagens.
- Observabilidade: logs da plataforma; sem alerta configurado.
- Recuperação de conta: só administrativa (sem e-mail).
