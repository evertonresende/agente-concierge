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
| 2 | E datas · F lead · G robustez e handoff · H concorrência · J implementação · D rodadas ao vivo | um dono por arquivo |
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

| Frente | Rodadas | O que o verificador achou |
|---|---|---|
| A (Marco 1) | 1, com o conselho (M1) | aprovada com ressalvas; 13 de 20 defeitos plantados pegos; total errado do modelo ao lado do total do código; suíte sem guarda no que F e H iam editar; cotação inválida não derrubava o resumo pendente. Quatro achados corrigidos antes do merge; a coordenadora plantou três defeitos de novo e os três foram pegos. Ver [`revisoes/m1.md`](revisoes/m1.md) |
| B1 (webhook falso) | 3 | modo gravado que não expirava, atraso que esperava antes de guardar, teste com furos; na terceira, o teste falhava em 3 de 5 rodadas contra `dev` porque desistia do POST antes de o pedido chegar |
| B2 (runner e casos) | 3 | **falso verde crítico**: caso pulado pela trava saía do denominador e o `marco1` dava 100% e `EVAL OK` sem rodar a conversa de lead; 20 de 80 casos reprovariam um agente correto; 2 de manipulação rodariam contra `producao`. Na terceira, o juiz novo tinha ficado mais frouxo: aprovava desconto escrito como "cada noite sai por", total errado e política inventada |
| D (simulador) | 1 | `SIMULADOR OK` com a ferramenta do hóspede fora do ar; erro do agente derrubava a rodada; juiz de handoff acusava agente certo e deixava passar errado; 10 de 12 casos fixos frágeis |
| E (datas) | conferência da coordenação | tabela própria de datas em três fusos, sem diferença; o CHECK no runtime achou regressão da L8 (1 de 3 respostas sem a pergunta de quantas pessoas), corrigida e repetida 10 de 10 |
| F (lead) | 6, aprovada na sexta | R1: hesitação com dado ("acho que sim, mas somos 3") e o "sim" seguinte enviava o dado antigo. R2: "acho que sim, mas no mês que vem" reexibia o resumo antigo e o sim o enviava, 10 de 10; das 50 confirmações naturais, 15 não enviavam. R3: um "?" em qualquer ponto mantinha o resumo; combinações de `422` e `5xx` somavam 3 e 4 POSTs para a mesma estadia. R4: com outras formas de pontuação, 34 de 106 mensagens mantinham o resumo antigo (virou limite conhecido, P18). R5: um sim com anúncio de dúvida ainda podia enviar o lead (daí a P19). R6: aprovada, com zero envio nesses casos e a confirmação legítima intacta |
| G (robustez) | 2, a terceira depois dos ajustes | R1: o código ligava `handoff` com texto fixo em mensagem comum ("Pode fechar, meu telefone é…", "a 500 m da praia"). R2: as redes por palavra passavam 24 de 80 mensagens comuns para humano ("esse lugar é descontraído?", "não estou pedindo desconto"); a conferência cortava a explicação do acréscimo de sexta e sábado; o lead podia sair com menos pessoas do que o grupo cotado |
| H (concorrência) | 2 do verificador, 2 conferências da coordenação | **crítico**: a nova tentativa do Worker reenviava a mesma mensagem sem identificador, e um "sim" podia valer duas vezes. A coordenadora achou no runtime real dois defeitos que o vitest não pega: o Worker não subia (constante exportada no módulo de entrada) e todo turno com catálogo caía em contingência (`fetch` chamado como método de objeto). R2: resumo gravado cuja resposta se perdia no caminho podia ser confirmado sem o hóspede ter visto; corpo sem limite de tamanho (corrigido pela P12 na branch da H, em verificação) |
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
- Agregado do reservado no código final: a preencher.
  <!-- PREENCHER: agregado do conjunto reservado e se algum caso migrou para dev -->

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
  e-mail em domínio reservado). Saíram no commit seguinte. O gate só lê a árvore atual,
  as mensagens e os autores, não o conteúdo de commits antigos. O Éverton decidiu que o
  histórico fica como aconteceu (X24).
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

Resultado das três rodadas: a preencher.
<!-- PREENCHER: três rodadas em dev, nota por bloco, classificação de cada falha -->

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
   do nome do lead. Em correção na F; estado final a preencher.
   <!-- PREENCHER: estado da validação do nome depois da F -->

## 10. Quem fez o quê

| Provedor e modelo | O que fez | Fase |
|---|---|---|
| Claude Fable 5.2 | coordenadora do começo ao fim; frentes A (produto até o Marco 1) e J (design e página); começo das frentes F e G | leva 1 e leva 2 até a X16 nas frentes |
| Claude Opus 5.5 | verificadores independentes e subagentes de revisão desde a leva 1; frentes I, K, L e N; F e G depois da X16; B2 e H depois da X23 | toda a entrega; a partir da X23, o único modelo das frentes e dos verificadores, com esforço médio, alto ou muito alto conforme a tarefa |
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

- Revisões de código, de segurança e segunda opinião (M2): a preencher.
  <!-- PREENCHER: resultado das revisões de código e segurança -->
- Exports de sessão em [`sessoes/`](sessoes/): a preencher.
  <!-- PREENCHER: exports de sessão -->
- Roteiro do vídeo: a preencher. <!-- PREENCHER: roteiro do vídeo -->
- Custo por conversa no código final: a preencher.
  <!-- PREENCHER: custo por conversa medido -->
