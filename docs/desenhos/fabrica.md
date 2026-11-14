# Desenho da fábrica

Como o agente foi construído: quem decide, quem escreve, quem confere. O processo em texto
está em [`docs/COMO-FOI-FEITO.md`](../COMO-FOI-FEITO.md); o log completo, no
[backlog](../exploracoes/BACKLOG-CONCIERGE-2026-11.md).

## 1. Quem faz o quê

Texto alternativo: o Éverton decide as lacunas, os modelos e o que não se desfaz. A
sessão de planejamento leu o enunciado, verificou a plataforma, consultou dois modelos de
outros provedores às cegas e escreveu contrato, plano de evals e backlog. A coordenadora
despacha frentes em worktrees, confere cada entrega com ensaio de merge, suíte, gate e
CHECK no runtime real, pede um verificador independente e só então faz o merge. O
conjunto reservado fica fora do repositório e só devolve o agregado.

```mermaid
flowchart TB
  accTitle: Papéis da fábrica
  accDescr: Éverton, sessão de planejamento, coordenadora, frentes em worktrees, verificador independente, conjunto reservado e gate de sigilo.

  EV["Éverton<br/>lacunas · modelos · ligar o envio real · repositório público"]

  subgraph PLAN["Planejamento (não escreve código de produto)"]
    direction TB
    P1["Lê o enunciado<br/>(fora do repositório)"]
    P2["Seis verificações em subagentes<br/>plataforma, modelos, limites, catálogo"]
    P3["Conselho às cegas<br/>dois modelos de outros provedores"]
    P4["CONTRATO · EVALS · BACKLOG · DECISOES"]
    P1 --> P2 --> P3 --> P4
  end

  subgraph COORD["Coordenadora (não edita código de produto)"]
    direction TB
    C1["Despacha a frente<br/>worktree própria, dono por arquivo"]
    C2["Ensaio de merge sobre a main<br/>suíte · tipos · gate de sigilo"]
    C3["CHECK no runtime real<br/>servidor local ou dev"]
    C4["Merge --no-ff · publica dev"]
  end

  FR["Frente<br/>só os seus arquivos"]
  VER["Verificador independente<br/>sondas próprias · defeitos plantados"]
  RES[("Conjunto reservado<br/>fora do repositório")]
  GATE["Gate de sigilo e de histórico<br/>antes de cada commit e de cada push"]

  EV -->|"decide"| P4
  P3 -->|"divergências"| EV
  P4 --> C1
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
```

- **Barreira do reservado.** Quem escreveu o conjunto reservado (frente C, outro provedor)
  não corrige o agente, e quem corrige o agente só vê o agregado.
- **Falha do simulador vira caso fixo.** A conversa que falhou é reduzida e entra nos casos
  de desenvolvimento antes da correção.
- **Decisão provisória.** Lacuna nova com o Éverton fora segue a recomendação da
  coordenação, marcada como provisória (P1 a P18) até ele confirmar (X15).

## 2. Frentes e levas

Texto alternativo: na leva 1, a frente A é a única de produto até o Marco 1; em paralelo
correm as frentes de eval (webhook falso, runner e casos, conjunto reservado, simulador) e
o design da página. No portão ficam o Marco 1, a revisão curta M1 e a escolha do modelo.
A leva 2 tem as frentes de profundidade: datas, lead, robustez e handoff, concorrência e a
implementação da página. A leva 3 tem revisões, custo, produção e entregáveis; K, N, L e
parte da M2 foram adiantadas pela X24.

```mermaid
flowchart LR
  accTitle: Frentes por leva
  accDescr: Leva 1 com A, B1, B2, C, D e J; portão com Marco 1, M1 e I; leva 2 com E, F, G, H e J; leva 3 com M2, L, K e N.

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
    MK{{"Marco 1 em dev<br/>13/11 17h31"}}
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
  end

  subgraph L3["Leva 3"]
    direction TB
    M2["M2 · código, segurança,<br/>segunda opinião"]
    L["L · custo por conversa"]
    K["K · produção, envio desligado"]
    N["N · entregáveis"]
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

Provedores por frente (X6, X16, X23): coordenadora no Claude Fable 5.2; A e J no Fable;
F e G começaram no Fable e passaram ao Claude Opus 5.5; B2, D, E e H rodaram no Gemini 4
Hydrogen até a X23 e depois no Opus 5.5; C no GPT-6 Astra; B1 no DeepSeek; I, K, L, N e
todos os verificadores no Opus 5.5; segunda opinião da M2 no Gemini 4 Argon.

## 3. Ciclo de uma entrega até a `main`

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
