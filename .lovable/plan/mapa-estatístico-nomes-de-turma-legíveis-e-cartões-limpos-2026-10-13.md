# Mapa Estatístico: nomes de turma legíveis e cartões limpos

## O que acontece hoje
Quando o Mapa não tem a data da fotografia (falta calendário/regra vigente para o mês), o nome da turma não é buscado e a tela mostra o código interno ("turma-02eb…") com "(sem data de fotografia)". Cada cartão ainda repete "Precisa revisar", "Automático", "Indeterminado" e "Origem da informação".

## O que muda
1. **Nome sempre legível**: sem data da fotografia, o nome vem do cadastro vigente hoje (mesma leitura de turmas usada no resto do sistema). Se nem assim houver nome, aparece "Turma sem nome no cadastro" — nunca o código.
2. **Aviso único no topo** em vez de repetir em cada cartão: "Os números deste mês ainda não podem ser calculados: falta o calendário/regra do mês." com botão para a tela que resolve (quando a conta tiver acesso).
3. **Cartões enxutos**: nome da turma + número (ou "—" quando não apurado). Somem "Automático", "Origem da informação" e o selo repetido; "Precisa revisar" só aparece quando houver de fato algo a revisar em uma turma específica.
4. Turmas ordenadas por nome.

Nada muda nos cálculos, na oficialização, nem em quem pode ver o quê. O código interno continua guardado para auditoria e exportação técnica.

## Detalhes técnicos
- `statistical-map.functions.ts` `mapClassNames`: sem `temporal`, chamar `classNamesAt` com contexto de hoje (validOn = knownAt = agora); rótulos de falha sem `${id}`.
- `statistical-map-page.tsx`: banner único quando todas as células estão indeterminadas por falta de fotografia; remover `<details>` de origem e etiqueta de origem dos cartões (manter em `data-provenance` oculto).
- Teste: nome nunca contém o id técnico; sem fotografia ainda retorna nome do cadastro.
- Verificação: abrir o Mapa com a conta CIECE e conferir por captura de tela.
