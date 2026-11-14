# Desenho da fábrica

Como o agente foi construído: quem decide, quem escreve, quem confere. O processo em texto
está em [`docs/COMO-FOI-FEITO.md`](../COMO-FOI-FEITO.md); o log completo, no
[backlog](../exploracoes/BACKLOG-CONCIERGE-2026-11.md).

## 1. Quem faz o quê

Texto alternativo: o Éverton decide as lacunas, os modelos e o que não se desfaz. A
sessão de planejamento leu o enunciado, verificou a plataforma, consultou dois modelos de
outros provedores às cegas e escreveu contrato, plano de evals e backlog. A coordenadora
despacha frentes em worktrees, confere cada entrega com ensaio de merge, suíte, gate e
CHECK no runtime real, pede um verificador independente e, por regra, só então faz o
merge (os merges que entraram sem verificador aprovado estão numa tabela do "Como foi
feito", seção 4). O
conjunto reservado ficou fora do repositório até a entrega de 14/11 e só devolve o agregado. Uma segunda sessão de
IA, revisora do Éverton e fora da cadeia da coordenadora, lê o repositório e os relatórios
e devolve os achados a ele, que viram itens do backlog. A frente K pede ao Éverton a ordem
para ligar o envio real de leads, e só ele a dá.

```mermaid
flowchart TB
  accTitle: Papéis da fábrica
  accDescr: Éverton, sessão revisora, sessão de planejamento, coordenadora, frentes em worktrees, verificador independente, conjunto reservado, gate de sigilo e a ordem para ligar o envio real.

  EV["Éverton<br/>decide as lacunas e os modelos · grava o vídeo<br/>manda ligar o envio real e publicar"]
  REV["Segunda sessão de IA, revisora do Éverton<br/>fora da cadeia da coordenadora:<br/>lê o repositório e os relatórios"]

  subgraph PLAN["Planejamento (não escreve código de produto)"]
    direction TB
    P1["Lê o enunciado<br/>(material local, fora do repositório)"]
    P2["Seis verificações em subagentes paralelos<br/>(plataforma, modelos, limites, catálogo real)"]
    P3["Conselho às cegas: Gemini e GPT<br/>mesma pergunta, um não vê o outro"]
    P4["CONTRATO · BACKLOG · EVALS · DECISOES<br/>prompt da coordenadora"]
    P1 --> P2 --> P3 --> P4
  end

  subgraph COORD["Coordenadora (não edita código de produto)"]
    direction TB
    C1["Confere sobreposição de arquivos da leva<br/>despacha a frente, uma worktree cada"]
    C2["Ensaio de merge sobre a main<br/>suíte · tipos · gate de sigilo"]
    C3["CHECK no runtime real<br/>servidor local ou dev"]
    C4["Merge --no-ff · publica dev"]
  end

  FR["Frente<br/>só os seus arquivos"]
  VER["Verificador independente<br/>sondas próprias · defeitos plantados"]
  RES[("Conjunto reservado<br/>fora do repositório")]
  GATE["Gate de sigilo e de histórico<br/>antes de cada commit e de cada push"]
  K["K · produção<br/>envio real desligado"]

  EV -->|"prompt de planejamento"| PLAN
  P3 -->|"lacunas, recomendação e divergências"| EV
  EV -->|"decisões"| P4
  P4 -->|"contrato e backlog commitados"| C1
  C1 --> FR
  FR -->|"relatório com evidência"| C2
  C2 --> C3 --> VER
  VER -->|"reprovado: lista de correção"| FR
  VER -->|"aprovado"| C4
  RES ==>|"só o agregado por bloco"| C3
  FR -.-> GATE
  COORD -.-> GATE
  COORD -->|"lacuna nova, Marco 1,<br/>o que não se desfaz"| EV
  EV -->|"ordem"| COORD
  REV -->|"achados"| EV
  EV -->|"achados viram itens do backlog"| COORD
  FR -. "repositório e relatórios" .-> REV
  C4 --> K
  K -->|"pede ordem para ligar o envio real"| EV
  EV -->|"ordem explícita"| K
```

## Legenda

- **Éverton** decide tudo o que é produto (as lacunas do enunciado), grava o vídeo e é o
  único que manda ligar o envio real de leads e tornar o repositório público. Produção
  pode subir sem ele enquanto o envio real estiver desligado.
- **Sessão de planejamento** transforma o enunciado em contrato e backlog. Nenhuma outra
  sessão lê o enunciado: todas leem o contrato.
- **Conselho às cegas**: Gemini e GPT recebem a mesma pergunta de uma pasta vazia, sem ver a
  recomendação da sessão nem a resposta um do outro. Pergunta e respostas ficam em
  `docs/conselho/`. Foi assim no planejamento e no Marco 1, antes da X16; na revisão final
  (M2) a segunda opinião foi só do Gemini 4 Argon, porque o GPT saiu pela X16.
- **Sessão coordenadora** não edita código de produto. Ela só despacha, confere e mergeia;
  o contexto dela fica limpo para durar todas as levas.
- **Frentes** trabalham cada uma na sua worktree, com critérios de aceite binários e
  evidência exigida. Frente pequena é subagente; frente longa é thread própria.
- **Portões**: por regra, nada entra em `main` sem passar por eles. Os merges sem verificador
  aprovado estão na tabela da seção 4 do "Como foi feito", e a frente I publicou dois
  commits com o gate reprovando. M1 é a versão curta (revisão de
  código da máquina de estados no marco 1); M2 é a completa (código, segurança e segunda
  opinião do Gemini 4 Argon) antes de produção.
- **Laço de robustez**: falha do simulador → caso fixo em `evals/casos/dev/` → correção →
  agregado do reservado. Exceção: na árvore final, os quatro casos propostos pelo simulador
  não viraram caso fixo, porque fixariam expectativa errada (P36).
- **Barreira do reservado**: quem escreve o conjunto reservado não corrige o agente, e quem
  corrige o agente só vê o agregado. Exceção: os 4 casos revelados pela regra 6 de
  `docs/EVALS.md`, que saíram do conjunto e ganharam substitutos.
- **Sessão revisora do Éverton**: uma segunda sessão de IA, independente, que ele usa para
  revisar as entregas. Não recebe ordens da coordenadora e devolve os achados a ele.
- **Decisão provisória.** Lacuna aberta durante a execução é decidida pela coordenação como
  provisória (as decisões P), para o Éverton confirmar ou reverter (X15, X27 e X28). Ele
  confirmou todas em 14/11, menos a P23 (X33).

## 2. Portões e laços

Texto alternativo: os portões, na ordem: gate de sigilo, testes unitários, evals de
desenvolvimento, revisão de código pelo verificador independente, revisão de segurança,
segunda opinião de outro provedor e agregado do conjunto reservado. O laço de robustez
leva a falha do simulador a um caso fixo, que fica vermelho para a frente de produto até a
correção. Bloco reprovado no reservado revela o caso, que migra para os casos de
desenvolvimento, e a frente C escreve um substituto.

Os nós do desenho dão a regra. O gate de sigilo roda, por regra, antes de cada commit e de
cada push, e a frente I publicou dois commits com o gate reprovando; os merges que entraram
sem verificador aprovado estão na tabela da seção 4 do "Como foi feito".

```mermaid
flowchart TB
  accTitle: Portões e laços da fábrica
  accDescr: Cadeia de portões G1 a G7, laço de robustez do simulador e laço do conjunto reservado.

  subgraph PROD["Produto"]
    EFGH["E datas · F lead · G robustez<br/>H concorrência · J página · L custo"]
  end
  subgraph EVAL["Evals"]
    B2["B2 · harness e casos de desenvolvimento"]
    D["D · simulador de hóspede hostil"]
  end
  C["C · conjunto reservado<br/>thread separada, encerrada pela X16<br/>não corrige o agente"]
  C3["Coordenadora verifica<br/>critérios de aceite, suíte, evals, CHECK no runtime"]
  C4["Merge sem squash, sem rebase, sem amend<br/>(--no-ff) · publica dev"]

  subgraph PORT["Portões: G1 a G4 a cada merge de produto; G5 a G7 na revisão final"]
    direction TB
    G1["Gate de sigilo<br/>antes de cada commit e de cada push"]
    G2["Testes unitários do núcleo"]
    G3["Evals de desenvolvimento por bloco"]
    G4["Revisão de código<br/>verificador independente: sondas e defeitos plantados"]
    G5["Revisão de segurança"]
    G6["Segunda opinião de outro provedor<br/>só Gemini 4 Argon na revisão final:<br/>o GPT saiu pela X16"]
    G7["Agregado do conjunto reservado"]
    G1 --> G2 --> G3 --> G4 --> G5 --> G6 --> G7
  end

  EFGH -->|"relatório com evidência"| C3
  C3 --> PORT
  PORT -->|"tudo verde"| C4
  D -->|"falha vira caso fixo"| B2
  B2 -->|"caso vermelho"| EFGH
  EFGH -->|"correção com o caso verde"| C3
  C ==>|"só o agregado por bloco"| G7
  C -. "barreira: não mostra casos,<br/>não toca o produto" .- PROD
  G7 -->|"bloco reprovado: caso revelado migra para dev<br/>e C escreve um substituto"| B2
```

## 3. Frentes e levas

Texto alternativo: na leva 1, a frente A é a única de produto até o Marco 1; em paralelo
correm as frentes de eval (webhook falso, runner e casos, conjunto reservado, simulador) e
o design da página. No portão ficam o Marco 1, a revisão curta M1 e a escolha do modelo.
A leva 2 tem as frentes de profundidade: datas, lead, robustez e handoff, concorrência e a
implementação da página. A leva 3 tem revisões, custo, produção e entregáveis; K, N, L e
parte da M2 foram adiantadas pela X24.

```mermaid
flowchart LR
  accTitle: Frentes por leva
  accDescr: Leva 1 com A, B1, B2, C, D e J; portão com Marco 1, M1 e I; leva 2 com E, F, G, H, J e as rodadas ao vivo do simulador; leva 3 com M2, L, K, N e o agregado do reservado.

  subgraph L1["Leva 1"]
    direction TB
    A["A · esqueleto até o Marco 1<br/>única frente de produto"]
    B1["B1 · webhook falso"]
    B2["B2 · runner e casos dev"]
    C["C · conjunto reservado"]
    D["D · simulador hostil"]
    J1["J · design da página (canvas)"]
  end

  subgraph PT["Portão"]
    direction TB
    MK{{"Marco 1 em dev, 13/11 17h31<br/>cotação do exemplo · confirmação<br/>lead no webhook falso · desconto vira handoff"}}
    M1["M1 · revisão curta<br/>verificador + conselho"]
    I["I · escolha do modelo<br/>por medição"]
  end

  subgraph L2["Leva 2"]
    direction TB
    E["E · datas"]
    F["F · lead robusto"]
    G["G · robustez e handoff"]
    H["H · concorrência e falha interna"]
    J2["J · página implementada"]
    D2["D · rodadas ao vivo contra dev"]
  end

  subgraph L3["Leva 3"]
    direction TB
    M2["M2 · código, segurança,<br/>segunda opinião"]
    L["L · custo por conversa"]
    K["K · produção, envio desligado"]
    N["N · README, decisões, desenhos, roteiro do vídeo"]
    RR["Agregado do reservado"]
  end

  A --> MK
  B2 --> MK
  MK --> M1
  MK --> I
  M1 --> L2
  I --> G
  D -->|"falha vira caso fixo"| B2
  C ==>|"agregado"| L3
  L2 --> M2 --> K
  K --> ENT(["Entrega"])
  N --> ENT
  L --> ENT
```

Linha de corte do plano: o acabamento da página (J) e o monitor diário (L) caem primeiro se
o tempo apertar; horas e corte estão no backlog.

Provedores por frente (X6, X16, X23): coordenadora no Claude Fable 5.2; A e J no Fable;
F e G começaram no Fable e passaram ao Claude Opus 5.5 (a F voltou ao Fable 5.2 de 13/11
23h28 a 14/11 02h55, por um desvio contra a X23 que a coordenação não percebeu); D e E rodaram no Gemini 4
Hydrogen e terminaram antes da X23; B2 e H rodaram no Gemini 4 Hydrogen até a X23 e depois
no Opus 5.5; C no GPT-6 Astra; B1 no DeepSeek; I, K, L, N e
todos os verificadores no Opus 5.5; S, T e os dois revisores do reservado no papel da
frente C (P33: o do diagnóstico e o segundo, com veto) também no Opus 5.5, com esforço alto; segunda opinião da M2 no Gemini 4 Argon.

## 4. Ciclo de uma entrega até a `main`

Texto alternativo: a frente entrega um relatório. A coordenadora faz o ensaio de merge e
o CHECK no runtime real; falhou, volta para a frente. Passou, o verificador independente
ataca a entrega; reprovou, volta com a lista. Aprovado, merge sem reescrever histórico,
gate de sigilo, push e publicação em `dev`. Pela X24, só bloqueia a entrada o que é
determinístico ou gera lead errado; o resto vira limite conhecido no README.

```mermaid
flowchart LR
  accTitle: Ciclo de entrega
  accDescr: Relatório da frente, ensaio de merge, CHECK no runtime, verificador, merge e publicação em dev, com as voltas de reprovação.

  R["Relatório da frente<br/>commits · CHECK · o que não rodou"]
  EN["Ensaio de merge<br/>suíte · tipos · gate"]
  RT["CHECK no runtime real<br/>evals do bloco"]
  VI["Verificador independente"]
  DEC{"Bloqueia?<br/>determinístico ou lead errado"}
  MG["Merge --no-ff<br/>gate · push · dev"]
  LIM["Limite conhecido<br/>no README"]

  R --> EN
  EN -->|"falhou"| R
  EN --> RT
  RT -->|"falhou"| R
  RT --> VI
  VI -->|"achados"| DEC
  DEC -->|"sim: nova rodada"| R
  DEC -->|"não"| LIM
  VI -->|"aprovado"| MG
  LIM --> MG
```

Rodadas de verificador por frente e o que cada uma achou: tabela da seção 4 do
[`COMO-FOI-FEITO.md`](../COMO-FOI-FEITO.md).
