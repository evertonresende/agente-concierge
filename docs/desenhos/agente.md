# Desenho do agente em produção (esboço)

Um agente só. Requisitos em [`docs/CONTRATO.md`](../CONTRATO.md). Os nomes de ferramenta
abaixo são ilustrativos; os definitivos saem da frente A.

## Caminho de uma mensagem

```mermaid
flowchart LR
  CLI["Hóspede, página de chat<br/>ou bateria do avaliador"]

  subgraph WORKER["Worker"]
    R["POST /chat<br/>valida o corpo<br/>acha a sessão pelo session_id"]
  end

  subgraph DO["Durable Object: um por session_id"]
    direction TB
    FILA["Fila: uma mensagem por vez"]
    EST[("SQLite da sessão<br/>histórico · rascunho da reserva<br/>estado do lead · flag de handoff")]
    LOOP["Loop de ferramentas<br/>limite de voltas e de tempo"]
    FILA --> LOOP
    LOOP <--> EST
  end

  MOD["Modelo<br/>Workers AI ou AI Gateway"]

  subgraph FERR["Ferramentas determinísticas (código)"]
    direction TB
    T1["buscar imóveis · ver ficha"]
    T2["cotar em centavos inteiros"]
    T3["resumir a reserva"]
    T4["confirmar e enviar o lead"]
    T5["passar para humano"]
  end

  CAT["API do catálogo<br/>somente GET"]
  WH["Webhook de leads<br/>dev: falso · produção: real"]

  CLI -->|"session_id + message"| R
  R --> FILA
  LOOP <-->|"mensagens e pedidos de ferramenta"| MOD
  LOOP --> FERR
  T1 -->|"GET"| CAT
  T2 -->|"ficha fresca"| CAT
  T4 -->|"POST só no estado<br/>resumo_apresentado + confirmação"| WH
  T5 -->|"liga a flag"| EST
  LOOP -->|"reply + handoff"| R
  R -->|"200 em menos de 60 s"| CLI
```

- A fila existe porque o Durable Object pode intercalar outro pedido enquanto espera o
  modelo ou o catálogo. Duas mensagens da mesma sessão nunca correm juntas.
- O texto que vem do catálogo entra na conversa como dado delimitado, nunca como instrução.
- O estado do envio é gravado antes do POST. Um reinício no meio não gera segundo envio.
- Em `dev` o webhook é um falso que replica o contrato do real. O real não recebe nenhum
  POST antes da entrega.

## Trava de confirmação

```mermaid
stateDiagram-v2
  [*] --> sem_reserva
  sem_reserva --> cotado: cotação válida (código)
  cotado --> cotado: algum dado mudou, recalcula
  cotado --> resumo_apresentado: dados completos, resumo com total no turno N
  resumo_apresentado --> cotado: qualquer dado mudou
  resumo_apresentado --> enviando: confirmação inequívoca em turno posterior a N
  enviando --> cotado: total recalculado ficou diferente, novo resumo
  enviando --> registrado: webhook respondeu 201
  enviando --> falhou: qualquer outra resposta, erro ou tempo esgotado
  registrado --> registrado: mesma reserva de novo, não reenvia
  registrado --> sem_reserva: outra reserva na mesma sessão
  falhou --> [*]: nunca vira "registrado"
```

- Resumo e confirmação ficam em turnos diferentes: a ferramenta de envio recusa se o resumo
  não foi apresentado num turno anterior.
- No envio, o total é recalculado com a ficha lida de novo. O valor do webhook sai desse
  cálculo, não do texto da conversa.
- Um lead por reserva: a confirmação é consumida uma vez.
- O que acontece depois de `falhou` e como começa uma segunda reserva dependem de lacunas
  ainda abertas (L-11 e L-7); o desenho final segue o que ficar registrado em `DECISOES.md`.

## Código decide, modelo conversa

| Do código | Do modelo |
|---|---|
| Preço, em centavos inteiros | Entender o que o hóspede quer |
| Dia da semana e número de noites | Escolher qual ferramenta chamar e com quais dados |
| As recusas (mínimo, capacidade, datas) e o motivo | Redigir a resposta em linguagem natural |
| O texto do valor em reais (`R$ 2.156,00`) | Pedir o dado que falta |
| O valor enviado ao webhook | Reconhecer reclamação, desconto e negociação e chamar o handoff |
| Transições da trava de confirmação | |
| Validação de entrada e de dados do lead | |
| A flag `handoff` devolvida na resposta | |

O modelo nunca escreve um total por conta própria: ele recebe o texto pronto da ferramenta.
Não existe ferramenta que aceite desconto ou preço informado pelo hóspede.
