# Backlog — Agente concierge (desafio técnico)

Fonte de requisitos: `docs/CONTRATO.md`. Toda frente lê o contrato inteiro antes de
começar e cita o critério (`CA-nn`) ou a lacuna (`L-n`) que está atendendo. Fatos de
plataforma com fonte: `docs/VERIFICACOES.md`. Plano de evals: `docs/EVALS.md`.
Decisões e motivos: `DECISOES.md`.

## Topo: marco, levas, corte e prazo

**Primeiro marco (Marco 1).** Uma conversa completa no ar em `dev`: a cotação do
exemplo do contrato (seção 3) devolve `R$ 2.156,00`, o hóspede recebe o resumo, confirma
em outro turno, o lead chega ao webhook falso com os 7 campos, e um pedido de desconto
devolve `handoff: true`. Até esse marco o código de produto tem **uma frente só (A)**.

**Ordem das levas.**

| Leva | Frentes | Relógio | Regra |
|---|---|---|---|
| 1 | **A** (produto, única) · **B1** webhook falso · **B2** harness e casos dev · **C** reservado · **D** simulador (construção) | 3,5 h | B1, B2, C e D dependem só do contrato e não tocam arquivos de A |
| Portão | Marco 1 verde · **M1** revisão curta · **I** escolha do modelo | 1 h | leva 2 só sai com Marco 1 verde; M1 e I rodam em paralelo |
| 2 | **E** datas · **F** lead · **G** robustez e handoff · **H** concorrência · **J** página · **D** (rodadas ao vivo) | 3 h | um dono por arquivo (tabela abaixo) |
| Integração | merges, correções a partir dos evals dev e do simulador, 1º agregado do reservado | 1,5 h | correção nunca olha caso reservado |
| 3 | **M2** revisões · **L** custo e monitor · **K** produção · **N** entregáveis | 2 h | K só depois de M2 e de ordem explícita do Éverton |

**Prazo.** Final: 14/11/2026 às 14h, assumido como horário de Brasília. Soma das
estimativas: **29,5 horas de agente**. Caminho crítico: **11 h de relógio** + 1 h de
coordenação = 12 h. Saindo às 16h30 de 13/11, a entrega técnica fecha por volta das
4h30 de 14/11, com 9,5 h de folga. O que depende do Éverton (assinar o plano, autorizar
produção, gravar o vídeo, responder o e-mail) cabe na manhã de 14/11.

**Linha de corte, nesta ordem** (o que cai primeiro se o tempo apertar):

1. acabamento da página de chat (J fica na versão mínima que A já entrega);
2. monitor diário de saúde (parte de L; a estimativa de custo por conversa fica);
3. volume do simulador hostil (D reduz a uma rodada curta; os casos de ataque fixos
   ficam);
4. largura da comparação de modelos (I cai para 2 candidatos);
5. interpretação de datas elaboradas (E passa a pedir a data explícita).

**Não caem:** Marco 1, núcleo de preço com testes, trava de confirmação, handoff,
serialização por sessão, evals dev por bloco, casos de ataque, conjunto reservado,
revisão de segurança, validação de `producao` sem POST, README e `DECISOES.md`.

## Mapa de sessões (mantido pela coordenadora)

| Sessão | Repo | Escopo resumido | Depende de | Prioridade | Horas | Roda como | Status | Worktree/Thread |
|---|---|---|---|---|---|---|---|---|
| A | agente-concierge | Esqueleto vertical até o Marco 1 | pré-voo | alta | 3,5 | thread T3 | pendente | — |
| B1 | agente-concierge | Webhook falso (Worker próprio) em `dev` | pré-voo | alta | 1 | subagente em worktree | pendente | — |
| B2 | agente-concierge | Harness HTTP e casos dev por bloco | — | alta | 2,5 | thread T3 | pendente | — |
| C | agente-concierge | Conjunto reservado (fora do repo) | — | alta | 2 | thread T3, fica viva | pendente | — |
| D | agente-concierge | Simulador de hóspede hostil | B2 (formato de caso) | média | 2,5 | thread T3 | pendente | — |
| M1 | agente-concierge | Revisão curta do Marco 1 | A | alta | 0,5 | subagentes + conselho | pendente | — |
| I | agente-concierge | Escolha do modelo por eval | A, B2 | alta | 1 | subagente em worktree | pendente | — |
| E | agente-concierge | Datas | Marco 1, L1, L2 | alta | 1,5 | subagente em worktree | pendente | — |
| F | agente-concierge | Lead robusto | Marco 1, L6, L7, L9, L10, L11, L20 | alta | 2,5 | thread T3 | pendente | — |
| G | agente-concierge | Robustez e handoff | Marco 1, L3, L4, L5, L12, L15, L16, L19, L21 | alta | 2,5 | thread T3 | pendente | — |
| H | agente-concierge | Concorrência endurecida e falha interna | Marco 1, L17, L18 | alta | 1 | subagente em worktree | pendente | — |
| J | agente-concierge | Página de chat | Marco 1 | baixa | 1 | subagente em worktree | pendente | — |
| M2 | agente-concierge | Revisão de código, segurança e segunda opinião | leva 2 integrada | alta | 1,5 | subagentes + conselho | pendente | — |
| L | agente-concierge | Custo por conversa e monitor diário | leva 2 integrada | média | 1 | subagente em worktree | pendente | — |
| K | agente-concierge | Produção | M2, L23, L24, ordem do Éverton | alta | 1,5 | thread T3 | pendente | — |
| N | agente-concierge | Entregáveis de processo | K | alta | 2 | thread T3 | pendente | — |
| — | — | Correções entre leva 2 e 3 | evals | alta | 1,5 | frente dona do arquivo | — | — |

Status é enumerado: `pendente` · `pronta` · `rodando` · `concluída` · `bloqueada` ·
`falhou`. Só vira `concluída` com evidência conferida pela coordenadora.

**Log de execução** (data · sessão · resultado · commits):
- _(vazio)_

## Pré-voo (antes da leva 1)

| # | O quê | Quem | Por quê |
|---|---|---|---|
| 1 | Assinar o plano pago da Cloudflare | Éverton | o gratuito dá 10 ms de CPU por requisição e ~85 chamadas de modelo por dia; os evals estouram isso (`docs/VERIFICACOES.md` §3) |
| 2 | `CLOUDFLARE_ACCOUNT_ID` e a credencial de deploy disponíveis no ambiente, por referência | Éverton / coordenadora | o token cobre mais de uma conta |
| 3 | Lacunas L1 a L24 decididas no contrato (seção 10) | Éverton | frente não implementa lacuna aberta |

## Dono de arquivo (confere antes de cada leva)

Duas frentes da mesma leva nunca tocam o mesmo arquivo. A frente A cria a estrutura
abaixo, já com os dois ambientes no `wrangler.jsonc`, para que ninguém mais precise
mexer na configuração.

| Caminho | Leva 1 | Leva 2 | Leva 3 |
|---|---|---|---|
| `package.json`, lockfile, `tsconfig.json`, `wrangler.jsonc`, config do vitest | A | — (pedido de dependência vai à coordenadora) | L (só `triggers`, se usar) |
| `src/index.ts` (rotas `/chat`, `/`, `/saude`) | A | H | — |
| `src/sessao.ts` (Durable Object: fila, estado, histórico) | A | H | — |
| `src/modelo.ts` (adaptador do modelo) | A | I (portão) | — |
| `src/catalogo.ts` (cliente do catálogo) | A | G | — |
| `src/agente/loop.ts`, `src/agente/prompt.ts` | A | G | — |
| `src/agente/ferramentas/catalogo.ts`, `handoff.ts`, `index.ts` | A | G | — |
| `src/agente/ferramentas/cotacao.ts` | A | E | — |
| `src/agente/ferramentas/lead.ts`, `src/lead.ts` | A | F | — |
| `src/nucleo/dinheiro.ts`, `src/nucleo/preco.ts` | A | — | — |
| `src/nucleo/datas.ts` | A | E | — |
| `src/nucleo/telefone.ts` | — | F | — |
| `src/pagina.ts` | A (mínima) | J | — |
| `test/**` | A | cada frente, só os testes dos seus arquivos | — |
| `falso/**` | B1 | — | — |
| `evals/rodar.mjs`, `evals/lib/**`, `evals/casos/dev/**`, `evals/README.md` | B2 | B2 recebe casos novos de D e de C | — |
| `evals/simulador/**` | D | D | — |
| `~/.config/agente-concierge/reservado/**` (fora do repo) | C | C | entra no repo na entrega (N) |
| `.github/workflows/**`, `scripts/custo*.mjs` | — | — | L |
| `scripts/validar-producao.sh` | — | — | K |
| `README.md`, `DECISOES.md`, `docs/desenhos/**`, `docs/sessoes/**` | — | — | N |
| `docs/exploracoes/**`, `docs/prompts/**`, `CLAUDE.md` | coordenadora | coordenadora | coordenadora |

As frentes de eval (B1, B2, C, D) **não tocam** `package.json` da raiz, lockfile,
config de teste nem `wrangler.jsonc`. O harness é Node 24 sem dependências; o webhook
falso tem a própria pasta com a própria configuração.

## Outcomes pedidos (nenhum fica sem dono)

| # | Outcome | Coberto por | Como se prova |
|---|---|---|---|
| 1 | Agente no ar em URL pública por 7 dias | K, L | `scripts/validar-producao.sh` + monitor diário |
| 2 | Contrato HTTP exato, resposta em menos de 60 s | A, H | evals bloco `contrato` |
| 3 | Dúvidas só pelo catálogo, sem inventar | A, G | evals `funciona-respostas`, `robustez-nao-inventa` |
| 4 | Cotação pela regra, total em reais por código | A, E | teste unitário do exemplo + evals `funciona-cotacoes` |
| 5 | Três recusas com motivo | A | unitário + evals `funciona-recusas` |
| 6 | Lead só após confirmação, um por reserva, erro nunca vira registrado | A, F | evals `funciona-leads` com GET no webhook falso |
| 7 | Handoff na hora certa, nunca negocia | A, G | evals `robustez-handoff` |
| 8 | Resistência a manipulação e a texto do catálogo | G, D | evals `robustez-manipulacao`, simulador |
| 9 | Uma mensagem por vez na mesma sessão | A, H | critério de integração 3 |
| 10 | Página simples de chat | A (mínima), J | abrir `/` em `dev` |
| 11 | Webhook real intocado até a entrega | todas, K | GET no real devolve lista vazia |
| 12 | Evals em três níveis, com medidas | A, B2, D | `docs/EVALS.md` + relatórios em `evals/relatorios/` |
| 13 | Conjunto reservado com barreira | C | agregado por bloco, sem caso exposto |
| 14 | Revisão de código, de segurança e segunda opinião | M1, M2 | achados registrados em `docs/revisoes/` |
| 15 | Escolha do modelo por eval | I | tabela comparativa em `docs/revisoes/modelos.md` |
| 16 | Histórico intacto e sigilo | todas | `scripts/verificar-sigilo.sh` → `SIGILO OK` |
| 17 | README com como rodar e custo por conversa | N, L | arquivo existe e cita a medida |
| 18 | `DECISOES.md` com escolhas, cortes e o que faria com mais tempo | coordenadora, N | arquivo |
| 19 | Dois desenhos (fábrica e agente) | N | `docs/desenhos/` renderiza no GitHub |
| 20 | Exports de sessão e prompts | N | `docs/sessoes/`, `docs/prompts/` |
| 21 | Vídeo de 3 a 5 minutos da fábrica rodando | Éverton, com roteiro de N | fora do repo |
| 22 | Entrega por resposta ao e-mail com link aberto | Éverton | fora do repo |
| 23 | Repositório público na entrega | Éverton | fora do escopo das sessões: nenhuma sessão muda a visibilidade |

## Critérios de integração (rodam na `main`, desde a leva 1, vermelhos no começo)

1. Marco 1: conversa completa em `dev`.
   CHECK: `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev --bloco marco1`
   ESPERA: `BLOCO marco1: 100%` e a linha final `EVAL OK`
2. Nenhum lead sem confirmação e nenhum duplicado em todo o conjunto dev.
   CHECK: `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev --bloco funciona-leads`
   ESPERA: `BLOCO funciona-leads: 100%`
3. Duas mensagens simultâneas na mesma sessão.
   CHECK: `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev --bloco contrato`
   ESPERA: `BLOCO contrato: 100%`
4. Conjunto dev inteiro dentro do limiar de `docs/EVALS.md`.
   CHECK: `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev`
   ESPERA: `EVAL OK`
5. Reservado, só agregado.
   CHECK: `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto reservado --so-agregado`
   ESPERA: `RESERVADO OK`
6. Testes unitários e de integração local.
   CHECK: `npm test`
   ESPERA: saída do vitest sem falha e sem erro não tratado
7. Sigilo e histórico.
   CHECK: `scripts/verificar-sigilo.sh`
   ESPERA: `SIGILO OK`
8. Webhook real intocado.
   CHECK: `scripts/validar-producao.sh --so-leitura`
   ESPERA: `LEADS REAIS: 0`

`AGENTE_URL_DEV`, `AGENTE_URL_PRODUCAO` e `LEADS_URL_DEV` vivem só em
`~/.config/agente-concierge/env`. Carregue o arquivo no mesmo comando, sem imprimir.

## Configuração de execução (respondida no planejamento — NÃO reperguntar)

| Decisão | Resposta |
|---|---|
| Passagem para a coordenadora | PENDENTE |
| Frentes rodam como | subagente em worktree (frente pequena) ou thread nova do T3 (frente longa), conforme o mapa |
| Autonomia da coordenadora | PENDENTE |
| Modelos | PENDENTE |
| Deploy em `dev` | PENDENTE |
| Deploy em `producao` | só com ordem explícita do Éverton, na frente K |

## Regras que valem para toda frente

1. Leia `docs/CONTRATO.md` inteiro e a sua seção deste backlog. Não existe outra fonte.
2. Trabalhe só na sua worktree e só nos arquivos da sua linha na tabela de donos.
   Precisou de outro arquivo: pare e avise a coordenadora.
3. Commit por mudança lógica, em português, com o rodapé padrão do repositório. Antes
   de cada commit e de cada push: `scripts/verificar-sigilo.sh` → `SIGILO OK`. Nunca
   squash, amend ou rebase.
4. Nenhuma requisição ao webhook real além de GET. Fluxo com confirmação só em `dev`
   ou local.
5. Nunca imprima variável secreta. Carregue `~/.config/agente-concierge/env` no mesmo
   comando em que usa o valor.
6. Mudou comportamento: deixa teste. `npm test` verde antes de cada commit de produto.
7. Antes de reportar: revisão de código por subagente (`code-reviewer`) sobre o diff
   da frente, com os achados corrigidos.
8. Relatório final em até 12 linhas: o que foi feito, saída de cada CHECK, o que ficou
   de fora, commits. Sem colar diff.
9. Lacuna `ABERTA` no contrato, ou critério impossível: pare e avise. Não decida
   comportamento de produto.

---

## Sessão A — Esqueleto vertical até o Marco 1

### Contexto (verificado)
- Um Durable Object intercala pedidos durante `await` de I/O externo; a garantia de
  uma mensagem por vez é uma fila de promises em memória dentro do objeto, mais um
  marcador de idempotência gravado no storage antes do POST do lead
  (`docs/VERIFICACOES.md` §1). `blockConcurrencyWhile` não serve (limite de 30 s).
- `wrangler.jsonc` com ambientes `dev` e `producao`; `vars`, bindings e `secrets` não
  são herdados; `exports` no lugar de `migrations`; `secrets.required`; o primeiro
  deploy exige `--secrets-file`; pacote de teste atual é `@cloudflare/vitest-plugin`
  (`docs/VERIFICACOES.md` §4). Confira na documentação oficial ao implementar.
- O modelo começa num modelo nativo do Workers AI, atrás da variável `MODELO` e de um
  adaptador único em `src/modelo.ts` no formato de chat com ferramentas; a escolha
  final é da frente I.
- O item de resumo do catálogo não traz preço; cotar exige a ficha (contrato §4).

### Tasks
- [ ] Projeto: `package.json` com scripts `test`, `dev`, `deploy:dev`,
      `deploy:producao` (os dois com `--env` explícito), `wrangler.jsonc` com os dois
      ambientes, estrutura de pastas da tabela de donos.
- [ ] Núcleo puro com testes: `dinheiro.ts` (centavos ↔ `R$ 2.156,00`), `preco.ts`
      (regra, três recusas, exemplo do contrato, diárias 365,90 e 245,50), `datas.ts`
      mínimo (data ISO e `DD/MM/AAAA` explícitas, dia da semana em data civil).
- [ ] `catalogo.ts`, `sessao.ts` com fila e estado em SQLite, `modelo.ts`, loop de
      ferramentas com limite de iterações e orçamento de 45 s, ferramentas: buscar
      imóveis, ficha, cotar, montar resumo, confirmar e enviar lead, passar para humano.
- [ ] Trava de confirmação por estado em `lead.ts` (contrato §5) e POST para
      `LEADS_URL`.
- [ ] `GET /saude`, página mínima em `/`, cabeçalhos `x-uso-*`, um log JSON por turno
      sem dados pessoais.
- [ ] Deploy em `dev` e gravação de `AGENTE_URL_DEV` no arquivo de ambiente.

### Critérios de aceite
1. Exemplo do contrato calculado pelo núcleo. (CA-04)
   CHECK: `npm test -- preco`
   ESPERA: teste `exemplo do contrato: R$ 2.156,00` passando, zero falhas
2. Três recusas e centavos reais. (CA-06)
   CHECK: `npm test -- nucleo`
   ESPERA: zero falhas, incluindo 245,50 × 1,2 = 29460 centavos
3. Duas mensagens simultâneas na mesma sessão, com o modelo travado por uma promise,
   são processadas em ordem e não intercalam. (CA-14)
   CHECK: `npm test -- sessao`
   ESPERA: teste `uma mensagem por vez` passando
4. Lead não sai sem resumo e confirmação em turnos separados; resposta diferente de
   201 não vira registrado. (CA-09, CA-11)
   CHECK: `npm test -- lead`
   ESPERA: zero falhas
5. Marco 1 no ar em `dev`.
   CHECK: critério de integração 1
   ESPERA: `BLOCO marco1: 100%`
6. `GET /saude` em `dev` informa `ambiente: "dev"` e `leads_destino: "falso"`.
   CHECK: `( set -a; . ~/.config/agente-concierge/env; set +a; curl -s "$AGENTE_URL_DEV/saude" )`
   ESPERA: JSON com os dois campos

### Não-escopo
- Datas relativas, sem ano e no passado (E). Validação de telefone, segunda reserva,
  retentativa de webhook (F). Casos de ataque e matriz fina de handoff (G).
- Nenhuma configuração de secret em `producao` e nenhum deploy de `producao`.

### Dependências
Pré-voo. O webhook falso (B1) precisa estar no ar para o critério 5; até lá, A testa
com o webhook falso local de `falso/` ou com mock.

## Sessão B1 — Webhook falso

### Contexto (verificado)
O webhook real aceita POST com 7 campos e devolve 201, ou 422 com lista de erros
quando falta campo; GET devolve `{ "leads": [ ... ] }`. O corpo exato do 422 e o
formato de cada item são desconhecidos (contrato §5).

### Tasks
- [ ] Worker próprio em `falso/` (configuração e dependências próprias), com
      `POST /leads/<token>` e `GET /leads/<token>`: valida presença e tipo dos 7
      campos, devolve 201 ou 422 `{ "erros": [ ... ] }`, guarda os leads com a hora de
      chegada.
- [ ] Modos de teste por cabeçalho ou token especial: forçar 500, forçar atraso,
      forçar 422. `DELETE` para limpar entre rodadas de eval (existe só no falso).
- [ ] Deploy e gravação de `LEADS_URL_DEV` no arquivo de ambiente.

### Critérios de aceite
1. POST válido devolve 201 e aparece no GET; POST sem campo devolve 422 e não aparece.
   CHECK: `node falso/teste.mjs "$LEADS_URL_DEV"` (com o arquivo de ambiente carregado)
   ESPERA: `FALSO OK`
2. Nada em `falso/` referencia a URL real.
   CHECK: `scripts/verificar-sigilo.sh`
   ESPERA: `SIGILO OK`

### Não-escopo
Qualquer arquivo fora de `falso/`. Qualquer requisição ao webhook real.

## Sessão B2 — Harness e casos de desenvolvimento

### Tasks
- [ ] `evals/rodar.mjs` conforme `docs/EVALS.md`: lê casos, conversa por `POST /chat`,
      aplica expectativas, confere leads por GET no webhook falso, mede latência e
      custo, imprime `BLOCO <nome>: <n>%` por bloco e `EVAL OK` só se os limiares
      passarem. Grava relatório em `evals/relatorios/`.
- [ ] Trava: caso com `confirma: true` só roda se `GET <alvo>/saude` disser `dev`.
- [ ] Bloco `marco1` primeiro (nos primeiros 45 minutos), depois os oito blocos.
- [ ] Juiz determinístico de total: recalcula a estadia com a regra do contrato,
      implementada de forma independente do código de produto, e compara com o total
      citado.

### Critérios de aceite
1. O runner reprova quando deve: rodado contra um agente falso que responde errado.
   CHECK: `node evals/teste-do-runner.mjs`
   ESPERA: `RUNNER OK` (inclui controle positivo: resposta errada reprova, lead a mais reprova)
2. Recusa caso com confirmação fora de `dev`.
   CHECK: `node evals/teste-do-runner.mjs --trava`
   ESPERA: `TRAVA OK`
3. Cada bloco de `docs/EVALS.md` tem pelo menos 6 casos.
   CHECK: `node evals/rodar.mjs --listar`
   ESPERA: `CASOS OK`

### Não-escopo
Código de produto. `package.json` da raiz. Casos do conjunto reservado.

## Sessão C — Conjunto reservado

### Regras (contrato de barreira)
- Quem escreve o reservado **não corrige o agente** e não lê o código de produto.
- Os casos ficam em `~/.config/agente-concierge/reservado/`, fora do repositório, até
  a entrega. Nenhuma outra frente abre essa pasta.
- O resultado sai só em agregado por bloco. Ninguém além desta sessão vê qual caso
  falhou.
- Caso que falhou e será corrigido: esta sessão move o caso para `evals/casos/dev/`
  (por meio de B2) e escreve um substituto no reservado.
- O reservado não é usado para escolher modelo.

### Tasks
- [ ] 5 a 8 conversas por bloco, no mesmo formato de B2, pensadas como um hóspede real
      e como um mal-intencionado, sem olhar os casos dev.
- [ ] Ficar viva para as migrações e substituições.

### Critérios de aceite
1. O runner lê o conjunto e só imprime agregado.
   CHECK: critério de integração 5 com `--listar`
   ESPERA: contagem por bloco, sem nome de caso
2. Nenhum caso reservado dentro do repositório antes da entrega.
   CHECK: `git ls-files evals/casos/reservado | wc -l`
   ESPERA: `0`

## Sessão D — Simulador de hóspede hostil

### Tasks
- [ ] `evals/simulador/`: um modelo de outro provedor faz o hóspede, por persona
      (`docs/EVALS.md`), contra `dev` apenas; juízes determinísticos do harness.
- [ ] Cada falha vira um caso fixo, entregue a B2 para `evals/casos/dev/`.
- [ ] Pelo menos 10 casos de ataque fixos existem mesmo que o simulador seja cortado.

### Critérios de aceite
1. Uma rodada de 8 personas termina com relatório.
   CHECK: `node evals/simulador/rodar.mjs --alvo "$AGENTE_URL_DEV" --rodadas 1`
   ESPERA: `SIMULADOR OK` e arquivo em `evals/relatorios/`
2. Recusa alvo que não é `dev`.
   CHECK: `node evals/simulador/rodar.mjs --alvo https://exemplo.invalid`
   ESPERA: `ALVO RECUSADO`

## Sessão M1 — Revisão curta do Marco 1

- [ ] Revisão de código (`code-reviewer`) restrita a: preço, trava de confirmação,
      POST do lead, fila por sessão.
- [ ] Segunda opinião de Gemini e GPT sobre o mesmo recorte (diff, sem segredos),
      rodada de pasta vazia, pergunta e respostas em `docs/conselho/`.
- [ ] Achados viram tarefa da frente dona do arquivo na leva 2.
MANUAL: `docs/revisoes/m1.md` com achados, severidade e destino de cada um.

## Sessão I — Escolha do modelo

### Contexto (verificado)
Candidatos e ressalvas em `docs/VERIFICACOES.md` §2. Modelos nativos que exigem plano
pago têm 20 requisições por minuto; modelos de terceiros passam pelo AI Gateway e
exigem chave.

### Tasks
- [ ] Rodar o conjunto dev (nunca o reservado) com 3 candidatos, mesmo código.
- [ ] Medir por candidato: acerto por bloco, violações de regra, latência p95 e
      máxima, custo por conversa.
- [ ] Escolher por confiabilidade de chamada de ferramenta primeiro; registrar em
      `docs/revisoes/modelos.md` e fixar `MODELO`.

### Critérios de aceite
1. Tabela comparativa com os números medidos.
   MANUAL: `docs/revisoes/modelos.md` com uma linha por candidato e a escolha
2. O escolhido passa o Marco 1.
   CHECK: critério de integração 1
   ESPERA: `BLOCO marco1: 100%`

## Sessão E — Datas

Implementa em `src/nucleo/datas.ts` e `ferramentas/cotacao.ts` as regras L1 e L2 do
contrato e a decisão fechada: data sem ano é a próxima ocorrência, e a resposta repete
a data completa com dia da semana.

### Critérios de aceite
1. Tabela de datas (sem ano, virada de ano, 29/02, relativa, passada) resolvida em
   código com relógio injetado.
   CHECK: `npm test -- datas`
   ESPERA: zero falhas
2. CHECK: `node evals/rodar.mjs --alvo http://127.0.0.1:8787 --conjunto dev --bloco funciona-cotacoes`
   ESPERA: `BLOCO funciona-cotacoes: 100%`

## Sessão F — Lead robusto

Implementa L6, L7, L9, L10, L11 e L20 em `src/lead.ts`, `ferramentas/lead.ts` e
`src/nucleo/telefone.ts`: validação e formato do telefone, segunda reserva, repetição,
mudança depois do resumo, falhas do webhook, estado `enviando` persistido antes do POST.

### Critérios de aceite
1. Matriz de estados do lead, incluindo webhook em 422, 500 e atraso (modos do falso).
   CHECK: `npm test -- lead telefone`
   ESPERA: zero falhas
2. CHECK: `node evals/rodar.mjs --alvo http://127.0.0.1:8787 --conjunto dev --bloco funciona-leads`
   ESPERA: `BLOCO funciona-leads: 100%`

## Sessão G — Robustez e handoff

Implementa L3, L4, L5, L12, L15, L16, L19 e L21 em `prompt.ts`, `loop.ts`,
`ferramentas/handoff.ts`, `ferramentas/catalogo.ts` e `catalogo.ts`: matriz de handoff,
"não sei" sem invenção, texto do catálogo como dado (delimitado e nunca obedecido),
fora de escopo, verificação pós-resposta de que todo total citado saiu do código.

### Critérios de aceite
1. Catálogo falso de teste com instrução embutida na descrição não muda preço nem
   regra. (CA-13)
   CHECK: `npm test -- robustez`
   ESPERA: zero falhas
2. CHECK: `node evals/rodar.mjs --alvo http://127.0.0.1:8787 --conjunto dev --bloco robustez-manipulacao --bloco robustez-handoff --bloco robustez-nao-inventa`
   ESPERA: os três blocos em 100%

## Sessão H — Concorrência endurecida e falha interna

Implementa L17 e L18 em `src/index.ts` e `src/sessao.ts`: validação do corpo, limite
de tamanho, resposta de contingência antes de 60 s, retomada depois de reinício do
objeto com lead em estado `enviando`.

### Critérios de aceite
1. Duas confirmações simultâneas geram exatamente 1 lead. (CA-14)
   CHECK: `npm test -- sessao concorrencia`
   ESPERA: zero falhas
2. CHECK: critério de integração 3 contra `http://127.0.0.1:8787`
   ESPERA: `BLOCO contrato: 100%`

## Sessão J — Página de chat

Uma página estática em `src/pagina.ts` que conversa pelo `POST /chat`, mostra quando
houve handoff e funciona no celular. Primeira a ser cortada.
MANUAL: captura de tela da conversa do Marco 1 feita na página em `dev`.

## Sessão M2 — Revisões antes de produção

- [ ] Revisão de código do diff integrado (`code-reviewer`).
- [ ] Revisão de segurança (`security-reviewer`): segredos, injeção, parâmetros
      enviados ao catálogo, dados pessoais em log, abuso de custo.
- [ ] Segunda opinião de Gemini e GPT, focada em cálculo, confirmação, POST,
      concorrência e isolamento de sessões; registros em `docs/conselho/`.
- [ ] Achado crítico ou alto corrigido antes de K.
MANUAL: `docs/revisoes/m2.md` com cada achado, severidade, correção e commit.

## Sessão L — Custo por conversa e monitor diário

- [ ] `scripts/custo.mjs`: lê os relatórios de eval e calcula custo médio e p95 por
      conversa para o modelo escolhido (vai para o README).
- [ ] Monitor diário por 7 dias: rodada de fumaça sem confirmação contra `producao`,
      com aviso em caso de falha (L23 define a URL). Segundo item da linha de corte.

### Critérios de aceite
1. CHECK: `node scripts/custo.mjs evals/relatorios`
   ESPERA: `CUSTO OK` e o valor por conversa

## Sessão K — Produção

### Contexto (verificado)
Como validar sem enviar lead: `docs/VERIFICACOES.md` §5. Risco de bloqueio do
avaliador por erro 1010 em `workers.dev`: `docs/VERIFICACOES.md` §3 e L23.

### Tasks
- [ ] `scripts/validar-producao.sh`: `--so-leitura` faz GET no webhook real e imprime
      `LEADS REAIS: <n>`; modo completo confere secrets presentes, `/saude`, e roda o
      conjunto dev **sem** casos de confirmação.
- [ ] Secrets de `producao` por referência; deploy de `producao` só com ordem do
      Éverton; teste da URL publicada com curl, `requests`, `urllib` e `fetch` do Node.
- [ ] L24 conforme decidido.

### Critérios de aceite
1. CHECK: `scripts/validar-producao.sh`
   ESPERA: `PRODUCAO OK` e `LEADS REAIS: 0`
2. Os quatro clientes recebem 200 do `POST /chat`.
   CHECK: `scripts/validar-producao.sh --clientes`
   ESPERA: `CLIENTES OK`

### Não-escopo
Qualquer POST ao webhook real. Tornar o repositório público.

## Sessão N — Entregáveis de processo

- [ ] `README.md`: como rodar, como testar, custo por conversa medido, limites.
- [ ] `DECISOES.md` final: o que foi escolhido, o que ficou de fora, o que faria com
      mais tempo.
- [ ] Desenhos finais em `docs/desenhos/`, exports de sessão em `docs/sessoes/` (com
      dados pessoais e segredos removidos), roteiro do vídeo, reservado copiado para
      `evals/casos/reservado/`.

### Critérios de aceite
1. CHECK: `scripts/verificar-sigilo.sh`
   ESPERA: `SIGILO OK`
2. MANUAL: lista dos entregáveis do desafio com o caminho de cada um.
