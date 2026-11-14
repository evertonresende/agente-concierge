# Como foi feito

O processo de construção do agente, tirado do log de execução do
[backlog](exploracoes/BACKLOG-CONCIERGE-2026-11.md) e de [`DECISOES.md`](../DECISOES.md).
Horários de 13/11/2026, em Brasília, como estão no log. Este documento é um rascunho: o
que se mede no fim está marcado como "a preencher".

## Em uma tela

1. Uma sessão de planejamento leu o enunciado, verificou a plataforma e escreveu o
   contrato, o plano de evals e o backlog. Nenhuma outra sessão leu o enunciado.
2. O Éverton decidiu as lacunas do enunciado antes do código.
3. Uma sessão coordenadora despachou frentes paralelas, cada uma na sua worktree e só nos
   seus arquivos. Ela não editou código de produto.
4. Antes de cada merge, um verificador independente leu o diff, mandou sondas e plantou
   defeitos para ver se a suíte pegava.
5. Um conjunto de evals reservado, escrito por outro provedor, ficou fora do repositório.
   Quem corrige o agente só vê o agregado.
6. Um gate de sigilo e de histórico rodou antes de cada commit e de cada push.
7. O modelo foi escolhido por medição, com a tabela na frente do Éverton.

Estimativa do plano: 29,5 horas de agente; caminho crítico de 11 horas de relógio mais 1
hora de coordenação, 12 horas no total. Prazo de entrega:
14/11 às 14h.

## 1. Contrato antes do código

- **Planejamento.** O prompt está em [`prompts/01-planejamento.md`](prompts/01-planejamento.md).
  A sessão leu o enunciado (material local, fora do repositório) e rodou seis verificações
  em subagentes paralelos, na documentação da Cloudflare e por GET no catálogo real:
  concorrência no Durable Object, modelos com chamada de ferramenta, plano pago e riscos
  de 7 dias no ar, ambientes e secrets, validação de `producao` sem POST e formato real do
  catálogo. Resultado com fonte em [`VERIFICACOES.md`](VERIFICACOES.md).
- **O que as verificações mudaram.** A fila por sessão existe porque o objeto intercala
  pedidos durante a espera de I/O e o bloqueio nativo tem limite de 30 s, menor que uma
  chamada de modelo. O cálculo em centavos inteiros existe porque uma diária real de
  245,50 vezes 1,2 em ponto flutuante dá 294,59999999999997. A L23 (subdomínio próprio)
  existe porque o endereço padrão da plataforma bloqueia alguns clientes HTTP antes do
  Worker e sem log.
- **Conselho às cegas.** Dois modelos de outros provedores (Gemini e GPT) receberam a
  mesma pergunta sobre as lacunas, de uma pasta vazia, sem ver a recomendação da sessão
  nem a resposta do outro. Pergunta e respostas inteiras em [`conselho/`](conselho/). A
  coluna "Origem" do `DECISOES.md` diz onde divergiram.
- **Lacunas.** O Éverton decidiu 24 lacunas numa rodada (L1 a L24), mais três na abertura
  da coordenação (L1a, L1b, L17a) e três durante a leva 1 (L5a, L13a, L16a). Ele decidiu
  diferente da recomendação na L1, na L11 e na L17, e depois no acréscimo da L15, na
  leva 1. A regra de cada uma
  está no [contrato](CONTRATO.md), seção 10.
- **Frente não decide produto.** Lacuna nova parava a frente. Enquanto o Éverton estava
  fora, valeu a recomendação da coordenação como provisória (X15): são as decisões P do
  `DECISOES.md`, cada uma com o motivo e quem levantou.

## 2. Frentes, levas e dono por arquivo

| Leva | Frentes | Regra |
|---|---|---|
| 1 | A (produto, única) · B1 webhook falso · B2 harness e casos · C reservado · D simulador · J design da página | até o Marco 1 o código de produto tem uma frente só |
| Portão | Marco 1 · M1 revisão curta · I escolha do modelo | a leva 2 só sai com o Marco 1 verde |
| 2 | E datas · F lead · G robustez e handoff · H concorrência · J implementação · D rodadas ao vivo · T datas sem ano (P21, saída da G) · S gate de sigilo (achados da M2) | um dono por arquivo |
| 3 | M2 revisões · L custo e monitor · K produção · N entregáveis | K e N adiantadas pela X24 |

- Cada frente rodou na própria worktree, a partir da `main`. A tabela "Dono de arquivo"
  do backlog dizia quem podia tocar cada caminho em cada leva. Duas frentes da mesma leva
  nunca tocaram o mesmo arquivo; exceção só com autorização registrada no log (por
  exemplo, a G acrescentando `dataComDia` no arquivo de datas da E, já encerrada).
- O Marco 1 (cotação do exemplo, resumo, confirmação em outro turno, lead no webhook
  falso, desconto virando handoff) ficou verde às 17h31, com o bloco `marco1` a 100%, a
  suíte com 128 testes e o gate de sigilo.
- Merge sempre `--no-ff`, sem reescrever histórico. Antes de cada merge, a coordenadora
  fazia um ensaio do merge sobre a `main`, rodava suíte, tipos e gate, e um CHECK no
  runtime real (servidor local do estado mesclado ou `dev`).

## 3. A coordenadora

- Não edita código de produto (decisão 16). Despacha, confere, mergeia e mantém o log.
  Prompt em [`prompts/02-coordenadora.md`](prompts/02-coordenadora.md), com os acréscimos
  do Éverton em [`prompts/02-coordenadora-acrescimos.md`](prompts/02-coordenadora-acrescimos.md).
- Para no Marco 1, em lacuna nova e antes do que não se desfaz: ligar o envio real de
  leads e tornar o repositório público (X2). O resto anda sozinho.
- Classifica cada falha de eval antes de mandar corrigir: do agente, do caso, do juiz ou
  do modelo. Exemplo: às 21h55 o `lead-04` foi lido no log do servidor, reproduzido em 20
  execuções (1 falha) e classificado como defeito intermitente do agente, sem risco de
  envio indevido.

## 4. Verificador independente antes de cada merge

Cada entrega passou por um subagente verificador (Claude Opus 5.5) que não escreveu o
código. Ele lê o diff, monta sondas próprias numa cópia e planta defeitos, um por vez,
para ver quantos a suíte da frente pega. Reprovação devolve a frente com a lista; a
correção entra como commit novo. As reprovações abaixo são o que o processo pegou antes
de chegar à `main` ou a `dev`.

No fim da leva 2 o ciclo de cada frente ficou fixo: ensaio do merge pelo hash exato sobre
a `main`, conferência com o modelo real num servidor local, verificador independente com
barra fechada (a lista do que ele tem de conferir, combinada antes) e merge pelo mesmo hash.
O hash exato entrou porque branches de frentes diferentes carregavam a G mesclada antes de
ela ter veredito.

| Frente | Rodadas | O que o verificador achou |
|---|---|---|
| A (Marco 1) | 1, com o conselho (M1) | aprovada com ressalvas; 13 de 20 defeitos plantados pegos; total errado do modelo ao lado do total do código; suíte sem guarda no que F e H iam editar; cotação inválida não derrubava o resumo pendente. Quatro achados corrigidos antes do merge; a coordenadora plantou três defeitos de novo e os três foram pegos. Ver [`revisoes/m1.md`](revisoes/m1.md) |
| B1 (webhook falso) | 3 | modo gravado que não expirava, atraso que esperava antes de guardar, teste com furos; na terceira, o teste falhava em 3 de 5 rodadas contra `dev` porque desistia do POST antes de o pedido chegar |
| B2 (runner e casos) | 2 do runner na leva 1, 6 do juiz de preço na leva 2 | **falso verde crítico**: caso pulado pela trava saía do denominador e o `marco1` dava 100% e `EVAL OK` sem rodar a conversa de lead; 20 de 80 casos reprovariam um agente correto; 2 de manipulação rodariam contra `producao`. Na terceira, o juiz novo tinha ficado mais frouxo: aprovava desconto escrito como "cada noite sai por", total errado e política inventada (primeira do juiz). Juiz R2: quatro altos (total sem a limpeza aprovado, resposta real certa reprovada, desconto com valor igual a um componente aprovado, respostas certas em inglês reprovadas). R3: aprovada. R4: a regra do rótulo com parêntese fazia o juiz aceitar qualquer das duas diárias. R5: aprovada; a P31 fechou o ciclo de correção do juiz, e o que sobra fica listado em `evals/README.md`. R6: reprovada; as duas correções de redação faziam aprovar respostas erradas que o juiz anterior reprovava, e o juiz voltou ao estado aprovado na R5 (P34) |
| D (simulador) | 1 | `SIMULADOR OK` com a ferramenta do hóspede fora do ar; erro do agente derrubava a rodada; juiz de handoff acusava agente certo e deixava passar errado; 10 de 12 casos fixos frágeis |
| E (datas) | conferência da coordenação | tabela própria de datas em três fusos, sem diferença; o CHECK no runtime achou regressão da L8 (1 de 3 respostas sem a pergunta de quantas pessoas), corrigida e repetida 10 de 10 |
| F (lead) | 9: aprovada na sexta; a sétima aprovou a regra do nome (P20), a oitava o "sim" limpo e a P29, a nona as formas de confirmação da P35 | R1: hesitação com dado ("acho que sim, mas somos 3") e o "sim" seguinte enviava o dado antigo. R2: "acho que sim, mas no mês que vem" reexibia o resumo antigo e o sim o enviava, 10 de 10; das 50 confirmações naturais, 15 não enviavam. R3: um "?" em qualquer ponto mantinha o resumo; combinações de `422` e `5xx` somavam 3 e 4 POSTs para a mesma estadia. R4: com outras formas de pontuação, 34 de 106 mensagens mantinham o resumo antigo (virou limite conhecido, P18). R5: um sim com anúncio de dúvida ainda podia enviar o lead (daí a P19). R6: aprovada, com zero envio nesses casos e a confirmação legítima intacta. R7: a regra do nome (P20) aprovada; dois efeitos viraram limites (P28). R8: aprovada; o "sim" limpo pelo caminho do resumo dá o mesmo lead que a confirmação em 28 formas de mensagem e não fura a fila da H |
| G (robustez) | 5, aprovada na quinta | R1: o código ligava `handoff` com texto fixo em mensagem comum ("Pode fechar, meu telefone é…", "a 500 m da praia"). R2: as redes por palavra passavam 24 de 80 mensagens comuns para humano ("esse lugar é descontraído?", "não estou pedindo desconto"); a conferência cortava a explicação do acréscimo de sexta e sábado; o lead podia sair com menos pessoas do que o grupo cotado. R3: reprovada por um achado só de teste, já corrigido; um médio (o total repetido saía cortado depois de 80 mensagens) foi corrigido com resumo aberto e aceito como limite sem ele (P26). R4 (teto de chamadas, P30): reprovada por um ponto do caminho do lead, achado depois que a coordenação já tinha mesclado (seção 9). R5: só a correção desse ponto, aprovada; sobrou um baixo do lado seguro (a confirmação do turno não roda quando o teto corta um `cotar` ou um `montar_resumo`, e o hóspede confirma de novo) |
| H (concorrência) | 5 do verificador, mais um só para a P24, e 2 conferências da coordenação | **crítico**: a nova tentativa do Worker reenviava a mesma mensagem sem identificador, e um "sim" podia valer duas vezes. A coordenadora achou no runtime real dois defeitos que o vitest não pega: o Worker não subia (constante exportada no módulo de entrada) e todo turno com catálogo caía em contingência (`fetch` chamado como método de objeto). R2: resumo gravado cuja resposta se perdia no caminho podia ser confirmado sem o hóspede ter visto; corpo sem limite de tamanho (corrigido pela P12). R3: duas mensagens ao mesmo tempo na sessão e um resumo que ficava confirmável sem ter sido visto quando o Worker desistia com o pedido na fila. R4: a correção desse segundo caso abriu outro (as duas tentativas do Worker entravam na fila e a segunda rodava o turno); a P24 foi verificada à parte e aprovada. R5: aprovada |
| S (gate de sigilo) | 2, mais uma conferência da coordenação | R1: cinco médios, quatro deles anteriores à frente. R2: com o índice corrompido, o gate terminava com `SIGILO OK` depois de falha de leitura; corrigido e conferido pela coordenação com as sondas do verificador |
| T (datas sem ano, P21) | 1 | aprovada: 82.102 casos comparados com a árvore anterior; só mudaram as saídas sem ano a mais de 90 noites, que passaram a ser recusadas; 11 de 12 defeitos plantados pegos |
| K (validação de `producao`) | 3, aprovada na terceira | R1: falso verde, `PRODUCAO OK` sem nenhuma conversa quando o script recebia argumentos extras; um redirecionamento no `/chat` era seguido com POST e corpo. R2: no modo completo, o runner ainda seguia o redirecionamento. R3: aprovada |
| L (custo) | 1, aprovada | só achados baixos; as contas batem com um programa à parte em frações exatas |
| N (estes textos) | 1 até aqui | R1: reprovada por uma afirmação, a trava de valores dada como garantida quando a G ainda a corrigia. O verificador final dos textos roda depois dos números finais: a preencher <!-- PREENCHER: verificador final da frente N --> |
| I (modelo) | 3, aprovada na terceira | R1: resposta `200` inútil do Haiku (vazia, cortada, erro como valor) não ia ao reserva. R2: fim de resposta que não batia com o conteúdo passava, e o mesmo id duas vezes quebrava o pareamento de chamada e resultado. R3: aprovada, sem achado alto nem médio; 7 de 68 defeitos plantados escapam, como seguimento |

Contagens de defeitos plantados pegos pela suíte, por rodada: F 12 de 12, 21 de 25, e na
quarta 22 de 31; G 30 de 33 e 23 de 27; H 7 de 9 (conferência) e 16 de 22; I 15 de 19.

O padrão que se repetiu: **rede de palavras não fecha**. Na F e na G, cada correção por
lista de palavras abriu outro buraco na rodada seguinte. A saída foi mudar de mecanismo:

- P17: palavra na mensagem do hóspede não liga `handoff` por código; só provoca uma
  segunda chamada ao modelo, focada no pedido.
- P18: se o próprio agente faz uma pergunta com resumo pendente, o resumo cai. A pergunta
  do agente é um sinal exato, no texto dele.
- P14: teto de 2 POSTs por estadia, somando qualquer combinação de falhas.

O custo das duas primeiras está declarado como limite no [README](../README.md).

## 5. Conjunto reservado

- Escrito pela frente C, em outro provedor (GPT-6 Astra), lendo só o contrato e o plano de
  evals, sem ver os casos de desenvolvimento: 60 casos, 13 com confirmação.
- Fica em `~/.config/agente-concierge/reservado/`, fora de toda worktree, até a entrega.
- O runner força `--so-agregado` nesse conjunto: sai só o acerto por bloco, sem id, sem
  mensagem e sem resposta.
- A frente C foi avisada das classes de defeito de expectativa achadas nos casos de
  desenvolvimento, sem ver caso nenhum, e ajustou 2 casos às regras decididas.
- As duas primeiras leituras do agregado em `dev`, na árvore b5af852, deram 83% e 80%,
  abaixo do limiar de 90%. A telemetria das duas janelas não tem contingência nem falha
  do catálogo.
- O conjunto foi escrito antes das decisões P11 a P32 e das correções do juiz. A P33 fixou
  as regras do diagnóstico antes de alguém ver quais casos falharam: conferir todos os
  casos contra o contrato, mudar expectativa só com a cláusula ou a decisão citada, uma
  passada única de correção com um segundo revisor com veto, e número final como soma de
  duas leituras seguidas na árvore congelada. Abaixo de 90%, o número vai ao Éverton como
  está.
- A sessão original da frente C rodou num provedor que saiu da entrega (X16). O diagnóstico
  é de um revisor novo no papel da frente C, que abre o conjunto, não corrige o agente e
  devolve só contagens.
- O diagnóstico terminou, devolvido só em contagens. Nos 60 casos, nenhum lead sem
  confirmação, duplicado ou diferente do resumo. A passada única mudou a expectativa de 9
  casos (7 afrouxados por redação, 2 apertados), cada um com a cláusula citada.
- **O veto funcionou.** O segundo revisor vetou as 9 mudanças, e os casos voltaram ao
  original: nas 7 afrouxadas, a expressão nova aprovava respostas erradas (5 a 6 por caso);
  das 2 apertadas, uma reprovava respostas certas e a outra ficou em dúvida. Ele apertou 3
  casos frouxos e concordou com a classificação das falhas (3 do juiz compartilhado, 1 de
  idioma, 4 de lead). É a regra da P33 fazendo o que devia: o primeiro revisor tendia a
  afrouxar; o segundo, sem esse interesse, barrou. A leitura de 91,7% que o primeiro
  revisor tinha feito não vale.
- **O conjunto fez o trabalho dele:** achou um erro real e repetido do agente. Em 4 casos o
  hóspede confirmava de um jeito que a L9 e a P13 aceitam, e o agente repetia o resumo sem
  enviar. Pela regra 6 de `docs/EVALS.md`, os 4 casos foram revelados, migraram para o
  conjunto de desenvolvimento e ganharam substitutos, conferidos duas vezes pelo segundo
  revisor. A correção (P35) foi pequena e verificada a fundo: 4 minutos de mudança, 20
  linhas na gramática do sim, e um verificador independente com 11.829 leituras de 3.943
  mensagens em três estados.
- O conjunto mede com as expectativas originais. **Número final, pela P33: 110 de 120
  (91,7%)**, soma de duas leituras seguidas na árvore final; o limiar é 90%. A leitura 1 deu
  88%, que sozinha reprovaria; a leitura 2, 95%. Antes, na árvore b5af852: 83% e 80%. O que
  mudou foi a correção do agente (P35) e 5 apertos do segundo revisor; nenhuma expectativa
  foi afrouxada.

## 6. Gate de sigilo e de histórico

O repositório fica público na entrega. `scripts/verificar-sigilo.sh` roda antes de cada
commit, com tudo em stage, e antes de cada push.

- Os termos proibidos não ficam no repositório: o script os deriva das variáveis de
  ambiente, fora dele. Uma lista versionada seria o próprio vazamento.
- Ele procura termos proibidos, endereços IP, e-mails que não são o do autor, arquivos de
  ambiente versionados, termos proibidos em mensagens de commit, autor e committer
  diferentes do autor do repositório, reescrita de histórico no reflog e refs no remoto
  fora de branches e tags (a ferramenta de orquestração cria refs locais de checkpoint com
  outra identidade, e elas não podem ser publicadas). A saída mostra só `arquivo:linha`.
- Frentes de outros provedores nunca abriram o arquivo de ambiente nem receberam token ou
  URL real (X7). Dados do catálogo chegaram a elas por um arquivo de fichas sem URL nem
  token.
- **Incidente.** Às 22h34, a frente I publicou dois commits com o gate reprovando, por
  causa de dados inventados numa linha de teste (endereço de faixa de documentação,
  e-mail em domínio reservado). Saíram no commit seguinte. O gate daquela hora só lia a árvore atual,
  as mensagens e os autores, não o conteúdo de commits antigos. O Éverton decidiu que o
  histórico fica como aconteceu (X24). Depois, a frente S fez o gate procurar os termos de
  sigilo no histórico inteiro a cada execução, com teste próprio
  (`scripts/verificar-sigilo.teste.sh`); isso fecha os achados 4, 5 e 6 da primeira passada
  da revisão final. IP e e-mail continuam procurados só nos arquivos atuais.
- **Chave da OpenAI.** Em 13/11 o Éverton tirou a chave da OpenAI de uso (X16). A frente
  I já a tinha guardado no gateway e no cofre de segredos da conta; removeu das duas, e a
  coordenação conferiu por nome que não sobrou nada. O commit que descreve essa ligação
  ficou no histórico, também por decisão dele (X18).

## 7. Escolha do modelo por medição

A frente I mediu os candidatos no conjunto de desenvolvimento, servidor local, webhook
falso local, todos no mesmo código. A tabela completa está em
[`revisoes/modelos.md`](revisoes/modelos.md), na `main` desde as 23h18 (merge 27c3093).

**Ressalva da própria tabela:** os números são do código `895d8aa`, anterior às últimas
mudanças das frentes G e B2. Medem os modelos lado a lado, não o agente final.

| Modelo | Acerto (98 casos) | p50 / p95 / máximo por turno | US$ por conversa |
|---|---|---|---|
| Claude Haiku 5.5, nível muito alto | 85% | 2,9 / 11,7 / 27,3 s | 0,0020 |
| Claude Haiku 5.5, nível alto | 86% | 2,3 / 5,5 / 11,9 s | 0,0016 |
| Claude Haiku 5.5, nível médio | 82% (controle: 79%) | 2,0 / 4,4 / 11,1 s | 0,0015 |
| Claude Haiku 5.5, nível baixo | 80% | 1,9 / 3,7 / 12,0 s | 0,0015 |
| GLM-5.3 Flash | 89% | 2,0 / 7,7 / 14,3 s | 0,0013 |
| DeepSeek 4.1 Flash | 92% | 4,3 / 7,9 / 17,0 s | 0,0030 |
| GLM-5.3 | 91% | 1,9 / 7,9 / 16,6 s | 0,0117 |

Como a escolha andou:

1. O plano começou com modelo nativo do Workers AI. O `gpt-oss-120b` mediu 83%, mas o
   Éverton o recusou como principal (X19): queria um modelo mais recente.
2. Os nativos pagos têm limite de 20 pedidos por minuto por conta e modelo. Sem pausa, o
   número de DeepSeek e GLM-5.3 mediu o limite (22% e 18%, com centenas de respostas
   429), não o modelo. As rodadas passaram a ter pausa de 13 s entre turnos (X19).
3. Na rajada de 10 conversas simultâneas, com principal e reserva recusando por limite
   ao mesmo tempo, 54 de 80 turnos caíram na contingência, e cada turno gastava 4
   chamadas. Daí o acréscimo da L18: recusa por limite vai direto ao reserva e não se
   repete.
4. O Haiku entrou como candidato pela chave da Anthropic do Éverton no gateway, com um
   limite de pedidos muito maior (X21). Ficou no médio (X22) e depois no alto (X24), pela
   tabela de níveis: o muito alto não ganhou acerto e dobrou o p95.
5. Os modelos do Workers AI acertaram mais casos no mesmo código. A leitura da frente I:
   as falhas só do Haiku são quase todas de redação que o juiz ou a expressão do caso não
   aceitava, não de valor. O juiz foi corrigido depois pela B2.
6. Limite da medição: uma rodada só no nível alto; entre duas rodadas do médio, 13 casos
   trocaram de resultado.

Modelo reserva: GLM-5.3 Flash, confirmado pelo Éverton (X30). Motivo registrado: o Haiku
vem direto do provedor e não deve falhar, então o reserva quase não entra. Na medição, o
GLM-5.3 Flash era o mais barato por conversa dos três candidatos a reserva, com acerto
perto dos outros dois.

## 8. Rodadas no código integrado

Medidas da coordenadora. As duas primeiras linhas são contra `dev`, com o modelo nativo do
Marco 1; as demais, no servidor local, com as branches mescladas sobre a `main`, já no
Haiku:

| Hora | Código | Resultado | Observação |
|---|---|---|---|
| 17h56 | Marco 1, 87 casos | 72 de 87 | base |
| 19h06 | `main` até a frente E | 83 de 98 | antes de F, G e H |
| 22h14 | I + F + G + B2 | 96 de 98 | 4 chamadas recusadas pelo gateway com erro de entrada |
| 22h22 | idem, F nova | 97 de 98 | as recusas subiram para 8 |
| 22h37 | adaptador corrigido | 98 de 98 | zero falha do modelo em 164 turnos |
| 23h02 | F com a quarta correção | 98 de 98 | idem |
| 23h14 | G nova | 97 de 98 | `lead-05`, previsto pela G |

Essas notas valem como medida do agente, não como prova do critério: o juiz da B2 dessas
rodadas foi reprovado pelo verificador. A prova dos 95% por bloco são três rodadas
seguidas em `dev`, com o juiz corrigido e aprovado (X24).

A fila da sessão também foi conferida no runtime real, em `dev`: duas mensagens ao mesmo
tempo na mesma sessão respondem as duas, sem contingência, e o "sim" que estava na fila só
reapresenta o resumo; o "sim" seguinte registra.

Rodadas na árvore congelada b5af852, pelo proxy de registro: 100 de 100, 100 de 100 e 98
de 100. As duas falhas da terceira eram falso vermelho do juiz: 298 de 300, nenhuma falha
do agente no que o juiz e o contrato medem (a redação teve uma autocorreção confusa que o
juiz não pegou; item 16 da seção 9). Julgadas de novo com o juiz de 193d1bf (P34), dão o mesmo resultado. Nas
rodadas oficiais, falso vermelho do juiz conta como falha na soma do bloco (P34). Como a correção da G reabriu o congelamento, a contagem das três rodadas
oficiais recomeça na árvore nova; as três de b5af852 ficam registradas.

Árvore de reserva 0567371 (sem a P35), três rodadas oficiais registradas: 99, 97 e 100 de
100, soma 296 de 300, nenhuma falha do agente no que o juiz e o contrato medem. As 4 falhas são falso vermelho, classificadas
pela conversa gravada: três redações de cotação certa que o juiz não reconhece e uma
expressão proibida do caso que pega "o pedido não foi enviado". Contando os falsos vermelhos
como falha (P34), cotações fecha em 37 de 39 (94,9%); sem eles, 39 de 39. Esses números são
da árvore de reserva, não o resultado da entrega.

A árvore final é 9d37f9a: o código de b5af852 mais a correção da G e as formas de
confirmação da F (P35), as duas aprovadas por verificador independente, juiz e runner
idênticos aos de 193d1bf, e 104 casos de desenvolvimento. A contagem das três rodadas
oficiais recomeça nela.

Resultado das três rodadas oficiais seguidas na árvore final, em `dev`: 104 de 104, 104 de
104 e 102 de 104. Soma por bloco, contando toda falha: 310 de 312 (99,4%), todos os blocos
acima de 95%; o menor é respostas, com 32 de 33 (97,0%). Nenhum lead sem confirmação,
duplicado ou diferente do resumo. As duas falhas da rodada 3, classificadas pela conversa
gravada: um falso vermelho do juiz (`cot-03`) e uma falha do agente (`resp-11`, descrição dos
dias errada num parêntese e uma autocorreção no meio da resposta, com valores e total
certos). Latência por turno: p50 de 2,9 a 3,0 s, p95 de 5,9 a 6,2 s, máximo de 13,8 s. Custo:
US$ 0,0026 por conversa em média. A tabela por bloco está no [README](../README.md).

Simulador hostil na árvore final, em `dev`: 6 de 10 conversas aprovadas, com cinco marcas de
falha em quatro conversas. Nenhuma é erro de contrato do agente: três são falso vermelho dos
juízes do próprio simulador e duas são o comportamento decidido na P13 (sim que repete dado
do resumo não confirma). Como o relatório do simulador não guarda o texto do agente, a
leitura do sim foi conferida pela função da árvore final sobre as mensagens gravadas, e o
texto do agente foi lido numa repetição das quatro conversas. A sonda da coordenação achou,
junto, um limite que não é da P13: sim com o destino do envio ("pode enviar o pedido ao time
comercial") também não confirma, por falta de vocabulário.

A regra de `docs/EVALS.md` manda cada falha do simulador virar caso fixo. Aqui ela não foi
seguida: os quatro casos que o simulador propôs fixariam expectativa errada (handoff num
gatilho falso, duas regras que reprovam resposta certa e um lead que contraria a P13). Pela
P36, eles não entraram, e o conjunto de desenvolvimento ficou com os 104 casos medidos. É um
desvio registrado: a regra acompanha correção do agente, e aqui não houve correção. Aceitar
o destino do envio no sim também ficou de fora: anularia as três rodadas, as duas leituras do
reservado e a validação de `producao`, cerca de duas horas pelo precedente da P35, para poupar
um turno ao hóspede.

Rajada na árvore final, em `dev`: 10 sessões simultâneas de 4 turnos, 40 de 40 com status
200, sem 429, 5xx, contingência ou resposta vazia; p95 de 5,4 s.

## 9. O que deu errado e como foi corrigido

1. **Falso verde no runner (16h47).** O caso pulado saía do denominador. Corrigido antes
   do merge; desde então o runner sai com `EVAL PARCIAL` (código 2) quando pula caso.
2. **Troca de modelo na mesma conversa não pegou (19h06).** As frentes F e G continuaram
   no modelo antigo depois da troca. Foram retomadas em sessão nova, com nota de estado.
3. **Máquina sem memória (19h20).** Várias suítes de teste ao mesmo tempo, cada uma com 8
   workers, mais servidores locais, derrubaram as sessões de F, G, H, I e B2 e todos os
   servidores locais. Nada commitado se perdeu; o trabalho sem commit no disco foi
   preservado. Uma causa provável apareceu depois: um teste rodado com a raiz no disco
   inteiro. Daí o teto de carga: suíte com poucos workers e por trava de arquivo, um
   servidor de CHECK por vez, no máximo 6 servidores locais.
4. **Porta errada (20h15).** A G apontou duas rodadas para a porta de um servidor de
   medição da I, e o modelo daquela rodada recebeu 173 recusas por limite em dois minutos.
   O servidor usava o webhook falso: nenhum POST ao real. A rodada contaminada foi
   descartada e refeita do zero. Regra nova: portas fixas por frente, com conferência de
   porta livre.
5. **Defeitos que só o runtime real mostra.** Na H, o Worker não subia e o `fetch` era
   recusado como método de objeto; os 142 testes passavam porque o vitest não roda esse
   runtime. Daí o CHECK no runtime real antes de todo merge.
6. **Resposta em português para hóspede em inglês (20h28).** O modelo imitava o resultado
   da ferramenta de cotação, que vinha em português. Corrigido na causa: a ferramenta
   entrega as datas no idioma do hóspede.
7. **Erro de entrada no gateway (22h14 a 22h34).** O pedido refeito depois da conferência
   terminava em mensagem do assistente, e o Haiku não aceita isso; o reserva respondia
   esses turnos. Causa provada pelo log do gateway e corrigida no adaptador.
8. **Ensaio com todas as branches (23h14).** Merge limpo, 1299 de 1300 testes. O teste
   vermelho, da H, bloqueou o merge e voltou para ela. Às 23h31 a H mostrou que o teste
   estava desatualizado, sem defeito: na combinação sai 1 POST e 1 lead, depois do "sim".
9. **Validação do nome do hóspede (23h14).** A rodada integrada achou um defeito no campo
   do nome do lead. A F fechou com a regra do nome (P20: só palavras que o hóspede
   escreveu) e, depois da segunda passada da revisão de segurança, com a P29 (sem dígito
   nem símbolo de moeda).
10. **Merge pelo relatório antes do fim do verificador (14/11).** A coordenação mesclou a
    frente G lendo o relatório do verificador quando a primeira linha dizia aprovado, antes
    de ele terminar. O veredito final reprovou um ponto do caminho do lead: a confirmação
    rodava quando o teto de chamadas cortava um `cotar` ou um `montar_resumo` do mesmo lote.
    A `main` já estava congelada. O congelamento foi reaberto, a G corrigiu e a contagem das
    rodadas recomeçou. Regra nova: veredito só vale quando a tarefa do verificador termina.
11. **Leitura do reservado gravada (14/11).** A segunda leitura do conjunto reservado passou
    pelo proxy de gravação, contra a regra de não gravar leitura do reservado. O registro
    não foi lido e foi movido para uma pasta privada que só o papel da frente C abre.
12. **Arquivos de sonda num commit de backlog (14/11).** Um commit de backlog feito com a
    árvore inteira em stage levou dois arquivos vazios deixados por uma sonda de
    verificação. Saíram num commit novo. Regra nova: a coordenação põe em stage só os
    arquivos que editou.
13. **O que só o ensaio com o modelo real achou.** Antes de congelar, o ensaio local com o
    modelo real achou o que a suíte não acha: o "sim" que reapresentava o resumo em vez de
    registrar (`lead-12`, corrigido pelo "sim" limpo da F), um falso vermelho do juiz no
    `cot-13` e, no último ensaio, outro falso vermelho na contagem elíptica de noites
    ("3 noites: 1 comum a R$ 590,00 e 2 de sexta e sábado"). A correção dele no juiz
    entrou sem verificador independente e saiu depois (item 15).
14. **Catálogo fora do ar em `dev` (14/11).** Logo depois de um deploy, 25 turnos seguidos
    saíram em contingência com origem no catálogo, por 95 segundos. Um segundo deploy do
    mesmo código não repetiu; a causa não foi determinada. A P32 diz como uma rodada
    oficial atingida por isso é contada, e cada rodada só começa depois de dois minutos de
    sonda limpa.
15. **Falso verde de juiz: um devolvido, um que entrou (14/11).** A coordenação devolveu a
    cabeça 799b9c3 da B2: a desculpa nova do caso de cancelamento aprovava 8 de 9 respostas
    erradas escritas para testá-la ("…não informa a política, e se você cancelar não há
    multa"). A correção ficou só numa fronteira de palavra, que era a causa real. Um defeito
    plantado mostrou também que o teste do corpus, afrouxado, deixava passar 19 de 34
    itens; a B2 fixou a contagem. Mas outro entrou: a correção da contagem depois de "N
    noites:" (4efb030) foi para a `main` em b5af852 só com a conferência da coordenação, sem
    verificador independente, e já aprovava linha com os dois tipos de noite e uma diária
    só. Quem achou foi o verificador da rodada 6 da B2. É o quarto erro da coordenação nesta
    lista: a bateria dela não tinha essa família de respostas erradas. Conferido depois: as
    três rodadas registradas de b5af852, julgadas de novo com o juiz de 193d1bf, dão o mesmo
    resultado (0, 0 e 2 reprovações, as duas já classificadas como falso vermelho), e a
    leitura do tipo de noite contra o valor não marca nenhuma resposta. O buraco não foi
    exercitado. Pela P34, o juiz volta a 193d1bf e não é mais corrigido nesta entrega.
16. **Autocorreção do modelo que a leitura à mão não pegou (14/11).** Em cerca de 1.600
    respostas gravadas no dia, duas trazem uma autocorreção confusa escrita pelo modelo. Uma
    é a falha do agente na rodada 3 da árvore final (`resp-11`). A outra, numa rodada de
    b5af852 que deu 100 de 100, diz que o nome no resumo "não veio do sistema", o que é falso:
    o nome vem do catálogo. Ela passou no juiz, e a leitura à mão da coordenação não a pegou
    na hora. É o quinto erro da coordenação nesta lista, junto da frase "nenhuma falha do
    agente em 300 conversas", dita sobre aquelas rodadas: ela vale para o que o juiz e o
    contrato medem, não para a redação. Nenhuma das duas muda valor, lead ou `handoff`; as
    duas viraram limite no README.

## 10. Quem fez o quê

| Provedor e modelo | O que fez | Fase |
|---|---|---|
| Claude Fable 5.2 | coordenadora do começo ao fim; frentes A (produto até o Marco 1) e J (design e página); começo das frentes F e G; a frente F de novo de 13/11 23h28 a 14/11 02h55 (regra do nome, "sim" limpo e P29), por um desvio de modelo, contra a X23, que a coordenação não percebeu e cuja causa não foi determinada | leva 1 e leva 2 até a X16 nas frentes; as entregas da F do desvio passaram por verificador em Opus 5.5 |
| Claude Opus 5.5 | verificadores independentes e subagentes de revisão desde a leva 1; frentes I, K, L e N; F (fora do desvio citado acima) e G depois da X16; B2 e H depois da X23; S e T, como subagentes em worktree; o revisor do reservado no papel da frente C (P33) | toda a entrega; a partir da X23, o único modelo das frentes e dos verificadores, com esforço médio, alto ou muito alto conforme a tarefa |
| Gemini 4 Hydrogen | frentes B2 (runner e casos), D (simulador), E (datas) e H (concorrência); conselho às cegas das lacunas e do Marco 1 | leva 1 e leva 2, até a X23 |
| Gemini 3.8 Flash (`gemini-3.8-flash-low`) | o hóspede simulado do simulador hostil (padrão de `evals/simulador/hospede-cli.mjs`) | rodadas ao vivo do simulador |
| Gemini 4 Argon | segunda opinião da revisão final (M2) | leva 3; desde a X23 é a única segunda opinião de outro provedor |
| GPT-6 Astra | frente C (conjunto reservado); conselho às cegas das lacunas e do Marco 1 | leva 1, até a X16 |
| DeepSeek Flash, pago (`deepseek/deepseek-flash`, pelo OpenCode) | frente B1 (webhook falso) | leva 1, até a X16 |

A partir da X23 (13/11), as frentes e os verificadores usam um modelo só, o
Claude Opus 5.5, e a segunda opinião de outro provedor fica para a revisão final. Antes,
a divisão por provedor seguia uma regra (X6): quem escreve os evals e o conjunto
reservado não é o provedor que escreve o agente. As trocas de provedor foram ordens do
Éverton, por limite semanal de uso e por escolha dele (X14, X16, X23).

Nas frentes fora do Claude, o rodapé do commit nomeia a ferramenta e o modelo que
ajudaram de fato (X9). Autor e committer são sempre os do repositório.

O setup do ambiente do autor que rodou nesta entrega (regras, skills e subagentes) está em
[`setup/`](setup/).

## 11. A preencher no fim

- Revisões (M2): as duas passadas estão em [`revisoes/m2.md`](revisoes/m2.md); a segunda,
  de segurança, sem achado crítico ou alto. Fechamento da M2: a preencher.
  <!-- PREENCHER: fechamento da M2 -->
- Exports de sessão em [`sessoes/`](sessoes/): a preencher.
  <!-- PREENCHER: exports de sessão -->
- Roteiro do vídeo: a preencher. <!-- PREENCHER: roteiro do vídeo -->
- Custo por conversa no código final: US$ 0,0026 em média nas três rodadas oficiais (seção 8
  e [README](../README.md)).
