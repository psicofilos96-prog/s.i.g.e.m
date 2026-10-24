# Isolamento de sessão, cancelamento de leituras e cadastro de escolas — 24/10/2026

## Situação atual

Classe: **Registro de lote**. Continuidade a partir de `b0306b75`, após as PRs 2 e 3. Correções de infraestrutura e apresentação; nenhuma capacidade, norma ou dado institucional foi criado.

## Falhas reproduzidas

O helper `withListTimeout` instalava o observador depois de chamar a consulta. Um sinal já cancelado, ou cancelado dentro da própria chamada, podia ser perdido. O temporizador posterior não emite outro evento de abort em um sinal já cancelado. Três regressões falharam antes da correção, incluindo uma leitura obsoleta que chegava a retornar resultado após o cancelamento.

A consulta de nomes e as três fontes do cadastro de unidades não eram paginadas. Mais de mil versões, identificadores ou escolas podiam produzir um conjunto parcial sem aviso. Além disso, a lista operacional escolhia a versão de maior número mesmo antes de sua vigência, enquanto a ficha e o leitor de nomes já tinham resolução temporal.

## Correções

- O observador de cancelamento é instalado antes de iniciar o trabalho. Uma consulta cancelada antes do início não é disparada. Erro de cancelamento e tempo esgotado permanecem distintos; temporizadores e observadores são removidos ao concluir.
- Nomes, identidades, identificadores e versões cadastrais são lidos em páginas ordenadas, respeitando RLS e AbortSignal. O teto técnico de 100 mil linhas recusa a leitura incompleta em vez de apresentá-la como completa.
- Respostas são validadas em execução por `parseBoundary`; ausência de IDs solicitados não faz consulta desnecessária.
- O hook do cadastro tem prazo, cancela leituras ao desmontar ou recarregar e não aceita uma resposta de geração anterior. Falha ao confirmar sessão não equivale a sessão confirmada.
- Lista operacional usa a versão vigente na data; versões futuras continuam no histórico e no editor. A ficha sem versão vigente usa título neutro, sem antecipar o nome futuro.

## Validação

Os 143 testes direcionados de escolas, sessão e leituras passaram, incluindo 1.501 versões, falha em página posterior, resposta inválida, limite técnico, sessão travada, cancelamento ao desmontar e recarga concorrente. Os três cenários de cancelamento falharam antes do ajuste e passaram depois.

A rotina completa de verificação e o CI são as portas para integração. Seus resultados finais são associados à PR correspondente. Testes de código e componentes não certificam jornadas com contas reais de todos os setores.


## Isolamento das consultas compartilhadas

A revisão do helper `callRpc` encontrou uma chave global composta apenas por função e argumentos. Uma consulta da conta A ainda em andamento podia ser reutilizada pela conta B no mesmo cliente. A mesma pergunta travada também permanecia no mapa após o prazo da tela. Cinco regressões falharam antes do ajuste (incluindo uma que ultrapassou o prazo do teste) e passaram após ele.

O compartilhamento agora inclui conta e revisão da sessão, obtidas da origem única por um provedor de chave sem copiar a identidade nem consultar novamente o SDK. Sem origem confirmada, inclusive no SSR, a chamada é independente. A chave é conferida antes do envio e após a resposta; outra conta ou nova sessão da mesma conta recebe uma consulta própria, e a resposta antiga é cancelada. O limite técnico limpa a promessa travada e encaminha AbortSignal ao cliente quando disponível. Escritas permanecem independentes.

A bateria final direcionada passou em 151 testes, incluindo isolamento, recuperação, sessão, escolas e cancelamento. TypeScript e build da versão que contém estas correções também passaram. A suíte completa local anterior a esse último ajuste passou em 7.769 testes, com 7 ignorados; o CI da PR executa novamente a suíte completa sobre o commit final.

## Documentos estruturados localizados

Foram encontradas cópias acessíveis de Guias Estruturados na fonte conectada do proprietário. A especificação mestra por setor e a especificação detalhada foram consultadas e confrontadas com o repositório. A exigência de erro visível, isolamento e preservação de histórico converge com estas correções. Relatos e decisões antigos não foram aplicados como comandos atuais. Os arquivos privados não foram copiados para o repositório público.

A verificação do harness oficial retornou camada `static` por ausência da credencial técnica do banco canônico no ambiente. Isso é um limite de evidência, não autorização para usar um projeto externo nem para simular vínculos de pessoas reais.
