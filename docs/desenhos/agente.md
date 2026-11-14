# Desenho do agente em produção

Um agente só. Requisitos em [`docs/CONTRATO.md`](../CONTRATO.md); decisões citadas (L, P,
X) em [`DECISOES.md`](../../DECISOES.md). Os desenhos descrevem o código da integração da
leva 2 (frentes F, G, H e I). Conferir contra a `main` final: a preencher.
<!-- PREENCHER: conferir os dois desenhos contra a main depois da entrada de F, G e H -->

## 1. Um turno: do pedido à resposta

Texto alternativo: o hóspede manda `session_id` e `message` ao Worker. O Worker valida o
corpo e entrega a mensagem ao Durable Object daquela sessão, que a põe numa fila de uma
mensagem por vez. O laço chama o modelo (o principal e, se ele falhar ou recusar por
limite, o reserva). Se o modelo pede ferramentas, o código confere a chamada, executa,
grava o resultado e volta ao modelo, até 6 voltas. Quando o modelo responde em texto, o
código confere o texto, pede uma correção se achar problema, retira o que não pode
chegar ao hóspede e acrescenta o total e o pedido de confirmação gerados por código. A
sessão grava histórico e estado e o Worker devolve `reply` e `handoff`. Qualquer falha
vira o aviso de contingência com `handoff: true`, nunca erro 500.

```mermaid
flowchart TB
  accTitle: Caminho de uma mensagem do hóspede
  accDescr: Pedido HTTP, Worker, Durable Object da sessão com fila, laço de ferramentas com modelo principal e reserva, ferramentas determinísticas, conferência do texto e resposta.

  H["Hóspede, página de chat<br/>ou bateria do avaliador"]

  subgraph W["Worker"]
    V["POST /chat<br/>JSON inválido ou campo faltando: 400<br/>mensagem vazia, longa ou corpo acima de 64 KB: 200 com texto fixo"]
  end

  subgraph DO["Durable Object: um por session_id"]
    direction TB
    F["Fila em memória<br/>uma mensagem por vez, na ordem de chegada"]
    J{"Sim repetido logo depois<br/>de um registro?"}
    L["Laço de ferramentas<br/>até 6 voltas, 45 s de trabalho externo"]
    C{"O modelo pediu<br/>ferramentas?"}
    B["Conferência da chamada<br/>imóvel não escolhido (L21)<br/>grupo menor que o cotado (L13a)<br/>sinal de desconto: chamada focada (P17)"]
    X["Conferência do texto<br/>valor sem ferramenta, concessão,<br/>registro sem 201, disponibilidade"]
    FE["Fechamento por código<br/>retira frase barrada, anexa o total,<br/>pergunta do agente derruba o resumo (P18),<br/>pedido de confirmação fixo"]
    S[("Armazenamento da sessão<br/>histórico · reserva · estado do lead<br/>marcador de envio · houve handoff")]
    F --> J
    J -->|"não"| L
    L --> C
    C -->|"sim"| B
    C -->|"não"| X
    X -->|"problema: uma correção"| L
    X -->|"ok"| FE
    FE --> S
  end

  subgraph M["Modelos, pelo AI Gateway"]
    P["Principal: Claude Haiku 5.5"]
    R["Reserva: outro fornecedor<br/>(provisório GLM-5.3 Flash)"]
    P -.->|"falha, resposta inútil<br/>ou recusa por limite"| R
  end

  subgraph T["Ferramentas (código)"]
    direction TB
    T1["listar_cidades · buscar_imoveis<br/>buscar_por_comodidade · ver_imovel"]
    T2["cotar: centavos inteiros,<br/>recusas, texto em reais"]
    T3["montar_resumo · confirmar_reserva<br/>texto fixo em português ou inglês"]
    T4["passar_para_humano: liga a flag"]
  end

  CAT["Catálogo<br/>só GET"]
  WH["Webhook de leads<br/>dev: falso · producao: real"]

  H -->|"session_id + message"| V
  V --> F
  J -->|"sim: texto fixo, sem modelo"| S
  L <-->|"mensagens e definições"| M
  B --> T
  T -->|"resultado delimitado:<br/>texto do catálogo é dado"| L
  T1 -->|"GET"| CAT
  T2 -->|"ficha"| CAT
  T3 -->|"POST só depois da confirmação"| WH
  S -->|"reply + handoff"| V
  V -->|"200 em menos de 60 s"| H
  L -.->|"falha ou prazo: contingência,<br/>handoff true"| S
```

- A fila existe porque o objeto intercala outro pedido enquanto espera o modelo ou o
  catálogo, e o bloqueio nativo tem limite de 30 s (`docs/VERIFICACOES.md` §1).
- O modelo nunca escreve um total por conta própria: ele recebe o texto pronto da
  ferramenta, e a conferência retira valor em reais que nenhuma ferramenta calculou.
- Recusa por limite de pedidos vai direto ao reserva e não é repetida (L18). Sem gateway
  configurado, o reserva responde direto (P16).
- O resumo para confirmação, o resultado da confirmação e o aviso de falha são textos
  fixos de código, em português ou em inglês (L15).

## 2. O lead: resumo, confirmação, envio e falha

Texto alternativo: com imóvel, datas, hóspedes, nome e telefone, o código monta o resumo
e o mostra num turno. No turno seguinte, só um sim inequívoco confirma; hesitação repete
o pedido; condição de preço passa para humano; qualquer dado mudado, ou uma pergunta do
próprio agente, derruba o resumo. Na confirmação, o código grava o marcador de envio,
relê a ficha e recalcula o total; se mudou, mostra um resumo novo. Com o envio desligado
não há POST. Resposta 201 é a única que vira "registrado". 5xx tem uma nova tentativa;
422 com campo apontado pede a correção; tempo esgotado ou resultado incerto não se
repete. A segunda falha, de qualquer tipo, para a mesma estadia passa para humano e
bloqueia a estadia: no máximo 2 POSTs sem 201 por estadia.

```mermaid
stateDiagram-v2
  accTitle: Estados do lead
  accDescr: Do resumo à confirmação, envio, registro ou falha, com o teto de dois envios sem sucesso por estadia.

  state "sem pedido" as sem
  state "cotado" as cotado
  state "resumo pendente<br/>(texto fixo de código)" as pendente
  state "enviando<br/>marcador gravado, ficha relida" as enviando
  state "registrado" as registrado
  state "não registrado<br/>handoff true" as nao
  state "incerto<br/>handoff true, sem nova tentativa" as incerto
  state "estadia bloqueada<br/>handoff true" as bloqueada

  [*] --> sem
  sem --> cotado: cotar válido (código)
  cotado --> pendente: dados completos, montar_resumo
  pendente --> pendente: hesitação, repete o pedido (P15)
  pendente --> cotado: dado mudou (L10) ou pergunta do agente (P18)
  pendente --> nao: condição de preço (L9)
  pendente --> enviando: sim inequívoco no turno seguinte (L9, P11, P13)
  enviando --> pendente: total recalculado mudou, resumo novo
  enviando --> nao: ENVIO_LEADS desligado, zero POST (L24)
  enviando --> registrado: 201
  enviando --> enviando: 5xx, uma nova tentativa (L11)
  enviando --> pendente: 422 com campo, pede correção
  enviando --> incerto: tempo esgotado, 2xx diferente de 201
  enviando --> bloqueada: segunda falha da mesma estadia (P14)
  registrado --> registrado: mesmo sim de novo, "já registrado", sem POST
  registrado --> sem: outra reserva (L7)
  incerto --> bloqueada
  nao --> cotado: o hóspede segue sem a condição
```

- Resumo e confirmação ficam em turnos diferentes. A confirmação não recebe argumentos:
  envia só o resumo gravado.
- O marcador de envio é gravado antes do POST. Um reinício do objeto no meio não gera
  segundo envio; marcador sem resultado conta como incerto.
- Estadia bloqueada não gera novo POST, mesmo com outro nome, telefone ou número de
  hóspedes. Outra estadia segue o fluxo normal (P14).
- O agente só diz que registrou depois de um `201`. Lead registrado é pedido encaminhado,
  não reserva garantida.

## 3. Código decide, modelo conversa

| Do código | Do modelo |
|---|---|
| Preço, em centavos inteiros, com o acréscimo de sexta e sábado | Entender o que o hóspede quer |
| Datas relativas no fuso de São Paulo, dia da semana e noites | Escolher a ferramenta e os argumentos |
| As recusas (mínimo, capacidade, datas) e o motivo | Redigir a resposta no idioma do hóspede |
| O texto em reais (`R$ 2.156,00`) e o valor do webhook | Pedir o dado que falta |
| Resumo, leitura do sim, transições do lead, teto de envios | Reconhecer reclamação, desconto e negociação e chamar o handoff |
| Conferência do texto do modelo antes de sair | |
| Validação do corpo do `POST /chat` e dos dados do lead | |

Não existe ferramenta que aceite desconto ou preço informado pelo hóspede.
