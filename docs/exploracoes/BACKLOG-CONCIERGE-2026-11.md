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
| I | agente-concierge | Escolha do modelo por eval | A, B2 | alta | 1 | subagente em worktree · Opus 5.5, esforço médio desde a X16 | fase 1 entregue; medindo DeepSeek 4.1 e GLM-5.3 em ritmo abaixo do limite (X19); escolha do principal é do Éverton | `t3/` (subagente) |
| E | agente-concierge | Datas | Marco 1, L1, L1a, L1b, L2 | alta | 1,5 | subagente em worktree · Gemini 4 Hydrogen | concluída: na `main` (81873fa) | `t3/datas-relativas-sao-paulo` |
| F | agente-concierge | Lead robusto | Marco 1, L6, L7, L9, L10, L11, L15 (textos fixos), L20 | alta | 2,5 | thread T3 · Fable 5.2 até 13/11 18h35, depois Opus 5.5 com esforço médio (X16) | concluída: na `main` (801c8a2); verificador independente rodando | `frente-f` |
| G | agente-concierge | Robustez e handoff | Marco 1, L3, L4, L5, L5a, L12, L13a, L15, L16, L16a, L19, L21 | alta | 2,5 | thread T3 · Fable 5.2 até 13/11 18h35, depois Opus 5.5 com esforço médio (X16) | rodando | `frente-g` |
| H | agente-concierge | Concorrência endurecida e falha interna | Marco 1, L17, L17a, L18 | alta | 1 | subagente em worktree · Gemini 4 Hydrogen até 13/11 21h26; depois Opus 5.5, esforço alto (X23) | duas rodadas de verificador independente; correções entregues (c905a09); espera a F entrar na `main` para o merge final e a terceira rodada | `t3/durable-session-concurrency` |
| J | agente-concierge | Página de chat em dois passos: design (canvas) e implementação | passo 1: nada; passo 2: Marco 1 e aprovação do Éverton | baixa | 0,7 + 1 | thread T3 · Fable 5.2 | passo 1 concluído (canvas aprovado pelo Éverton, com dois ajustes); passo 2 entregue (b8991ce) | `frente-j` |
| M2 | agente-concierge | Revisão de código, segurança e segunda opinião | leva 2 integrada | alta | 1,5 | subagentes Opus 5.5 + segunda opinião do Gemini 4 Argon em esforço alto (X23) | pendente | — |
| L | agente-concierge | Custo por conversa e monitor diário | leva 2 integrada | média | 1 | subagente em worktree · Opus 5.5 (X23; antes prevista para o Gemini 4 Hydrogen) | pendente | — |
| K | agente-concierge | Produção com o envio real desligado | M2 | alta | 1,5 | thread T3 · Opus 5.5, esforço conforme a dificuldade (X23) | pendente | — |
| N | agente-concierge | Entregáveis de processo | K | alta | 2 | thread T3 · Opus 5.5, esforço conforme a dificuldade (X23) | pendente | — |
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
| `src/agente/ferramentas/cotacao.ts`, `src/agente/ferramentas/pedido.ts` (onde as datas dos argumentos são interpretadas) | A | E (exceções: a G edita `cotacao.ts` para as datas e o exemplo da instrução saírem no idioma do hóspede, e os dois arquivos no que toca à contagem e à validade do número de hóspedes) | — |
| `src/agente/ferramentas/lead.ts`, `src/lead.ts` | A | F | — |
| `src/env.ts` | A | I, que roda junto com a leva 2; outra frente pede à coordenadora | — |
| `test/apoio.ts` | A | congelado: ninguém altera; apoio novo vai em `test/apoio-<frente>.ts` da própria frente | — |
| `src/nucleo/dinheiro.ts`, `src/nucleo/preco.ts` | A | — | — |
| `src/nucleo/datas.ts` | A | E (exceção: a G acrescenta `dataComDia(data, idioma)`, sem tocar no resto) | — |
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
