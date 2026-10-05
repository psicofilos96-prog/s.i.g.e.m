## Portal público (`src/features/public-portal/`, migrations 0087–0088)
- Rotas públicas são allowlist (`isPublicPath`): tudo fora dela é interno, porque rota nova nunca pode virar pública por omissão.
- Público só lê `public_portal_list`/`public_portal_get` (DEFINER), que devolvem a ÚLTIMA versão apenas quando está `publicado`; anon não tem privilégio de tabela, porque ausência de flag nunca pode publicar.
- Inexistente, rascunho e revogado respondem igual (`indisponivel`), porque diferenciar permite enumeração.
- Tipos publicáveis são lista fechada (fronteira de segurança); conteúdo é texto autorado para publicação, nunca derivado de fatos de aluno/servidor/turma.
- Escrita só por `record_public_publication` (capability `publicar-conteudo-publico`, versão append-only, concorrência otimista, revogação com motivo).
- Raiz é `noindex`; só páginas públicas publicadas declaram `index`. Verificação de documento é `noindex` e não devolve id técnico da escola.
