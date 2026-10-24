# Auditoria de acessos, sessão e navegação — 23/10/2026

## Situação atual

Classe: **Registro de lote**. Auditoria iniciada no commit `ee1b5dc7`, a pedido do proprietário. Não declara homologação institucional nem funcionamento integral de todos os setores.

## Evidência do ambiente

O projeto Lovable `a5d0ed94-feb8-485b-8fe0-2d52377f3418` estava pronto para preview e sem publicação registrada pela API. O HEAD local coincidia com o informado pelo Lovable e com o HEAD remoto. Banco conectado confirmado pelas consultas do projeto; destino canônico conferido por `scripts/environment-gate.mjs`. O projeto Supabase externo informado na conversa não foi alterado.

Consultas somente de contagem: 820 tabelas públicas, todas com RLS; 56 escolas institucionais, 10.081 pessoas estudantes, 171 matrículas na tabela operacional `school_enrollments` e 173 principais setoriais. Essas tabelas têm finalidades diferentes; os totais não provam completude de migração ou de matrícula. Nenhum dado pessoal foi incluído neste relatório.

## Falha crítica corrigida no banco

As cinco tabelas legadas `sg_schools`, `sg_classes`, `sg_students`, `sg_staff` e `sg_attendance` tinham privilégios de SELECT/INSERT/UPDATE/DELETE para `authenticated` e política `logados usam` com USING/WITH CHECK verdadeiros. Logo, uma conta autenticada podia contornar a separação por setor/escola pela API.

A migration aditiva `0609_archive_legacy_simple_tables` revoga acesso direto de PUBLIC/anon/authenticated e remove as cinco políticas. SQL aplicado em transação pelo conector do projeto Lovable, após conferência do destino canônico. Não houve exclusão de registros. A migration é idempotente para a aplicação posterior pelo mecanismo de release; a execução direta não inseriu recibo manual no ledger do Drizzle.

Verificação posterior no catálogo vivo: em todas as cinco tabelas, RLS ligado, zero políticas e ausência de privilégios SELECT/INSERT/UPDATE/DELETE para anon e authenticated. A função `locate_student_by_name` continua SECURITY DEFINER, executável por authenticated e inacessível a anon, com guarda `has_school_capability('localizar-estudante-para-matricula', _school)`. A prova positiva com uma sessão de matrícula autorizada permanece pendente.

O endereço antigo `/cadastro/escolas` ainda montava o editor legado, contrariando o contrato do módulo. Passa a redirecionar para `/unidades`, como os demais cadastros antigos já faziam com seus destinos oficiais.

## Correções no cliente

- Sessão encerrada deixa de revelar o menu completo. Ação principal dos guias usa a mesma regra de estação/capacidade que menu e destino.
- “Mais funções” só aparece quando realmente existem funções adicionais autorizadas. Links do menu compacto têm nome acessível; buscas de menu simultâneas usam identificadores próprios.
- Rotas com query string ou fragmento mantêm a checagem de competência. Regras de subrota têm precedência sobre regras de rota ancestral.
- Estações desconhecidas, incluindo nomes herdados de Object, recusam acesso sem lançar erro.
- Falhas de persistência não deixam um token nunca gravado no cache de sessão. Uma falha antiga não invalida uma sessão mais recente.
- Rejeição de transporte na leitura compartilhada de capacidades não fica presa no cache por 60 segundos; a recuperação pode consultar novamente.
- Guia contextual usa cartão com hierarquia visual, próximo passo e ação responsiva, preservando tokens semânticos e a região acessível.

## Verificação reproduzível

A rotina tentava baixar o pacote inexistente `tsgo`. O compilador agora é uma dependência explícita e fixada (`@typescript/native-preview`), usado por `npm run typecheck`, pela rotina de verificação e pelo CI. O `tsc` de JavaScript estourou o heap padrão neste ambiente; isso não foi tratado como aprovação.

O smoke de rotas agora tem prazo de 15 segundos por requisição e registra falha quando apenas parte das rotas fica sem resposta. Isso evita espera ilimitada e um PASS parcial enganoso.

Resultados já concluídos nesta execução:

- Typecheck: 0 erros; execução pela rotina oficial em 31,4 s.
- Invariantes profundas: 161 testes aprovados; o novo teste do acervo também foi executado separadamente (3/3).
- Acesso/sessão/acessibilidade direcionados: 129 testes aprovados.
- PDFs: 20 testes aprovados; dados: 17 testes aprovados.
- Build de produção aprovado; smoke HTTP de 11 rotas aprovado.
- Integridade de migrations, índice documental, auditoria SQL estática, varredura de segredos e consistência do lockfile: aprovados.
- Harness institucional e navegação autenticada: não executados. O veredito global permanece parcial, mesmo quando as verificações locais passam.

## Limites materiais

Os diretórios Windows citados pelo proprietário não estão montados neste ambiente. Navegador interativo conectado e sessões reais de cada setor não estão disponíveis pelos conectores desta execução. Testes de componente, inspeção do catálogo SQL e HTTP sem login não equivalem a prova completa da jornada autenticada. Não foram inventados titulares, vínculos, normas ou homologações para contornar essas ausências.
