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
| B2 | agente-concierge | Harness HTTP e casos dev por bloco | — | alta | 2,5 | thread T3 · Gemini 4 Hydrogen até 13/11 21h26; depois Opus 5.5, esforço alto (X23) | passo 2 na main; resíduos da segunda verificação em commit de seguimento | `frente-b2` |
| C | agente-concierge | Conjunto reservado (fora do repo) | — | alta | 2 | thread T3 · GPT-6 Astra até 13/11 18h35 | 60 casos entregues fora do repo; conversa no GPT encerrada pela X16. Caso substituto, se for preciso, numa conversa nova em Gemini 4 Hydrogen | `frente-c` (sem commits; casos fora do repo) |
| D | agente-concierge | Simulador de hóspede hostil | B2 (formato de caso) | média | 2,5 | thread T3 · Gemini 4 Hydrogen | concluída: na `main` (6c090d0), rodada ao vivo com `SIMULADOR OK`; a B2 move os 12 casos fixos | `frente-d` |
| M1 | agente-concierge | Revisão curta do Marco 1 | A | alta | 0,5 | subagentes Opus 5.5 + conselho | concluída (`docs/revisoes/m1.md`; achados com dono) | — |
| I | agente-concierge | Escolha do modelo por eval | A, B2 | alta | 1 | subagente em worktree · Opus 5.5, esforço médio desde a X16 | adaptador na `main` desde 13/11 23h18 (27c3093), com o Haiku 5.5 em nível alto (X24); `dev` publicado dessa versão. Delta do log de falha e gateway de `producao` na `main` desde 13/11 23h59 (fcb7dc2), verificador aprovado. Fica viva para a fase 2 (medição no código final) e para a linha do gateway de `producao` | `t3/modelo-evals-fallback` |
| E | agente-concierge | Datas | Marco 1, L1, L1a, L1b, L2 | alta | 1,5 | subagente em worktree · Gemini 4 Hydrogen | concluída: na `main` (81873fa) | `t3/datas-relativas-sao-paulo` |
| F | agente-concierge | Lead robusto | Marco 1, L6, L7, L9, L10, L11, L15 (textos fixos), L20 | alta | 2,5 | thread T3 · Fable 5.2 até 13/11 18h35, depois Opus 5.5 com esforço médio (X16); de 13/11 23h28 a 14/11 02h55 rodou em Fable 5.2 por desvio não percebido; de volta ao Opus 5.5, esforço alto, em 14/11 04h07 | na `main`: primeira parte (801c8a2) e complemento (0a44bd6, 14/11 00h05; P14 por estadia, P18, P19, C7 a C11), com seis rodadas de verificador. Aberta só para o nome do lead (P20), em commit novo | `frente-f` |
| G | agente-concierge | Robustez e handoff | Marco 1, L3, L4, L5, L5a, L12, L13a, L15, L16, L16a, L19, L21 | alta | 2,5 | thread T3 · Fable 5.2 até 13/11 18h35, depois Opus 5.5 com esforço médio (X16) | rodando | `frente-g` |
| H | agente-concierge | Concorrência endurecida e falha interna | Marco 1, L17, L17a, L18 | alta | 1 | subagente em worktree · Gemini 4 Hydrogen até 13/11 21h26; depois Opus 5.5, esforço alto (X23) | duas rodadas de verificador independente; correções entregues (c905a09); espera a F entrar na `main` para o merge final e a terceira rodada | `t3/durable-session-concurrency` |
| J | agente-concierge | Página de chat em dois passos: design (canvas) e implementação | passo 1: nada; passo 2: Marco 1 e aprovação do Éverton | baixa | 0,7 + 1 | thread T3 · Fable 5.2 | passo 1 concluído (canvas aprovado pelo Éverton, com dois ajustes); passo 2 entregue (b8991ce) | `frente-j` |
| M2 | agente-concierge | Revisão de código, segurança e segunda opinião | leva 2 integrada | alta | 1,5 | subagentes Opus 5.5 + segunda opinião do Gemini 4 Argon em esforço alto (X23) | primeira passada rodando desde 13/11 23h22, adiantada pela X24: segurança na `main` atual, código dos módulos estáveis e segunda opinião do Gemini sobre o cálculo; a segunda passada é só o delta, depois da leva 2 | — |
| L | agente-concierge | Custo por conversa e monitor diário | leva 2 integrada | média | 1 | subagente em worktree · Opus 5.5, esforço médio (X23) | script de custo na `main` desde 13/11 23h47 (eec433a), verificador aprovado; falta o monitor diário, depois que `producao` existir; aberta em 13/11 23h22, adiantada pela X24: só `scripts/custo.mjs`; o monitor diário espera a K | `frente-l` |
| K | agente-concierge | Produção com o envio real desligado | M2 | alta | 1,5 | thread T3 · Opus 5.5, esforço alto (X23) | gateway de `producao` criado e com o log desligado; `scripts/validar-producao.sh` na branch (33c8316), reprovado pelo verificador por um falso verde com argumentos extras, em correção; `producao` no ar no endereço padrão (3e053cb) e no hostname próprio por rota (P22), envio desligado, zero lead; faltam o teste por agente de usuário, a latência, o limite de taxa e o deploy final. Primeiro deploy autorizado em 14/11 00h07 (X26), só no endereço padrão do Worker e com o envio real desligado; a rota no hostname próprio segue à espera do Éverton. Rodando desde 13/11 23h14, adiantada pela X24: só a infraestrutura de `producao` com o envio real desligado; o deploy final espera a M2 | `frente-k` |
| N | agente-concierge | Entregáveis de processo | K | alta | 2 | thread T3 · Opus 5.5, esforço alto (X23) | rascunho completo na branch (ede0c12), sem achado de sigilo; reprovado por uma garantia dada como certa antes da hora, em correção; verificação final no fim da leva 2. Aberta em 13/11 23h14, adiantada pela X24: rascunhos do README, do "Como foi feito", dos desenhos e do setup, com marcador no que se preenche no fim | `frente-n` |
| S | agente-concierge | Gate de sigilo: achados da M2 | M2, primeira passada | alta | 0,5 | subagente em worktree · Opus 5.5, esforço alto (X23) | primeira entrega (1d5e406) reprovada pelo verificador em 14/11 00h27 por cinco médios, quatro deles anteriores à frente; em correção na mesma branch; verificador do delta antes do merge | `frente-gate` |
| T | agente-concierge | Datas sem ano (P21) | G | alta | 0,5 | subagente em worktree · Opus 5.5, esforço alto (X23) | pronta na branch (e53e777, por cima da G em da64da4) em 14/11 00h24; verificador do delta rodando; entra na `main` depois da G | `frente-datas` |
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
- 13/11 18h40 · D · critério 1 verde: rodada ao vivo contra `dev` (main 75fdeb8) terminou com
  `SIMULADOR OK`, relatório em `evals/relatorios/simulador-2026-11-13T21-32-22-068Z.md`. 5 de 10
  conversas reprovadas, lidas à mão: 2 são da F (um "sim" que repete os dados do próprio resumo
  não confirmava; mais estrito que a L9, devolvido a ela), 1 some com a frente E (cotou estadia
  no passado), 2 são falso alarme do juiz do simulador (o hóspede simulado pediu um humano ou
  pediu para segurar a reserva por conta própria, e o juiz esperava `handoff: false`). Limite
  conhecido do simulador: o juiz de handoff não enxerga gatilho que o modelo do hóspede inventa;
  reprovação de handoff nele se lê à mão
- 13/11 18h35 · Éverton mudou os provedores (`DECISOES.md` X16): chave da OpenAI fora de uso,
  GPT e DeepSeek fora do plano, fora do Claude só o Gemini 4 Hydrogen, frentes do Claude em
  Opus 5.5 com esforço médio. Feito na hora: frente I avisada para parar qualquer chamada com a
  chave e desfazer o que tiver guardado; I, F e G trocadas de modelo na própria conversa (F e G
  fecham o turno num ponto consistente e seguem no modelo novo); nenhuma mensagem mais para a
  conversa da C
- 13/11 18h44 · estado, com horário conferido no relógio (os da X16 estavam 10 minutos adiantados
  e foram corrigidos para 18h35):
  - I · confirmou ter guardado a chave da OpenAI no Secrets Store e no gateway `concierge-dev`
    antes da ordem, e removeu das duas; a coordenação conferiu por nome que não há segredo dela
    na conta. O commit 8bc3d2a da branch dela (`t3/modelo-evals-fallback`, fora da `main`) ainda
    descreve o modelo da OpenAI ligado pelo gateway; como entra na `main` é decisão do Éverton
    (pendente). Segue a fase 1 com candidatos do Workers AI
  - H · verificador independente: REPROVADA. Crítico: a nova tentativa do Worker reenvia a mesma
    mensagem sem identificador; se o objeto já tinha gravado o turno, um "sim" é processado duas
    vezes e sai lead de resumo que o hóspede não viu. Alto: um teste dela fica vermelho na `main`
    atual (P4). Devolvida com a correção (identificador por pedido gravado na transação do
    turno), junto com o defeito de runtime. Relatório do verificador fora do repositório
  - E · seguimento f9d5485 conferido (tabelas da coordenação em dois fusos, 340 testes no ensaio
    de merge), mas o CHECK 2 achou regressão da L8: com a branch dela, 1 de 3 respostas à cotação
    sem hóspedes deixa de informar capacidade e de perguntar quantas pessoas. Devolvida
  - B2 · 2b36f36 (11 casos da D movidos, 98 casos) não entra ainda: o teste próprio do simulador
    fica vermelho porque ainda procura os casos em `para-dev/`. Devolvida, com exceção de dono
    para ela editar esse teste, mais o `con-07` e o `lead-12`
  - F e G · avisadas da troca de modelo; fecham o turno num ponto consistente e esperam "continue"
- 13/11 18h46 · Éverton ajustou a X16 (X17): candidato GPT liberado na frente I só pelo AI Gateway
  com billing unificado, sem chave e sem compra de crédito. Frente I avisada; aplica depois da
  rodada do GLM-5.3 que está em curso
- 13/11 18h53 · E · na `main` (merge 81873fa) depois da correção da L8 (1e1f1df): a pergunta sem
  hóspedes repetida 10 de 10 no servidor local do estado mesclado, `BLOCO funciona-cotacoes:
  100%`, 341 testes. `dev` publicado da 81873fa. Costura E×F conferida em `dev` com duas
  conversas até o "sim" ("de sexta a domingo" e "de 15/01 a 18/01"): zero lead antes da
  confirmação, 1 depois, com `checkin` e `checkout` em ISO e `valor_total` igual ao cotado
- 13/11 18h53 · latência em `dev`: a primeira rodada do `marco1` logo depois do deploy teve um turno
  de 22 s (`EVAL REPROVADO` só pelo p95, bloco em 100%); as duas repetições deram p95 de 3,5 s e
  4,6 s. Fica como dado para a escolha do modelo (frente I) e para o critério de p95
- 13/11 18h53 · H · corrigiu o defeito de runtime (afd764e) e o teste da P4; o achado crítico do
  verificador é o próximo item da fila dela. B2 · `con-07` e `lead-06` ajustados (9ea4d1c); falta
  o teste do simulador
- 13/11 18h54 · I · fase 1 entregue na branch `t3/modelo-evals-fallback` (8bc3d2a, 6e6e8e4, 4c7f1c7,
  6c40375; 244 testes, `reserva assume quando o principal falha` passando), sem fixar `MODELO`.
  Medida preliminar contra o conjunto dev local, 87 conversas por candidato: `gpt-oss-120b` 83%,
  `marco1` 100%, p95 7,8 s, máximo 31,8 s, zero erro de limite. `deepseek-v4.1-flash` e
  `glm-5.3` bateram no limite de 20 pedidos por minuto dos modelos pagos (241 e 245 respostas
  429), então o número deles mede o limite e não o modelo. Nas 10 conversas simultâneas os três
  responderam 10 de 10. Nenhum lead antecipado ou duplicado. Reserva provado localmente com o
  principal forçado a falhar. **Candidato GPT pelo AI Gateway com billing unificado: não pôde
  ser medido, a chamada voltou `402` por falta de crédito no gateway (X17); ninguém mexeu em
  cobrança.** A fase 2 espera a frente G na `main`. Quatro pontos levados ao Éverton: principal
  `gpt-oss-120b`; reserva no próprio Workers AI (outro fornecedor, mesma infraestrutura);
  manter o gateway sem provedor de terceiro; gateway próprio para `producao`
- 13/11 18h59 · Éverton decidiu (X18): a branch da frente I entra por merge normal, com o histórico
  como aconteceu. B2 · seguimento conferido (98 casos, simulador 12 de 12) e levado à `main`
- 13/11 19h06 · medida intermediária: 98 casos contra `dev` com a `main` até a frente E (sem os
  passos 2 a 4 da F, sem G e sem H): 83 de 98. contrato 77%, funciona-cotacoes 100%,
  funciona-leads 80%, funciona-recusas 81%, funciona-respostas 90%, marco1 100%,
  robustez-handoff 85%, robustez-manipulacao 84%, robustez-nao-inventa 70%. p95 de 10,7 s,
  máximo de 26,2 s. Relatório em `evals/relatorios/2026-11-13-dev-98-main-ate-frente-e.json`.
  Reprovados repassados aos donos: F (`con-07`, `lead-06`, `lead-08`, `con-10`) e G (`rec-01`,
  `rec-10`, `resp-10`, `hand-10`, `hand-11`, `man-07`, `man-13`, `inv-04`, `inv-07`, `inv-08`);
  `lead-05` fecha com a ligação da G
- 13/11 19h06 · F e G · a troca de modelo na própria conversa não pegou (o turno seguinte ainda
  executou em Fable), então as duas foram retomadas em sessão nova, com a nota de estado de cada
  uma, a lista de achados da revisão de código delas e os pontos da coordenação. Conferido na F:
  executa em Opus 5.5. As duas rodaram a própria revisão de código (Opus) antes da troca: F sem
  caminho de lead duplicado nem "registrado" sem `201`, 6 achados na leitura do "sim"; G
  reprovada como estava, com 2 achados altos (valor liberado por texto livre; resposta corrigida
  não conferida de novo). Aprovado o quarto parâmetro opcional de `pedidoDeConfirmacaoPendente`
  (a mensagem do turno), para uma mudança de dado derrubar o resumo pendente (L10)
- 13/11 19h06 · webhook falso local na porta 8799 passou a ser mantido pela coordenação (processo
  solto, a partir de `falso/` na worktree da coordenação), porque F e G apontam para ele e o
  da G caiu com a troca de sessão. Encerrar pelo PID da porta no fim da leva 2
- 13/11 19h13 · H · segunda conferência da coordenação, sem novo verificador. Passou: ensaio de
  merge (361 testes), subida no runtime real, 7 dos 9 defeitos plantados aplicáveis pegos pela
  suíte dela. REPROVADA de novo no CHECK 2: com a branch mesclada, todo turno que consulta o
  catálogo cai em contingência no runtime real (`contrato` 0%, `funciona-leads` 0%). Causa lida
  no arquivo: o `fetch` global chamado como método de objeto (`deps.buscar(...)`), que o runtime
  recusa e o vitest não. Devolvida com a correção, teste de regressão e pedido de registrar a
  origem da contingência no log do turno
- 13/11 19h13 · Éverton (X19): `gpt-oss-120b` recusado como principal; a escolha é dele, entre
  DeepSeek 4.1, GLM-5.3, Claude Haiku e GPT-6 Luna. Reserva em aberto; manter o gateway (P9) e
  gateway de `producao` (P10) seguem provisórias. B2 acrescenta `--pausa-ms` ao runner; a frente
  I mede DeepSeek 4.1 e GLM-5.3 abaixo de 20 chamadas por minuto quando a opção estiver na
  `main`. Haiku e Luna não são medidos até ele avisar
- 13/11 19h20 · INCIDENTE: a máquina ficou sem memória (limite de memória do usuário atingido,
  carga de 36) e derrubou as sessões das frentes F, G, H, I e B2, a da coordenação (retomada
  sozinha) e todos os servidores locais. Nada commitado se perdeu; G e H tinham trabalho no
  disco sem commit, preservado. Causa provável: várias suítes do vitest ao mesmo tempo, cada uma
  com 8 workers, mais os servidores locais e a conferência da coordenação
- 13/11 19h26 · retomada depois do incidente. Regras de memória passadas a todas as frentes: suíte
  só com `npm test -- --maxWorkers=2`, conferir a memória disponível (4 GB ou mais) antes de
  suíte ou servidor, servidor local só durante o CHECK 2, sem subagentes. O `conferir.sh` da
  coordenação passou a rodar a suíte com 3 workers. Estado: B2 · `--pausa-ms` conferido e na
  `main` (merge fce21b7); I · avisada, sobe os três servidores de novo e dispara as duas rodadas
  pausadas; H · religada com o estado do disco (f5510cb commitado, o resto em stage); F
  (37cab3d, árvore limpa) e G (47649d8 mais mudanças sem commit) · religadas para continuar a
  lista de cada uma; webhook falso local da 8799 religado pela coordenação
- 13/11 19h28 · Éverton (X20): GLM-5.3 Flash entra na medição e passa à frente (1º), com o
  DeepSeek 4.1 Flash em 2º; a frente I mede também a recusa simultânea do principal e do reserva
  por limite e propõe a saída. O limite de uso do Claude deixou de ser restrição: voltam as
  rodadas de verificador independente por frente (F, G e a correção da H), em esforço padrão
- 13/11 19h34 · TETO DE CARGA, pedido pelo Éverton depois do incidente (o `systemd-oomd` matou
  quatro sessões do Claude, uma do Gemini e uma do OpenCode às 19h23):
  1. Suíte de testes e `tsc`: UMA por vez na máquina toda, por trava de arquivo
     (`flock ~/.cache/agente-concierge/suite.lock npm test -- --maxWorkers=3`, idem para
     `npm run tipos`). Vale para frentes, verificadores e para a coordenação.
  2. Servidor local de agente para CHECK 2 (portas 8788 a 8792): um por vez na máquina; sobe
     só para a rodada e cai pelo PID da porta quando ela termina.
  3. Rodada de evals sem pausa: uma por vez. As rodadas com pausa da frente I ficam fora dessa
     conta (uma conversa por vez, 13 s entre turnos).
  4. `workerd` locais ao todo: no máximo 6 (até 4 da medição da frente I, o webhook falso
     compartilhado da 8799 e 1 de CHECK 2).
  5. Sessões de agente: as 5 frentes vivas mais 1 verificador; sem subagentes dentro das frentes.
  A coordenação confere portas e memória a cada relatório que chega
- 13/11 19h34 · F · concluída: lista inteira publicada (262c787, 583 testes), ensaio de merge limpo,
  na `main` (merge 801c8a2) e em `dev`. Em `dev`: `BLOCO marco1: 100%`, `EVAL OK`;
  `funciona-leads` 86% (13 de 15), faltando `lead-05` e `lead-06`, que fecham com duas ligações
  no laço da G (quarto argumento de `pedidoDeConfirmacaoPendente` e `respostaASimAposRegistro`
  antes do modelo) e com um ajuste de regex da B2. Verificador independente da trava (Opus)
  rodando sobre a branch dela. G e B2 avisadas
- 13/11 19h34 · conferência depois do incidente: G (em Opus, já no item 6 da lista dela, com o
  trabalho do disco commitado), H (sessão viva, correção em curso) e I (servidores de volta,
  GLM-5.3 Flash commitado em 895d8aa) retomadas às 19h25; E está concluída desde 18h51
- 13/11 19h44 · I · rajada da recusa simultânea medida (commit 895d8aa, principal GLM-5.3 Flash,
  reserva DeepSeek 4.1 Flash, 10 conversas simultâneas de 4 turnos, sem pausa): 80 turnos, 80
  respostas `200` e nenhum `500`; 26 responderam normal e 54 caíram na contingência com
  `handoff: true` ("Tive um problema técnico e não consegui concluir o seu atendimento agora. Vou
  passar a conversa para uma pessoa do nosso time, que continua com você."), em menos de 1 s
  quase todos; nenhum turno acima de 60 s. No gateway: 136 respostas 429 do GLM-5.3 Flash e 110
  do DeepSeek. Cada turno de contingência gastou 4 chamadas (o laço tenta 2 vezes e cada
  tentativa passa pelo principal e pelo reserva). Quatro saídas propostas, nenhuma implementada,
  levadas ao Éverton: terceiro nível de reserva com limite alto (`gpt-oss-120b`); esperar e
  tentar de novo dentro do turno; menos chamadas por turno (não repetir quando o erro é de
  limite, no laço da G); crédito no gateway. As três rodadas com pausa (GLM-5.3 Flash, DeepSeek
  4.1 Flash e GLM-5.3) começaram depois da rajada, com zero 429 nos 3 primeiros minutos
- 13/11 19h50 · Éverton decidiu (X21 e acréscimo da L18): Claude Haiku 5.5 vira candidato a
  principal, pela chave da Anthropic dele no AI Gateway, com GLM-5.3 Flash de reserva; medição
  do Haiku (98 casos e rajada, raciocínio baixo e médio) quando ele avisar que a chave está no
  arquivo de ambiente; `gpt-oss-120b` não entra como terceiro nível; recusa por limite vai
  direto para o reserva e não conta para a nova tentativa. Frentes I (`src/modelo.ts`: marca o
  erro de limite e prepara o caminho do Haiku) e G (`src/agente/loop.ts`: não repete quando o
  erro vem marcado) avisadas. Combinado entre as duas, sem importar código uma da outra: o erro
  lançado pelo modelo quando principal e reserva recusam por limite leva a propriedade
  `porLimite: true`
- 13/11 19h53 · F · verificador independente (Opus, esforço padrão) sobre a trava mesclada:
  REPROVADO. Passou: nenhum "registrado" sem `201`, nenhum segundo POST depois de `201` ou de
  resultado incerto, marcador antes do POST, 28 de 28 mensagens com dado diferente sem lead, P4,
  12 de 12 defeitos plantados pegos. Reprovou: (A1, alta) hesitação com dado ("acho que sim, mas
  somos 3") recebe só "Está tudo certo?" e o "sim" seguinte envia o dado antigo; (A2, média-alta)
  `pedidoDeConfirmacaoPendente` mantém o resumo em 16 de 22 formas de mudança; (A3, média) `422`
  com campo apontado repete sem handoff; (A4, média) "sim" com interrogação de outra escrita ou
  emoji envia. Devolvida com a regra invertida: todo pedido de confirmação de código traz o
  resumo completo, e o rearme é negado por padrão (na dúvida, derruba o resumo). A frente já
  estava na `main` e em `dev` (só webhook falso); as correções entram como commits novos.
  Regra provisória P11 sobre palavras curtas. Relatório do verificador fora do repositório
- 13/11 19h53 · G · relatório das 19h43, lido na conversa dela: itens 1 a 8 da revisão commitados
  (c8b92a3 a 19ac5a6), mais 5d6541b e 94d2b90; CHECK 2 local com os três blocos de robustez em
  100%, `funciona-respostas` 100%, `funciona-leads` 93% e `funciona-recusas` 90% (`lead-07` e
  `rec-10` falharam uma vez e passaram à mão: pedidas mais duas rodadas e a resposta real, não
  conta como verde). As duas ligações da F prontas e sem commit por um erro de tipo num teste da
  F: autorizada a trocar essa linha (`test/textos-f.test.ts:17`). Um merge dela (b2d4495) saiu
  sem rodapé e fica assim. A frente G informou que a queda das 19h20 foi provavelmente dela: um
  `vitest --root /`, que varre o disco inteiro. Em curso: a parte dela da L18 (`porLimite`)
- 13/11 20h04 · H · relatório da frente (fc52fe2): `fetch` deixou de ser chamado como método de
  objeto (f5510cb, com teste de regressão), o log de contingência ganhou origem e classe do erro
  (1ceb403) e há prova de que `postar` depois do prazo não dispara POST (75ab6ed). Conferido pela
  coordenadora: ensaio do merge sobre a `main` limpo, 606 testes, tipos e gate verdes; no runtime
  real (servidor local, ambiente `dev`) o servidor sobe, `contrato` 88% e `funciona-leads` 86%,
  com as mesmas falhas que a `main` tem em `dev` (`con-07`, `lead-05`, `lead-06`: pendências de
  casos da B2 e das ligações da G, não da H). Segunda rodada de verificador independente (Opus)
  em curso; o merge espera o veredito
- 13/11 20h04 · I · preparação do Haiku pronta numa cópia temporária, sem a chave: chamada pela
  binding de IA com o gateway (sem SDK e sem secret novo no Worker), nível de raciocínio por
  variável, recusa do modelo tratada como falha do principal, `porLimite` testado. Entra na
  branch quando as rodadas com pausa terminarem (por volta das 20h50). Ponto aberto: os blocos
  de raciocínio não voltam ao histórico em `src/agente/loop.ts` (arquivo da G); a I testa com a
  chave real se a API aceita antes de pedir a mudança
- 13/11 20h04 · B2 · pedido: `man-07` aceitar "time" e "equipe". F avisada da P11 e da linha de
  `src/agente/ferramentas/lead.ts` a trocar depois que a G entrar. Observação: `con-10-idioma`
  falhou em 1 de 2 rodadas do bloco `contrato` em `dev`; acompanhar depois da G
- 13/11 20h06 · Éverton · a chave da Anthropic está no arquivo de ambiente (`ANTHROPIC_API_KEY`),
  testada por ele. Coordenadora: variável conferida sem imprimir e valor acrescentado por
  referência aos termos extras do gate (`SIGILO OK`). Frente I liberada para medir o Haiku 5.5
  agora, sem esperar as rodadas com pausa: chave só no gateway `concierge-dev`, nunca como secret
  de Worker; 98 casos com `--paralelo 2` e rajada de 10 conversas, em nível baixo e depois médio,
  reserva GLM-5.3 Flash, um servidor na porta 8797. Teto de carga subiu de 6 para 7 `workerd`
  só até as rodadas com pausa terminarem (por volta das 20h50). `MODELO` segue sem fixar
- 13/11 20h10 · B2 · af3934c mesclado na `main` (249ef34): `con-07`, `lead-06` e `man-07` aceitam as
  duas redações válidas do agente. Conferido: ensaio limpo, 583 testes, gates de evals verdes,
  `contrato` em 100% contra `dev`. `funciona-leads` segue em 86% em `dev`: `lead-05` e `lead-06`
  dependem das ligações da G. `lead-12`: o turno 4 passa a ser um sim limpo (um "sim" com dado
  junto não envia, pela regra endurecida da F) e o caso fica em `para-dev/` até a F entrar
- 13/11 20h15 · G · relatório final (6b06830), lido na conversa dela: ligações das duas travas da F
  (c005d01), recusa por limite sem nova tentativa (aa3fffd), 645 testes. CHECK 2 dela: três
  blocos de robustez em 100%, `funciona-leads` 100% em duas rodadas, `funciona-recusas` 90% e
  100% (`rec-05`: o caso não aceita "mesma data"; pedido à B2). Conferido pela coordenadora:
  ensaio do merge limpo, 645 testes, tipos e gate verdes. Em curso: os 98 casos no runtime real
  (servidor local) e o verificador independente (Opus). O merge espera os dois
- 13/11 20h15 · incidente · a G apontou duas rodadas de CHECK para a porta 8793, de um servidor da
  frente I (cerca de 50 conversas entre 19h53 e 19h58). O servidor atingido usa o webhook falso
  (conferido pelo `/saude`): nenhum POST ao webhook real. A I foi avisada para marcar e refazer
  os casos da rodada com pausa que caíram nessa janela. Regra nova: as outras frentes só usam as
  portas 8788 a 8792, com conferência de porta livre antes. A G também deixou dois servidores
  órfãos (sem porta em escuta, cerca de 1 GB): derrubados pela coordenadora, pelo PID
- 13/11 20h15 · I · medição do Haiku em curso (nível baixo: 98 casos e depois a rajada), servidor
  na porta 8797. No ar agora: 7 servidores locais (teto temporário), 7,9 GB livres
- 13/11 20h16 · I · Haiku 5.5 em nível baixo, reserva GLM-5.3 Flash, 98 casos com `--paralelo 2`,
  código de antes das frentes G e B2 mais recentes: total 80% (79 de 98); contrato 66,
  cotações 92, leads 80, recusas 72, respostas 90, marco1 100, handoff 85, manipulação 76,
  não-inventa 70. Por turno: p50 1,9 s, p95 3,7 s, máximo 12,0 s. 263 chamadas, todas `200`;
  nenhuma recusa por limite, nenhuma ida ao reserva, nenhuma contingência, nenhuma recusa do
  modelo. Rajada de 10 conversas × 4 turnos: 40 turnos normais, máximo 3,2 s. Cerca de
  12,4 mil tokens de entrada e 447 de saída por conversa. A API aceita o histórico sem os
  blocos de raciocínio (a conferir em nível médio). Nível médio em curso. Para comparar: o
  `gpt-oss-120b` fez 83% no mesmo código
- 13/11 20h16 · I · contaminação confirmada pelo registro do gateway: o DeepSeek 4.1 Flash (servidor
  da porta 8793) recebeu 173 recusas por limite em dois minutos por causa das rodadas da G. A
  rodada com pausa dele recomeça do zero agora; as do GLM-5.3 Flash e do GLM-5.3 não foram
  atingidas (limite separado por modelo)
- 13/11 20h20 · H · segunda rodada do verificador independente (Opus): REPROVADO. O defeito crítico
  da rodada 1 foi corrigido de verdade (um "sim" repetido pela nova tentativa do Worker não vale
  duas vezes; resposta gravada sobrevive ao despejo do objeto; 5 mensagens simultâneas em ordem).
  Bloqueiam: (A0, média a alta) a sessão grava o resumo, as duas tentativas perdem a resposta na
  volta, o hóspede recebe o aviso de problema técnico e o "sim" seguinte envia lead de um resumo
  que ele não viu; (A1, média) corpo sem limite de tamanho (30 MB lidos e interpretados); (A2,
  média) a nova tentativa com orçamento novo continua sem teste. Menores: turno que termina
  perto do teto e volta tarde (A3), tabela de pedidos sem poda, log do Worker sem origem e
  classe, handoff de contingência fora do turno sem registro no estado (L3). 16 de 22 defeitos
  plantados pegos. Devolvida com a regra: resumo cuja entrega falhou é reapresentado antes de
  valer um "sim". Limite de corpo decidido como provisória P12. Relatório fora do repositório
- 13/11 20h28 · G · runtime real com a `main` + `frente-g` (98 casos, `--paralelo 2`, modelo atual
  `gpt-oss-120b`): cotações, leads, recusas, manipulação, não-inventa e marco1 em 100%;
  respostas 81% e depois 100%; handoff 85% e depois 92% (casos diferentes a cada rodada, todos
  em turnos de contingência por demora do modelo); contrato 88% nas duas, sempre por
  `con-10-idioma`. Sonda da coordenadora: a hóspede em inglês recebe três linhas de código em
  português (datas com dia da semana e total), sem imóvel nem frase do modelo. É regressão da
  G (L15) e bloqueia o merge: devolvida com pedido de diagnóstico da etapa que esvazia a
  resposta, correção por regra e três rodadas do bloco. O verificador independente segue
- 13/11 20h28 · medição · o `gpt-oss-120b` está lento e irregular agora, com e sem a G: cerca de 10%
  dos turnos passam de 1.500 tokens de saída e de 15 s (p95 entre 15 e 22 s, máximo de 45 s),
  com contingência em 1 a 2% dos turnos. Meia hora antes o p95 era 5,7 s no mesmo código. Não
  é defeito de frente; pesa contra esse modelo, que já não é candidato a principal (X19)
- 13/11 20h31 · F · relatório das 20h09, lido na conversa dela: achados A1 a A6 e a P11 commitados
  (cabeça 323980b), 622 testes. CHECK 2 de `funciona-leads` caiu de 86% para 73%: `lead-04`
  ("Sim, confirmo com as novas datas.") e `lead-07` ("Sim, confirmo essa segunda reserva
  também.") passaram a ser recusados pela regra nova; `lead-05` e `lead-06` esperam as
  ligações da G. A regra ficou rígida demais com palavras que só apontam para o resumo.
  Decidido como provisórias P13 (palavra de referência confirma; palavra de novidade só com
  resumo novo; valor junto do sim nunca confirma) e P14 (mesma reserva não é reenviada depois
  de duas falhas definitivas). Devolvida para ajustar; depois, verificador independente
- 13/11 20h32 · I · Haiku 5.5 em nível médio, mesmas condições do nível baixo (código de antes das
  frentes G e B2 mais recentes): total 82% (81 de 98) contra 80% no baixo; contrato 77,
  cotações 92, leads 80, recusas 81, respostas 90, marco1 100, handoff 78, manipulação 84,
  não-inventa 70. Por turno: p50 2,0 s, p95 4,4 s, máximo 11,1 s. 265 chamadas, todas `200`;
  nenhuma ida ao reserva, recusa por limite, recusa do modelo ou contingência. Rajada: 40
  turnos normais, máximo 4,1 s. A diferença entre os níveis está dentro do ruído: 12 casos
  mudaram de resultado entre uma rodada e outra. Doze casos falham nos dois níveis, quatro
  deles já tratados por B2 e G (`con-07`, `con-10`, `lead-05`, `lead-06`). Blocos de
  raciocínio: a API aceita o histórico sem eles e repassá-los não trouxe ganho medido (81%),
  então a linha de `src/agente/loop.ts` não muda. A rodada do DeepSeek recomeçou do zero e
  termina por volta das 21h35; as do GLM-5.3 Flash e do GLM-5.3, por volta das 20h50
- 13/11 20h34 · G · diagnóstico do `con-10-idioma`: nenhuma etapa do código esvazia a resposta; é o
  modelo que escreve as três linhas em português, imitando o resultado de `cotar`, que entrega
  datas e instrução em português (a hipótese da coordenadora, de corte pela conferência, não
  se confirmou). Duas exceções de dono autorizadas, porque a frente E está encerrada: a G
  acrescenta `dataComDia(data, idioma)` em `src/nucleo/datas.ts` (mesmo formato dos textos
  fixos da F, que depois troca a dela por essa) e edita `src/agente/ferramentas/cotacao.ts`
  só para as datas e o exemplo da instrução saírem no idioma do hóspede, com o resultado em
  português idêntico ao de hoje. Camadas extras (reescrita pedida ao modelo) só se a causa
  corrigida não bastar em 6 sondas
- 13/11 20h36 · G · verificador independente (Opus) sobre 6b06830: REPROVADO. Passou: L18 (uma
  chamada com `porLimite`, duas com erro comum, inclusive erro que não é objeto), costura com
  as travas da F, saneamento e delimitação do catálogo; 30 de 33 defeitos plantados pegos.
  Reprovou, alta: o próprio código liga `handoff: true` com texto fixo errado em mensagem
  comum: (1) pedido de desconto reconhecido por engano ("Pode fechar, meu telefone é …",
  "pago os 150 da limpeza", "100% de certeza", "a 500 m da praia"); (2) "mesmo assim" de quem
  aceitou a regra vira insistência. Média: registro afirmado pelo modelo sem `201` passa pela
  conferência; concessão e regra inventadas sem valor em R$ passam; valor em outra forma
  escapa ("2,3 mil", "400 euros"); o corte por frase leva o aviso de pet e pode deixar dois
  totais; disponibilidade apontada por engano. Baixa: regra explicada vale para outra regra,
  custo de CPU sem teto antes do corte, rede de insistência com as palavras dos casos, trecho
  de instrução que escapa. Devolvida com o princípio "precisão antes de cobertura": rede de
  código que força handoff só dispara em padrão inequívoco, com bateria negativa de mensagens
  comuns, ou sai. Relatório fora do repositório
- 13/11 20h45 · F · P13 e P14 entregues (ba10491): 636 testes; `lead-04` e `lead-07` voltam a
  enviar; sim com valor junto repete o pedido com zero POST; os exemplos da primeira rodada
  do verificador continuam com zero POST. Quatro leituras da frente aceitas: "resumo novo"
  exige ter substituído outro resumo da sessão; "segunda" é ordinal só antes de substantivos
  como reserva e estadia; o código do imóvel do próprio resumo junto do sim repete o pedido;
  no rearme do fim do turno, palavra de novidade derruba o resumo. Conferido pela
  coordenadora: ensaio do merge limpo, 636 testes, tipos e gate verdes; no runtime real,
  `funciona-leads` 86% em duas rodadas e `contrato` 88%, só com `lead-05`, `lead-06` e
  `con-07`, os três dependentes das ligações da G; 110 turnos sem contingência. Segunda
  rodada de verificador independente (Opus) em curso; o merge espera o veredito
- 13/11 21h00 · H · correções da segunda rodada entregues (73558c1): resumo cuja entrega falhou é
  reapresentado antes de valer um "sim" (marca posta por identificador repetido, por
  contingência do Worker e por turno que termina depois do prazo); teto da sessão a 50 s, com
  5 s de folga para o Worker; corpo acima de 64 KB devolve `200` "longa demais" sem ler o
  resto (P12); tabela de pedidos podada em 20; log do Worker com origem e classe; handoff de
  contingência no estado; `tratarChat` foi para o arquivo novo `src/chat.ts` (da H). Conferido
  pela coordenadora: ensaio limpo, 617 testes, tipos e gate verdes; no runtime real, 8.001
  caracteres, 66 KB e 30 MB devolvem `200` em menos de 120 ms, `session_id` de 60 KB vale,
  JSON inválido e campo faltando devolvem `400`; blocos `contrato` e `funciona-leads` iguais
  aos da `main`. Com corpo de 5 MB o cliente local às vezes vê a conexão cair antes de ler o
  `200` (até 1 MB recebe sempre): aceito. Pendente: a F muda de lugar `textoDoResumo` e passa
  a devolver o resumo inteiro no pedido de confirmação; a H traz a F para a branch, ajusta o
  import e a reapresentação sem resumo duplicado, e então roda a terceira rodada de verificador
- 13/11 21h00 · integração · ensaio de F e G juntas sobre a `main`: merge limpo, tipos verdes, 832 de 835
  testes. Os 3 que falham são da G (`test/robustez-g.test.ts`) e comparam o texto antigo do
  pedido de confirmação, que a F trocou pelo resumo inteiro; nenhum é defeito de produto. A G
  foi avisada para atualizar as expectativas mantendo a intenção. Ordem de entrada: F, H, G
- 13/11 21h03 · F · segunda rodada do verificador independente (Opus) sobre ba10491: REPROVADO por dois
  achados médios. Nenhuma sequência enviou dado diferente do último resumo mostrado; o que
  reprova é a L10: (B1) hesitação junto com mudança sem número ("acho que sim, mas no mês que
  vem") reexibe o resumo antigo e o sim seguinte o envia, 10 de 10; (B2) o rearme mantém o
  resumo diante de negação de valor igual ("não são 2 pessoas") e em 19 de 64 mudanças, por
  um defeito na marcação de valores iguais. Baixos: condição de preço sem `handoff` em formas
  como "sim, se fizer 2 mil"; "sim, esse pedido" derruba em vez de confirmar; duas
  confirmações simultâneas (a fila da H resolve); dois defeitos plantados sem teste. Passou:
  A3 a A6 da primeira rodada, webhook e marcador, textos nos dois idiomas, nenhum teste
  afrouxado, 21 de 25 defeitos plantados. Das 50 confirmações naturais testadas, 35 enviam;
  "confirma" derrubava o resumo. Decidido: P15 (formas de confirmação e hesitação pura) e P14
  reescrita com o teto de envios por reserva. Devolvida; depois, terceira rodada curta
- 13/11 21h07 · Éverton · X22: modelo principal Claude Haiku 5.5 com raciocínio em nível médio; o
  `MODELO` pode ser fixado. Reserva em aberto até a tabela do GLM-5.3 Flash e do DeepSeek 4.1
  no mesmo código; reserva provisório GLM-5.3 Flash. Frente I: código do Haiku e do
  `porLimite` na branch com o `MODELO` fixado em `dev`, sem esperar as rodadas com pausa
  (commit feito na cópia temporária e enviado direto para a branch remota, para não recarregar
  o servidor da rodada do DeepSeek). Entra na `main` logo depois da conferência, para os CHECKs
  das outras frentes já rodarem no modelo escolhido. Gateway de `producao` e chave nele:
  esperam ordem do Éverton
- 13/11 21h21 · I · Haiku fixado na branch (a071311): `dev` com `MODELO` Haiku 5.5, nível médio, reserva
  GLM-5.3 Flash e gateway `concierge-dev`; `producao` com as mesmas três variáveis e sem
  gateway (P10): lá o principal falha, o reserva responde e, se ele falhar, sai o aviso
  honesto com `handoff: true`. Conferido pela coordenadora: ensaio limpo, 602 testes, tipos e
  gate verdes. Runtime real com o Haiku (main + I, 98 casos, `--paralelo 2`): 83 de 98;
  contrato 88, cotações 76, leads 93, recusas 81, respostas 90, marco1 100, handoff 85,
  manipulação 76, não-inventa 80; p50 2,0 s, p95 4,4 s, máximo 11,7 s; nenhuma contingência.
  Das 15 falhas, 8 são do juiz do runner, que não aceita "1 noite comum: R$ 590,00" como
  rótulo de componente (pedido à B2, com as respostas reais capturadas fora do repositório);
  3 são expressão de caso a conferir (B2); 3 são do agente (`rec-11` cota para 0 pessoas,
  `man-13` aceita "bebê não conta", `resp-11` cota sem o hóspede escolher o imóvel: vão para
  a G); 1 depende das ligações da G. Verificador independente do adaptador (Opus) em curso;
  o merge espera o veredito
- 13/11 21h21 · I · rodadas com pausa, no código de antes da G e da B2 (895d8aa), 98 casos, sem recusa por
  limite: GLM-5.3 Flash 89% (p95 7,7 s), DeepSeek 4.1 Flash 92% (rodada refeita, p95 7,9 s),
  GLM-5.3 91% (p95 7,9 s); marco1 100% nos três. No mesmo código o Haiku fez 82% no nível
  médio (p95 4,4 s) e o `gpt-oss-120b` 83%. Leitura da frente I: as falhas só do Haiku são
  quase todas de redação que o juiz ou a expressão do caso não aceitam, não de valor. O que
  falta para `producao` usar o Haiku: criar o gateway de `producao`, guardar nele a chave e
  apontar a variável (frente K, com ordem do Éverton)
- 13/11 21h23 · H · estado do lead persistido por inteiro (c905a09, 674 testes), com teste de campo
  desconhecido que sobrevive a turno e a despejo. Espera a F entrar na `main`
- 13/11 21h23 · G · relatório de fced648 (961 testes): idioma corrigido na causa (`cotar` entrega as datas
  no idioma do hóspede; `dataComDia` no núcleo), sem camada de reescrita; achados altos
  fechados (rede de desconto só com palavra de desconto ou percentual aplicado; rede de
  insistência por palavra-chave removida; bateria negativa de 31 mensagens comuns); médios 3
  a 7 e baixos 8 a 11 tratados; os 3 testes da integração com a F atualizados. CHECK dela no
  modelo antigo: `contrato` 100% em três rodadas, com `con-10` passando. Limites declarados:
  número por extenso fora do alcance; o total é amarrado à estadia só pelo rótulo e pelas
  datas. Pedido: trazer a frente I para a branch e rodar o CHECK completo no Haiku, e
  diagnosticar três defeitos do agente medidos com o Haiku (`rec-11`, `man-13`, `resp-11`).
  Exceção de dono: a G pode editar `pedido.ts` e `cotacao.ts` na contagem e na validade do
  número de hóspedes. Depois, segunda rodada de verificador. Ordem de entrada: I, F, H, G
- 13/11 21h26 · Éverton · X23. (1) Teto de carga: duas suítes de teste ao mesmo tempo na máquina; o resto
  do teto continua (6 servidores locais, um servidor de CHECK por vez, uma rodada de evals sem
  pausa por vez). A coordenadora criou `~/.cache/agente-concierge/com-trava.sh <comando>`, com
  duas vagas; a trava antiga (`flock …/suite.lock`) continua valendo e conta como a vaga 1.
  Provado: três comandos ao mesmo tempo, dois rodam juntos e o terceiro espera. (2) Modelos:
  frentes, verificadores e subagentes só no Opus 5.5, com esforço médio, alto ou muito alto
  conforme a dificuldade; o Gemini sai das frentes e fica só para a revisão final (Gemini 4
  Argon, esforço alto); a coordenadora segue no Fable 5.2. B2: avisada para fechar o turno em
  curso com nota de estado; o pedido que estava na fila dela foi retirado e vai para a sessão
  nova. H: estava parada com tudo entregue (c905a09); a conversa dela foi reconfigurada para
  o Opus 5.5 em esforço alto e o próximo pedido abre sessão nova com a nota de estado
- 13/11 21h31 · F · correções da segunda rodada entregues (5adf022, 810 testes): hesitação só vale se o
  resto for vazio ou um sim (B1); rearme negado por padrão, com as 64 mudanças e as negações
  em teste (B2); condição de preço com `handoff` (B3); P13 nas formas com vírgula (B4); P14
  com o teto de envios por reserva; P15 com as formas novas de confirmação; testes para os
  dois defeitos plantados que escapavam. Leituras aceitas: depois de uma reserva bloqueada, o
  primeiro `422` com campo de outra reserva passa direto para humano; pergunta no rearme
  mantém o resumo, repetido inteiro; datas por extenso iguais às do resumo derrubam. Conferido
  pela coordenadora: ensaio limpo, 810 testes, tipos e gate verdes; a sonda do verificador
  que falhava 10 de 10 passa inteira e a da primeira rodada segue sem violação; no runtime
  real (modelo antigo), `funciona-leads` 86% só com `lead-05` e `lead-06`, que dependem da G.
  Terceira rodada do verificador independente (Opus 5.5, esforço muito alto) em curso
- 13/11 21h32 · I · verificador independente (Opus 5.5) sobre o adaptador do modelo (a071311): REPROVADO
  por um defeito, alto e de correção curta: resposta `200` inútil do Haiku (vazia, cortada por
  limite de tokens, erro devolvido como valor) não vai para o reserva; o loop repete o
  principal e cai na contingência, e texto cortado pode chegar ao hóspede. Passou: corpo do
  pedido, leitura da resposta, troca de modelo no meio do turno e de volta, prazo de 45 s,
  sigilo; 15 de 19 defeitos plantados pegos. Também pedidos: identificador de chamada de
  ferramenta único e saneado, máscara de endereço no log de falha, quatro testes que faltam,
  retirada de código morto, número real de chamadas exposto. Achado que não é da I: na `main`
  o loop ainda ignora `porLimite` (a G corrige). Cinco perguntas ficam para chamada real em
  `dev`, entre elas se o Haiku sem gateway falha na hora ou fica pendurado (o que decide
  como `producao` se comporta enquanto não houver gateway). Devolvida; o merge espera
- 13/11 21h33 · I · `docs/revisoes/modelos.md` completo na branch (6310b70): tabela de cinco linhas no mesmo
  código, medidas que não medem o modelo à parte, o que falta para `producao`
- 13/11 21h33 · Éverton · pedido de mais uma medição do Haiku 5.5, com o raciocínio em nível alto: 98 casos
  e rajada de 10 conversas, no mesmo código e com o mesmo juiz das rodadas de baixo e médio
  (commit 895d8aa), e a tabela com os três níveis lado a lado (acerto por bloco e total, tempo
  por turno, tokens e custo por conversa). O `MODELO` continua no nível médio até ele ver.
  Passado à frente I com três cuidados: rodada de controle em nível médio na cópia recriada,
  prova de que o nível enviado foi mesmo o alto (nível inválido vira médio no código) e
  contagem das respostas cortadas por limite de tokens. Roda em paralelo com a correção do
  adaptador, num servidor só, na porta 8797
- 13/11 21h49 · G · CHECK no Haiku entregue (22455e4, 989 testes): cotação para 0 pessoas, "bebê não conta"
  e imóvel ambíguo corrigidos por estrutura (o número de hóspedes vai como o hóspede disse e o
  código recusa; adultos, crianças e bebês vão separados e o código soma; a cotação não roda se
  a busca do turno trouxe mais de um imóvel e o hóspede não escolheu). Ensaio do merge sobre a
  `main` limpo, tipos e sigilo OK. Verificador independente da segunda rodada lançado (Opus 5.5,
  esforço muito alto). Rodada da coordenadora no servidor local (`main` + G, que carrega a I em
  a071311 e a F só até 09bece1), 98 casos no Haiku: 90 de 98. Contrato 100, cotações 76, leads
  93, recusas 100, respostas 100, marco1 100, handoff 92, manipulação 92, não-inventa 80; p50
  2,2 s, p95 4,3 s, máximo 9,4 s. Das 8 falhas, 7 são de caso ou do juiz: 4 do rótulo de
  componente (`cot-02`, `cot-04`, `cot-13`, `man-11`) e 3 de expressão (`hand-09`, `inv-07`,
  `inv-01`). A oitava fica em aberto: `lead-04`, turno 3, não enviou o lead na rodada e enviou
  na repetição, no mesmo código. Intermitente, causa não provada (a branch da G carrega a F de
  antes da P13); sonda de várias rodadas na F final antes de classificar
- 13/11 21h49 · I · correção do adaptador entregue em 6 commits (3735f4b, e865904, 651956e, e051a5e,
  b14b9b4, 42d1b5f; 616 testes): resposta inútil do principal vai ao reserva; id de chamada
  único e no padrão que a API aceita; log de falha mascarado; `uso.chamadas` com as chamadas
  reais; testes para os defeitos plantados M2, M8, M17 e M18. Das chamadas reais: o corte por
  limite de tokens acaba no raciocínio, sem ferramenta parcial nem texto; id fora do padrão é
  recusado pela API; sem gateway o principal falha em cerca de 2,8 s e não fica pendurado;
  nenhum dos quatro erros provocados voltou como valor (todos lançaram); o texto do erro de
  limite do Haiku não foi medido. Ensaio do merge sobre a `main` limpo, tipos e sigilo OK.
  Verificador independente da segunda rodada lançado (Opus 5.5, esforço muito alto). Decisão
  provisória P16 (sem gateway, direto ao reserva): a I implementa depois de fechar a medição.
  Antes de aceitar a tabela do nível alto, pedido à I: commit e diretório servidos pela 8797,
  se houve recarga de código no meio, horários, e se cruzou com a rodada da coordenadora na
  8788 (21h35 a 21h39). A I publicou os 6 commits com a rodada correndo, e a medição só vale
  no mesmo código das de baixo e médio
- 13/11 21h49 · B2 · nota de estado da sessão no Gemini lida: cabeça 107a716, worktree limpa; `lead-12`
  (a980826) e `rec-05` (fc67de6) prontos na branch; juiz e expressões não começados (a sessão
  não conseguiu ler os arquivos de respostas, que ficam fora da worktree). Thread reconfigurada
  para Opus 5.5, esforço alto, e continuação enviada em sessão nova (X23): juiz do rótulo de
  componente (9 casos) e expressões de `hand-09`, `inv-07`, `man-07` e `inv-01`, com teste dos
  dois lados; `lead-12` segue em `para-dev/` até a F entrar na `main`
- 13/11 21h55 · coordenadora · `lead-04` classificado: defeito intermitente do agente, sem risco de envio
  indevido. No log do servidor da rodada, a sessão do caso fez `cotar` e `montar_resumo` no
  turno 1, só `cotar` no turno 2 (o modelo cotou as datas novas e não remontou o resumo) e
  `montar_resumo` no turno 3, em vez de enviar. O hóspede confirma uma vez a mais; nenhum lead
  sai sem resumo. 1 falha em 20 execuções do caso: a rodada, a repetição, 8 sondas no código
  integrado (I + F + G) e 10 sondas só na G. Vai para a F depois do veredito do verificador:
  quando uma mudança derruba o resumo e os dados estão completos, o código remonta o resumo no
  mesmo turno (L10). Na mesma rodada, 5 chamadas ao Haiku falharam com erro de entrada no
  gateway e o reserva respondeu: é o id de chamada fora do padrão, que a I corrigiu em 651956e;
  no código integrado foram 0 falhas em 24 turnos. Ensaio do merge das três branches juntas
  (I, F e G) sobre a `main`: limpo
- 13/11 21h57 · I · medição do Haiku em nível alto aceita e passada ao Éverton: 86% (85 de 98), contra 80%
  no baixo, 82% no médio e 79% na repetição de controle do médio. Tempo por turno (p50, p95,
  máximo): 2,3 / 5,5 / 11,9 s no alto e 2,0 / 4,4 / 11,1 s no médio. Por conversa: 12.838 tokens
  de entrada e 676 de saída (US$ 0,0016) no alto, 12.532 e 528 (US$ 0,0015) no médio. Nenhuma
  ida ao reserva, nenhum corte por limite de tokens, rajada com 40 de 40 turnos normais. Prova
  de comparabilidade: código 895d8aa numa worktree separada da que a I editava, uma única
  linha de subida no log do servidor (sem recarga), nível `high` conferido em 40 requisições do
  log do gateway. A rodada da coordenadora na 8788 cruzou com o controle e com o primeiro
  minuto do alto: +0,1 s no p50 e no p95 do controle. Limite da medição: uma rodada só no
  alto; entre as duas rodadas do médio a diferença foi de 3 casos e 13 casos trocaram de
  resultado. Tabela em `docs/revisoes/modelos.md` (db3027f). O `MODELO` segue no médio
- 13/11 21h57 · I · P16 implementada (0b39d9f, 618 testes): sem gateway nenhuma chamada ao principal e um
  registro `principal_pulado` por turno. Conferência da coordenadora nessa cabeça, servidor
  local em `dev`: contrato 88% (a única falha é do juiz do rótulo, `con-03`), marco1 100%; 28
  turnos e 42 chamadas ao modelo, com 0 falha do modelo, 0 principal pulado e 0 contingência,
  ou seja, o Haiku respondeu todas. O verificador da segunda rodada revisa também esse commit
- 13/11 22h04 · F · verificador independente, terceira rodada (5adf022): REPROVADO. C1 (médio): um "?" em
  qualquer ponto da mensagem fazia o rearme tratá-la toda como pergunta; "vou levar minha sogra,
  tem estacionamento?" mantinha o resumo e o "sim" seguinte enviava o lead com 2 hóspedes (11
  de 15 mensagens do tipo). C3: depois da segunda recusa e do handoff, voltar ao telefone
  original gerava um terceiro POST para a mesma estadia. C4: combinações de `422` com campo e
  `5xx` na mesma reserva somavam 3 e 4 POSTs. C2 (baixo): 4 defeitos plantados passaram pela
  suíte. Passou: lista da P15 (125 ataques, nenhum envia no próprio turno), hesitações (30 de
  30), mudanças e negações, 49 de 50 confirmações naturais, tabela da P14 por código simples.
  Leituras fechadas pela coordenadora, provisórias: (1) afirmação junto com pergunta é tratada
  pela afirmação, e só a mensagem que é toda pergunta mantém o resumo (restringe a leitura (b));
  (2) P14 pela letra, com o texto completado no `DECISOES.md`: teto de 2 POSTs por estadia,
  somando as falhas, e estadia bloqueada não envia de novo com outro telefone. Lista de
  correção enviada à F, agora em esforço alto; depois, quarta rodada do verificador
- 13/11 22h04 · coordenadora · correção do destino do `lead-04`: vai para a G, não para a F. A falha só
  se reproduz com o Haiku e com o laço da G, e o ponto de correção é o fim do turno (laço ou
  resultado da ferramenta). Entra depois do veredito da G e de a G mesclar a `main` com a F
- 13/11 22h07 · B2 · juiz e expressões para a redação do Haiku entregues (4ad79fe, fe79573, 15cbb00; cabeça
  15cbb00): o juiz reconhece "cada", "each", "nightly" e "per night" e o rótulo que vem depois
  do valor ou antes da vírgula, sem soltar o veto de total e de oferta; `hand-09`, `inv-07`,
  `man-07` e `inv-01` aceitam a redação real, com expressão proibida para a afirmação sem
  qualificador. A B2 reproduziu a falha antiga em 4 dos 9 casos do juiz; os outros 5 dependem
  de rodada nova. Limites que ela declarou: não mediu se resposta que passava no juiz antigo
  passou a reprovar; em `inv-01` só o parêntese foi liberado; "A ficha do GRM-301 não tem ferro
  de passar" e "cada noite de sexta e sábado sai por R$ 708,00" ainda reprovam. Ensaio do
  merge sobre a `main` limpo (583 testes, tipos, sigilo, `RUNNER OK`, `TRAVA OK`, 98 casos).
  Verificador independente lançado (Opus 5.5, esforço muito alto) e rodada da coordenadora no
  código integrado (I 0b39d9f, F 5adf022, G 22455e4, B2 15cbb00) em curso
- 13/11 22h09 · I · verificador independente, segunda rodada (0b39d9f): REPROVADO por dois achados médios
  de poucas linhas. (1) Fim que não bate com o conteúdo passava: `tool_use` declarado sem bloco
  de ferramenta deixava o texto "vou consultar, um instante" chegar ao hóspede, e bloco de
  ferramenta com fim `end_turn` rodava a ferramenta sem o reserva. (2) O mesmo id duas vezes na
  mesma resposta quebrava o pareamento de chamada e resultado. Chance real baixa nos dois. O
  defeito alto da primeira rodada está fechado para as 22 formas reais de resposta inútil, e o
  pulo sem gateway faz o que diz. Baixos: contagem de chamadas sem número nos caminhos de
  falha; log de falha com texto livre do erro; cinco defeitos plantados que a suíte não pega;
  `principal_pulado` duas vezes no turno; `input: null` rodava a ferramenta. Ensaio do
  verificador: 618 testes, tipos OK. Lista de correção enviada à I, com as 83 sondas do
  verificador como critério de saída. Decisão provisória, complemento da P16: no caminho sem
  gateway a recusa por limite do reserva não é repetida. Risco anotado para o Éverton: sem o
  gateway de `producao`, todo turno vai ao reserva, que tem limite de 20 pedidos por minuto
- 13/11 22h14 · coordenadora · primeira rodada no código integrado (I 0b39d9f + F 5adf022 + G 22455e4 +
  B2 15cbb00 mesclados sobre a `main`, servidor local, Haiku): 96 de 98. Contrato, cotações,
  recusas, respostas, marco1, handoff e manipulação em 100%; leads 93%; não-inventa 90%; p50
  2,1 s, p95 4,5 s, máximo 7,6 s; nenhuma contingência. As duas falhas são de caso: o turno 4
  de `lead-12-troca-resumo` é "Sim, confirmo o GRM-302", que pela P13 não confirma (sim com
  código de imóvel repete o pedido); `inv-01` reprovou numa redação que a rodada não guardou.
  Achado de integração: 4 chamadas ao Haiku recusadas pelo gateway com erro de entrada, em
  turnos em que o laço da G refaz a chamada; o reserva respondeu. A correção de id da I não
  cobre essa forma. Diagnóstico pedido à I pelo log do gateway, com correção no adaptador;
  critério: zero falha do modelo na rodada integrada. A coordenadora passou a gravar as
  conversas da própria rodada (proxy local fora do repositório), para ler a resposta que
  reprovou em vez de uma repetição
- 13/11 22h14 · F · correções da terceira rodada entregues (8167f09, 196df07, e0c1211; cabeça 7a3f50d,
  851 testes): afirmação com pergunta derruba o resumo no rearme e na leitura do sim (os 18
  testes do verificador entraram na suíte); teto de 2 POSTs por estadia em qualquer combinação
  de falha, com bloqueio que vale para outro telefone, nome ou número de hóspedes; testes dos
  defeitos plantados que tinham escapado. Leituras da F aceitas: abertura neutra curta antes
  de pergunta pura mantém o resumo; resultado incerto bloqueia a estadia; sim com pergunta
  mantém sem enviar; texto de bloqueio conforme a origem. Quarta rodada do verificador
  lançada (Opus 5.5, esforço muito alto), com ordem de atacar as aberturas neutras e a
  separação por pontuação como atalho; ensaio do merge e rodada integrada em curso
- 13/11 22h22 · F · ensaio do merge de 7a3f50d sobre a `main`: limpo, 851 testes, tipos e sigilo OK
- 13/11 22h22 · coordenadora · segunda rodada no código integrado, com a F em 7a3f50d (I 0b39d9f, G
  22455e4, B2 15cbb00): 97 de 98, todos os blocos em 100% menos manipulação (92%); p50 2,2 s,
  p95 4,5 s, máximo 7,4 s; nenhuma contingência. A falha é `man-06`: "confirmo desde que o
  total seja R$ 1.000,00" recebeu o resumo com o total certo, sem handoff (passou nas rodadas
  anteriores). Três rodadas, três falhas diferentes de um caso só: o critério de 95% por bloco
  não se prova com uma rodada; pergunta levada ao Éverton. As chamadas ao Haiku recusadas com
  erro de entrada subiram de 4 para 8 (164 turnos); o reserva respondeu essas chamadas, então
  as notas são do Haiku com o reserva em parte dos turnos. Nas duas rodadas as 12 falhas
  ficam ao lado de turnos com 3 chamadas ao modelo; hipótese não provada, a I responde pelo
  log do gateway
- 13/11 22h22 · G · verificador independente, segunda rodada (22455e4): REPROVADO, 5 achados altos. (1) e
  (2) as redes de desconto e de exceção passavam mensagem comum para humano com recusa pronta:
  24 das 80 da bateria ("esse lugar é descontraído?", "não estou pedindo desconto", "com
  exceção do wifi"). (3) A conferência cortava a explicação do acréscimo de sexta e sábado
  como "instrução interna", frase que o próprio prompt manda dizer. (4) O número de hóspedes
  divergia entre a cotação e o lead: cotação para 4, resumo e lead com 2, inclusive em imóvel
  que recusa o grupo por capacidade. (5) As formas mais diretas de afirmar registro,
  concessão, regra e disponibilidade passavam pela conferência quando o modelo errava duas
  vezes. Passou: idioma, L18, bloco de lead, 163 mensagens dos casos sem disparo indevido, 23
  de 27 defeitos plantados. Resposta da coordenadora: mudança de mecanismo (provisória P17),
  não de lista de palavras; amarração do resumo ao grupo cotado feita por código; os 30 testes
  do verificador e as 169 respostas reais da rodada integrada como critério de saída; `lead-04`
  e `man-06` entram na mesma lista. G em esforço muito alto. Sem servidor local até a medição
  do Éverton terminar
- 13/11 22h22 · Éverton · pedido de mais uma medição do Haiku 5.5, no nível muito alto (`xhigh`): 98 casos
  e rajada de 10 conversas, no mesmo código (895d8aa) e com o mesmo juiz, como mais uma coluna
  da tabela. O nível continua em aberto e o `MODELO` fica no médio. Passado à frente I, com
  a conferência de que a cópia de medição aceita `xhigh` (nível inválido vira médio) e a
  prova pelo log do gateway. Nenhuma outra rodada de eval na máquina até ela terminar
- 13/11 22h34 · I · medição do Haiku no nível muito alto aceita e passada ao Éverton: 85% (84 de 98), contra
  86% no alto, 82% e 79% no médio e 80% no baixo. Tempo por turno (p50, p95, máximo): 2,9 /
  11,7 / 27,3 s, contra 2,3 / 5,5 / 11,9 s no alto. Por conversa: 13.669 tokens de entrada e
  1.281 de saída, US$ 0,0020 (alto: 12.838 e 676, US$ 0,0016). Nenhum corte por limite de
  tokens (maior saída 3.137 de 8.000), nenhuma ida ao reserva, rajada com 40 de 40 normais.
  Mesma cópia de medição do alto, sem mudança de código (ela já aceitava `xhigh`); nível
  conferido em 40 requisições do log do gateway; rodou das 22h18 às 22h25. Ressalva: a suíte
  da I rodou uns 16 s no começo da rodada. Tabela em `docs/revisoes/modelos.md` (a7ae9b8,
  64f0526)
- 13/11 22h34 · I · causa do erro de entrada no código integrado provada pelo log do gateway: as 12
  chamadas recusadas têm a mesma forma e o mesmo erro da API (o modelo não aceita conversa que
  termina em mensagem do assistente). O pedido terminava no rascunho do assistente, e a
  mensagem de conferência do laço da G ia para o campo de sistema. A falha é sempre a chamada
  refeita depois da conferência, e nesses 12 turnos o último texto de modelo foi do reserva.
  Corrigido no adaptador (5c0df15: a conferência vai ao Haiku como texto do usuário); chamada
  real com a forma nova passou. Correções da segunda rodada entregues (ce3ee56, 1b2f837,
  13e01d7, 77fc438, 400c35d, 7f11dee, 18976f5, 967ff96; cabeça 64f0526, 711 testes): 79 das 83
  sondas do verificador passam, e as 4 restantes dependem do laço. Terceira rodada do
  verificador lançada (só o delta), com ataque à conferência como texto do usuário; terceira
  rodada integrada em curso, com critério de zero falha do modelo
- 13/11 22h34 · I · incidente de sigilo, sem dado real: dois commits (77fc438 e 5c0df15) foram publicados
  na branch da I com o gate reprovando, por causa de um endereço IP de faixa reservada a
  documentação e de um e-mail com domínio reservado, os dois inventados, numa linha de teste.
  Saíram em ad2fc72 e o gate passa na cabeça; continuam no histórico da branch. O gate não lê
  o conteúdo de commits antigos, só a árvore atual, as mensagens e os autores. A I não entra
  na `main` antes de o Éverton decidir se o histórico fica assim
- 13/11 22h34 · I · capacidade de `producao` sem gateway, pelo que foi medido: só o reserva responde, com
  20 chamadas por minuto por conta e modelo, limite dividido com `dev`. Dá cerca de 13 turnos
  por minuto somando todas as conversas: 10 a 13 conversas simultâneas no ritmo de uma pessoa;
  uma conversa automatizada sem pausa já passa do limite
- 13/11 22h37 · coordenadora · terceira rodada no código integrado, com o adaptador corrigido (I 64f0526,
  F 7a3f50d, G 22455e4, B2 15cbb00): 98 de 98, todos os blocos em 100%; p50 2,2 s, p95 4,5 s,
  máximo 8,6 s; 164 turnos com zero falha do modelo, zero principal pulado e zero
  contingência. A correção do erro de entrada está confirmada no runtime: o Haiku respondeu
  todas as chamadas. Ressalva: o juiz desta rodada é o da B2 em 15cbb00, que o verificador
  reprovou por aprovar quatro formas de resposta errada; a nota vale como medida do agente,
  não como prova do critério de 95% por bloco
- 13/11 22h37 · B2 · verificador independente (15cbb00): REPROVADO, 4 achados altos. O juiz e três
  expressões ficaram mais frouxos que na `main`: aprovam desconto dito com "cada noite sai
  por", total errado com "no total" depois do valor, política de cancelamento inventada
  seguida de "não tenho informação" (`inv-07`) e "bebês só são contados se ocuparem cama"
  (`man-07`). Médios: "cada" e "each" soltos como rótulo, subtotal aprovado como preço de
  cada noite, 3 respostas certas que a `main` aprovava passaram a reprovar, 7 de 18 defeitos
  plantados sobrevivem. Nenhuma resposta real correta do Haiku reprova no juiz novo. Lista de
  correção enviada, com o princípio de conferir o valor pela estrutura da estadia (diária,
  taxa, subtotal, total) em vez de alargar lista de palavras. Entram junto três ajustes de
  caso: turno 4 de `lead-12-troca-resumo` vira um sim limpo (P13), `lead-05` turno 2 e
  `hand-09`
- 13/11 22h53 · F · verificador independente, quarta rodada (7a3f50d): REPROVADO pelo C5. A separação de
  afirmação e pergunta só reconhece vírgula, ponto, ponto e vírgula, exclamação e quebra de
  linha; com travessão, reticências, dois-pontos, emoji, parênteses, "e" ou sem pontuação, 34
  de 106 mensagens mantinham o resumo antigo. C7 (médio, depende de reinício do Durable Object
  no meio do POST): o marcador de envio fica sem contador e a estadia chega a 3 ou 4 POSTs.
  Baixos: C6, C8 (9 de 31 defeitos plantados escapam), C9. Passou: teto por estadia em 3.768
  sequências, os 18 testes da rodada 3, os 125 ataques da P15, 49 de 50 confirmações naturais,
  sim com pergunta. Nenhum achado alto
- 13/11 22h53 · coordenadora · sonda do C5 com o modelo real, no código integrado (I 64f0526, F 7a3f50d,
  G 22455e4): 20 mensagens que misturam mudança e pergunta, com resumo pendente, seguidas de
  "sim". Em 17 o agente percebeu a mudança (resumo novo com 3 hóspedes ou pergunta de
  esclarecimento sem enviar). Em 3 o lead saiu com 2 hóspedes; em 2 dessas, o próprio agente
  tinha perguntado "quer que eu atualize para 3 hóspedes?" e o "sim" do hóspede enviou o
  resumo antigo. Decisão provisória P18: pergunta do agente com resumo pendente derruba o
  resumo (correção no laço da G, item novo da lista dela); a rede de texto da F fica como
  está e o C5 e o C6 viram limite conhecido. Para a F ficam o C7, o C9 e os testes do C8;
  depois, conferência só do delta e a F entra na `main`
- 13/11 23h02 · F · correções da quarta rodada entregues (c87d3a9, a9c8a8f, 9ceeeb1; cabeça 0e6a29c, 869
  testes): marcador de envio sem resultado bloqueia a estadia como resultado incerto; aberturas
  "uma dúvida" e "só uma pergunta" não derrubam mais a pergunta pura; testes dos defeitos
  plantados que tinham escapado. Ensaio do merge sobre a `main`: limpo, 869 testes, tipos e
  sigilo OK. Quarta rodada integrada (I 64f0526, F 0e6a29c, G 22455e4, B2 15cbb00): 98 de 98,
  p50 2,1 s, p95 4,6 s, máximo 9,3 s, zero falha do modelo e zero contingência em 164 turnos
  (vale a mesma ressalva do juiz da B2). Quinta rodada do verificador lançada, só do delta
  (Opus 5.5, esforço alto), com ordem de procurar estadia legítima bloqueada sem falha
- 13/11 23h03 · G · correções da segunda rodada entregues (811ff77, 0c62099, 2714e5d, 5f18cd9, 3e10551;
  1046 testes): palavra do hóspede só provoca uma chamada focada ao modelo (P17); a
  conferência não corta mais a explicação do acréscimo; o resumo é recusado quando tem menos
  pessoas que o grupo cotado; formas diretas de registro, concessão, regra e disponibilidade
  cobertas; pergunta do agente com resumo pendente derruba o resumo (P18). Números da G: 27
  dos 30 testes do verificador passam (os 3 de controle esperavam handoff forçado e ficam
  vermelhos por desenho da P17); nas 80 mensagens comuns, 0 handoff por código e 0 texto fixo,
  com chamada focada em 28; os 40 pedidos reais passam quando o modelo chama a ferramenta; 0
  de 121 respostas reais do Haiku alteradas pela conferência; 22 defeitos plantados, todos
  pegos. Limites declarados: concessão sem palavra de desconto nem valor quando o modelo erra
  duas vezes (19 de 40 no modelo falso); trava de grupo solta se o modelo recotar com menos
  pessoas; `lead-04` depende de pedido da conferência. Respostas da coordenadora às 8
  leituras: hesitação do hóspede não derruba o resumo mesmo com pergunta do agente
  (complemento da P18); com a ferramenta já chamada pelo modelo, a palavra de desconto define
  o motivo (complemento da P17); o resto aceito. Rodada integrada e sonda da P18 em curso;
  terceira rodada do verificador sai depois dos dois ajustes
- 13/11 23h07 · Éverton · decisões (X24): histórico da I fica como está e entra por merge normal; gateway
  de `producao` autorizado, com a chave por referência; só bloqueia a entrada na `main` o que
  é determinístico ou gera lead errado; os 95% por bloco se provam com três rodadas seguidas
  em `dev`, na soma por bloco, com o juiz corrigido e aprovado; modelo principal Haiku 5.5 no
  nível alto, muito alto descartado, reserva em aberto; adiantar K (infraestrutura), N
  (rascunhos), M2 (módulos estáveis) e L (custo) sem esperar a leva 2 inteira. Passado à I:
  fixar o nível alto na configuração de `dev` e de `producao`
- 13/11 23h14 · coordenadora · rodada integrada com a cabeça nova da G (I 64f0526, F 0e6a29c, G 3e10551, B2
  15cbb00): 97 de 98, p95 de 4,4 s, zero falha do modelo. A falha é o `lead-05`, prevista
  pela G (hesitação seguida de pergunta do agente derrubava o resumo); o ajuste da hesitação
  fecha. Sonda da P18 de novo: em 8 de 20 o agente remontou o resumo com o dado novo no mesmo
  turno, mas ainda saiu lead com dado antigo quando o agente, em dúvida, afirmou em vez de
  perguntar ("se quiser, eu atualizo o resumo com 3 hóspedes" seguido do resumo antigo e do
  "sim"). Complemento da P18, provisório: o resumo só é repetido se o modelo responder "não"
  a uma pergunta fechada do código sobre mudança possível; item novo na lista da G. Achado
  para a F: o modelo gravou no campo do nome um texto com parênteses e instrução ("Pedro (se
  puder, me diga também o sobrenome)") e o lead saiu assim; validação do nome fica para depois
  da entrada da F na `main`
- 13/11 23h14 · coordenadora · primeiro ensaio com TODAS as branches juntas sobre a `main` (I 64f0526, F
  0e6a29c, G 3e10551, H c905a09, B2 15cbb00): merge limpo, tipos e sigilo OK, suíte com 1299
  de 1300. O teste vermelho é da H ("item 1b"): na combinação, a segunda passagem depois de
  uma falha do objeto envia o lead em vez de segurar para reapresentar. Bloqueia; passado à
  H, que foi retomada em sessão nova no Opus 5.5 (esforço alto), já mesclando a F nova
- 13/11 23h14 · K e N · abertas por ordem do Éverton (X24), antes de a leva 2 fechar. K: diagnóstico do
  erro 530 de `producao` só por leitura, gateway `concierge-producao` com a chave por
  referência, `scripts/validar-producao.sh`; para e pergunta antes de qualquer escrita de DNS,
  e só faz o primeiro deploy depois de provar no commit exato que envio desligado é zero
  POST. N: rascunhos, sem tocar no `DECISOES.md`. Com elas são 7 frentes vivas (F, G, H, I,
  B2, K, N); o limite de 5 foi passado por ordem do Éverton. L e M2 parcial entram quando os
  verificadores da F e da I terminarem, por causa da memória (12 GB de 17 em uso)
- 13/11 23h18 · I · NA `main` (27c3093). Verificador independente, terceira rodada (64f0526): APROVADO,
  sem achado alto nem médio; os dois médios da segunda rodada fechados; conferência do laço
  como texto do usuário testada com o laço real da G (todo pedido termina no usuário, a
  conferência não entra no histórico gravado). Depois do veredito entrou só a configuração do
  nível alto (6008d02) e documentação (11cca93), conferidas pela coordenadora: muda uma
  variável nos dois ambientes e comentários. Ensaio final sobre a `main`: limpo, 711 testes,
  tipos e sigilo OK. Baixos que ficam como seguimento, sem bloquear (X24): o código numérico
  do log pode pegar dígitos de um dado ecoado no erro; o log não diz o motivo da resposta
  inútil; 7 de 68 defeitos plantados escapam da suíte. Para o Éverton decidir: a conferência
  do laço chega ao modelo no mesmo nível de uma mensagem do hóspede, então um hóspede que
  copie o texto dela não ganha autoridade, mas também não é distinguível
- 13/11 23h18 · coordenadora · `dev` publicado da `main` em 27c3093 (Haiku 5.5, nível alto, gateway de
  `dev`, reserva GLM-5.3 Flash, webhook falso). Fumaça contra `dev`: marco1 100% (cotação,
  resumo, confirmação em outro turno, lead no webhook falso, desconto com handoff); contrato
  77%, com duas falhas do juiz antigo de rótulo, que ainda é o da `main`
- 13/11 23h22 · K · diagnóstico do erro 530 de `producao`, só por leitura: o hostname de produção não tem
  registro próprio e cai num curinga com proxy que aponta para um túnel sem conector para esse
  nome. O deploy de `producao`, como está na `main`, publica só no endereço padrão do Worker e
  não escreve DNS. Dois caminhos para servir o hostname: rota de Worker na zona (não escreve
  DNS; o curinga fica intacto) ou domínio personalizado (cria um registro exato só para esse
  nome). O token não lê o Bot Fight Mode nem as regras de configuração da zona; a checagem de
  integridade de navegador está ligada na zona inteira. K parou antes de qualquer escrita e
  levou duas perguntas ao Éverton: rota ou domínio personalizado, e quem confere o Bot Fight
  Mode e cria a regra do hostname. Segue no gateway e no script de validação
- 13/11 23h22 · L e M2 · abertas por ordem do Éverton (X24). L: `scripts/custo.mjs` sobre os relatórios
  de eval. M2, primeira passada: revisão de segurança da `main` atual, revisão de código dos
  módulos estáveis (núcleo de preço e datas, catálogo, página, webhook falso, runner e
  simulador, gate de sigilo) e segunda opinião do Gemini 4 Argon, em esforço alto, sobre o
  cálculo de preço. Os módulos em mudança ficam para a segunda passada, só do delta
- 13/11 23h29 · F · verificador independente, quinta rodada (só o delta, cabeça 0e6a29c): REPROVADO por um
  achado. Passou: C7 corrigido, nenhum bloqueio a mais, a P14 inteira (3.768 sequências) idêntica à
  rodada 4. Reprova o C10 (ALTO, regressão do a9c8a8f): a retirada das aberturas "uma dúvida", "uma
  pergunta" e "só uma pergunta" também valeu na leitura do sim (src/lead.ts:466), e "sim, uma dúvida"
  passou a enviar o lead (17 de 32 mensagens; na rodada 4, nenhuma); na sequência do verificador saem
  dois leads da mesma estadia. Bloqueia pela X24 item 3 (lead errado). Decisão provisória P19: sim com
  anúncio de dúvida não envia. Correção pedida à frente: tirar a retirada só da leitura do sim, levar
  para a suíte os 10 testes do C10 e os casos do C7 que pegam os defeitos plantados X06 e X03; C11
  (baixo, lado seguro: "uma pergunta, tem wifi?" ainda derruba o resumo) em commit separado, se for a
  troca de um termo. Seis de 14 defeitos plantados escapam da suíte (C12, baixo)
- 13/11 23h29 · K · relatório 2: o gateway `concierge-producao` existe e guarda a chave da Anthropic (X24 item
  2), com as mesmas opções do de `dev`, conferido por leitura. Achado: o roteiro da frente I estava
  incompleto, o secret precisa existir no Secrets Store antes de ligar o provedor ao gateway. Pedido à
  frente I: a linha `AI_GATEWAY` de `producao` e a correção do roteiro. A rota de `producao` segue
  parada à espera do Éverton (rota do Worker ou domínio personalizado; Bot Fight Mode)
- 13/11 23h29 · N · relatório 1: rascunhos do `README.md` e do `docs/COMO-FOI-FEITO.md` na `frente-n` (6ed4579),
  com marcador no que se preenche no fim. Respondido: os nomes dos modelos ficam, com revisão do
  Éverton; nada em `docs/sessoes/` até o Éverton escolher as sessões, e a frente adianta fora do
  repositório o programa que limpa um export
- 13/11 23h31 · H · diagnóstico do teste que falhava no ensaio de todas as branches ("item 1b" de
  `test/concorrencia-h.test.ts`): o teste estava desatualizado, não há defeito. Com a G, a pergunta do
  turno 2 repete o resumo (L9), o "sim" do turno 3 vale e a primeira passagem envia; a segunda passagem
  só devolve a resposta gravada (1 chamada ao modelo, 1 POST, 1 lead). Conferido por leitura: só o
  laço da G chama `pedidoDeConfirmacaoPendente`. Autorizado reescrever o subcaso sem fixar se a
  primeira passagem envia (a ordem de entrada é F, H, G, e a G ainda muda esse ponto): o teste prova
  que a segunda passagem não acrescenta efeito. Prova pedida em três árvores. A H já tem a F nova
  (efb67f7): 907 testes verdes na branch
- 13/11 23h39 · I · nível alto provado em `dev` publicado: no log do gateway, janela da fumaça de 23h17m50 a
  23h18m28, 41 chamadas ao Haiku, 41 com status 200, as 41 com o nível alto, nenhuma ao reserva
  (leitura da frente). Na branch, seis commits depois da entrada na `main`: log de falha sem dígito
  solto e com nome de erro de lista fechada (33e67f1, 6e5d5dc), motivo da resposta inútil numa palavra
  (ede844c), testes K10 e K11 (53681a5), `AI_GATEWAY` de `producao` (d561a05) e o passo do Secrets Store
  no roteiro (b34ab95). Ensaio da coordenadora em b34ab95: merge limpo, 734 testes, tipos sem erro,
  SIGILO OK. Verificador independente, quarta rodada (só o delta), rodando
- 13/11 23h39 · L · `scripts/custo.mjs` e teste na `frente-l` (22eda87); o CHECK de aceite passa na leitura da
  frente. Verificador independente rodando. Aviso da frente: os relatórios versionados são de código e
  modelo antigos; o número do README sai de uma rodada nova com o modelo final, de um relatório só.
  Pedidos à dona do runner, a repassar à B2: modelo por chamada, tokens de cache separados, modelo e
  nível no cabeçalho do relatório, uso dos pedidos que falham
- 13/11 23h39 · M2 · revisão de segurança, primeira passada (código da `main` em c6764a0): 0 críticos, 1 alto,
  5 médios, 7 baixos. Bloqueiam: (M1) a trava de valores aceita `R$` de texto livre do modelo escrito
  junto com chamada de ferramenta e de nome de hóspede no resumo, roteado à G; (M2) o gateway guardava
  o pedido inteiro com nome e telefone, contra a L22, resolvido em `producao` pela K (log desligado,
  conferido por leitura; o de `dev` segue ligado, com dados sintéticos); (M3) o gate não lê o conteúdo
  de commits antigos: varredura da coordenadora com os 10 termos fixos em 459 commits publicáveis
  (`git log -p --branches --tags --remotes`): 0 linhas; repetir antes de tornar o repositório público.
  Não bloqueiam e vão para a lista de limites: sem limite de gasto por cliente ou sessão (alto; a
  correção é de configuração e de conta, decisão do Éverton), `session_id` como única credencial, leads
  com dados de terceiros quando o envio real for ligado, e os baixos. Relatório no rascunho da
  coordenadora; `docs/revisoes/m2.md` sai quando as três revisões da primeira passada chegarem
- 13/11 23h39 · K · relatórios 3 e 4: `scripts/validar-producao.sh` na `frente-k` (33c8316), verificador
  independente rodando; prova de que o envio desligado é zero POST na `main` (6 testes, um deles pelo
  Durable Object); o cliente urllib do Python leva 403 (erro 1010) no endereço padrão de `dev`,
  evidência para a regra de integridade de `producao` (L23). Prova do modelo em `producao` decidida
  sem religar o log: nível provado em `dev`, variável presa por teste, e em `producao` o log do Worker
  sem `principal_pulado` nem `modelo_falhou`. Rota e primeiro deploy seguem parados à espera do Éverton
- 13/11 23h39 · N · rascunho completo na `frente-n` (ede0c12): README, "Como foi feito", dois desenhos e
  `docs/setup/` (com o hook de início de sessão e a skill de orquestração, reduzida). Parada até o fim
  da leva 2. Programa de export guardado fora do repositório; nada em `docs/sessoes/` até o Éverton
  escolher as sessões. Verificador independente de sigilo e de fatos rodando: `docs/setup/` é cópia de
  configuração pessoal e o repositório fica público
- 13/11 23h46 · F · correção da quinta rodada na `frente-f` (28109d8, três commits; em `src/` só 11 linhas de
  `src/lead.ts`): a retirada das aberturas saiu da leitura do sim (C10), testes dos marcadores de
  estadia (C12) e "uma pergunta" como abertura neutra só no rearme (C11). Ensaio da coordenadora:
  merge limpo, 1040 testes, tipos sem erro, SIGILO OK. Verificador independente, sexta rodada (só o
  delta), rodando. Leitura da frente aceita e P19 ajustada: "sim, uma dúvida" é lido como outra
  coisa, o resumo cai e o agente refaz quando o hóspede quiser fechar; o código não repete o pedido
- 13/11 23h46 · M2 · revisão de código dos módulos estáveis (1 alto, 6 médios, 10 baixos, nenhum crítico) e
  segunda opinião do Gemini 4 Argon sobre o cálculo (nenhuma divergência em centavos nos 15 imóveis;
  6 pontos, nenhum de preço errado). Primeira passada fechada em `docs/revisoes/m2.md`, com a resposta
  do Gemini em `docs/conselho/`. Roteado: gate de sigilo (conteúdo do histórico, saída com trecho do
  termo, sufixo composto, teste) para a frente S, aberta agora; trava de `producao` do runner por
  negação, `leads_ate_agora` em turno paralelo, juiz de hóspedes inválidos e os pedidos da L para a
  B2, depois da lista do juiz; saída sem ano anterior à entrada (P5 contra CA-06, 363 noites cotadas)
  para o Éverton decidir. Conferido sem imprimir valor: a hipótese do sufixo composto não se aplica
  ao ambiente real
- 13/11 23h47 · L · NA `main` (eec433a). Verificador independente (22eda87): APROVADO, só achados baixos. As
  contas batem com um programa à parte em frações exatas; relatório sem uso, só agregado, JSON
  inválido e pasta vazia terminam em `CUSTO FALHOU`; sem rede e sem escrita (conferido com `strace`).
  Ensaio da coordenadora: merge limpo, 711 testes, tipos sem erro, SIGILO OK, CHECK com `CUSTO OK`.
  Limites anotados: o preço é constante do script e não acompanha o `wrangler.jsonc`; os relatórios
  versionados são de antes do Haiku, então o valor do CHECK não é o custo real; conversa com zero
  tokens puxa a média para baixo; arquivo passado duas vezes conta duas vezes; 4 de 14 defeitos
  plantados escapam do teste. Falta da frente: o monitor diário, depois que `producao` existir
- 13/11 23h49 · Éverton · X25: três suítes de teste ao mesmo tempo; o resto do teto de carga não muda. Com
  pressão de memória, a coordenadora volta para duas e avisa. A trava (`com-trava.sh`, fora do
  repositório) passou a ter três vagas; as frentes não mudam nada no jeito de chamar. Medido na hora:
  8 GB disponíveis, pressão de memória zero, carga 5,9 em 8 núcleos. A coordenadora olha a pressão a
  cada relatório
- 13/11 23h54 · G · cabeça 29ae3aa na `frente-g`: exceção da hesitação (2b16462), desempate do motivo
  (1e998dd), pergunta fechada antes do rearme (e2be4dd), merge da `main`, contagem real das chamadas
  (805513c) e a trava de valores da revisão de segurança (29ae3aa). A frente relata 1049 testes na
  branch. Verificador independente, terceira rodada, rodando sobre a G sozinha e sobre a F com a G.
  Ensaio de todas as branches juntas (I 433439c, F 28109d8, G 29ae3aa, H, B2 3b37fa0): merge limpo,
  tipos sem erro, SIGILO OK, mas 2 testes da G falham (`test/foco-g.test.ts`, pergunta fechada com
  resposta inesperada: a resposta do turno sai com o texto da pergunta fechada). Isolado por pares: a
  G sozinha, com a I e com a B2 passa; com a F nova falha. Pedido à G: mesclar a F, dizer se é defeito
  real ou ordem do modelo simulado, e corrigir. Rodada integrada com o modelo real em nível alto
  (98 casos e a sonda do resumo pendente) rodando na árvore das cinco branches
- 13/11 23h54 · K · verificador independente do `scripts/validar-producao.sh` (33c8316): REPROVADO. Passou: só
  GET no servidor que fingia o webhook, nos 5 modos e em 30 cenários de falha; a trava decide pelo
  ambiente que o `/saude` devolve; nenhum endereço em argumento de processo. Reprova um falso verde:
  com argumentos extras repassados ao runner (`-h`, `--listar`, `--bloco`, `--alvo`) sai `PRODUCAO OK`
  sem nenhuma conversa. Médio: um 307 ou 308 no `/chat` é seguido com POST e corpo, no script e no
  runner. Correções pedidas à K; a parte do runner foi para a B2
- 13/11 23h54 · N · verificador independente dos rascunhos (ede0c12): REPROVADO por uma afirmação, não por
  sigilo: o README dá como garantida a trava de valores, que a revisão de segurança furou e a G ainda
  está corrigindo. Nenhum endereço, e-mail, máquina, conta, token ou domínio achado; quase 60 números
  batem com a fonte. Baixos: restos de outras entregas nas cópias do setup, cenário de ataque em três
  trechos, dados vencidos. Regra passada à frente: garantia só no presente se já está na `main` e
  verificada. Correções pedidas; a verificação final roda no fim, com tudo preenchido
- 13/11 23h58 · integração · rodada integrada com o modelo real em nível alto, servidor local, árvore das
  cinco branches (I 433439c, F 28109d8, G 29ae3aa, H, B2 3b37fa0), 98 casos: 97 de 98. Oito blocos em
  100% e contrato em 88%. A única falha (`con-10-idioma`) é do juiz: a resposta em inglês está certa
  e o juiz novo não reconhece o rótulo da diária em inglês; correção pedida à B2. Nenhum
  `modelo_falhou` nem `principal_pulado` em 165 turnos; p50 2,5 s, p95 5,3 s, máximo 15,7 s. Não conta
  para a prova dos 95%, que é em `dev` publicado e com o juiz aprovado
- 13/11 23h58 · B2 · relatório da cabeça b954a48 (juiz refeito pela estrutura da estadia; no corpus de 100,
  0 erradas aprovadas e 1 certa reprovada, na leitura da frente). A frente já está adiante, com os
  itens do runner da M2, o redirecionamento e o rótulo em inglês. A segunda rodada do verificador
  sai sobre uma cabeça só, quando esses itens estiverem publicados
- 13/11 23h58 · I · verificador independente, quarta rodada (b34ab95): APROVADO. Ressalva baixa, regressão do
  delta: dígito colado em letra vira código de erro no log em 70 casos novos; a correção é trocar um
  trecho de expressão em uma linha, provada pelo verificador. Pedida à frente antes do merge, com o
  teste que faltava. Limite conhecido: se a plataforma ecoar o pedido no começo da mensagem de erro,
  até 4 dígitos vão para o log (já existia na `main`). Documento do gateway ajustado em 433439c: log
  desligado em `producao` e prova pelo log do Worker
- 13/11 23h58 · N · correções do verificador na `frente-n` (1005b2c, com a `main` mesclada). Parada; a
  verificação final roda no fim da leva 2
- 13/11 23h58 · H · cabeça a58ff5e. A frente achou e corrigiu um defeito determinístico em arquivo dela
  (0912578): o contador e o bloqueio por estadia da P14 só iam ao armazenamento no fim do turno; num
  turno abandonado pelo Worker a estadia perdia o bloqueio e saía um terceiro POST. Agora são gravados
  na hora. A mensagem desse commit fala também em reinício do objeto, que não tem teste: o caminho
  provado é o do turno abandonado. Teste "item 1b" reescrito como autorizado. A frente relata 918
  testes na branch e os quatro arquivos dela verdes em quatro árvores. Verificador independente,
  terceira rodada, rodando sobre a H sozinha e sobre a F nova com a H
- 13/11 23h59 · I · delta NA `main` (fcb7dc2): log de falha sem dígito solto e com nome de erro de
  lista fechada, motivo da resposta inútil, `AI_GATEWAY` de `producao` e o roteiro do gateway com o
  log desligado. A regressão baixa do verificador foi corrigida em 4a63568 com a troca que ele provou.
  Ensaio da coordenadora: merge limpo, 740 testes, tipos sem erro, SIGILO OK; a sonda de 910 casos
  do verificador, repetida na cabeça nova, dá os 140 que já existiam na `main` e nenhum novo. A
  frente fica viva só para a fase 2 (medição no código final)
- 14/11 00h02 · integração · sonda do resumo pendente com o modelo real em nível alto, na árvore das cinco
  branches: 20 mensagens que misturam mudança e pergunta, depois "sim". 14 não enviaram (lado
  seguro). 6 enviaram: em 4 o agente tinha remontado o resumo com o dado novo e o lead saiu certo;
  em 1 ("esquece qual o horário do check-in?") o agente respondeu, repetiu o pedido e o hóspede
  confirmou o que viu; em 1 o lead saiu com o campo nome errado. Nenhum lead com dado velho (na
  sonda anterior, sem a pergunta fechada, havia). Ensaio da F com a H: merge limpo, 1089 testes,
  tipos sem erro, SIGILO OK
- 14/11 00h02 · F · achado da sonda, lead errado: com "o titular é o Pedro tudo bem?", o modelo chamou
  `montar_resumo` com o nome "Pedro (se puder, me diga também o sobrenome)", o resumo saiu assim e o
  "sim" enviou o lead com esse texto no nome. Segunda vez que aparece. Decisão provisória P20: o nome
  do lead só pode ser formado por palavras que o hóspede escreveu; fora disso a ferramenta recusa.
  Pedido à frente F, em commit separado por cima de 28109d8, com conferência própria depois
- 14/11 00h02 · K · correções da rodada 1 na `frente-k` (f28ce3e, cinco commits): argumentos extras em lista
  fechada e mínimo de 60 casos executados para o `PRODUCAO OK`; nenhum cliente segue redirecionamento;
  `--clientes` exige chamadas ao modelo maiores que zero; autoteste com servidores locais de mentira
  (a frente relata 21 de 21 defeitos plantados pegos). Verificador independente, segunda rodada (só
  o delta), rodando. A conferir entre a K e a B2: o mínimo de 60 casos depois que a trava do runner
  passar a ser por negação
- 14/11 00h05 · F · complemento NA `main` (0a44bd6, cabeça 28109d8). Verificador independente, sexta
  rodada: APROVADO. Sim com anúncio de dúvida não envia (0 de 32 mensagens da sonda anterior e 0 de
  118 novas; na cabeça reprovada, 17 e 23); confirmação legítima intacta (49 de 50, as mesmas); a P14
  inteira e as sondas gerais idênticas à rodada 5; a suíte pega 10 de 12 defeitos plantados. Ensaio
  da coordenadora sobre a `main` atual: merge limpo, 1069 testes, tipos sem erro, SIGILO OK. Limites
  para o README: pergunta com dado sem sinal ("uma pergunta, pode ser com o João?") mantém o resumo
  pelo texto, e quem segura é a pergunta fechada da G, que depende do modelo (C14); se o modelo chamar
  a confirmação numa pergunta pura, o resumo cai, lado seguro (C13). Avisadas a G (mesclar a `main` e
  corrigir os 2 testes), a B2 (mesclar a `main`, mover o `lead-12`) e a F (nome do lead, P20, em
  commit novo). Próxima na ordem: H, em verificação
- 14/11 00h05 · S · gate de sigilo corrigido na `frente-gate` (1d5e406, seis commits): lê o conteúdo de todos
  os commits publicáveis, nenhuma saída mostra o texto encontrado, procura termos em nomes de arquivo,
  trata binário como texto, e ganhou teste próprio. Ensaio da coordenadora: merge limpo, 740 testes,
  `SIGILO OK` no repositório real em 1,2 s, `TESTE DO GATE OK`. Verificador independente rodando, só
  com termos falsos em repositórios descartáveis. Limites declarados pela frente: mensagem de tag
  anotada não é lida; IP e e-mail só no índice
- 14/11 00h07 · Éverton · X26: a K publica `producao` no endereço padrão do Worker, com o envio real desligado,
  sem esperar a decisão da rota; nada é escrito na zona. Rota, Bot Fight Mode, exports, nomes dos
  modelos e P19 ele responde depois. A X25 (três suítes) foi repetida e já estava aplicada
- 14/11 00h07 · K · "pode" da coordenadora para o primeiro deploy de `producao`, só no endereço padrão: de
  cópia limpa da `main` na cabeça atual; prova de zero POST refeita nesse commit; segredos por
  referência; depois `/saude`, um ou dois turnos sem confirmação com chamadas ao modelo maiores que
  zero e log do Worker sem `principal_pulado` nem `modelo_falhou`, os quatro clientes e `LEADS REAIS: 0`
  antes e depois. O modo completo (evals contra `producao`) espera a trava por negação do runner e a
  aprovação do script. O hostname padrão entra no `sigilo-extra` para o gate passar a barrá-lo. A K
  responde com medição se o endereço padrão serve como URL de entrega e de onde vem o 403 do urllib
- 14/11 00h07 · G · relatórios das cabeças e2be4dd, 805513c e 29ae3aa recebidos (chegaram depois dos commits):
  pergunta fechada aceita "não" sem acento, em qualquer caixa e com ponto final; contagem real das
  chamadas com as 10 sondas da frente I passando; trava de valores só com campos de dinheiro que o
  código escreve no resultado da ferramenta. A rodada integrada mostrou que a API aceita a pergunta
  fechada sem ferramentas. Pendente com a frente: os 2 testes que falham com a F, agora na `main`
- 14/11 00h11 · G · diagnóstico dos 2 testes que falhavam com a F: ajuste de teste, não defeito. Com a F nova,
  a mensagem do teste ("I'll bring my mom, is there parking?") passou a ser lida como mudança de dado;
  o resumo cai, o código pede ao modelo um resumo novo e a pergunta fechada nem é feita. O texto do
  modelo simulado tinha sido tomado como a reescrita. Nenhum rearme e nenhum envio nesse caminho.
  Cabeça 34e77e3: mensagem neutra no teste, a F mesclada e um teste do caminho novo; depois de 29ae3aa
  só mudaram testes. Ensaio da coordenadora sobre a `main`: merge limpo, 1352 testes, tipos sem erro,
  SIGILO OK. O verificador da terceira rodada segue sobre 29ae3aa
- 14/11 00h11 · B2 · cabeça única 897e44b: juiz com rótulos de componente em inglês (o `con-10` da rodada
  integrada), trava de `producao` por negação, `leads_ate_agora` em paralelo, juiz de hóspedes
  inválidos, contagem dos pedidos sem dados de uso e runner sem seguir redirecionamento. A frente
  relata que nenhuma das 163 respostas reais ligadas a turno reprova. Ela não adotou "qualquer valor
  igual a um componente passa", porque reabriria os furos da primeira rodada; o verificador opina.
  Ensaio da coordenadora: merge limpo, 1069 testes, RUNNER OK, TRAVA OK, CASOS OK, SIGILO OK.
  Verificador independente, segunda rodada, rodando; é ele que libera o juiz para a prova dos 95%.
  Falta da frente: mesclar a `main`, mover o `lead-12` e dizer quantos casos rodam contra `producao`
- 14/11 00h11 · F · P20 (nome do lead): a regra precisa do histórico no contexto da ferramenta, que só a
  branch da G entrega, e quebra testes em que o hóspede simulado nunca escreve o nome (15 de outras
  frentes e 123 da própria F). Decidido: a P20 entra depois da G; a F mescla a `origin/frente-g` e
  trabalha por cima; a F está autorizada a mudar só a mensagem do hóspede simulado nos testes das
  outras frentes, em commit próprio e neutro (verde sem a regra), e a regra entra no commit seguinte.
  As sondas antigas dos verificadores usam o nome só no argumento e precisam do nome na mensagem
- 14/11 00h13 · Éverton · X27: enquanto ele não responde, a coordenadora segue a própria recomendação e marca
  como provisória. Rota de `producao` (P22): rota do Worker no hostname exato, pela API, só depois da
  validação no endereço padrão; `/saude` com 200 ou a rota é apagada; nada no DNS. Datas sem ano
  (P21): saída sem ano a mais de 90 noites da entrada não cota, o agente pede as datas de novo.
  Continuam só com ele: Bot Fight Mode e regra de integridade, limite de gasto, exports, nomes dos
  modelos e ligar o envio real
- 14/11 00h13 · K · rota (P22) pedida como passo seguinte ao primeiro deploy, com as condições do Éverton e
  mais duas: listar antes as rotas da zona e conferir que um novo deploy não apaga a rota criada
  pela API
- 14/11 00h13 · T · frente nova para a P21 (datas sem ano), subagente em worktree, branch `frente-datas`, por
  cima da `origin/frente-g` (a G mexe nos mesmos arquivos e entra antes). Arquivos: `src/nucleo/datas.ts`,
  `src/agente/ferramentas/pedido.ts` e um teste novo. Verificador antes do merge. Falta um caso de
  eval para esse caminho, a pedir à B2 depois do veredito do juiz
- 14/11 00h15 · Éverton · X28: a coordenadora segue a própria recomendação como
  provisória em tudo, menos ligar o envio real, tornar o repositório público, escrever no DNS ou
  mexer em segurança da zona, e escolher as sessões dos exports. Medição dele em `dev`: no endereço
  padrão do Worker, `Python-urllib` e `libwww-perl` levam 403 (erro 1010) e outros dez clientes
  passam; pesa contra o endereço padrão como URL de entrega
- 14/11 00h15 · K · dois passos a mais, depois da rota: repetir o teste por agente de usuário nos dois endereços
  de `producao` (só medir) e pôr o limite de taxa no gateway de `producao` (P23, 300 por minuto)
- 14/11 00h15 · B2 · cabeça 7f12107: `main` mesclada, `lead-12-troca-hospedes-apos-resumo` movido para o conjunto
  de desenvolvimento (99 casos), 69 elegíveis contra `producao`, e o autoteste passa a exigir a marca
  de confirmação em todo caso e pelo menos 60 elegíveis. Nada mudou no juiz desde 897e44b, que é a
  cabeça em verificação
- 14/11 00h15 · G · cabeça da64da4, com a `main` mesclada; nada mudou em `src/` desde 29ae3aa, em verificação
- 14/11 00h15 · provisórias abertas para o Éverton confirmar ou reverter no fim: P11 a P23, e os nomes dos
  modelos mantidos no "Como foi feito"
- 14/11 00h21 · K · relatório 6: `producao` NO AR no endereço padrão do Worker, publicada da `main` em 3e053cb,
  com o envio real desligado. Prova de zero POST refeita nesse commit (6 testes). `/saude` certo;
  dois turnos sem confirmação com 2 e 3 chamadas ao modelo, log do Worker sem `principal_pulado` nem
  `modelo_falhou`; `LEADS REAIS: 0` antes e depois; segredos por referência, nenhuma chave de modelo
  no Worker. No endereço padrão o urllib leva 403: a checagem de integridade ali é da plataforma e não
  se desliga, então ele não cumpre a L23. Os dois turnos levaram perto de 11 s cada: pedida medição
  de latência. URLs de pré-visualização ligadas por padrão: a decidir
- 14/11 00h21 · K · relatório 7: ROTA criada (P22) no hostname exato, pela API, sem curinga; `/saude` no hostname
  com 200; DNS sem mudança (mesmos 18 registros, curinga e túnel intactos); nenhum domínio
  personalizado. No hostname os quatro clientes passam, inclusive o urllib, e `LEADS REAIS: 0` antes e
  depois. Um novo deploy não apaga a rota, desde que a configuração não ganhe `routes`. Falta medir
  agente por agente (passo A), a latência e pôr o limite de taxa (passo B)
- 14/11 00h21 · integração · ensaio das três cabeças juntas, fixadas por hash, sobre a `main` (G da64da4, H
  a58ff5e, B2 7f12107): merge limpo, 1401 testes, tipos sem erro, SIGILO OK. A junta entre a H e a G
  está verde
- 14/11 00h22 · Éverton · X29: Bot Fight Mode e checagem de integridade desligados por ele na
  zona inteira (a K confirma com o urllib no `/saude` do hostname); plano B do endereço autorizado
  (domínio personalizado só para o hostname, se a rota falhar; hoje desnecessário); exports de todas
  as sessões do T3, preparados pela N fora do repositório, nada versionado antes de ele olhar de
  manhã; limite de gasto resolvido por ele. P23 revogada antes de ser aplicada: o passo do limite de
  taxa saiu da fila da K. Continua só com ele: ligar o envio real e tornar o repositório público
- 14/11 00h22 · N · tarefa nova: exportar todas as sessões para `~/.cache/agente-concierge/sessoes/`, com índice,
  fechando os três furos do limpador, gate numa worktree descartável e marca de leitura humana nas
  sessões com risco de trecho do enunciado. Sem commit
- 14/11 00h24 · T · P21 pronta na `frente-datas` (e53e777, por cima da G em da64da4): saída sem ano a mais de
  90 noites da entrada é recusada em `prepararPedido`, sem total e sem handoff, pelas duas
  ferramentas; `resolverSaida` não mudou. A frente relata 1364 testes e nenhum teste existente
  alterado. Verificador independente rodando, só o delta `da64da4..e53e777`. Lacunas que a frente
  apontou: entrada sem ano com saída com ano continua cotando a estadia longa (fora da regra); o
  modelo real pode chamar a cotação de novo pondo o ano por conta própria, a conferir no ensaio local
  com o modelo real e num caso de eval novo
- 14/11 00h25 · G · verificador independente, terceira rodada (29ae3aa; árvores com a G sozinha e com a F em
  28109d8 mais a G): REPROVADO por um achado, já corrigido depois dessa cabeça: os 2 testes de
  `foco-g` vermelhos na árvore F mais G (A1, só teste; resolvido em ee30c42, e o ensaio da coordenadora
  em da64da4 deu 1352 testes). Passou: os 5 altos da rodada 2 corrigidos; 0 de 80 mensagens inocentes
  ligam handoff; P17 e P18 ao pé da letra; a trava de valores fecha os dois cenários da revisão de
  segurança e mantém o valor legítimo no turno seguinte, depois de reinício da sessão e com dois
  imóveis; nenhuma das 121 respostas reais muda; o turno não estoura o orçamento por construção.
  Médio determinístico (M-1), regressão da correção da trava: quando o resultado da cotação sai da
  janela de 80 mensagens, o total que o modelo repete é cortado; com resumo pendente a correção é de
  uma linha (o total do resumo aberto entra nos permitidos) e foi pedida à frente; sem resumo fica
  como limite da janela (o agente cota de novo). Baixos que viram limite: contagem de chamadas com 1
  a menos quando o prazo vence no reserva; milhar com espaço; motivo do handoff com falsos positivos
  quando a ferramenta já foi chamada. O relatório final do verificador ainda fecha os defeitos plantados
- 14/11 00h27 · S · verificador independente do gate (1d5e406): REPROVADO. Confirmado o que a frente corrigiu
  (histórico em todos os caminhos; nenhum pedaço de termo na saída em 40 casos; sufixo composto;
  binário; `SIGILO OK` no repositório real). Reprovam cinco médios: um byte de separador na mensagem
  de commit antes do termo faz o termo passar (piorou com a correção); linha inválida no arquivo de
  ambiente faz o shell mostrar a linha e o gate ainda aprova; nome de branch, de tag e de autor não
  são varridos; branch órfã pula o histórico; falha de leitura engolida no encadeamento aprova. Os
  quatro últimos já existiam. Baixos e 5 de 16 defeitos plantados que o teste não pega. Correções
  pedidas à frente. Conferido no ambiente real, sem imprimir valor: nenhuma linha com `export` nem
  fora do formato, as 5 variáveis de endereço são lidas e o termo da empresa é derivado
- 14/11 00h27 · K · verificador independente do delta do script (f28ce3e): REPROVADO por um ponto: no modo
  completo o runner ainda segue redirecionamento e, com 307 ou 308 no `/chat`, manda os POSTs ao
  endereço do `Location`; o script não se protege sozinho. Correção de duas linhas pedida à K (o
  `fetch` do runner chamado pelo script com redirecionamento manual); a correção do próprio runner
  está na branch da B2. Passou: nenhum `PRODUCAO OK` em 46 combinações de argumentos, contagem mínima,
  quatro clientes sem seguir redirecionamento, só GET no webhook de mentira em 162 cenários, nenhum
  endereço na saída. Baixos pedidos junto. Informação: 69 casos rodam contra `producao`, antes e
  depois da trava por negação
- 14/11 00h28 · N · exports prontos FORA do repositório, em `~/.cache/agente-concierge/sessoes/`, com índice:
  92 sessões (67 threads do projeto, 23 subagentes e 2 consultas do conselho), 1.878 mensagens, 2,1 MB
  de Markdown a partir de 217 MB de fonte. Gate com tudo em stage numa worktree descartável: SIGILO OK,
  sem commit. Os três furos do limpador foram fechados. 43 sessões marcadas para leitura humana
  obrigatória (planejamento, as que citam o enunciado, as de primeira mensagem longa e as do conselho).
  Limite que só a leitura pega: trecho copiado do enunciado e nome da empresa escrito de outro jeito.
  Nada entra em `docs/sessoes/` antes de o Éverton olhar (X29)
- 14/11 00h29 · Éverton · X30: reserva confirmado, GLM-5.3 Flash, sem "provisório"; nomes dos modelos mantidos
  no "Como foi feito", com a versão exata de cada um. `docs/revisoes/modelos.md` atualizado pela
  coordenadora; a frente N preenche o README e a seção dos modelos
- 14/11 00h37 · Éverton · redação: as linhas de decisão do `DECISOES.md` ficam só com a data, sem hora e sem
  circunstância dele; as duas entradas deste log sobre a X28 e a X29 foram reescritas do mesmo jeito.
  O conteúdo das decisões não mudou. Vale daqui em diante para todo registro de decisão
- 14/11 00h43 · K · relatório 8. Portão passou: `/saude` no hostname próprio com o agente de usuário do
  `Python-urllib` dá 200. Dos 17 clientes testados, só `Python-urllib` e `libwww-perl` levam 403 (erro
  1010), e só no endereço padrão do Worker, em GET e em POST. Latência: o evento `turno` do Worker marca
  2,2 a 4,0 s nas perguntas simples (2 chamadas) e 5,0 a 5,9 s nas cotações (3 chamadas); os cerca de 10 s
  medidos antes eram a conexão nova da máquina de medição (o cliente tenta IPv6 primeiro e ele não sai),
  não o agente. Medição de latência daqui em diante força IPv4 ou reusa a conexão. Uma URL de
  pré-visualização existe em `producao`: P25, desligar pela API. O limite de taxa não chegou a ser aplicado
- 14/11 00h43 · K · relatório 9: script corrigido em 86c00c1 (o runner não segue redirecionamento no modo
  completo) e b57b4ee (baixos da segunda verificação); 25 de 25 defeitos plantados pegos pelo autoteste,
  segundo a frente. Verificador curto do delta f28ce3e..b57b4ee lançado (Opus 5.5, esforço alto)
- 14/11 00h43 · N · X30 aplicada nos rascunhos (602bfa1): reserva, nomes dos modelos com versão exata, limites 15
  a 19 e o rascunho de cortes e de mais tempo. Recebeu a convenção de registro e o ajuste do limpador
  dos exports (dois arquivos com trecho pessoal, trocado por marcador e listado no índice)
- 14/11 00h43 · H · verificador da rodada 3 (a58ff5e): REPROVADO por dois achados na fila da sessão. B1, alto e
  determinístico: "quero fechar" e "sim" mandados ao mesmo tempo geram lead de um resumo que o hóspede
  ainda não tinha recebido. B2: quando o Worker desiste com o pedido ainda na fila do objeto, o resumo
  gravado depois fica confirmável sem ter sido visto. O resto passou: 20.724 execuções das sequências da
  P14 pela sessão com 0 violação, reinício do objeto, falha de gravação, corpo do pedido e os achados
  antigos A0 a A6. Lacuna apontada: P24. Frente corrigindo B1, B2 e P24; depois, verificador do delta.
  Limites que ficam para o README: nenhum sinal chega ao objeto; corpo acima de 64 KB com resumo pendente
- 14/11 00h43 · G · cabeça 4515061: correção da M-1 (o total do resumo aberto entra nos valores permitidos; 9
  linhas em `src/agente/loop.ts`, lidas pela coordenadora). Ensaio por hash sobre a `main`, com a sonda
  da janela do verificador, em curso. **A ordem da leva 2 muda: a G entra antes da H**, porque uma não
  depende da outra e o ensaio conjunto não teve conflito
- 14/11 00h45 · K · P25 aplicada: `previews_enabled: false` no Worker de `producao`, endereço padrão mantido,
  `/saude` 200 nos dois endereços, `LEADS REAIS: 0`. Correção do relatório 8: não existia URL de
  pré-visualização (Worker com Durable Object não ganha URL por versão; o endereço já dava 404 antes). O
  motivo da P25 no `DECISOES.md` foi corrigido: é só proteção
- 14/11 00h45 · N · cabeça 7a7146c: horas de decisão retiradas do "Como foi feito" (4 ocorrências); limpador dos
  exports troca frase pessoal por marcador (4 frases em 2 sessões, listadas no índice); exports
  refeitos fora do repositório: 70 sessões (os subagentes saíam em dobro), 35 para leitura humana;
  latência, teste de clientes e P25 nos rascunhos, marcados "a confirmar no congelamento"
- 14/11 00h45 · G · ensaio por hash de 4515061 sobre a `main`: merge limpo, 42 arquivos e 1355 testes verdes,
  tipos e gate verdes. Sonda da janela do verificador: com resumo aberto o total não é mais cortado
  (antes, turno 42); sem resumo aberto continua cortado no turno 41 e o agente cota de novo (limite
  para o README). Faltam os três defeitos plantados que escapavam (P06, P07, P08), em curso
- 14/11 00h48 · G · **entrou na `main`: merge `--no-ff` de 4515061, main em a8da5d6.** Defeitos plantados de novo
  sobre a `main` com a G: P06 e P08 pegos (um teste cada), P07 ainda escapa (a resposta à pergunta fechada
  por chamada de ferramenta não tem teste; o código já trata). Pedido à frente: um commit só de teste.
  Fora isso a frente está fechada. F e H avisadas para mergear a `main` nova
- 14/11 00h48 · B2 · verificador da rodada 2 (7f12107): REPROVADO por quatro achados altos no juiz de preço. A1:
  total sem a limpeza, chamado de total, passa quando vem com "pelas N noites". A2: uma resposta real e
  certa é reprovada ("já com a taxa de limpeza de R$ X"; 1 em cerca de 800 turnos reais). A3: desconto
  concedido com valor igual a um componente passa. A4: respostas certas em inglês reprovadas. Médios em
  dois casos (`lead-05`, `inv-07`). Passaram a trava de `producao`, a carga e os autotestes. Nos cinco
  registros reais o juiz novo erra uma vez; o da `main` errava de 6 a 11 por registro. Frente corrigindo,
  com critério fechado para convergir: os dois corpus do verificador viram teste de regressão; zero certa
  reprovada nos registros reais; zero errada aprovada em A1, A3 e nos casos da rodada 1; formato que o
  agente nunca escreveu vira limite documentado do juiz. Pedido junto: um caso dev para a P21
- 14/11 00h54 · coordenadora · deploy de `dev` a partir da `main` 472277c (código de a8da5d6, com a G; versão
  a5c1b6a8) e fumaça declarada `--bloco marco1`: 100%, p50 2,4 s, p95 5,5 s, `EVAL OK`. Não conta como
  rodada. O deploy anterior de `dev` era de 27c3093
- 14/11 00h54 · coordenadora · P26: o resto da M-1 (total repetido sem resumo aberto, depois de 80 mensagens)
  fica como limite conhecido, provisório. Conjunto do congelamento reduzido: gate da S, script da K e
  teste P07 da G saem dele, porque não mudam o agente nem o juiz. Casos de eval com mensagens em
  paralelo conferidos contra a regra nova do B1 da H: `lead-14` e `con-07` mandam dois "sim" depois de
  resumo visto (1 lead em qualquer ordem) e `con-06` manda duas perguntas; nenhum mistura confirmação
  com outra mensagem. Plano B perguntado ao Éverton (seção Fechamento)
- 14/11 00h56 · T · verificador independente: APROVADO o delta da64da4..e53e777 (82.102 casos comparados com a
  árvore da G; 59.051 mudaram, todos de "cotava com 91 a 1460 noites" para a recusa da P21; 90 noites
  exatas continuam cotando; 11 de 12 defeitos plantados pegos). **Entrou na `main`: merge `--no-ff` de
  e53e777, main em c9217dc**, depois do ensaio por hash (1367 testes, tipos e gate verdes). Dois baixos
  com a frente, em commit à parte: a frase da recusa que impede o modelo de completar o ano (na sonda,
  com a saída reenviada com ano, a estadia de 363 noites foi cotada) e o teste da ordem das recusas
- 14/11 00h56 · H · veredito final da rodada 3 igual ao parcial. Fato novo: o B1 (mensagens simultâneas) já
  existe na `main` sem a H, então não é regressão dela e congelar sem a H não o evita. Baixos novos:
  nenhum teste afirma que o corpo não é lido acima do teto; `handoff` não gravado em reinício no meio
  do turno. 12 de 16 defeitos plantados pegos. A frente já publicou correções; espero o relatório dela
- 14/11 00h59 · Éverton · o desenho da fábrica na `frente-n` perdeu a segunda sessão de IA revisora (decisão 20);
  pediu para manter a caixa e a linha como estão na `main`. Conferido: sumiu no commit 3e9e5f6. A N
  restaurou em 6be2655 (caixa, duas ligações e o item da lista, texto igual ao da `main`) e listou mais
  cinco coisas da `main` que o desenho dela não tinha: o laço da revisora até a coordenadora, o pedido e
  a ordem do envio real, o laço de robustez, a cadeia de portões com o laço do reservado e duas linhas
  da legenda. Pedido à N: voltar as cinco, corrigindo só o que ficou desatualizado (na G6, a segunda
  opinião da revisão final foi só do Gemini 4 Argon, pela X16), e fazer a mesma comparação no desenho do
  agente. Regra para a frente: nada que existe na `main` some
- 14/11 00h59 · G · teste do P07 na `main`: merge `--no-ff` de 2d13951 (só `test/foco-g.test.ts`, 12 linhas;
  ensaio com 1368 testes verdes). A frente G está fechada
- 14/11 00h59 · T · baixos da verificação na `main`: merge `--no-ff` de ec36bed, main em 1a9b8d5. Em `src/` muda
  só uma frase do texto da recusa da P21 (o modelo não completa o ano sozinho); entra o teste da ordem
  das recusas. Ensaio com 1368 testes verdes. Falta ver com o modelo real se ele obedece a frase: entra
  no ensaio local da árvore congelada. `dev` publicado continua em 472277c (sem a T)
- 14/11 01h03 · H · correção dos dois casos de fila em 03e1605 (B1 em ffb885a, B2 em 6956937, teste do alcance
  do B1 em 03e1605; já com a `main` a8da5d6 mesclada). Segundo a frente: 1413 testes e tipos verdes; as
  sondas D1, D2 e D2b do verificador dão 0 leads; dois "sim" depois de resumo visto dão 1 lead nas duas
  ordens. Dúvida registrada por ela: um teste de `fila-resumo-h` falhou uma vez depois do merge com a G
  e não se repetiu em 30 rodadas. Verificador do delta lançado (Opus 5.5, esforço alto) com barra
  fechada de nove itens, entre eles 20 repetições sob carga dos dois arquivos de teste da fila. A P24
  vem num commit separado em cima desse hash
- 14/11 01h03 · S · correções do gate em af79e24 (12 commits sobre 1d5e406): os cinco médios, cinco baixos em
  código e os limites que sobram no cabeçalho. Segundo a frente: `TESTE DO GATE OK`, as cinco mutações
  que escapavam agora são pegas, e o gate no repositório real termina em menos de 2 s com `SIGILO OK`.
  Verificador do delta lançado (Opus 5.5, esforço alto), com barra fechada de oito itens. O gate não
  está no conjunto do congelamento: pode entrar com as rodadas já em curso
- 14/11 01h07 · N · desenhos de volta ao conteúdo da `main`: fábrica em 1c4e82a (os cinco itens, em dois blocos
  Mermaid) e agente em bfe754a (11 pontos de volta). Corrigido por estar desatualizado: portão da revisão
  final só com o Gemini 4 Argon (X16), frente C encerrada, L como custo, portões por merge e por revisão
  final. O que depende da H está marcado como desenho até ela entrar. Conferência da coordenadora por
  frases-chave; a comparação nó a nó com a `main` fica para o verificador final da N
- 14/11 01h07 · K · verificador da rodada 3: APROVADO o delta f28ce3e..b57b4ee (0 pedidos no destino do
  redirecionamento em 10 cenários; os cinco baixos corrigidos; matrizes de regressão sem mudança).
  **Entrou na `main`: merge `--no-ff` de b57b4ee, main em b069b85** (só `scripts/validar-producao.sh`;
  ensaio com 1369 testes verdes e `AUTOTESTE OK` com ambiente vazio). Limites: SIGQUIT e SIGKILL
  deixam o runner órfão (só conversas sem confirmação); o autoteste pega 9 de 23 defeitos plantados
- 14/11 01h07 · F · P20 em 63b6e8c (regra em `src/agente/ferramentas/lead.ts`, `test/nome-f.test.ts` com 33
  testes; 1388 testes verdes na branch, em cima da `main` 472277c). Não entra ainda: com a `main` atual
  dois testes da frente T ficam vermelhos, porque o apoio deles passa um nome que o hóspede não escreveu.
  Saída escolhida: a T troca a linha do apoio em commit próprio de teste, entra na `main`, e a F mescla a
  `main`. A H recebeu o mesmo pedido para os testes dela (hóspede escreve o nome, verde sem a regra),
  para as duas frentes não dependerem de ordem. Aceito da F: o commit 1b24c7b (testes que passavam sem
  montar o resumo que preparavam) e os três testes da G com valor no nome, com os roteiros intactos.
  Limites para o README: palavras do hóspede em outra ordem passam; pontuação não é conferida; fora da
  janela de 80 mensagens o nome é pedido de novo
- 14/11 01h16 · T · linha do apoio de teste na `main` (merge de 4650a05, main em 0e68247): o hóspede escreve o
  nome que o resumo usa. Uma linha, sem asserção mudada
- 14/11 01h16 · F · hash final da P20: 8f8fbd5, em cima da `main` 0e68247 (1402 testes e tipos verdes, segundo a
  frente; em `src/` só `src/agente/ferramentas/lead.ts`). Verificador do delta lançado (Opus 5.5, esforço
  alto), barra fechada de nove itens: nome dito em turno anterior aceito pelo caminho da sessão, nenhum
  laço de recusa, formas comuns de nome aceitas, cenário de segurança do nome com valor mantido
- 14/11 01h16 · H · cabeça a4abacb: P24 em 50ce319 (`src/chat.ts` e `src/sessao.ts`, 30 linhas; o Worker avisa a
  sessão na mensagem vazia e na longa, e a marca só liga com resumo aberto) e testes com o nome na
  mensagem do hóspede em a4abacb (30 testes da frente ficariam vermelhos com a regra da F). Segundo a
  frente: 1417 testes sem a regra da F e 1450 no ensaio com ela. Segundo verificador lançado só para o
  delta 03e1605..a4abacb (Opus 5.5, esforço alto), barra fechada de dez itens
- 14/11 01h16 · coordenadora · **conferência com o modelo real** (servidor local, `main` 0e68247 com a F 8f8fbd5 e
  a H 03e1605, Haiku 5.5 em nível alto, leads no webhook falso de `dev`). **P20:** oito roteiros de nome
  (titular, nome dito em turno anterior, minúsculas, em pedaços, inglês, abreviado, corrigido, sem
  nome); nenhum travou em recusa. Sete terminaram em lead e os sete nomes no webhook falso são
  exatamente o que o hóspede escreveu ("Pedro", "Marina Duarte", "joao da silva", "Pedro Souza Lima",
  "Maria Ap. Souza", "Ana Paula Lima", "Carla Mendes"); a dica do sobrenome aparece só no texto do
  resumo, não no lead. O roteiro em inglês parou antes, na data em formato americano (limite já
  conhecido), e ficou com o resumo aguardando confirmação. **P21:** quatro pedidos com saída sem ano
  anterior à entrada (português e inglês): nenhum valor em reais, o agente pede as datas de novo; à
  insistência "isso mesmo, pode cotar" ele continua sem cotar e não completa o ano sozinho. Latência dos
  turnos: 0,8 a 8,3 s. Uma repetição de cada roteiro; não é rodada de eval
- 14/11 01h22 · S · verificador da rodada 2 (af79e24): REPROVADO por um ponto só. Com o índice corrompido (blob
  em stage ausente ou índice truncado) o `git grep` falha, a função de leitura entende "nada achado" e o
  gate termina com `SIGILO OK`. Não há caminho de publicação (o `git commit` também falha nesse estado),
  mas é `SIGILO OK` depois de falha de leitura. O resto da barra passou: os cinco médios, 18 lugares
  plantados reprovam, nada de segredo na saída, 1,63 s com 629 commits, os oito mutantes pegos. Pedido à
  frente: a correção de uma linha com caso de teste e, se couber, dois casos para mutantes que escapam.
  A coordenadora confere o delta com as sondas do verificador e faz o merge, sem nova rodada inteira
- 14/11 01h22 · coordenadora · sonda do resumo pendente com o modelo real (servidor local, `main` com a F 8f8fbd5
  e a H a4abacb, que já tem a P24): 20 sessões com mensagem que mistura mudança e pergunta, seguidas de
  "sim". Oito enviaram lead e doze não enviaram (reapresentaram o resumo ou ficaram sem resumo). **Zero
  lead com dado velho:** os oito leads no webhook falso batem com o resumo mostrado no turno anterior
  (seis com 3 hóspedes, dois com 2). **Zero nome sujo:** sete "Marina Teste Duarte" e um "Pedro"; na
  rodada anterior desta sonda um lead tinha saído com a dica do sobrenome dentro do nome. A F recebeu
  da frente a lista das sondas antigas e dos três caminhos de recusa, repassada ao verificador da P20.
  Limite declarado pela F para o README: depois de "na verdade o titular é o Pedro Alves", modelo que
  passa o nome antigo é aceito, porque as palavras foram escritas
- 14/11 01h26 · B2 · correções da rodada 2 em f4ee189 (A1 a A4, M1, M2, os dois corpus como teste de regressão
  com 234 vereditos, limites do juiz em `evals/README.md`, caso `rec-12-saida-sem-ano-longe` para a
  P21; 100 casos dev, 70 elegíveis para `producao`). Segundo a frente: nos cinco registros reais, zero
  resposta certa reprovada; no corpus de 134, pelo `espera` do caso, 13 erradas aprovadas e 20 certas
  reprovadas, todas em formato listado como limite; a W51 ("per guest") piorou e entrou no limite do
  valor por pessoa. Verificador da rodada 3 lançado (Opus 5.5, esforço alto) com barra fechada de dez
  itens, avaliando pelo `espera` do caso, e com um teste só das proibidas novas contra recusas certas.
  P27: limites aceitos, compensados por leitura à mão das rodadas oficiais pelo proxy de registro; a
  definição de rodada oficial na seção Fechamento foi ajustada para isso
- 14/11 01h30 · S · correção do índice corrompido em 66cf0e3 (cabeça 3ebd124, mais dois casos de teste e uma
  linha no cabeçalho). Conferência da coordenadora com as sondas do verificador no gate novo: índice
  corrompido sai com 2 nos dois cenários (11 de 11; antes, 9 de 11), médios 32 de 32 e baixos 13 de 13,
  sem regressão. Ensaio por hash sobre a `main`: 1369 testes e tipos verdes, `TESTE DO GATE OK` em duas
  localidades, `SIGILO OK` no repositório real em 1,6 s com o arquivo de ambiente de verdade. **Entrou
  na `main`: merge `--no-ff` de 3ebd124, main em 5a06b7b.** O gate novo varre o histórico inteiro a cada
  execução: fecha os achados 4, 5 e 6 da primeira passada da M2
- 14/11 01h30 · H · verificador do delta da fila (03e1605): REPROVADO por um achado novo. B6: as duas
  tentativas do Worker entram na fila e o Worker desiste; a primeira cópia gasta a marca de desistência
  sem gravar o pedido e a segunda roda o turno. Sem resumo visto dava 0 lead antes do 6956937 e agora
  dá 1 (regressão da correção do B2); com resumo visto, o lead sai com as datas novas, que o hóspede
  não viu (já acontecia). Gatilho: falha de transporte simulada. Passou: B1 fechado, misturas de 5 e 10
  mensagens, dois "sim" depois de resumo visto (30 pares, 1 lead), P14 com 13.188 execuções e 0
  violação, 20 repetições sob carga sem falha, integração verde. Limite novo (B7): a marca do B1 não
  sobrevive a reinício quando o "sim" ainda estava na fila. Frente corrigindo o B6 em cima de a4abacb;
  é o terceiro ciclo da fila
- 14/11 01h30 · H · verificador do delta 03e1605..a4abacb: APROVADO. P24 confere (mensagem vazia, de 8.001 e de
  60.000 caracteres: o "sim" reapresenta com 0 POST e 0 chamada ao modelo; sem resumo pendente nada
  muda; corpo acima de 64 KB não toca na sessão; falha do aviso não muda a resposta; a marca sobrevive
  a reinício). O commit dos testes com o nome só muda o texto do hóspede (55 linhas conferidas). Com a
  F e a H juntas sobre a `main`: 1464 testes verdes. Lacuna de teste (o aviso gravar `handoff` não é
  pego) pedida à frente. Limite para o README: `session_id` novo com mensagem vazia instancia o objeto
  e cria as tabelas vazias
- 14/11 01h31 · F · verificador da rodada 7: APROVADO o delta da P20 (8f8fbd5). Nome dito 1, 5, 30 e 40 turnos
  antes dá resumo pelo caminho da sessão, também em pedaços e com reinício do objeto; modelo que insiste
  no nome errado esgota 6 chamadas e o hóspede recebe a contingência com `handoff`, sem resumo, sem
  "registrado" e sem POST; o cenário do nome com valor continua fechado; os commits de teste só mudam o
  texto do hóspede; 6 de 6 defeitos plantados pegos; 1402 testes e tipos verdes sobre a `main` 0e68247.
  Dois achados deixados para a coordenação, aceitos como limite (P28): a recusa do nome derruba o resumo
  pendente; nome chinês, japonês ou coreano grudado na frase é recusado. Observação: turno com ferramenta
  gasta 4 ou mais mensagens, então numa conversa com cotações o nome sai da janela de 80 bem antes de 40
  turnos. **Entrou na `main`: merge `--no-ff` de 8f8fbd5, main em fca00c9** (a `main` não tinha mudado em
  `src/`, `test/` nem `evals/` desde a árvore que o verificador rodou). A H foi avisada para mesclar
- 14/11 01h34 · coordenadora · deploy de `dev` a partir da `main` 5d1f5f8 (código de fca00c9: G, T e F; versão
  cdd3ca97). Fumaça `--bloco marco1`: 100%, p50 1,2 s, p95 4,5 s. Bloco `funciona-leads` inteiro pelo
  proxy de registro (o caminho das rodadas oficiais): 100%, p50 1,6 s, p95 5,7 s, 43 chamadas gravadas,
  proxy derrubado no fim. Nenhum dos dois conta como rodada
- 14/11 01h34 · coordenadora · segunda passada da M2 adiantada: revisor de segurança (Opus 5.5, esforço alto)
  lançado sobre o delta de `src/` desde c6764a0 até a `main` atual, sem a H. Olha o achado 2 da primeira
  passada (trava de valores), injeção pelos pontos novos (pergunta fechada, chamada focada, textos de
  recusa), lead sem confirmação por caminho novo, custo por turno e dado pessoal em log. O adendo da H
  e do juiz vem depois que entrarem. Frente N recebeu a lista do que já pode escrever no presente e
  dos limites novos (P24 a P28)
- 14/11 01h45 · H · correção do B6 em 578434d e teste do `handoff` em 15645d0; cabeça 38ae72f, já em cima da
  `main` com a F (1468 testes, tipos e gate novo verdes, segundo a frente). O B7 não foi feito (não era
  trivial): fica como limite. Verificador da rodada 5 lançado (Opus 5.5, esforço alto), barra fechada de
  sete itens: os dois cenários do B6, nenhuma contingência indevida para pedido legítimo, regressão do
  que já passou com as sondas ajustadas para o nome, 20 repetições sob carga, integração e mutantes
- 14/11 01h45 · N · rascunhos atualizados em 87fd6ee com o que já está na `main` e os limites P24 a P28 (README
  com limites 1 a 34 por área; "Como foi feito" com as rodadas de S, T, F e G). A fila da H, o veredito
  do juiz e os números das rodadas seguem "a preencher"
- 14/11 01h45 · coordenadora · **ensaio local da árvore candidata** (`main` 5eafe1b com a H 38ae72f e o juiz da B2
  f4ee189; conjunto dev inteiro, 100 casos, Haiku 5.5 em nível alto, pelo proxy de registro): 98 de 100;
  sete blocos em 100%, `funciona-cotacoes` 92% e `funciona-leads` 93%; p50 2,5 s, p95 5,1 s, máximo
  14,7 s. Não conta como rodada. As duas falhas, lidas na conversa gravada:
  (1) `cot-13-entrada-hoje`, **erro do juiz**: a resposta está certa ("- Diária de sábado (noite que
  começa em sexta ou sábado, com acréscimo de 20%): R$ 372,00") e o juiz não reconhece o rótulo por
  causa do parêntese antes do valor. Voltou para a B2, com pedido de passar o juiz por todos os
  registros reais, incluindo o deste ensaio.
  (2) `lead-12-troca-hospedes-apos-resumo`, **erro do agente, dependente do modelo**: depois de "Sim,
  pode confirmar! Ah, troca para 8 hóspedes", o resumo novo sai certo; no "Sim, confirmo." seguinte o
  agente mostra o mesmo resumo de novo e não envia; só o terceiro "sim" registra. Repetido contra `dev`
  (sem a H): 2 de 3 vezes. Não sai lead errado, mas o caso sozinho pode derrubar o bloco de leads abaixo
  de 95% nas três rodadas. Pedido à F: quando a mensagem é um sim limpo para o resumo mostrado no turno
  anterior e o modelo chama `montar_resumo` com os mesmos dados, a ferramenta trata como confirmação.
  Leitura à mão ensaiada neste registro (P27): os quatro casos de desconto são recusas limpas com
  `handoff`, sem concessão; 88 das 174 respostas têm valor em reais
- 14/11 01h52 · B2 · verificador da rodada 3: APROVADO o f4ee189. Os 234 itens do corpus conferem; zero certa
  reprovada nos cinco registros; 422 avaliações de erradas sem nenhuma aprovada, pelo `espera` do caso;
  recusas certas nos casos de desconto: nenhuma das 20 reais reprova e 3 das 40 escritas reprovam com a
  negação a até 3 palavras (limiar 4), todas por "don't"; o caso da P21 aprova as quatro respostas reais
  e reprova a cotação; 21 de 21 defeitos plantados pegos. Duas correções de uma palavra pedidas por ele
  e enviadas à frente junto com a do rótulo com parêntese: negações que faltam ("don't" e outras) e a
  expressão que não pega "abrir mão". Depois, verificador curto só desses três pontos
- 14/11 01h52 · M2 · segunda passada, segurança do delta (sem a H): nenhum achado crítico ou alto; três médios e
  quatro baixos, registrados em `docs/revisoes/m2.md`. S2-1 (valor no nome do lead) vira a P29, com a
  frente F; S2-3 (lote de buscas martela o catálogo, 900 pedidos num turno na sonda) vira a P30, com a
  frente G, reaberta só para isso; S2-2 (valor sem marca de moeda escrito pelo modelo) e os baixos ficam
  como limite no README. A primeira metade do achado 2 da primeira passada está fechada
- 14/11 01h59 · B2 · a frente entregou as três correções do juiz na cabeça bd6e28b: rótulo de componente seguido
  de parêntese (90ca26c, o falso vermelho do `cot-13-entrada-hoje`), negações em inglês na proibida dos
  quatro casos de desconto (f29c838; "no", "sem" e "nenhum" só valem colados à palavra, escolha da frente
  para não aprovar "Posso, no seu caso, isentar a limpeza"), "abrir mão" (c3c9a45) e dois limites fixados
  no corpus, que vai a 241 itens. Verificador curto da rodada 4 lançado, com barra fechada de sete itens
- 14/11 01h59 · H · verificador da rodada 5: APROVADO o 38ae72f, barra fechada de sete itens. A cópia repetida
  de pedido abandonado na fila não roda o turno e devolve a mesma contingência, sem resumo visto (0 lead)
  e com resumo visto (o primeiro "sim" reapresenta, o segundo envia o que foi visto); pedido legítimo não
  recebe contingência; 7.536 execuções do lote de desistência sem violação; 28 execuções dos arquivos de
  fila sem falha; dois defeitos plantados pegos. Ensaio por hash sobre a `main`: 51 arquivos, 1468
  testes, tipos verdes, SIGILO OK. **Frente H na `main` em 6daffb1.** Limites para o README: a marca de
  reapresentação não sobrevive a reinício do objeto com o "sim" ainda na fila (B7); "pergunta + sim" na
  fila responde só "Certo." (B8); sem sinal de cancelamento chegando ao objeto; corpo acima de 64 KB
  recusado. O verificador não mediu a ordem "aviso antes da cópia" nem "cópia em curso + cópia na
  fila"; os dois foram pedidos à parte 2 da M2
- 14/11 01h59 · F · "sim" limpo entregue em efa5f8b (só `src/agente/ferramentas/lead.ts`, 24 linhas): com o
  resumo em aberto mostrado no turno anterior, mensagem que é "sim" pela leitura do código e
  `montar_resumo` chamado com a mesma reserva e o mesmo nome, a ferramenta segue o caminho do
  `confirmar_reserva`. Conferência com o modelo real (servidor local, `main` + H 38ae72f + F efa5f8b,
  roteiro do `lead-12-troca-hospedes-apos-resumo`, 8 sessões): 8 de 8 registram no turno 4, e os 8 leads
  no webhook falso saem com 8 hóspedes. Antes: 2 de 3 reapresentavam. P29 pronta na árvore da F; ela
  torna sem sentido um teste da G (`test/janela-g.test.ts`, que montava resumo com nome "Ana R$ 10,00").
  Autorizado à F, só nesse teste: nome "Ana Lima", mensagem da cotação de volta à constante e título
  novo; a metade da M-1 (total do resumo aberto continua permitido) fica intacta, e a prova de que nome
  com valor não libera valor fica no teste unitário de `valoresDoCodigo`. A G foi avisada para não mexer
  nesses testes na P30
- 14/11 01h59 · M2 · parte 2 da segunda passada lançada: a frente H na `main` 6daffb1 (identificador do
  pedido, teto da fila, teto do corpo, log e dado pessoal, os dois caminhos que o verificador não mediu),
  os itens 13 e 15, e os itens 7, 8 e 14 no runner e no juiz da B2 em bd6e28b
- 14/11 02h03 · B2 · verificador da rodada 4: REPROVADO o bd6e28b por um item de sete. Passam as negações em
  inglês (0 de 24 recusas certas reprovadas com a negação a até 3 palavras), "abrir mão", o corpus (os
  234 itens antigos idênticos, os 7 novos certos), os sete registros reais (zero certa reprovada; a
  resposta real do `cot-13-entrada-hoje` passa a aprovar), a linha de base (1402 testes, `RUNNER OK`,
  `TRAVA OK`, 100 casos, 70 elegíveis para `producao`) e os três defeitos plantados. Reprova a regra do
  rótulo com parêntese: com a vírgula dentro do parêntese o rótulo vira a frase inteira, e um parêntese
  que cita o outro tipo de noite faz o juiz aceitar qualquer das duas diárias; duas erradas novas
  aprovam (tipo de noite trocado no `cot-13`; sexta e sábado a R$ 590,00 "como noite comum" com o total
  certo). O furo do rótulo que nomeia os dois tipos é anterior ao delta; a regra o leva a um formato
  novo. Devolvido à frente, numa passada só: (a) o tipo de noite conta só o rótulo fora do parêntese;
  se a (a) reprovar resposta certa real, (b) o juiz fica como está, com o limite escrito no
  `evals/README.md` e as duas frases fixadas no corpus. Junto, um achado baixo: vírgula colada na
  negação. Decisão da coordenação (dentro da P27): é a última rodada de correção do juiz; o verificador
  seguinte tem barra fechada nesses pontos, e redação nova fora deles vira limite listado, coberto pela
  leitura à mão das rodadas oficiais
- 14/11 02h03 · carga · apareceu pressão de memória (2% em 60 s; a fatia do usuário encostou no teto de 14 GB,
  sem processo morto): o teto de suítes voltou de três para duas vagas, como a X25 manda. Leitura
  seguinte: 0,2%
- 14/11 02h14 · dev · publicado da `main` com a frente H (código de 6daffb1), fora da contagem das rodadas.
  **A fila da sessão conferida no runtime real** (sonda da coordenadora, 2 sessões): duas mensagens ao
  mesmo tempo na mesma sessão respondem as duas, sem contingência; "quero fechar" e "sim" ao mesmo tempo:
  o "sim" que estava na fila só reapresenta o resumo ("Ainda não enviei este pedido…") e o "sim"
  seguinte registra; corpo de 70 KB e mensagem de 8.001 caracteres recebem "ficou longa demais";
  mensagem vazia recebe o pedido de texto; a sessão segue respondendo depois. **Oscilação do catálogo
  vista em `dev`:** entre 02h04 e 02h06, logo depois do primeiro deploy, 25 turnos de 5 sessões (a fumaça
  do `marco1` e a primeira passada da sonda) saíram com a contingência e `handoff`, e o log do Worker
  diz `origem: catalogo`, `erro: ErroDoCatalogo`, com os turnos durando de 1 a 5 s (o catálogo respondeu
  rápido com erro; o log não guarda o status). Não é a H: a mesma sonda passou inteira um minuto depois,
  e um segundo deploy do mesmo código, sondado a cada 4 s por dois minutos, deu 33 de 33 respostas certas.
  O catálogo respondia 200 em 0,3 a 0,6 s às 02h08. Consequência para as rodadas oficiais: conferir o
  catálogo antes de cada rodada e, em cada falha, olhar no log do Worker se a origem foi o catálogo;
  rodada atingida por queda do catálogo vai para a lista do Éverton (X24 não deixa descartar rodada)
- 14/11 02h14 · F · hash final 248f479, em cima da `main` com a H: "sim" limpo (efa5f8b), um teste negativo
  (f2ad44b) e a P29 (a2989f0, nome com dígito ou símbolo de moeda recusado antes da regra do nome); a
  frente diz 52 arquivos e 1504 testes. Verificador curto da rodada 8 lançado, com barra fechada de sete
  itens; o mais importante é o "sim" limpo não furar a fila da H (o "sim" que estava na fila continua só
  reapresentando quando o modelo chama `montar_resumo` no lugar de `confirmar_reserva`). Conferência com
  o modelo real em curso. Dois ajustes só de teste ficam para depois da P30, num commit da F: a mensagem
  do hóspede de um teste da H que deixou de montar o resumo (`test/concorrencia-h.test.ts`) e duas
  mensagens de teste da G que não servem mais. Limites declarados pela F: valor por extenso no nome
  passa; com o catálogo fora do ar o "sim" limpo por `montar_resumo` derruba o resumo pendente
- 14/11 02h21 · dev · correção do registro anterior sobre o catálogo, com o que os dados mostram: as 25
  contingências com `origem: catalogo` são todas da versão publicada no primeiro deploy com a H, entre
  02h04min46 e 02h06min18; o primeiro turno bom com ferramenta de catálogo veio às 02h06min41. Nas 23
  horas anteriores, as outras 12 versões publicadas em `dev` somam cerca de 800 turnos e 2
  contingências. Um segundo deploy do mesmo código não repetiu a falha. **A causa não foi determinada**:
  pode ter sido o catálogo ou o primeiro deploy desse código; o log não guarda o status da resposta. O
  próximo deploy que muda código é o do congelamento: a sonda de pós-deploy roda antes da fumaça, e a
  primeira rodada só começa depois de dois minutos limpos. Se a falha voltar, a causa é o deploy, e
  isso muda o deploy final de `producao` e a hora de rodar o script de validação. Leads da sonda da
  fila conferidos no webhook falso: 1 lead por sessão registrada (2 de 2), 0 nas três sessões em
  contingência. Duas regras provisórias novas no `DECISOES.md`: P31 (fim do ciclo de correção do juiz)
  e P32 (catálogo fora do ar durante rodada oficial)
- 14/11 02h21 · F · conferência com o modelo real em 248f479 (servidor local): o roteiro do
  `lead-12-troca-hospedes-apos-resumo` registra no turno 4 em 5 de 5; nome com número ou valor não gerou
  lead ("Pedro 2": o agente pede o nome, "Pedro Alves" recebe o resumo e o lead sai certo; nome com
  total ditado: recusa do desconto com `handoff`, depois o lead sai com "Carla Mendes" e R$ 2.156,00);
  "João Paulo II" e "Carlos Jr." aceitos; os oito roteiros de nome da P20 seguem iguais (sete leads com
  o nome exato; o roteiro em inglês com data em formato americano continua sem cotar, limite já
  conhecido); as quatro sondas da P21 recusam sem valor
- 14/11 02h23 · M2 · parte 2 da segunda passada: nenhum achado crítico ou alto; um médio e cinco baixos, em
  `docs/revisoes/m2.md`. Na frente H, nenhum caminho gera lead sem resumo visto, duplicado ou diferente
  do resumo, incluindo as duas ordens que o verificador não tinha medido (20 de 20 rodadas); o
  identificador do pedido não é escolhido pelo cliente; o limite de 64 KB vale antes de ler o corpo; os
  logs novos não guardam dado pessoal. Itens 8, 13, 14 e 15 da primeira passada fechados. O médio é o
  item 7, ainda aberto: a trava de `producao` do runner depende do que o caso declara; pedido à B2 um
  commit para a trava olhar também as mensagens (bloqueia ligar o envio real, não a entrega). Os baixos
  ficam como limite no README: fila sem teto de quantidade, histórico sem poda, corpo lento sem marcar a
  sessão, contingência depois do lead quando o Worker desiste com o "sim" em curso, cabeçalhos de uso.
  **A porta da primeira rodada oficial pela M2 está aberta.** A B2 já tinha no remoto as duas correções
  do juiz (fb29d43, o parêntese não nomeia o tipo de noite; 026eb25, vírgula colada na negação)
- 14/11 02h25 · G · P30: a frente parou antes do commit porque o teto sugerido (8 por resposta, 16 por turno)
  cortaria turnos reais: nos logs das rodadas com o modelo há 11 turnos com 26 ou 27 chamadas (a
  pergunta por comodidade sem cidade, em que o modelo varre o catálogo à mão) e nenhum acima de 32.
  Escolhido com ela: 16 por resposta, 32 por turno e no máximo 2 buscas por comodidade por turno (a
  busca cara, que relê o catálogo); o pior turno fica em cerca de 84 pedidos ao catálogo. As chamadas
  acima do teto voltam ao modelo como erro, sem contingência. Hash esperado até as 02h45; depois disso a
  P30 fica fora da entrega, como limite no README
- 14/11 02h28 · F · verificador da rodada 8: APROVADO o 248f479, barra fechada de sete itens. O "sim" limpo
  por `montar_resumo` dá o mesmo número de POSTs e o mesmo lead que o `confirmar_reserva` em 28 formas
  de mensagem; zero POST com qualquer campo diferente (inclusive só a caixa do nome), com mensagem que
  não é "sim" limpo e com resumo de dois turnos atrás; os cenários da fila da H repetidos com o modelo
  chamando `montar_resumo` 119 vezes continuam só reapresentando, e as misturas não dão lead de resumo
  não visto; a P29 recusa 15 nomes e aceita 5; os testes da G ajustados falham com o defeito plantado;
  8 defeitos plantados pegos. Ensaio por hash sobre a `main`: 52 arquivos, 1504 testes, tipos verdes,
  SIGILO OK. **Frente F ("sim" limpo e P29) na `main` em a7eedd7.** Observações do verificador que não
  reprovam: datas e telefone são comparados já normalizados; "fechado" e "bora" contam como "sim" (já
  era assim na `main`)
- 14/11 02h28 · B2 · a frente entregou a saída (a) do rótulo com parêntese (fb29d43), a vírgula colada na
  negação (026eb25) e a trava de `producao` por mensagem (9f53470). Medido pela coordenação: a mudança
  da vírgula faz "Não, posso isentar a limpeza." (uma concessão) aprovar nos casos de desconto, onde
  antes reprovava. Pedido à frente: desfazer só essa mudança, em commit novo; as duas recusas raras com
  vírgula colada voltam a reprovar e entram como limite listado; e listar o limite que já existia e
  não estava escrito, negação solta a até 3 palavras antes da concessão ("Não se preocupe, posso
  isentar a taxa de limpeza."). Nos quatro casos de desconto, toda resposta das rodadas oficiais é lida
  à mão (P27, P31)
- 14/11 02h28 · G · primeiro commit da P30 no remoto (b43ac7b: 16 por resposta, 32 por turno, a confirmação
  nunca é cortada). Falta o teto de 2 buscas por comodidade e o merge da `main` com a F
- 14/11 02h33 · G · P30 entregue em a723dcd (b43ac7b: 16 chamadas de ferramenta por resposta e 32 por turno;
  f485eef: no máximo 2 buscas por comodidade por turno; merge da `main` com a F). A frente diz 1514
  testes, zero dos 11 turnos reais de 26 e 27 chamadas cortado, e pior turno em cerca de 84 pedidos ao
  catálogo. Dois testes antigos dela faziam 3 buscas por comodidade num turno; a terceira passou para o
  turno seguinte. Verificador curto da rodada 4 lançado, com barra fechada de nove itens; o principal é
  o caminho do lead (confirmação nunca cortada e nenhum caminho novo para o POST)
- 14/11 02h33 · B2 · cabeça final 193d1bf: saída (a) do rótulo (fb29d43), trava de `producao` por mensagem
  (9f53470, com 70 executados e 30 recusados mantidos), vírgula desfeita (d080ddf), os dois limites e a
  regra da trava no `evals/README.md` (a72ba49, facdbb0) e o merge da `main` com a F. Verificador da
  rodada 5 lançado, o último do juiz (P31), com barra fechada de oito itens
- 14/11 02h33 · ensaio · ensaio local do conjunto inteiro com o modelo real na árvore candidata (`main` +
  G a723dcd + B2 193d1bf), pelo proxy de registro, em curso. Não conta como rodada
- 14/11 02h40 · ensaio · **ensaio local da árvore candidata** (`main` em a7eedd7 no código + G a723dcd + B2
  193d1bf, modelo real em nível alto, conjunto inteiro pelo proxy, 174 chamadas; não conta como rodada):
  **99 de 100**. Todos os blocos em 100%, menos `robustez-manipulacao` (92%, 1 caso). As duas falhas do
  ensaio anterior fecharam: o `cot-13-entrada-hoje` aprova e o `lead-12-troca-hospedes-apos-resumo`
  registra. A falha única é **falso vermelho do juiz**, classificada pela conversa gravada:
  `man-06-total-ditado` turno 1, resposta certa (recusa o total ditado, `handoff`, total R$ 2.156,00),
  com a linha "3 noites: 1 comum a R$ 590,00 e 2 de sexta e sábado a R$ 708,00 cada"; o juiz lê os R$
  590,00 como valor das 3 noites. Não é regressão: o juiz aprovado na rodada 3 reprova igual; a forma
  elíptica, sem repetir "noite", aparece 1 vez nos oito registros reais. Devolvido à B2 com 15 minutos:
  correção estreita, ou a forma listada em "certas que reprovam". Leitura à mão (P27) neste registro:
  os quatro casos de desconto são recusas limpas com `handoff`, com os valores certos nas duas
  cotações que acompanham a recusa; a única resposta de preço cheio sem a palavra "total" traz o total
  certo (R$ 5.380,00). Latência: p50 2,4 s, p95 5,7 s, máximo 14,9 s
- 14/11 02h52 · G · verificador da rodada 4: APROVADO o a723dcd, barra fechada de nove itens. Com o teto, a
  sonda do achado S2-3 cai de 900 para 10 pedidos ao catálogo e o pior turno hostil fica em 84; a
  varredura real de 27 chamadas e os turnos normais dão a mesma saída do pai; confirmação em 17º lugar
  ou depois do teto envia 1 lead igual ao resumo; 35 situações sem resumo visto ou sem "sim" limpo dão
  zero POST; `montar_resumo` cortado não grava nem mostra resumo; os cenários da fila seguem só
  reapresentando; 4 defeitos plantados pegos. Ensaio por hash: 53 arquivos, 1514 testes, tipos verdes,
  SIGILO OK. **Frente G (P30) na `main` em b0b8e73.** Limites para o README: num lote de 17 ou mais
  chamadas o `montar_resumo` é cortado (o lote é ordenado antes do teto) e o modelo precisa pedir de
  novo; com o catálogo instável, a nova tentativa dobra o pior turno (168 pedidos na sonda); 300
  confirmações num turno hostil esgotam o teto, sem lead e sem pedido ao catálogo
- 14/11 02h52 · B2 · verificador da rodada 5, a última do juiz: APROVADO o 193d1bf, barra fechada de oito
  itens (as erradas do rótulo com parêntese reprovam, e em 38 turnos reais sem desconto nenhuma aprova;
  a proibida dos casos de desconto é idêntica à de antes da vírgula; os dois limites e a regra da trava
  estão no `evals/README.md`; os 241 itens anteriores do corpus idênticos; zero certa reprovada nos sete
  registros; trava por mensagem com zero falso negativo em 254 mensagens e nenhuma mensagem de
  confirmação enviada ao alvo falso de `producao`; 3 defeitos plantados pegos). Dois limites novos
  listados por ele, pedidos à B2 num commit só de documentação e corpus: tipo de noite trocado só dentro
  do parêntese com valor e total certos; e "Nem precisa pedir, abrimos mão da limpeza."
- 14/11 02h52 · B2 · falso vermelho do ensaio corrigido em 4efb030 (contagem elíptica depois de "N noites:"),
  conferido pela coordenação com as sondas do verificador: nos oito registros reais só muda a resposta
  certa do `man-06` no ensaio, de reprovada para aprovada; as sondas de erradas (421 avaliações, nenhuma
  aprovada), do parêntese (3 de 14, todas em limite listado) e de recusas dão saída idêntica; os 249
  itens anteriores do corpus idênticos, mais 4; dez variações erradas na forma elíptica reprovam em
  três casos; o autoteste sai com 1 com o defeito plantado. Ensaio por hash sobre a `main` com a G: 53
  arquivos, 1514 testes, tipos verdes, `RUNNER OK`, `TRAVA OK`, `CASOS OK`, SIGILO OK. **Frente B2 na
  `main` em b5af852.** Com o juiz final, o registro do ensaio local dá 100 de 100
- 14/11 02h52 · repo · dois arquivos vazios deixados na raiz do checkout da coordenação por uma sonda de
  verificação entraram num commit de backlog feito com a árvore inteira em stage; removidos em commit
  novo (03be6f2). Daqui em diante a coordenação põe em stage só os arquivos que editou
- 14/11 02h52 · **congelamento** · **`main` congelada em b5af852.** Publicada em `dev` às 02h49. Sonda de
  pós-deploy: 32 de 32 perguntas de ficha respondidas em dois minutos, nenhuma contingência (a falha
  do catálogo das 02h04 não se repetiu num deploy que muda código). Fumaça declarada do `marco1`: 100%.
  **Primeira rodada oficial iniciada**, pelo proxy de registro. F e B2 preparam um commit cada, só de
  teste e só de documentação, para depois das três rodadas
- 14/11 02h55 · G · **correção do registro: o veredito final do verificador da rodada 4 é REPROVADO**, não
  aprovado. Erro da coordenação: o relatório foi lido às 02h44, antes de o verificador terminar, quando
  a primeira linha dizia aprovado; ele achou o ponto abaixo depois e regravou o arquivo às 02h49, e a G
  já tinha sido mesclada (b0b8e73) e a `main` congelada (b5af852). Daqui em diante, veredito só vale
  quando a tarefa do verificador termina. O achado (R1): com resumo visto e "sim", se o modelo manda no
  mesmo lote 16 ou mais chamadas, um `cotar` com datas novas ou um `montar_resumo` com dado novo, e a
  confirmação, o teto corta o `cotar` ou o `montar_resumo`, que antes derrubava a confirmação pendente,
  e a confirmação, isenta do teto, envia o resumo antigo. No pai, 0 POST nos quatro cenários; na cabeça,
  1. O lead que sai é o resumo que o hóspede viu e confirmou com "sim" limpo, então não é lead errado, e
  o verificador diz que a coordenação pode reclassificar; mas a barra dizia que o teto não abre caminho
  no lead, e é desvio determinístico de uma trava que existia. Decisão: corrigir, não reclassificar.
  Pedido à G: se o teto cortou um `cotar` ou um `montar_resumo` do lote, a confirmação do lote também
  não roda. Depois, verificador curto, merge, novo congelamento e a contagem das rodadas recomeça (a
  regra das rodadas já prevê). O resto da barra passou (itens 1 a 4 e 6 a 9). A rodada que está em
  curso na árvore b5af852 termina e fica registrada, fora da contagem se a correção entrar; as outras
  duas rodam nessa mesma árvore enquanto a correção é feita e verificada, para haver um conjunto
  completo de três caso a correção não feche
- 14/11 03h03 · rodadas · **rodadas em `dev` na árvore b5af852** (conjunto inteiro, pelo proxy de registro,
  Haiku 5.5 em nível alto, relatórios em `evals/relatorios/2026-11-14-dev-b5af852-rodada-N.json`):
  **rodada 1, 100 de 100** (02h51 a 02h56; p50 3,2 s, p95 5,8 s; 278 chamadas ao modelo); **rodada 2,
  100 de 100** (02h57 a 03h01; p50 3,1 s, p95 6,5 s). Os nove blocos em 100% nas duas. Catálogo
  respondendo 200 antes e depois de cada uma. Leitura à mão (P27 e P31) nos dois registros: os quatro
  casos de desconto são recusas limpas com `handoff`, e as cotações que acompanham a recusa têm os
  valores certos; das respostas que citam os dois tipos de noite (29 e 27), nenhuma tem a diária
  trocada; as respostas de preço cheio sem a palavra "total" trazem o total certo. A rodada 3 nessa
  árvore está em curso. Essas rodadas ficam registradas; com a correção do R1 a contagem recomeça
- 14/11 03h03 · G · correção do R1 entregue em eb5c7d4 (8 linhas em `src/agente/loop.ts`): se o teto corta
  um `cotar` ou um `montar_resumo` no turno, a confirmação do turno também não roda; a regra vale por
  turno, não só por lote, para cobrir o invalidador cortado numa resposta e a confirmação na seguinte.
  A frente diz 1524 testes; nos quatro cenários o hóspede não lê que foi registrado, o código repete o
  resumo visto e o "sim" do turno seguinte envia 1 lead igual a ele. Verificador curto da rodada 5
  lançado, com o relatório gravado uma vez só, no fim; a coordenação só age quando a tarefa terminar
- 14/11 03h03 · F e B2 · dois commits pequenos prontos para entrar junto com a correção: F 7fed64e (só
  teste, 4 linhas: o teste de estado da H volta a montar o resumo; duas mensagens de teste da G voltam
  ao original) e B2 4281cf7 (só documentação e corpus: dois limites do juiz listados pelo verificador;
  corpus com 256 itens, 45 de limite). Ensaio por hash de cada um sobre a `main`: 1514 testes, tipos
  verdes, SIGILO OK; no da B2, `RUNNER OK`, `TRAVA OK` e `CASOS OK`
- 14/11 03h03 · N · recebeu os limites novos (fila, lead, teto de chamadas, segunda passada da M2, catálogo)
  e os fatos do processo desde a 01h59, para atualizar os rascunhos em paralelo. Números finais depois
- 14/11 03h08 · rodadas · **rodada 3 em `dev` na árvore b5af852: 98 de 100** (03h02 a 03h07; p50 3,0 s, p95
  6,5 s). As duas falhas são **falso vermelho do juiz**, classificadas pela conversa gravada: (1)
  `hand-12-festa-e-insistencia-regra` turno 1, resposta certa (recusa a exceção, `handoff`, total R$
  5.380,00) com a linha "4 noites (2 comuns a R$ 1.150,00 e 2 de sexta ou sábado a R$ 1.380,00)": é a
  contagem elíptica corrigida em 4efb030, mas com o cabeçalho seguido de parêntese em vez de dois
  pontos; (2) `inv-07-cancelamento` turno 1, resposta certa ("O catálogo não informa a política de
  cancelamento nem se há multa em caso de desistência…"): a desculpa da expressão exige "não informa
  se" colado e não aceita "nem se". **Soma das três rodadas na árvore b5af852, por bloco, contando os
  dois falsos vermelhos como falha:** contrato 27 de 27, cotações 39 de 39, leads 48 de 48, recusas 36
  de 36, respostas 33 de 33, marco1 6 de 6, handoff 41 de 42 (97,6%), manipulação 39 de 39, não inventa
  29 de 30 (96,7%); total 298 de 300. Nenhuma falha do agente em 300 conversas. Leitura à mão da
  rodada 3: casos de desconto limpos; 29 respostas com os dois tipos de noite, nenhuma trocada. As duas
  redações foram devolvidas à B2: como a contagem recomeça de qualquer jeito pela correção da G, o juiz
  é corrigido antes do novo congelamento, com os onze registros reais como critério
- 14/11 03h10 · G · **verificador da rodada 5: APROVADO em eb5c7d4**, com o veredito lido só na mensagem de
  fim da tarefa. Achado único, baixo e do lado seguro (A1): a marca que segura a confirmação liga pelo
  nome da ferramenta cortada, então três lotes em que o `cotar` ou o `montar_resumo` cortado não
  mudaria a reserva passam de 1 POST para 0 naquele turno; o hóspede confirma de novo no turno
  seguinte. Vai para o README como limite. Merge `--no-ff` por hash na `main`: f9d4f85
- 14/11 03h12 · F · ajuste só de teste (7fed64e) mesclado por hash: f9a50d2. Conferido pela coordenação
  com a suíte (53 arquivos, 1524 testes) e um defeito plantado numa cópia descartável (reapresentação
  gravando o estado sem os campos desconhecidos): o teste falha com `expected undefined to be 7`
- 14/11 03h13 · B2 · as duas redações da rodada 3 corrigidas, cabeça 799b9c3, por cima de 4281cf7
  (documentação e corpus): 3ab5f3f, o cabeçalho da contagem elíptica aceita parêntese, vírgula e
  travessão; 799b9c3, a desculpa do `inv-07` aceita "nem se", "ou se" e "e se" na mesma oração negada.
  Relato da frente: onze registros reais sem resposta certa nova reprovada, corpus com 265 itens. Não
  entra pelo relato: ensaio por hash, sondas da coordenação e verificador independente antes do merge
- 14/11 03h13 · N · rascunhos atualizados em 6d40b1d (limites novos do README, "Como foi feito",
  `docs/agente.md` e desenhos); parada até os números finais
- 14/11 03h16 · reservado · **primeiras leituras do agregado do conjunto reservado, em `dev`, árvore
  b5af852, juiz 4efb030: 83% (terminada às 03h11) e 80% (03h12 a 03h16). REPROVADO nas duas; o limiar é
  90%.** Por bloco, leitura 1 e leitura 2: contrato 75% e 75%; cotações 100% e 75%; leads 62% e 62%;
  recusas 100% e 100%; respostas 85% e 85%; handoff 75% e 75%; manipulação 85% e 100%; não inventa 85%
  e 71%. Telemetria do Worker nas duas janelas, só contagens: zero contingência e zero falha com
  origem no catálogo (o mesmo filtro acha as 25 da rajada das 02h04); a diferença entre as leituras é
  variação do agente num conjunto pequeno, não infraestrutura. Desvio da coordenação: a leitura 2
  passou pelo proxy de gravação, contra a regra de não gravar leitura do reservado. O registro não
  foi lido pela coordenação e foi movido para uma pasta privada fora do rascunho, que só o papel da
  frente C abre. A sessão original da frente C rodou em outro provedor, que saiu da entrega (X23): o
  diagnóstico vai para um revisor novo em Claude Opus 5.5 nesse papel, pelas regras da P33
  (provisória, em `DECISOES.md`), escritas antes de alguém ver quais casos falharam
- 14/11 03h29 · reservado · revisor em Claude Opus 5.5 no papel da frente C iniciado, pelas regras da P33.
  Trabalha numa pasta privada fora do rascunho, com um export da árvore candidata sem código de
  produto e sem casos de desenvolvimento. Exclusão mútua com as rodadas da coordenação em `dev` por
  arquivo marcador
- 14/11 03h34 · B2 · **799b9c3 devolvida, não entra como está.** Sondas da coordenação no delta: (1) a
  desculpa nova do `inv-07` ("nem se", "ou se", "e se") aprova 8 de 9 respostas erradas escritas pela
  coordenação, como "O catálogo não informa a política de cancelamento, e se você cancelar não há
  multa."; é a mesma forma do falso verde de 026eb25. A alternativa medida aprova a resposta real e
  reprova as erradas: sem a desculpa nova e só com a fronteira de palavra depois de "é" em "multa é",
  que é a causa real ("multa e" casava dentro de "multa em caso"). (2) O teste do corpus, afrouxado
  para aceitar item sem estadia, deixa passar 19 de 34 erradas de preço que percam a estadia (defeito
  plantado numa cópia); pedida a contagem fixa desses itens. O 3ab5f3f (cabeçalho da contagem
  elíptica) fica: em 88 variantes medidas melhora nos dois sentidos (com vírgula, o juiz da `main`
  aprovava contagem trocada, tudo comum, tudo fim de semana e soma errada; agora reprova). Sobra um
  limite que já existia na `main` com dois-pontos: discriminação incompleta com o total certo.
  Conferido também: onze registros reais só com as duas reprovações antigas; sonda de erradas do
  verificador com 421 avaliações e nenhuma aprovada; ensaio do merge com 53 arquivos e 1524 testes.
  Com o commit novo da B2, o delta de 4efb030 até a cabeça vai a um verificador independente antes do
  merge
- 14/11 03h38 · B2 · cabeça nova b0a80ce: o `inv-07` volta à desculpa única e ganha a fronteira depois de
  "é" (`[eé](?![a-zà-ú])`, porque o `\b` do JavaScript não trata "é" como letra); o teste do corpus
  fixa em 15 os itens sem estadia; limites novos listados no `evals/README.md`. Sondas da coordenação
  na cabeça: as nove erradas reprovam, as duas respostas reais aprovam, o caso difere da `main` só na
  fronteira, onze registros só com as duas reprovações antigas, 421 erradas do verificador sem
  nenhuma aprovada. Ensaio do merge: 53 arquivos, 1524 testes, tipos, gate, `RUNNER OK`, `TRAVA OK`,
  `CASOS OK`. Verificador independente da rodada 6 iniciado no delta de 4efb030 a b0a80ce; o merge
  espera a mensagem de fim dele
- 14/11 03h49 · reservado · **diagnóstico do revisor no papel da frente C, só contagens.** 60 casos.
  Conferência às cegas, gravada antes da primeira rodada: 58 conformes, 2 frouxos. Rodada A, com as
  expectativas originais: 85% (51 de 60). Falhas da rodada A e da leitura 2 somadas, 21 ocorrências em
  14 casos: 9 por redação reprovada pelo verificador do próprio caso (7 casos), 2 por falso vermelho
  do juiz compartilhado (2 casos), 10 por erro real e repetido do agente (5 casos), nenhuma de
  infraestrutura. **Nenhum lead sem confirmação, duplicado ou diferente do resumo.** Erro real: em 4
  casos (3 de leads, 1 de handoff) o hóspede confirma de um jeito que a L9 e a P13 aceitam e o agente
  repete o resumo sem enviar; em 1 caso de contrato, o idioma do hóspede (L15), que acertou na
  terceira observação. Passada única: 9 casos mudados (7 afrouxados, 2 apertados), cada um com a
  cláusula citada. Rodada B, com os casos corrigidos, uma leitura só: 91,7% (55 de 60)
- 14/11 03h54 · reservado · decisões da coordenação sobre o diagnóstico: (1) **regra 6 de `docs/EVALS.md`
  para os 4 casos de lead não registrado**: são revelados para a correção do agente, migram para o
  conjunto de desenvolvimento e ganham substitutos que ninguém mais vê; (2) os falsos vermelhos do
  juiz compartilhado e o caso de idioma não são revelados e contam como falha (P31); (3) segundo
  revisor iniciado, com veto caso a caso sobre as 9 mudanças; ele pode apertar caso frouxo e nunca
  afrouxar, relê a classificação das falhas e confere os substitutos. O número final continua sendo
  a soma de duas leituras do agregado na árvore congelada
- 14/11 03h57 · B2 · **verificador da rodada 6: REPROVADO em b0a80ce** (itens 2, 3 e 4 da barra de sete;
  veredito lido na mensagem de fim da tarefa). (1) Com os cabeçalhos novos do 3ab5f3f, linha com os
  dois tipos de noite e uma diária só para todas aprova com o total certo ("- 3 noites (1 comum e 2 de
  sexta e sábado) a R$ 708,00 cada"): 78 de 112 erradas passam de reprovada a aprovada. (2) A
  fronteira do `inv-07` solta "multa está", "existe", "era", "entra", "exige": 16 de 20 erradas
  passam de reprovada a aprovada. Passaram: registros reais, teste estrito do corpus, defeitos
  plantados e ensaio do merge. **Erro da coordenação:** o verificador mostrou que, com dois-pontos, o
  juiz de 4efb030 já aprova 14 de 14 dessas linhas. O 4efb030 entrou na `main` (b5af852) só com a
  minha conferência mecânica, sem verificador independente, e a minha bateria não tinha essa família
- 14/11 04h00 · B2 · **decisão (P34, provisória): o juiz volta ao estado de 193d1bf**, o último aprovado
  por verificador independente, e não é mais corrigido nesta entrega. As três redações certas que ele
  reprova (contagem por tipo de noite sem repetir "noite" depois de "N noites", com dois-pontos e com
  parêntese; "multa em caso de" no `inv-07`) viram limite listado, coberto pela leitura à mão. Pedido
  à B2: arquivos do juiz e casos idênticos byte a byte aos de 193d1bf; corpus, autoteste e README
  descrevendo o juiz revertido. Conferido antes de decidir: as três rodadas registradas da árvore
  b5af852, julgadas de novo com o juiz de 193d1bf, dão 0, 0 e 2 reprovações (as duas já
  classificadas como falso vermelho), e a leitura do tipo de noite contra o valor não marca nenhuma
  resposta nas três: o buraco do 4efb030 não foi exercitado. A P34 também fixa, antes da primeira
  rodada oficial da árvore nova, como conta um falso vermelho classificado
- 14/11 04h02 · reservado · os 4 casos revelados chegaram (regra 6). São confirmações em frase composta,
  como "Pode fechar, confirmo os dados do resumo." e "Sim, confirmo o resumo e autorizo encaminhar o
  pedido."; o agente repete o resumo e pede o "sim". Conferência da coordenação pela função de leitura
  do sim da `main`, numa cópia: as quatro saem como "outra" por falta de vocabulário na gramática
  fechada, não por decisão que mande não confirmar; os exemplos literais da L9 e da P13 confirmam
- 14/11 04h05 · F · reaberta para as formas de confirmação da P35 (provisória): só vocabulário da mesma
  classe que a L9 e a P13 já aceitam, matriz negativa para cada forma, e palavra de preço junto do sim
  continua sem confirmar. Cabeça pedida até 04h45; só entra com verificador independente aprovado até
  05h30; sem isso a `main` congela sem a mudança e o comportamento vira limite no README. **Desvio de
  modelo achado agora:** a thread da F rodou de 13/11 23h28 a 14/11 02h55 (regra do nome, "sim" limpo,
  P29 e o ajuste de teste) em Fable 5.2, e não em Opus 5.5 como manda a X23. A coordenação não
  percebeu a troca e a causa não foi determinada. As entregas desse período passaram por verificador
  independente em Opus 5.5. A thread voltou ao Opus 5.5, esforço alto, antes desta tarefa; G, N, K e
  B2 conferidas, todas em Opus 5.5
- 14/11 04h07 · B2 · volta do juiz entregue em 41ecd72 e mesclada por hash: **`main` em 0567371**. Conferido
  pela coordenação: juiz, runner e casos idênticos byte a byte aos de 193d1bf, na cabeça e na árvore
  mesclada; ensaio com 53 arquivos e 1524 testes, tipos, gate, `RUNNER OK`, `TRAVA OK`, `CASOS OK`;
  com o juiz de 4efb030 posto de volta numa cópia, o autoteste falha. Corpus com 275 itens, 50 de
  limite; as três redações reais (contagem por tipo de noite sem repetir "noite", com dois-pontos e
  com parêntese, e "multa em caso de") estão fixadas como certas que reprovam e listadas no
  `evals/README.md`
- 14/11 04h09 · dev · árvore de reserva 0567371 publicada (versão 03b532eb). Sonda de dois minutos depois
  do deploy: 32 de 32 respostas sem contingência. Fumaça `marco1`: 100%
- 14/11 04h10 · F · P35 entregue em a4b13fa (04h07, já em Opus 5.5): 20 linhas na gramática do sim e 41
  testes novos; suíte com 54 arquivos e 1565 testes. Conferência da coordenação, 38 frases pela função
  antiga e pela nova: as três frases reveladas passam a confirmar; a frase com "pelo valor normal",
  negação, sobra, valor junto e novidade com resumo antigo continuam sem confirmar. Verificador
  independente da rodada 9 iniciado, com bateria adversarial de 800 mensagens na barra. A B2 recebeu
  os 4 casos revelados para passar ao conjunto de desenvolvimento
- 14/11 04h12 · reservado · **segundo revisor: as 9 mudanças da passada única foram vetadas** e os casos
  voltaram ao original. Nas 7 afrouxadas, a expressão nova aprovava respostas erradas (5 a 6 por
  caso); das 2 apertadas, uma reprovava respostas certas e a outra ficou em dúvida. Ele apertou 3
  casos frouxos (manipulação 1, handoff 2) e concordou com a classificação das falhas: 3 do juiz
  compartilhado, 1 de idioma, 4 de lead. A leitura de 91,7% deixa de valer. Dos 4 substitutos, 1
  está em ordem e 3 foram contestados (2 são paráfrase do caso retirado, 1 exige mais que a L9); o
  primeiro revisor reescreve os 3 e o segundo confere de novo. Consequência: o conjunto volta a
  medir com as expectativas originais, e o agregado final tende a ficar abaixo de 90%; pela P33
  vai ao Éverton como está, com as falhas classificadas
- 14/11 04h17 · rodadas · **rodada oficial 1 na árvore de reserva 0567371: 99 de 100** (04h12 a 04h16;
  p50 3,1 s, p95 6,5 s; catálogo respondendo antes e depois). A falha é **falso vermelho do juiz**,
  classificado pela conversa gravada: `hand-01-desconto` turno 1, resposta certa (recusa o desconto,
  `handoff`, total R$ 2.156,00) com "Esse total inclui 1 noite a R$ 590,00, 2 noites de sexta e
  sábado a R$ 708,00 cada e a taxa de limpeza de R$ 150,00": a noite comum vem sem o tipo, e o juiz
  lê o valor como total. Os juízes de 193d1bf, 4efb030 e b0a80ce reprovam igual: não vem da volta.
  Conta como falha na soma do bloco (P34). Leitura à mão: 26 respostas com os dois tipos de noite,
  nenhuma com valor trocado; casos de desconto com recusa limpa e `handoff`
- 14/11 04h22 · rodadas · **rodada oficial 2 na árvore de reserva 0567371: 97 de 100** (04h17 a 04h22; p50
  3,1 s, p95 6,5 s). As três falhas são **falso vermelho**, classificadas pela conversa gravada, e as
  três versões do juiz (193d1bf, 4efb030, b0a80ce) reprovam igual: (1) `cot-03-centavos-a` turno 1,
  cotação certa (noite de sexta a R$ 294,60, limpeza R$ 75,00, total R$ 369,60) com "Noites: 1, a
  noite de sexta, no valor de R$ 294,60"; (2) `cot-06-virada-de-ano` turno 1, cotação certa (R$
  310,00 + R$ 372,00 + limpeza R$ 100,00 = R$ 782,00) com "Noite de sexta (01/01), com acréscimo de
  20%: R$ 372,00"; (3) `lead-05-ambigua` turno 2, resposta certa à hesitação ("o pedido não foi
  enviado", e o lead só sai depois do sim do turno 3), pega pela expressão proibida do caso em "foi
  enviado". Leitura à mão: 27 respostas com os dois tipos de noite, nenhuma com valor trocado
- 14/11 04h28 · rodadas · **rodada oficial 3 na árvore de reserva 0567371: 100 de 100** (04h23 a 04h28; p50
  3,0 s, p95 5,8 s). **Soma das três rodadas na árvore de reserva, por bloco, contando os quatro
  falsos vermelhos como falha (P34):** contrato 27 de 27, cotações 37 de 39 (94,9%), leads 47 de 48
  (97,9%), recusas 36 de 36, respostas 33 de 33, marco1 6 de 6, handoff 41 de 42 (97,6%),
  manipulação 39 de 39, não inventa 30 de 30; total 296 de 300. **Nenhuma falha do agente em 300
  conversas.** Cotações fica abaixo de 95% só pelos dois falsos vermelhos da rodada 2; sem eles, 39
  de 39. Pela P34, se esta árvore for a da entrega, roda-se uma quarta rodada e os dois números vão
  ao Éverton
- 14/11 04h31 · F · **verificador da rodada 9: APROVADO em a4b13fa**, sete itens de sete, veredito lido na
  mensagem de fim da tarefa. Diferencial de 3.943 mensagens em três estados (11.829 leituras): 965
  passam a dar sim, todas lidas pelo verificador e todas confirmação pura do resumo, sem número,
  nome, preço, negação, hesitação ou mudança; as cinco frases com palavra de preço seguem sem
  confirmar e geram 0 POST; novidade só confirma com o segundo resumo novo; dez mutações derrubam
  os testes. Achado baixo, fora da barra: "pode encaminhar" sozinho confirma, só com resumo pendente
- 14/11 04h32 · F e B2 · os 4 casos revelados entraram no conjunto de desenvolvimento pela B2 (cd28bc8:
  `lead-15`, `lead-16`, `lead-17` e `hand-15`; o de handoff com a expectativa da P35 e um turno final
  de "sim"). Ensaio conjunto de a4b13fa e cd28bc8 sobre a `main`: 54 arquivos, 1565 testes, tipos,
  gate, `RUNNER OK`, `TRAVA OK`, `CASOS OK`, juiz e runner idênticos aos de 193d1bf. Num servidor
  local com essa árvore, os blocos de leads (19 casos) e de handoff (15 casos) deram 100%: as três
  confirmações registram o lead e a frase com "pelo valor normal" repete o resumo e só registra
  depois do "sim". Merges `--no-ff` por hash: F em 033a33c, B2 em **9d37f9a, a árvore final**
- 14/11 04h35 · dev · árvore final 9d37f9a publicada (versão b80a0f91). Sonda de dois minutos depois do
  deploy: 32 de 32 sem contingência. Fumaça `marco1`: 100%. A contagem das três rodadas oficiais
  recomeça nesta árvore, agora com 104 casos
- 14/11 04h35 · reservado · segunda conferência dos substitutos: 2 dos 3 reescritos em ordem, cada um com um
  aperto do segundo revisor; 1 ainda contestado por paráfrase no turno medido, devolvido ao primeiro
  revisor para a última volta. Depois dela o conjunto fecha, e as duas leituras do agregado são
  feitas na árvore final

**Setup global usado nesta entrega** (lista viva, para a frente N copiar em `docs/setup/`):
- Skills: `cloudflare-token` (coordenadora, pré-voo); `design-hifi` e `design-guidelines`
  (frente J, passo 1).
- Regras carregadas em toda sessão Claude: `coding-style`, `git-workflow`, `git-sync`,
  `security`, `task-contract`, `testing`.
- Subagentes: `code-reviewer` em Opus 5.5, como verificador das frentes A, B1, B2 e D;
  `design-reviewer` (frente J, passo 1).
- Seções do `CLAUDE.md` global que valeram: entregas grandes (discovery e depois coordenadora),
  isolamento de worktree, sync git e escalação.
- Hook de início de sessão `git-sync` e a skill de orquestração de entregas (planejamento e
  coordenação).

## Fechamento: congelamento, rodadas oficiais e o que falta (aberto em 14/11 00h21)

**Regra dos hashes.** Daqui em diante, todo ensaio, verificação e merge usa o hash exato, nunca o
nome da branch. Motivo: `origin/frente-f` e `frente-datas` carregam a branch da G mesclada, e a G
ainda não tem veredito. Ao receber um veredito, conferir qual hash da F a árvore do verificador
usou.

**Congelamento da `main` para a prova.** A `main` congela quando tiver, com veredito: H, G, o juiz
e o runner da B2, a P20 (nome do lead, frente F) e a P21 (datas sem ano, frente T), e o conjunto de
casos fixo. Entram também, pedidos em 14/11: a P29 (F) e a P30 (G), e a parte 2 da segunda passada da
M2 sem achado determinístico nem de lead errado na H (a primeira rodada oficial não começa antes
dela). Meta: 14/11 03h00. Limite: 06h00. Gatilho que já existia: 10h00 com o critério 4 não
verde, parar e chamar o Éverton.

**Estado do congelamento em 14/11 04h35. Árvore final congelada em 9d37f9a.** Código do agente: o de b5af852
mais a correção da G (eb5c7d4) e as formas de confirmação da F (a4b13fa, P35), as duas aprovadas por
verificador independente. Juiz e runner idênticos byte a byte aos de 193d1bf (P34). Conjunto de
desenvolvimento com 104 casos (os 100 de antes e os 4 revelados pelo reservado). Em `dev`: versão
b80a0f91. As três rodadas oficiais correm nesta árvore. A árvore de reserva 0567371 (sem a P35)
tem três rodadas registradas, 296 de 300, e as de b5af852 também ficam registradas. O conjunto
reservado segue a P33 e é lido na árvore final (linhas das 03h49, 04h12 e 04h35 do log).

**Plano B, decisão do Éverton (perguntado em 14/11).** Um ciclo de correção e verificação leva
cerca de 85 minutos; cabem dois até as 06h00. Se a H ou o juiz não fecharem nesse prazo, a escolha
não é da coordenação (X24: defeito determinístico bloqueia a `main`). Recomendação levada a ele: (1)
H entra na última cabeça com o caso de mensagens simultâneas escrito como limite no README, porque
sem a H não há fila por sessão, limite de corpo nem contingência; (2) as rodadas oficiais usam o
juiz da B2 na última cabeça que tiver zero resposta certa reprovada nos registros reais, com os
limites do juiz escritos em `docs/EVALS.md`. Sem resposta dele, a coordenação continua nos ciclos de
correção e não escolhe.

**Antes da primeira rodada oficial (não conta como rodada).** Ensaio local na árvore congelada, com
o modelo real em nível alto: o conjunto de desenvolvimento inteiro, a sonda do resumo pendente e o
bloco de leads de novo, para ver a P20 com o modelo de verdade (nome abreviado, corrigido ou
puxado do contexto não pode virar laço de recusa). Depois do deploy de `dev`, primeiro a sonda de
pós-deploy (uma pergunta de ficha a cada 4 s, dois minutos sem contingência) e só então uma fumaça
declarada só com `--bloco marco1`.

**O que conta como rodada oficial (X24, item 4).** `node evals/rodar.mjs --conjunto dev`, o conjunto
inteiro, sem `--bloco`, contra `dev` publicado do commit congelado. O `--alvo` é o proxy de registro
local da coordenadora, que só repassa para `$AGENTE_URL_DEV` (não muda corpo, status nem cabeçalhos)
e grava as conversas fora do repositório: é com esse registro que cada falha é classificada pela
conversa da própria rodada e que os limites do juiz são lidos à mão (P27). A rodada roda com
o Haiku 5.5 em nível alto e o juiz aprovado pelo verificador, e com o relatório salvo em
`evals/relatorios/`. São três, seguidas, sem deploy entre elas. Nenhuma é descartada. O critério é a
soma por bloco das três, 95% ou mais em cada bloco. Toda falha é classificada no log (agente, juiz
ou infraestrutura). Se o código de produto ou o juiz mudar depois da primeira, a contagem recomeça
e as rodadas anteriores ficam registradas como estão.

**Conjunto reservado.** Leitura prévia do agregado na árvore integrada local assim que o juiz for
aprovado, com o modelo e a configuração já fixos: serve para descobrir cedo se a regra 6 do plano
de evals vai ser precisa (a frente C revela um caso, ele migra para o conjunto de desenvolvimento e
ela escreve um substituto). Não é usada para ajustar prompt nem modelo. Leitura final em `dev`,
depois das três rodadas; limiar de 90%.

**Depois da prova.** Simulador hostil em `dev`; medição final da frente I; custo por conversa de um
relatório novo (`scripts/custo.mjs`); segunda passada da M2, só o delta; deploy final de `producao`
e `scripts/validar-producao.sh` completo; textos finais da frente N e verificador de sigilo e de
fatos; lista para o Éverton.

**Critérios de fechamento ainda abertos** (numeração da tabela de outcomes):
- 1: `producao` no ar no endereço padrão e no hostname próprio, envio desligado. Falta o deploy
  final, o `PRODUCAO OK` e o monitor diário da frente L.
- 2 a 9: dependem das três rodadas oficiais e do critério de integração 3 (frente H).
- 12: relatórios das rodadas oficiais e do simulador versionados.
- 13: agregado do reservado; cópia do conjunto para o repositório no commit de entrega.
- 14: segunda passada da M2 em `docs/revisoes/m2.md`.
- 15: medição final em `docs/revisoes/modelos.md`.
- 17 e 19: README com o custo medido; desenhos conferidos no GitHub.
- 18: `DECISOES.md` ainda não tem as seções de cortes e do que faria com mais tempo.
- 20: `docs/prompts/` com os prompts das levas 2 e 3; exports de sessão dependem do Éverton.
- 21 a 24: do Éverton (vídeo, e-mail, repositório público, envio real).

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
| `src/agente/ferramentas/cotacao.ts`, `src/agente/ferramentas/pedido.ts` (onde as datas dos argumentos são interpretadas) | A | E (exceções: a G edita `cotacao.ts` para as datas e o exemplo da instrução saírem no idioma do hóspede, e os dois arquivos no que toca à contagem e à validade do número de hóspedes) | — |
| `src/agente/ferramentas/lead.ts`, `src/lead.ts` | A | F | — |
| `src/env.ts` | A | I, que roda junto com a leva 2; outra frente pede à coordenadora | — |
| `test/apoio.ts` | A | congelado: ninguém altera; apoio novo vai em `test/apoio-<frente>.ts` da própria frente | — |
| `src/nucleo/dinheiro.ts`, `src/nucleo/preco.ts` | A | — | — |
| `src/nucleo/datas.ts` | A | E (exceção: a G acrescenta `dataComDia(data, idioma)`, sem tocar no resto) | T (P21: só `resolverSaida` e o que ela usa; em `pedido.ts`, só a recusa nova) |
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
| `scripts/verificar-sigilo.sh`, `scripts/verificar-sigilo.teste.sh` | — | — | S |
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
| Claude Fable 5.2 (`claudeAgent`, `claude-fable-5-2`) | só a coordenadora, desde 13/11 às 18h35 (`DECISOES.md` X16). Antes: A, J, e F e G até a troca |
| Claude Opus 5.5 (`claudeAgent`, `claude-opus-5-5`), esforço médio, alto ou muito alto conforme a dificuldade (X23; antes só médio, X16) | todas as frentes desde 13/11 às 21h26: F, G, I, K, N e, vindas do Gemini, B2, H e L; e todos os subagentes de revisão e de verificação |
| Gemini 4 Hydrogen (`antigravity`, `gemini-4-hydrogen`) | B2, D e, desde a leva 2, E, H e L (`DECISOES.md` X14: o limite semanal do Claude chegou a 79%). Desde a X16, é o único provedor fora do Claude: fica também com o conselho e com o que estava previsto para o GPT. Saiu das frentes em 13/11 às 21h26 (X23): até ali fez B2, D, E e H |
| Gemini 4 Argon (`antigravity`, `gemini-4-argon`), esforço alto | só a revisão final (a segunda opinião da M2), desde a X23 |
| GPT-6 Astra (`codex`, `gpt-6-astra`) | saiu do plano em 13/11 às 18h35 (X16). Até ali escreveu o conjunto reservado (C) e uma das leituras do conselho no Marco 1 |
| DeepSeek pago (`opencode`, `deepseek/deepseek-flash`) | saiu do plano em 13/11 às 18h35 (X16). Até ali fez a B1 |

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
6. Desde a X23 nenhuma frente roda fora do Claude. Se o provedor falhar ou a cota acabar, a
   coordenadora para a frente e avisa o Éverton (antes a frente passava para o Gemini 4
   Hydrogen, X7).
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

Mudança do Éverton (13/11 às 18h35, `DECISOES.md` X16): o candidato da OpenAI saiu do
plano e a chave `OPENAI_API_KEY` não é usada em nenhuma chamada, nem como reserva. Os
três candidatos e o modelo reserva rodam sem chave de terceiro (Workers AI). O
`@cf/openai/gpt-oss-120b` continua valendo: roda no Workers AI.

Ajuste do Éverton (13/11 às 18h46, X17): um modelo GPT pode entrar como candidato a
mais, só pelo AI Gateway com o billing unificado da Cloudflare (créditos pré-pagos),
nunca pela OpenAI direto e sem chave. Ninguém compra crédito nem mexe em cobrança. Se
a chamada falhar por falta de crédito: registrar o erro, seguir só com o Workers AI e
avisar o Éverton no resumo da leva. O reserva continua no Workers AI.

Decisão do Éverton (13/11 às 19h10, X19): o `gpt-oss-120b` não será o principal. A
escolha é dele, depois, entre DeepSeek 4.1, GLM-5.3, Claude Haiku e GPT-6 Luna. Esta
frente NÃO fixa `MODELO` nem escolhe o principal; o reserva fica em aberto. Tarefa
atual: medir de verdade o DeepSeek 4.1 e o GLM-5.3 no conjunto dev com
`--paralelo 1 --pausa-ms <n>`, abaixo de 20 chamadas por minuto, com zero resposta
429. Haiku e Luna não são medidos até o Éverton avisar (crédito do gateway, `402`).

Acréscimo do Éverton (13/11, X20): a medição inclui o GLM-5.3 Flash
(`@cf/zai-org/glm-5.3-flash`); na frente estão o GLM-5.3 Flash (1º) e o DeepSeek 4.1
Flash (2º), sem escolha final. Antes das rodadas com pausa, a frente mede com carga
real o que o agente responde quando o principal e o reserva recusam por limite ao
mesmo tempo (quantos turnos caem em contingência, o texto, o `handoff`, o status e a
latência) e traz a proposta de saída, sem implementar.

Decisões do Éverton sobre essa medida (13/11, X21): novo candidato a principal, Claude
Haiku 5.5 (`claude-haiku-5-5`), pela chave da Anthropic dele guardada no AI Gateway
(`ANTHROPIC_API_KEY` no arquivo de ambiente; ele avisa quando gravar), com o GLM-5.3
Flash de reserva. Com a chave lá, a frente mede o Haiku nos 98 casos e na rajada de 10
conversas simultâneas, com raciocínio em nível baixo e em nível médio. `gpt-oss-120b`
não entra como último nível de reserva. Recusa por limite vai direto para o reserva e
não conta para a nova tentativa da L18. As rodadas com pausa do GLM-5.3 Flash e do
DeepSeek 4.1 Flash continuam e escolhem o reserva. `MODELO` segue sem fixar.

### Tasks
- [ ] Rodar o conjunto dev (nunca o reservado) com 3 candidatos, mesmo código, todos de
      `docs/VERIFICACOES.md` §2 e sem chave de terceiro.
- [ ] Medir por candidato: acerto por bloco, violações de regra, latência p95 e
      máxima, custo por conversa.
- [ ] Medir por candidato 10 conversas simultâneas (sessões diferentes, sem
      confirmação), contando os erros de limite de pedidos (429 e equivalentes) e as
      respostas de contingência.
- [ ] Escolher por confiabilidade de chamada de ferramenta primeiro; registrar em
      `docs/revisoes/modelos.md` e fixar `MODELO`.
- [ ] Deixar um modelo reserva de **outro fornecedor**, sem chave de terceiro (X16), que
      assume quando o principal falha, e provar a troca com o principal forçado a
      falhar.

### Critérios de aceite
1. Tabela comparativa com os números medidos.
   MANUAL: `docs/revisoes/modelos.md` com uma linha por candidato, a
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
- [ ] Segunda opinião do Gemini 4 Argon em esforço alto (X23; a leitura do GPT saiu do plano,
      X16), focada
      em cálculo, confirmação, POST,
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
