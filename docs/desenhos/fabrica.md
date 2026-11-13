# Desenho da fábrica (esboço)

Como o agente foi construído: quem decide, quem escreve, quem confere. Requisitos em
[`docs/CONTRATO.md`](../CONTRATO.md); evals em [`docs/EVALS.md`](../EVALS.md).

## Quem faz o quê

```mermaid
flowchart TB
  EV["Éverton<br/>decide as lacunas · grava o vídeo · autoriza produção"]
  REV["Segunda sessão de IA, revisora do Éverton<br/>fora da cadeia da coordenadora:<br/>lê o repositório e os relatórios"]

  subgraph PLAN["Sessão de planejamento (não escreve código de produto)"]
    direction TB
    P1["Lê o enunciado<br/>(material local, fora do repositório)"]
    P2["Seis verificações em subagentes paralelos<br/>(plataforma, modelos, limites, catálogo real)"]
    P3["Conselho às cegas: Gemini e GPT<br/>mesma pergunta, um não vê o outro"]
    P4["CONTRATO · BACKLOG · EVALS · DECISOES<br/>prompt da coordenadora"]
    P1 --> P2 --> P3 --> P4
  end

  subgraph COORD["Sessão coordenadora (não edita código de produto)"]
    direction TB
    C1["Confere sobreposição de arquivos da leva"]
    C2["Despacha as frentes, uma worktree cada"]
    C3["Verifica: critérios de aceite, suíte, evals"]
    C4["Merge sem squash, sem rebase, sem amend"]
    C1 --> C2 --> C3 --> C4
  end

  subgraph FRENTES["Frentes em worktrees"]
    direction TB
    subgraph PROD["Produto"]
      A["A · marco 1<br/>esqueleto vertical"]
      EFGH["E datas · F lead · G robustez<br/>H concorrência · J página · L observabilidade"]
      K["K · produção"]
      A --> EFGH --> K
    end
    subgraph EVAL["Evals (começam junto com A, outros arquivos)"]
      B1["B1 · webhook falso"]
      B2["B2 · harness e casos de desenvolvimento"]
      D["D · simulador de hóspede hostil"]
      I["I · escolha do modelo por eval"]
    end
    C["C · conjunto reservado<br/>thread separada, fica viva<br/>não corrige o agente"]
    N["N · entregáveis"]
  end

  subgraph PORT["Portões (nesta ordem, por merge de produto)"]
    direction TB
    G1["Gate de sigilo<br/>antes de cada commit e de cada push"]
    G2["Testes unitários do núcleo"]
    G3["Evals de desenvolvimento por bloco"]
    G4["Revisão de código"]
    G5["Revisão de segurança"]
    G6["Segunda opinião: Gemini e GPT<br/>sobre o diff integrado"]
    G7["Agregado do conjunto reservado"]
    G1 --> G2 --> G3 --> G4 --> G5 --> G6 --> G7
  end

  EV -->|"prompt de planejamento"| PLAN
  P3 -->|"lacunas, recomendação e divergências"| EV
  EV -->|"decisões"| P4
  P4 -->|"contrato e backlog commitados"| COORD
  C2 --> FRENTES
  FRENTES -->|"relatório com evidência"| C3
  C3 --> PORT
  PORT -->|"tudo verde"| C4

  D -->|"falha vira caso fixo"| B2
  B2 -->|"caso vermelho"| EFGH
  EFGH -->|"correção com o caso verde"| C3
  C ==>|"só o agregado por bloco"| G7
  C -. "barreira: não mostra casos,<br/>não toca o produto" .- PROD
  G7 -->|"bloco reprovado: caso revelado migra para dev<br/>e C escreve um substituto"| B2

  K -->|"pede autorização"| EV
  EV -->|"ordem explícita"| K
  REV -->|"achados"| EV
  EV -->|"achados viram itens do backlog"| COORD
  FRENTES -. "repositório e relatórios" .-> REV
```

## Legenda

- **Éverton** decide tudo o que é produto (as lacunas do enunciado), grava o vídeo e é o
  único que autoriza produção.
- **Sessão de planejamento** transforma o enunciado em contrato e backlog. Nenhuma outra
  sessão lê o enunciado: todas leem o contrato.
- **Conselho às cegas**: Gemini e GPT recebem a mesma pergunta de uma pasta vazia, sem ver a
  recomendação da sessão nem a resposta um do outro. Pergunta e respostas ficam em
  `docs/conselho/`.
- **Sessão coordenadora** não edita código de produto. Ela só despacha, confere e mergeia;
  o contexto dela fica limpo para durar todas as levas.
- **Frentes** trabalham cada uma na sua worktree, com critérios de aceite binários e
  evidência exigida. Frente pequena é subagente; frente longa é thread própria.
- **Portões**: nada entra em `main` sem passar por eles. M1 é a versão curta (revisão de
  código da máquina de estados no marco 1); M2 é a completa (código, segurança e segunda
  opinião de Gemini e GPT) antes de produção.
- **Laço de robustez**: falha do simulador → caso fixo em `evals/casos/dev/` → correção →
  agregado do reservado.
- **Barreira do reservado**: quem escreve o conjunto reservado não corrige o agente, e quem
  corrige o agente só vê o agregado.
- **Sessão revisora do Éverton**: uma segunda sessão de IA, independente, que ele usa para
  revisar as entregas. Não recebe ordens da coordenadora e devolve os achados a ele.

## Levas no tempo

Horas e linha de corte estão no backlog; aqui só a ordem.

```mermaid
flowchart LR
  subgraph L1["Leva 1 · até o marco 1"]
    direction TB
    L1A["A · única frente de produto"]
    L1B["B1 · B2 · C · D<br/>só evals, outros arquivos"]
  end
  M1{{"Marco 1 em dev<br/>cotação do exemplo · confirmação<br/>lead no webhook falso · desconto vira handoff<br/>+ M1 revisão curta"}}
  subgraph L2["Leva 2 · profundidade"]
    direction TB
    L2I["I · modelo escolhido por eval (primeiro)"]
    L2P["E · F · G · H em paralelo"]
    L2C["J · L (caem primeiro se apertar)"]
    L2D["D rodando contra dev"]
  end
  subgraph L3["Leva 3 · fechamento"]
    direction TB
    L3M["M2 · revisões e segunda opinião"]
    L3R["Agregado do reservado"]
    L3K["K · produção (com ordem do Éverton)"]
    L3N["N · README, decisões, desenhos, vídeo"]
  end
  L1 --> M1 --> L2 --> L3 --> ENT(["Entrega"])
```
