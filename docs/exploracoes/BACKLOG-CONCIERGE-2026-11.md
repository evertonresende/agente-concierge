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
| 1 | **A** (produto, única) · **B1** webhook falso · **B2** harness e casos dev · **C** reservado · **D** simulador (construção) · **J** passo 1 (design da página, só em `docs/desenhos/`) | 3,5 h | B1, B2, C, D e o passo 1 de J dependem só do contrato e não tocam arquivos de A |
| Portão | Marco 1 verde · **M1** revisão curta · **I** escolha do modelo | 1 h | leva 2 só sai com Marco 1 verde; M1 e I rodam em paralelo |
| 2 | **E** datas · **F** lead · **G** robustez e handoff · **H** concorrência · **J** passo 2 (implementa o design aprovado) · **D** (rodadas ao vivo) | 3 h | um dono por arquivo (tabela abaixo) |
| Integração | merges, correções a partir dos evals dev e do simulador, 1º agregado do reservado | 1,5 h | correção nunca olha caso reservado |
| 3 | **M2** revisões · **L** custo e monitor · **K** produção · **N** entregáveis | 2 h | K sai depois de M2, com o envio real desligado (L24); ligar o envio só com ordem do Éverton |

**Prazo.** Final: 14/11/2026 às 14h, assumido como horário de Brasília. Soma das
estimativas: **29,5 horas de agente**. Caminho crítico: **11 h de relógio** + 1 h de
coordenação = 12 h. Saindo às 16h30 de 13/11, a entrega técnica fecha por volta das
4h30 de 14/11, com 9,5 h de folga. O que depende do Éverton (mandar ligar o envio
real, tornar o repositório público, gravar o vídeo, responder o e-mail) cabe na manhã de
14/11.

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
| A | agente-concierge | Esqueleto vertical até o Marco 1 | pré-voo | alta | 3,5 | thread T3 · Fable 5.2 | concluída | `frente-a` |
| B1 | agente-concierge | Webhook falso (Worker próprio), construído e testado local; deploy em `dev` pela coordenadora | pré-voo | alta | 1 | subagente em worktree · DeepSeek | concluída | `t3/webhook-falso-leads` |
| B2 | agente-concierge | Harness HTTP e casos dev por bloco | — | alta | 2,5 | thread T3 · Gemini 4 Hydrogen | passo 2 na main; resíduos da segunda verificação em commit de seguimento | `frente-b2` |
| C | agente-concierge | Conjunto reservado (fora do repo) | — | alta | 2 | thread T3, fica viva · GPT-6 Astra | rodando (60 casos; relendo por classes de defeito) | `frente-c` (sem commits; casos fora do repo) |
| D | agente-concierge | Simulador de hóspede hostil | B2 (formato de caso) | média | 2,5 | thread T3 · Gemini 4 Hydrogen | na `main` (6c090d0); falta a rodada ao vivo contra `dev` e a B2 mover os 12 casos fixos | `frente-d` |
| M1 | agente-concierge | Revisão curta do Marco 1 | A | alta | 0,5 | subagentes Opus 5.5 + conselho | concluída (`docs/revisoes/m1.md`; achados com dono) | — |
| I | agente-concierge | Escolha do modelo por eval | A, B2 | alta | 1 | subagente em worktree · Opus 5.5 | rodando (fase 1) | `t3/` (subagente) |
| E | agente-concierge | Datas | Marco 1, L1, L1a, L1b, L2 | alta | 1,5 | subagente em worktree · Gemini 4 Hydrogen | entregue (e8c2669, db7d272); seguimento curto da P5 e da P7 antes do merge | `t3/datas-relativas-sao-paulo` |
| F | agente-concierge | Lead robusto | Marco 1, L6, L7, L9, L10, L11, L15 (textos fixos), L20 | alta | 2,5 | thread T3 · Fable 5.2 | rodando | `frente-f` |
| G | agente-concierge | Robustez e handoff | Marco 1, L3, L4, L5, L5a, L12, L13a, L15, L16, L16a, L19, L21 | alta | 2,5 | thread T3 · Fable 5.2 | rodando | `frente-g` |
| H | agente-concierge | Concorrência endurecida e falha interna | Marco 1, L17, L17a, L18 | alta | 1 | subagente em worktree · Gemini 4 Hydrogen | reprovada no CHECK 2 (Worker não sobe no runtime real); em correção | `t3/durable-session-concurrency` |
| J | agente-concierge | Página de chat em dois passos: design (canvas) e implementação | passo 1: nada; passo 2: Marco 1 e aprovação do Éverton | baixa | 0,7 + 1 | thread T3 · Fable 5.2 | passo 1 concluído (canvas aprovado pelo Éverton, com dois ajustes); passo 2 entregue (b8991ce) | `frente-j` |
| M2 | agente-concierge | Revisão de código, segurança e segunda opinião | leva 2 integrada | alta | 1,5 | subagentes Opus 5.5 + conselho | pendente | — |
| L | agente-concierge | Custo por conversa e monitor diário | leva 2 integrada | média | 1 | subagente em worktree · Gemini 4 Hydrogen | pendente | — |
| K | agente-concierge | Produção com o envio real desligado | M2 | alta | 1,5 | thread T3 · Opus 5.5 | pendente | — |
| N | agente-concierge | Entregáveis de processo | K | alta | 2 | thread T3 · Opus 5.5 | pendente | — |
| — | — | Correções entre leva 2 e 3 | evals | alta | 1,5 | frente dona do arquivo | — | — |

Status é enumerado: `pendente` · `pronta` · `rodando` · `concluída` · `bloqueada` ·
`falhou`. Só vira `concluída` com evidência conferida pela coordenadora.

**Log de execução** (data · sessão · resultado · commits):
- 13/11 · coordenadora · pré-voo e documentos: três lacunas decididas, frentes divididas
  por provedor, `AGENTS.md`, conta da Cloudflare e fichas do catálogo gravadas fora do
  repositório. Faltam, do Éverton: `AGENTE_URL_PRODUCAO`, o estado do Bot Fight Mode e a
  regra do hostname (travam só a frente K) · 8e11378, ffb7cb2, 3298156, merge 2d35648
- 13/11 16h00 · leva 1 despachada, todas a partir da `main` em 2d35648, sem sobreposição de
  arquivo: A (Fable 5.2, thread), B1 (DeepSeek, subagente), B2 (Gemini 4 Hydrogen,
  thread), C (GPT-6 Astra, thread) e D (Gemini 4 Hydrogen, thread)
- 13/11 16h14 · C · 56 casos no reservado, 7 por bloco, 9 com confirmação; contagem e JSON
  conferidos sem abrir caso; nada no repositório. Critério 1 espera o runner da B2
- 13/11 16h14 · B1 · webhook falso mergeado e publicado em `dev` pela coordenadora;
  `LEADS_URL_DEV` gravada. CHECK 1: `FALSO OK` local e contra `dev`; CHECK 2: `SIGILO OK`.
  Verificador (Opus): aprovado com ressalvas de infraestrutura de teste (modo gravado
  que não expira, atraso que espera antes de guardar, teste com furos); voltaram para a
  frente como segunda rodada · 5628055, b255c7a, merge d711b0c
- Critérios de integração nesta hora: 7 verde; 1 a 6 e 8 vermelhos (dependem de A, B2 e K)

- 13/11 16h30 · B2 · passo 1 (runner inicial, formato de caso e bloco `marco1`) conferido pela
  coordenadora e mergeado para liberar C e D · 2cbdb99, merge 2759766. Passo 2 entregue
  (79 casos, `RUNNER OK`, `TRAVA OK` e `CASOS OK` reproduzidos pela coordenadora); dois
  verificadores (Opus) lendo o runner e os casos antes do merge
- 13/11 16h30 · C · revisão com o formato final: 60 casos, 10 com confirmação, conferidos só
  por contagem
- 13/11 16h30 · B1 · segunda rodada entregue (`FALSO OK` com 15 grupos); verificador relendo
- 13/11 16h30 · J · mudada pelo Éverton: Fable 5.2, thread, design aprovado por ele antes de
  implementar; passo 1 despachado
- Pré-voo: o Éverton disse que a regra do hostname foi criada; o estado do Bot Fight
  Mode (ligado ou desligado) ficou ambíguo na resposta e foi perguntado de novo

- 13/11 16h47 · B1 · concluída. Terceira rodada (só o teste): contra `dev` o teste falhava em 3
  de 5 rodadas porque desistia do POST antes de o pedido chegar; corrigido, 5 de 5 com
  16 grupos ok. Furos menores do teste do falso ficaram aceitos · 94e0469, fee69f5,
  6f6193e, merges e4712ef e 320eb63. Webhook falso republicado em `dev`
- 13/11 16h47 · B2 · passo 2 **não mergeado**. Verificador do runner: REPROVADO — falso verde
  crítico (caso pulado pela trava sai do denominador e o bloco `marco1` dá 100% e
  `EVAL OK` sem rodar a conversa de lead) e três altos. Verificador dos casos: aprovado
  com ressalvas — os 58 valores esperados batem com o recálculo independente, mas 20 de
  80 casos reprovariam um agente correto e 2 de manipulação rodariam contra `producao`.
  Tudo devolvido numa mensagem; D1 e a regex do `marco1` saem primeiro
- 13/11 16h47 · **três lacunas novas levadas ao Éverton**, com recomendação (em cada uma, §6 do
  contrato e uma regra L puxam `handoff` para lados opostos): pergunta por cupom ou
  promoção; injeção que manda aplicar desconto; pedido para contar menos hóspedes.
  Até a resposta, os casos não conferem `handoff` nesses turnos e nenhuma frente
  implementa comportamento novo
- 13/11 16h47 · C · avisada das classes de defeito de expectativa, sem ver caso nenhum

- 13/11 17h13 · J · passo 1 concluído: canvas aprovado pelo Éverton na thread da frente
  (mensagem dele conferida), com dois ajustes para a implementação · 2fbc375
- 13/11 17h13 · A · entregue (12 commits até aca6c7a). Coordenadora reproduziu os quatro
  CHECK e 109 testes; `/saude` em `dev` correto; bloco `marco1` a 100% e `EVAL OK` com o
  runner corrigido da B2 (provisório: agente publicado a partir da branch); 1 lead de 7
  campos conferido por GET. Verificador (Opus) lendo o diff antes do merge
- 13/11 17h13 · M1 · conselho consultado às cegas (Gemini e GPT); respostas inteiras em
  `docs/conselho/` · 1098d2e
- 13/11 17h13 · **decisões do Éverton**: L5a, L13a e L16a (as três lacunas de `handoff`), L15
  com textos fixos em português e inglês, L10 com o último resumo mostrado; E, H e L
  passam para o Gemini 4 Hydrogen (X14). Bot Fight Mode segue sem resposta

- 13/11 17h21 · M1 · concluída: verificador (Opus) aprovou a frente A com ressalvas — preço,
  POST, fila e trava sem defeito no caminho que não se desfaz; 13 de 20 defeitos
  plantados pegos pela suíte. Treze achados com dono em `docs/revisoes/m1.md`: quatro
  voltaram para a frente A antes do merge, o resto é da leva 2 (o "sim" validado por
  código é a primeira tarefa da F)
- 13/11 17h21 · D · verificador (Opus): REPROVADO — o simulador dá `SIMULADOR OK` com a CLI do
  hóspede fora do ar, erro do agente derruba a rodada, o juiz de handoff acusa agente
  certo e deixa passar errado, e 10 dos 12 casos fixos têm expectativa frágil. Os 7
  totais conferem. Devolvido numa mensagem, casos fixos primeiro
- 13/11 17h21 · C · 2 casos ajustados às regras decididas; 60 casos, 13 com confirmação
- Donos dos arquivos que a frente A criou fora da tabela: `tipos.ts` com G, `pedido.ts`
  com F, `env.ts` com I e depois H, `test/apoio.ts` congelado

- 13/11 17h31 · A · concluída. Correções do M1 conferidas (128 testes; três defeitos plantados
  de novo pela coordenadora, os três pegos) · 61b85fd, 0a40913, 681d174, 6c7c53b,
  28e6717, merge 45ca6ef
- 13/11 17h31 · **MARCO 1 VERDE.** Agente publicado em `dev` pela coordenadora a partir da
  `main` em 45ca6ef. Critério de integração 1: `BLOCO marco1: 100%` e `EVAL OK`, sem
  caso pulado, com o runner da `main` e com o runner corrigido da B2. Critério 6:
  `npm test` na `main`, 128 de 128, sem erro não tratado. Critério 7: `SIGILO OK`.
  Latência do bloco: p95 de 8,1 s. Relatório em `evals/relatorios/`. Critérios 2 a 5
  esperam o passo 2 da B2; o 8 espera a frente K

- 13/11 17h44 · A · encerrada. Último commit: o contexto das ferramentas ganhou a mensagem do
  turno e a data de hoje em São Paulo, para E e F não dependerem de arquivos de outras
  frentes · 59b441f, merge f55d1a9 (130 testes)
- 13/11 17h44 · B2 · correções entregues (D1 a D9, 87 casos, decisões aplicadas); coordenadora
  reproduziu os três CHECK e provou por fora o `EVAL PARCIAL` com saída 2; verificador
  relendo um recorte; conjunto dev inteiro rodando contra `dev` para medir a base
- 13/11 17h44 · **Éverton liberou a leva 2** e os portões seguintes (X2); lacuna nova durante a
  ausência dele segue a recomendação da coordenação como provisória (X15)
- 13/11 17h44 · leva 2 despachada da `main` em diante deste commit: E (Gemini, subagente), F e
  G (Fable, threads), J passo 2 (Fable, thread). H sai quando D ou J terminar

- 13/11 17h56 · base medida: agente do Marco 1 contra os 87 casos dev (runner da B2 em 7afe770,
  contra `dev`): 72 de 87; marco1 e robustez-handoff 100%, funciona-leads 66%,
  robustez-nao-inventa 70%, funciona-recusas 72%; nenhum lead sem confirmação nem
  duplicado; p95 de 10,6 s, máximo de 34 s
- 13/11 17h56 · D · correções entregues · 0ca85ff, 493a3a4. H despachada (Gemini) na vaga
- 13/11 17h56 · G · levantou textos de código fora da lista da L15: regra provisória P3 e
  detector único de idioma com a frente F (`src/nucleo/idioma.ts`)

- 13/11 18h01 · B2 · passo 2 na `main` (87 casos, runner corrigido) · 6b34703, 7052906, cde0094,
  7afe770, merge 77f8828. Segundo verificador (Opus, recorte): o runner passou no que
  era crítico e alto; numa amostra de 13 casos, 3 ainda reprovam agente correto e 7
  deixam passar agente errado. Devolvidos para um commit de seguimento, sem nova rodada
  de verificador. `CASOS OK`, `RUNNER OK` e 130 testes na `main`
- 13/11 18h01 · regra provisória P4 (o "sim" só vale logo depois de resumo ou pedido de
  confirmação gerados por código), levantada pela frente F
- 13/11 18h01 · relatório da medida de base em `evals/relatorios/2026-11-13-dev-base-marco1.json`
- 13/11 18h14 · F · passo 1 (o "sim" lido por código, P4 na versão dura) e detector de idioma
  entregues · f55029c, b05590e · exceção de uma linha em `test/loop.test.ts` autorizada
- 13/11 18h16 · D · na `main` depois de ensaio de merge, 130 testes, tipos, teste próprio 12 de 12
  e gate · merge 6c090d0 · falta a rodada ao vivo
- 13/11 18h18 · E · entregue (e8c2669, db7d272); conferida pela coordenação com tabela própria
  de datas em três fusos, sem diferença; duas lacunas levantadas viraram P5 e P6, e a conferência
  achou a P7; seguimento curto pedido antes do merge
- 13/11 18h19 · J · passo 2 entregue (b8991ce); o contorno de foco por dentro do campo virou P8.
  Aviso dela para todas: `npm run dev -- --port N` falha (dois `--port`); o comando é
  `npx wrangler dev --env dev --port N`
- 13/11 18h20 · F (passo 1 e idioma) e J (passo 2) na `main` · merges 56cc12c e 75fdeb8 ·
  `dev` publicado da 75fdeb8, `BLOCO marco1: 100%`, `EVAL OK`
- 13/11 18h21 · I · despachada (subagente em worktree, Opus 5.5), em duas fases: mede agora e
  repete a comparação depois que a G entrar na `main`, porque a G reescreve o prompt e o loop
- 13/11 18h22 · D · rodada ao vivo do simulador contra `dev` iniciada pela coordenação
- 13/11 18h24 · B2 · seguimento 60d87d9 conferido (`RUNNER OK`, `TRAVA OK`, `CASOS OK`); entra
  na `main` junto com os 12 casos da D e a correção do `con-07` (regex não aceitava "já
  registramos")
- 13/11 18h26 · H · REPROVADA no CHECK 2: com a branch mesclada, o Worker não sobe no runtime
  real (constante exportada no módulo de entrada; os 142 testes passam porque o vitest não roda
  esse runtime). Devolvida com correção, teste de regressão e prova pelo `/saude`. Verificador
  independente (Opus, recorte de 30 chamadas) lendo a entrega: é a rodada única dela
- 13/11 18h27 · F · passos 2 a 4 publicados na `frente-f` (363 testes; `funciona-leads` 91%
  local, o caso que falta depende da ligação da G); relatório final depois da revisão dela
- 13/11 18h32 · Éverton: limite semanal do Claude em 84%. Vale o combinado: recorte menor, uma
  rodada de verificador por frente, e frente do Claude que parar por cota vai para o Gemini 4
  Hydrogen (X7). A trava de confirmação (F) e a ligação dela no loop (G) são verificadas numa
  rodada só, depois do merge da G. **Se a coordenadora parar por cota: retomar daqui.** Pendente
  de merge, nesta ordem: B2 (60d87d9 + fila), E (seguimento da P5 e P7, depois CHECK 2 local do
  bloco `funciona-cotacoes`), F (ensaio de merge + bloco `funciona-leads` local), H (depois da
  correção e do veredito), G, I (fase 2). Scripts da coordenação fora do repositório:
  `conferir.sh` (ensaio de merge, suíte, tipos, gate), `local-eval.sh` (servidor local do
  estado mesclado + runner), `levar-para-main.sh` (merge `--no-ff`, gate, push)

**Setup global usado nesta entrega** (lista viva, para a frente N copiar em `docs/setup/`):
- Skills: `cloudflare-token` (coordenadora, pré-voo); `design-hifi` e `design-guidelines`
  (frente J, passo 1).
- Regras carregadas em toda sessão Claude: `coding-style`, `git-workflow`, `git-sync`,
  `security`, `task-contract`, `testing`.
- Subagentes: `code-reviewer` em Opus 5.5, como verificador das frentes A, B1, B2 e D;
  `design-reviewer` (frente J, passo 1).

## Pré-voo (antes da leva 1)

| # | O quê | Quem | Por quê |
|---|---|---|---|
| 1 | Plano pago da Cloudflare, na conta pessoal (a mesma da zona do subdomínio de produção) | Éverton: **assinado em 13/11** | o gratuito dá 10 ms de CPU por requisição e ~85 chamadas de modelo por dia; os evals estouram isso (`docs/VERIFICACOES.md` §3). A coordenadora confere antes dos evals em volume |
| 2 | `AGENTE_URL_PRODUCAO` (o subdomínio do L23) no arquivo de ambiente | Éverton: **feito em 13/11** (presença conferida, valor não lido) | o hostname não fica em arquivo versionado; sem ele a frente K não sai |
| 3 | `CLOUDFLARE_ACCOUNT_ID` no arquivo de ambiente, derivado da zona do domínio do e-mail do autor (é a conta pessoal do Éverton), e a credencial de deploy por referência | coordenadora: **feito em 13/11** (uma zona encontrada; o identificador e a chave da OpenAI também entraram nos termos extras do gate de sigilo) | o token cobre mais de uma conta; sem a conta o primeiro deploy de `dev` não sai |
| 4 | Olhar no painel se o Bot Fight Mode da zona está ligado e dizer à coordenadora | Éverton: **sem resposta** (o campo voltou em branco três vezes); a frente K descobre pelo teste com os quatro clientes | o token não lê essa configuração; ligado, ele bloqueia cliente automatizado no domínio inteiro e a decisão L23 (mexer só no hostname) não se sustenta sozinha |
| 5 | Criar no painel a regra que desliga a checagem de integridade de navegador só para o hostname de produção, ou dar ao token permissão de regras de configuração | Éverton: **criada** (dito por ele em 13/11; a frente K confere lendo as regras da zona) | o token provavelmente não cria essa regra; sem ela a frente K para de madrugada e produção não sobe sem ele |
| 6 | Lacunas decididas no contrato (seção 10) | feito em 13/11; a L1a, a L1b e a L17a foram decididas na abertura da coordenação (valem os padrões que eram provisórios); nenhuma aberta | frente não implementa lacuna aberta |
| 7 | Fichas do catálogo fora do repositório, sem URL nem token, para as frentes fora do Claude | coordenadora: **feito em 13/11** (`~/.local/share/agente-concierge/catalogo/fichas.json`) | essas frentes não recebem a URL do catálogo |

## Dono de arquivo (confere antes de cada leva)

Duas frentes da mesma leva nunca tocam o mesmo arquivo. A frente A cria a estrutura
abaixo, já com os dois ambientes no `wrangler.jsonc`, para que ninguém mais precise
mexer na configuração.

| Caminho | Leva 1 | Leva 2 | Leva 3 |
|---|---|---|---|
| `package.json`, lockfile, `tsconfig.json`, `wrangler.jsonc`, config do vitest | A | I, só no portão e só o que o modelo e o AI Gateway exigirem; depois, — (pedido de dependência vai à coordenadora) | L (só `triggers`, se usar) |
| `src/index.ts` (rotas `/chat`, `/`, `/saude`) | A | H | — |
| `src/sessao.ts` (Durable Object: fila, estado, histórico) | A | H | — |
| `src/modelo.ts` (adaptador do modelo), `test/modelo*` | A | I (portão) | — |
| `src/catalogo.ts` (cliente do catálogo) | A | G | — |
| `src/agente/loop.ts`, `src/agente/prompt.ts` | A | G | — |
| `src/agente/ferramentas/catalogo.ts`, `handoff.ts`, `index.ts`, `tipos.ts` | A | G | — |
| `src/agente/ferramentas/cotacao.ts`, `src/agente/ferramentas/pedido.ts` (onde as datas dos argumentos são interpretadas) | A | E | — |
| `src/agente/ferramentas/lead.ts`, `src/lead.ts` | A | F | — |
| `src/env.ts` | A | I, que roda junto com a leva 2; outra frente pede à coordenadora | — |
| `test/apoio.ts` | A | congelado: ninguém altera; apoio novo vai em `test/apoio-<frente>.ts` da própria frente | — |
| `src/nucleo/dinheiro.ts`, `src/nucleo/preco.ts` | A | — | — |
| `src/nucleo/datas.ts` | A | E | — |
| `src/nucleo/telefone.ts`, `src/nucleo/idioma.ts` (detector único de idioma: `idiomaDoHospede(textos): "pt" \| "en"`; G importa) | — | F | — |
| `src/pagina.ts` | A (mínima) | J (passo 2) | — |
| `docs/desenhos/pagina-canvas.html` | J (passo 1) | — | — |
| `test/**` | A | E: `test/nucleo/datas.test.ts`; F: `test/lead.test.ts`; G: `test/loop.test.ts`, `test/catalogo.test.ts` (exceção: a F troca uma linha de `test/loop.test.ts`, a contagem de POSTs do teste do `500`, que passa de 1 para 2 com a nova tentativa da L11); H: `test/sessao.test.ts`, `test/chat.test.ts`; I: `test/modelo.test.ts`. Teste novo vai em arquivo novo da frente (`test/<tema>-<letra da frente>.test.ts`). `test/nucleo/preco.test.ts` e `dinheiro.test.ts`: ninguém | — |
| `falso/**` | B1 | — | — |
| `evals/rodar.mjs`, `evals/teste-do-runner.mjs`, `evals/lib/**`, `evals/casos/dev/**`, `evals/README.md` | B2 | B2 recebe casos novos de D e de C | — |
| `evals/simulador/**` (casos fixos para o conjunto dev saem em `evals/simulador/para-dev/<bloco>/`; quem move é B2) | D | D | — |
| `evals/relatorios/**` | coordenadora (frente gera, não commita) | coordenadora | coordenadora |
| `~/.config/agente-concierge/reservado/**` (fora do repo) | C | C | entra no repo na entrega (N) |
| `.github/workflows/**`, `scripts/custo*.mjs` | — | — | L |
| `scripts/validar-producao.sh` | — | — | K |
| `README.md`, `DECISOES.md` (texto final; decisões novas a coordenadora registra a qualquer hora), `docs/desenhos/**`, `docs/sessoes/**`, `docs/setup/**` | — | — | N |
| `docs/revisoes/modelos.md` | — | I (portão) | — |
| `docs/exploracoes/**`, `docs/prompts/**`, `docs/revisoes/m1.md`, `docs/revisoes/m2.md`, `docs/conselho/**`, `docs/CONTRATO.md`, `docs/EVALS.md`, `CLAUDE.md`, `AGENTS.md` | coordenadora | coordenadora | coordenadora |

Acoplamento entre E e F: `cotacao.ts` (E) chama `resumir`, de `ferramentas/lead.ts` (F),
e os dois usam `prepararPedido`, de `pedido.ts` (E), que é quem interpreta as datas. F não
muda a assinatura de `resumir` sem avisar a coordenadora e passa as datas a
`prepararPedido` como vieram; E não edita `lead.ts` e não muda a assinatura de
`prepararPedido` sem avisar. O `Contexto` das ferramentas (`tipos.ts`, G) já traz
`mensagem` (texto do hóspede no turno) e `hoje` (data civil em São Paulo): acréscimo a
ele é só aditivo e avisado.

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
| 23 | Repositório público na entrega | Éverton | nenhuma sessão muda a visibilidade sem ordem dele |
| 24 | Envio real de leads ligado só na entrega | K, com ordem do Éverton | `scripts/validar-producao.sh --entrega` → `ENTREGA OK` |

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
| Passagem para a coordenadora | o Éverton abre uma thread nova com `docs/prompts/02-coordenadora.md` |
| Frentes rodam como | subagente em worktree (frente pequena) ou thread nova do T3 (frente longa), conforme o mapa |
| Autonomia da coordenadora | segue sozinha, e para em: Marco 1 verde, lacuna nova ou critério impossível, hora de ligar o envio real, hora de tornar o repositório público |
| Resumo | até 10 linhas para o Éverton no fim de cada leva |
| Modelos | divididos por provedor: tabela "Modelos por provedor", abaixo (decisão do Éverton na abertura da coordenação; substitui a divisão anterior entre modelo mais forte e intermediário) |
| Deploy em `dev` | liberado para A na leva 1 e para a coordenadora: o webhook falso depois do merge de B1 e o agente, a partir da `main`, depois de cada merge |
| Deploy em `producao` | pode sair sem o Éverton, depois de M2, com `ENVIO_LEADS=desligado` (L24) |
| Ligar o envio real e tornar o repositório público | só com ordem explícita do Éverton |

**Modelos por provedor.** Quem escreve os evals e o conjunto reservado não é o provedor
que escreve o agente.

| Provedor e modelo no T3 Code | Quem roda |
|---|---|
| Claude Fable 5.2 (`claudeAgent`, `claude-fable-5-2`) | coordenadora, A, F, G e J |
| Claude Opus 5.5 (`claudeAgent`, `claude-opus-5-5`) | I, K, N e os subagentes de revisão e de verificação |
| Gemini 4 Hydrogen (`antigravity`, `gemini-4-hydrogen`) | B2, D e, desde a leva 2, E, H e L (`DECISOES.md` X14: o limite semanal do Claude chegou a 79%) |
| GPT-6 Astra (`codex`, `gpt-6-astra`) | C e o conselho; nada além disso (uso limitado) |
| DeepSeek pago (`opencode`, `deepseek/deepseek-flash`) | B1; nunca os modelos gratuitos do OpenCode |

**Frente fora do Claude (B1, B2, C, D, E, H e L).**

1. Lê o `AGENTS.md` da raiz, que traz as regras do `CLAUDE.md` (esses agentes não leem
   o `CLAUDE.md`).
2. Nunca abre nem carrega `~/.config/agente-concierge/env`, nunca toca `producao` e
   nunca recebe o token nem a URL real. O gate de sigilo lê esse arquivo por dentro e
   mostra só `arquivo:linha`; a frente roda o script como está.
3. Dados do catálogo para casos e testes: `~/.local/share/agente-concierge/catalogo/fichas.json`
   (10 cidades e 15 fichas lidas por GET em 13/11/2026, sem URL nem token).
4. Consequência para E e H: desenvolvem com `npm test` (testes com modelo e catálogo de
   mentira). O CHECK contra `$ALVO_LOCAL` é rodado pela coordenadora na worktree da
   frente, porque o servidor local precisa do arquivo de ambiente e da credencial do
   modelo. Para as demais: B1 constrói e testa só local, e o deploy do webhook falso em `dev` com a
   gravação de `LEADS_URL_DEV` passa para a coordenadora. D constrói contra um agente de
   mentira local, e as rodadas ao vivo contra `dev` são rodadas pela coordenadora. Todo
   CHECK que usa variável do arquivo de ambiente é rodado pela coordenadora.
5. O relatório é conferido por um subagente verificador do Claude antes do merge, como o
   de qualquer frente.
6. Provedor falhou ou a cota acabou: a frente passa para o Gemini 4 Hydrogen, com registro
   no log e aviso no resumo da leva.
7. O rodapé do commit nomeia a ferramenta e o modelo que ajudaram de fato, no lugar de
   "Claude Code". Autor e committer continuam os do repositório.

**Orçamento de uso.** O limite semanal de uso do Éverton estava em 74% em 13/11, com o
uso extra desligado. Por isso os modelos acima, e por isso: no máximo 5 frentes vivas,
subagente devolve veredito e não diff, e o volume do simulador (que usa modelo de outro
provedor, fora desse limite) é preferível a rodadas extras de revisão. Se o limite
acabar, a coordenadora registra o estado no backlog e avisa; não troca de provedor por
conta própria.

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
   comportamento de produto. Onde a linha da lacuna traz um padrão provisório,
   implemente o padrão provisório.
10. Deploy só onde este backlog autoriza. O comando usa `CLOUDFLARE_API_TOKEN`,
    carregado por referência do arquivo de credencial no mesmo comando, e
    `CLOUDFLARE_ACCOUNT_ID`, do arquivo de ambiente. O token nunca vira secret de
    Worker e nunca aparece em saída.
11. Servidor local: cada frente usa a própria porta (`ALVO_LOCAL`): E 8788, F 8789,
    G 8790, H 8791, J 8792. Nos CHECK, `ALVO_LOCAL` é `http://127.0.0.1:<porta>`.
12. Webhook falso: cada frente usa o próprio segmento de token no servidor local, e o
    harness acha os leads da sua rodada pelo telefone único que ele mesmo gerou.
    Ninguém além da coordenadora limpa a lista do webhook falso de `dev`, e só sem
    rodada em curso.
13. Relatórios de eval: a frente não commita. Só a coordenadora commita
    `evals/relatorios/` na `main`.

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
- Armadilha já medida em outra conta: Worker recém-criado no endereço padrão da
  plataforma pode responder 404 com corpo `error code: 1042` sem nenhuma invocação. A
  correção é a flag de compatibilidade `global_fetch_strictly_public`. Vale também
  para o webhook falso (B1), que o agente de `dev` chama por HTTP.
- `ENVIO_LEADS` (contrato §8 e L24): `ligado` em `dev`, `desligado` em `producao`. O
  POST do lead só sai com `ligado`. (CA-17)

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
- [ ] Uma lista de leads por segmento de token, para que rodadas e frentes não se
      misturem.
- [ ] Modos de teste por cabeçalho ou token especial: forçar 500, forçar atraso,
      forçar 422. `DELETE` existe só no falso e limpa uma lista; no ambiente `dev`
      só a coordenadora usa, sem rodada em curso. O harness não depende dele.
- [ ] Deploy e gravação de `LEADS_URL_DEV` no arquivo de ambiente: **pela coordenadora**,
      depois do merge (a frente roda fora do Claude e não lê o arquivo de ambiente nem
      a credencial de deploy). A frente entrega a configuração pronta para
      `npx wrangler deploy` dentro de `falso/`, sem secret e sem identificador de conta
      no arquivo, e com a flag `global_fetch_strictly_public`.

### Critérios de aceite
1. POST válido devolve 201 e aparece no GET; POST sem campo devolve 422 e não aparece.
   CHECK (frente): `node falso/teste.mjs http://127.0.0.1:<porta>/leads/<segmento>`, com
   o servidor local de `falso/` no ar
   CHECK (coordenadora, depois do deploy): `node falso/teste.mjs "$LEADS_URL_DEV"`, com o
   arquivo de ambiente carregado
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

A frente roda fora do Claude: constrói e testa contra um agente de mentira local. As
rodadas ao vivo contra `dev` (critério 1) são rodadas pela coordenadora. O hóspede é
feito por uma CLI local de outro provedor, chamada como subprocesso, com o modelo
escolhido por opção de linha de comando; nunca o GPT (uso limitado) e nunca os modelos
gratuitos do OpenCode.

### Tasks
- [ ] `evals/simulador/`: um modelo de outro provedor faz o hóspede, por persona
      (`docs/EVALS.md`), contra `dev` apenas; juízes determinísticos do harness.
- [ ] Cada falha vira um caso fixo em `evals/simulador/para-dev/<bloco>/`, que B2 move
      para `evals/casos/dev/`.
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

Acréscimo do Éverton (13/11, `DECISOES.md` X10): um dos três candidatos é um modelo da
OpenAI. A chave está em `OPENAI_API_KEY`, no arquivo de ambiente: use por referência,
nunca imprima, nunca em arquivo versionado. Como ela chega ao modelo (chave guardada no
AI Gateway ou secret do Worker de `dev`) é escolha desta frente, lendo a documentação
antes; a chave nunca vai para `producao` por esta frente.

### Tasks
- [ ] Rodar o conjunto dev (nunca o reservado) com 3 candidatos, mesmo código. Um deles
      é da OpenAI; os outros saem de `docs/VERIFICACOES.md` §2.
- [ ] Medir por candidato: acerto por bloco, violações de regra, latência p95 e
      máxima, custo por conversa.
- [ ] Medir por candidato 10 conversas simultâneas (sessões diferentes, sem
      confirmação), contando os erros de limite de pedidos (429 e equivalentes) e as
      respostas de contingência.
- [ ] Escolher por confiabilidade de chamada de ferramenta primeiro; registrar em
      `docs/revisoes/modelos.md` e fixar `MODELO`.
- [ ] Deixar um modelo reserva de **outro provedor** configurado no AI Gateway, que
      assume quando o principal falha, e provar a troca com o principal forçado a
      falhar.

### Critérios de aceite
1. Tabela comparativa com os números medidos.
   MANUAL: `docs/revisoes/modelos.md` com uma linha por candidato (um da OpenAI), a
   coluna de erros de limite nas 10 conversas simultâneas e a escolha
2. O escolhido passa o Marco 1.
   CHECK: critério de integração 1
   ESPERA: `BLOCO marco1: 100%`
3. O modelo reserva responde quando o principal falha.
   CHECK: `npm test -- modelo`
   ESPERA: teste `reserva assume quando o principal falha` passando
   MANUAL: `docs/revisoes/modelos.md` diz qual é o reserva, de qual provedor, e como a
   troca foi provada em `dev`

## Sessão E — Datas

Implementa em `src/nucleo/datas.ts` e `ferramentas/cotacao.ts` as regras L1 e L2 do
contrato e a decisão fechada: data sem ano é a próxima ocorrência, e a resposta repete
a data completa com dia da semana. Com entrada e saída determinadas, a cotação sai na
mesma resposta. L1a: "fim de semana" sem datas não é mapeado; o agente pede entrada e
saída. L1b: dia da semana sem data ("sexta que vem") é a próxima ocorrência daquele dia,
com a data exata declarada na resposta.

### Critérios de aceite
1. Tabela de datas (sem ano, virada de ano, 29/02, relativa, passada) resolvida em
   código com relógio injetado.
   CHECK: `npm test -- datas`
   ESPERA: zero falhas
2. CHECK: `node evals/rodar.mjs --alvo "$ALVO_LOCAL" --conjunto dev --bloco funciona-cotacoes`
   ESPERA: `BLOCO funciona-cotacoes: 100%`

## Sessão F — Lead robusto

Implementa L6, L7, L9, L10, L11 e L20 em `src/lead.ts`, `ferramentas/lead.ts` e
`src/nucleo/telefone.ts`: validação e formato do telefone, segunda reserva, repetição,
mudança depois do resumo, falhas do webhook, estado `enviando` persistido antes do POST.

Acréscimos decididos durante a leva 1 (contrato, seção 10): L15, o resumo, o resultado da
confirmação e o aviso de falha são textos fixos gerados por código, em português e em
inglês, escolhidos pelo idioma do hóspede, e o modelo nunca reescreve o resumo (se o
tempo apertar, fica só o português e a coordenadora registra); L10, vale sempre o último
resumo mostrado. Os achados da revisão do Marco 1 que são desta frente estão em
`docs/revisoes/m1.md`.

### Critérios de aceite
1. Matriz de estados do lead, incluindo webhook em 422, 500 e atraso (modos do falso).
   CHECK: `npm test -- lead telefone`
   ESPERA: zero falhas
2. CHECK: `node evals/rodar.mjs --alvo "$ALVO_LOCAL" --conjunto dev --bloco funciona-leads`
   ESPERA: `BLOCO funciona-leads: 100%`

## Sessão G — Robustez e handoff

Implementa L3, L4, L5, L12, L15, L16, L19 e L21 em `prompt.ts`, `loop.ts`,
`ferramentas/handoff.ts`, `ferramentas/catalogo.ts` e `catalogo.ts`: matriz de handoff,
"não sei" sem invenção, texto do catálogo como dado (delimitado e nunca obedecido),
fora de escopo, verificação pós-resposta de que todo total citado saiu do código.

Acréscimos decididos durante a leva 1 (contrato, seção 10): L5a (cupom ou promoção:
`handoff: true`), L16a (manipulação que pede desconto: `handoff: true`; só ignorar regras
ou trocar de papel: `false`) e L13a (pedido para contar menos hóspedes: recusa e explica
na primeira vez, `handoff: true` se insistir). Os achados da revisão do Marco 1 que são
desta frente estão em `docs/revisoes/m1.md`.

### Critérios de aceite
1. Catálogo falso de teste com instrução embutida na descrição não muda preço nem
   regra. (CA-13)
   CHECK: `npm test -- robustez`
   ESPERA: zero falhas
2. CHECK: `node evals/rodar.mjs --alvo "$ALVO_LOCAL" --conjunto dev --bloco robustez-manipulacao --bloco robustez-handoff --bloco robustez-nao-inventa`
   ESPERA: os três blocos em 100%

### Condicional: juiz de decisão (`DECISOES.md` X11)
Só se, depois da leva 2 integrada, os evals de handoff (`robustez-handoff`) ou de
confirmação (`funciona-leads`) seguirem falhando: esta frente avalia um modelo de decisão
(Jev ou Clef) como segunda opinião nesses dois pontos, fora do caminho normal do pedido,
lendo a documentação antes de escrever qualquer coisa. Quem abre essa tarefa é a
coordenadora, com os números na mão. Se não entrar, a frente N registra em "o que faria
com mais tempo".

## Sessão H — Concorrência endurecida e falha interna

Implementa L17 e L18 em `src/index.ts` e `src/sessao.ts`: validação do corpo, limite
de tamanho, resposta de contingência antes de 60 s, retomada depois de reinício do
objeto com lead em estado `enviando`.

### Critérios de aceite
1. Duas confirmações simultâneas geram exatamente 1 lead. (CA-14)
   CHECK: `npm test -- sessao concorrencia`
   ESPERA: zero falhas
2. CHECK: critério de integração 3 contra `"$ALVO_LOCAL"`
   ESPERA: `BLOCO contrato: 100%`

## Sessão J — Página de chat

Mudada pelo Éverton durante a leva 1 (`DECISOES.md` X13): roda em Claude Fable 5.2,
numa thread do T3, em dois passos. O acabamento continua sendo o primeiro item da linha
de corte.

### Passo 1 — design (agora, em paralelo à leva 1; teto de 40 minutos)
Não toca em `src/`. Entrega um canvas em `docs/desenhos/pagina-canvas.html`, feito com as
skills `design-hifi` e `design-guidelines` do Éverton, e **para**: o Éverton aprova na
própria thread.

- Uma direção só. Sem variações lado a lado e sem a rodada de perguntas da skill: as
  respostas estão aqui. Tela completa, web, em duas larguras (desktop e celular).
- Direção: a do site do Éverton. Fonte Inter, sem cantos arredondados, fundo `#fafafa`,
  texto `#141414`, rótulos em maiúsculas com espaçamento largo, muito espaço em branco.
- Conteúdo: conversa com histórico; campo de envio; estados de enviando e de erro; aviso
  visível quando vier `handoff: true`; três botões de exemplo (a cotação do exemplo do
  contrato, uma pergunta de comodidade, um pedido de desconto); rodapé com o link do
  repositório e a frase "agente de demonstração, dados fictícios".
- Texto real, sem lorem ipsum: a conversa do Marco 1.
- Funciona só com teclado e tem contraste legível. Uma rodada do `design-reviewer` antes
  de mostrar.
- Para o Éverton ver: capturas de tela nas duas larguras e o arquivo servido na porta
  8090.

MANUAL: `docs/desenhos/pagina-canvas.html` na branch, capturas nas duas larguras
mostradas na thread, e a aprovação do Éverton escrita na thread.

### Passo 2 — implementação (depois do Marco 1 e da aprovação; teto de 1 hora)
Implementa o design aprovado em `src/pagina.ts`: uma página estática que conversa pelo
`POST /chat`, mostra quando houve handoff e funciona no celular.

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
- [ ] Monitor diário por 7 dias: rodada de fumaça sem confirmação contra `producao`
      (`AGENTE_URL_PRODUCAO`), com aviso em caso de falha. Segundo item da linha de
      corte.

### Critérios de aceite
1. CHECK: `node scripts/custo.mjs evals/relatorios`
   ESPERA: `CUSTO OK` e o valor por conversa

## Sessão K — Produção

### Contexto (verificado)
Como validar sem enviar lead: `docs/VERIFICACOES.md` §5. Risco de bloqueio do
avaliador por erro 1010 em `workers.dev`: `docs/VERIFICACOES.md` §3 e L23.

Verificado na API em 13/11/2026 (só leitura): a zona do domínio está ativa, no plano
gratuito; a checagem de integridade de navegador está **ligada** na zona inteira; o
subdomínio de produção ainda não tem registro de DNS. **Desconhecido:** o estado do
Bot Fight Mode (o token não tem permissão de leitura de bots) e se o token consegue
criar a regra de configuração por hostname.

### Tasks
- [ ] `scripts/validar-producao.sh`: `--so-leitura` faz GET no webhook real e imprime
      `LEADS REAIS: <n>`; modo completo confere secrets presentes, `/saude` com
      `envio_leads: "desligado"`, e roda o conjunto dev **sem** casos de confirmação;
      `--entrega` reprova se o envio estiver desligado.
- [ ] Secrets de `producao` por referência e deploy de `producao` com
      `ENVIO_LEADS=desligado`, no subdomínio de `AGENTE_URL_PRODUCAO` (L23). O hostname
      entra pelo ambiente no comando de deploy, não em arquivo versionado.
- [ ] Regra de configuração que desliga a checagem de integridade de navegador **só
      para esse hostname**. Nada mais na zona é alterado. Se o token não tiver
      permissão, pare e peça ao Éverton para criar a regra no painel.
- [ ] Bot Fight Mode da zona: confira o estado. Se estiver ligado, **não desligue**
      (vale para o domínio inteiro): pare e leve ao Éverton.
- [ ] Teste da URL publicada a partir da máquina de desenvolvimento com curl, Python
      `requests`, Python `urllib` com o agente de usuário padrão, e `fetch` do Node.
- [ ] Só com ordem do Éverton: `ENVIO_LEADS=ligado`, novo deploy e
      `scripts/validar-producao.sh --entrega`.

### Critérios de aceite
1. CHECK: `scripts/validar-producao.sh`
   ESPERA: `PRODUCAO OK`, `LEADS REAIS: 0` e `ENVIO: desligado`
2. Os quatro clientes recebem 200 do `POST /chat`, sem página de bloqueio.
   CHECK: `scripts/validar-producao.sh --clientes`
   ESPERA: `CLIENTES OK`
3. Outro hostname da mesma zona continua com a checagem de integridade ligada.
   MANUAL: saída da leitura das regras da zona mostrando uma única regra, restrita ao
   hostname de produção
4. Na entrega, com ordem do Éverton.
   CHECK: `scripts/validar-producao.sh --entrega`
   ESPERA: `ENTREGA OK` e `ENVIO: ligado`

### Não-escopo
Qualquer POST ao webhook real. Ligar o envio real sem ordem. Alterar qualquer outra
configuração da zona. Tornar o repositório público.

## Sessão N — Entregáveis de processo

- [ ] `README.md`: como rodar, como testar, custo por conversa medido, limites.
- [ ] `DECISOES.md` final: o que foi escolhido, o que ficou de fora, o que faria com
      mais tempo (inclui o juiz de decisão da X11, se não tiver entrado).
- [ ] `docs/setup/`: cópia das skills, das regras e dos subagentes do ambiente global do
      Éverton que **rodaram de fato** nesta entrega (a lista está no log deste backlog),
      sem IP, nome de máquina nem dado de cliente. O enunciado pede para ver esse setup.
      O gate de sigilo precisa passar com as cópias em stage.
- [ ] Desenhos finais em `docs/desenhos/`, exports de sessão em `docs/sessoes/` (com
      dados pessoais e segredos removidos), roteiro do vídeo, reservado copiado para
      `evals/casos/reservado/`.

### Critérios de aceite
1. CHECK: `scripts/verificar-sigilo.sh`
   ESPERA: `SIGILO OK`
2. MANUAL: lista dos entregáveis do desafio com o caminho de cada um.
