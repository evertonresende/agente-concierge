# Rascunho: aberturas do DECISOES.md e da lista de limites

Rascunho da frente N, a pedido do Éverton em 14/11. Ele lê e decide se entra e como. Não
há fato nem número novo: cada linha remete a um texto que já existe no `DECISOES.md`, no
`README.md`, no "Como foi feito" ou no log do backlog.

## Parte 1. Abertura proposta para o `DECISOES.md`

Critério das escolhas: as decisões que mudam o que o hóspede lê ou o que chega à lista de
leads.

> **As escolhas**
>
> - O código decide e o modelo conversa: preço, datas, recusas e valor do lead saem de
>   código (decisão 2).
> - Lead com trava por estado: resumo num turno, confirmação em outro, total recalculado,
>   um lead por reserva (decisão 4, L9, P14).
> - O sim é lido por gramática fechada no código; na dúvida, o agente repete o resumo
>   (L9, P13, P35).
> - Palavra na mensagem não liga o handoff: só pede uma chamada focada ao modelo (P17).
> - Um Durable Object por sessão, uma mensagem por vez (decisão 1).
> - Modelo escolhido por medição: Claude Haiku 5.5 no nível alto, GLM-5.3 Flash de
>   reserva (X24, X30).
> - Só bloqueia a `main` o que é determinístico ou gera lead errado; o resto vira limite
>   no README (X24).
>
> **Os cortes**
>
> - Juiz de decisão com um segundo modelo para handoff e confirmação (X11).
> - Rede de palavras que liga o handoff por código: passava mensagens comuns (P17).
> - Monitor diário como código: dois modos do script de validação já o fazem (P38).
> - Destino do envio no sim: anularia rodadas, reservado e validação para poupar um
>   turno (P36).
> - Limite de taxa no gateway: resolvi o gasto na conta do provedor (P23, X29).
> - Endereço padrão do Worker como URL de entrega: barra alguns clientes HTTP (X28, P22).
>
> **O que eu faria com mais tempo**
>
> - Juiz de preço que compara valores com a cotação, não a forma da frase (P31, P34).
> - Handoff sem depender só do modelo, com bateria negativa antes (P17).
> - Número por extenso e número solto sem moeda na conferência (README, limites 8 e 46).
> - Gramática do sim mais larga, com matriz negativa e verificador (P35, P36).
> - Limite de gasto e credencial por sessão (`docs/revisoes/m2.md`).
> - Mais rodadas e reservado maior, para cada número ter intervalo (P33).
>
> As tabelas completas continuam abaixo, sem corte.

## Parte 2. Abertura proposta para a seção de limites do README

Critério de "pesa mais": o que um avaliador encontra numa conversa normal e o que toca em
dinheiro, em lead ou em dado pessoal. Raridade não conta a favor.

> **Os cinco limites que mais pesam**
>
> 1. **Handoff depende do modelo** (limite 1). O que a pessoa vê: um pedido de desconto ou
>    de negociação que não passa para humano. Custo: se o modelo errar também na chamada
>    focada, o handoff não acontece.
> 2. **Número solto sem marca de moeda nem centavos passa pela conferência** (limite 46). O
>    que a pessoa vê: "consigo deixar o total em 1500" chega sem corte. Custo: um valor que não
>    saiu do código na conversa; o valor do lead continua sendo o do código.
> 3. **Sim com o destino do envio não confirma** (limite 55). O que a pessoa vê: "Sim, pode
>    enviar o pedido ao time comercial" faz o agente repetir o resumo, embora o próprio
>    resumo use essa frase. Custo: um turno a mais; nunca gera lead errado.
> 4. **Sim que repete dado do resumo não confirma** (limite 54). O que a pessoa vê:
>    "Confirmo, 3 pessoas" faz o agente repetir o resumo. Custo: um turno a mais; nunca gera
>    lead errado.
> 5. **Data no formato americano** (limite 6). O que a pessoa vê: "01/15/2027" não é lida
>    como data, e o agente pede as datas de novo. Custo: um turno, e a conversa em inglês
>    não chega à cotação enquanto a data vier nesse formato.
>
> Os outros 61 limites seguem abaixo, por grupo, com o número e o texto de sempre.

Quase entraram:
- **Pedido de humano depende do modelo** (limite 2): pesa como o 1, mas o 1 já cobre o
  mecanismo; trocar se o Éverton preferir o caso mais comum ao mais caro.
- **Nome e telefone no prompt de sistema** (limite 60): toca em dado pessoal, mas o
  avaliador não vê nada na conversa.
- **Sem limite de gasto por cliente ou por sessão** (limite 24): toca em dinheiro, mas não
  aparece numa conversa normal.
- **Concessão e registro escritos pelo modelo em paráfrase** (limites 66 e 65): tocam em
  dinheiro e em lead e passam pela conferência, mas dependem de o modelo escrever assim; o
  valor do lead e o estado "registrado" continuam sendo do código. Trocam bem com o 46.
