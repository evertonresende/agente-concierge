# Planejamento do agente concierge

- Export de sessão de trabalho. Índice e regras em [README.md](README.md).
- Tipo: sessão aberta pelo Éverton.
- Aberta por: Éverton, na interface.
- Branch: `-`. Provedor: claudeAgent.
- Sessões que ela abriu (8):
  - Verificar concorrência em Durable Objects (subagente)
  - Modelos com tool calling CF (subagente)
  - Limites plano CF 7 dias (subagente)
  - Wrangler ambientes e secrets (subagente)
  - Explorar catálogo real GET (subagente)
  - Salvar prompt de planejamento (subagente)
  - Escrever plano de evals e desenhos (subagente)
  - Escrever docs/VERIFICACOES.md (subagente)
- Só o texto das mensagens: sem chamada e resultado de ferramenta, raciocínio, anexo, lembrete de sistema, bloco de instrução injetado e resumo de compactação. Sem data e hora. Máscaras descritas no índice.

---

## Mensagem · Usuário

# Sessão de planejamento: agente concierge (desafio técnico)

Você é a sessão de planejamento desta entrega. Você explora, verifica e escreve o
contrato e o backlog. NÃO IMPLEMENTE código de produto e NÃO FAÇA DEPLOY. Ao final,
entregue o prompt da sessão coordenadora e pare.

## Contexto

- O enunciado está em `.privado/enunciado.txt`. Leia inteiro antes de tudo: contrato
  HTTP, regra de preço, catálogo, webhook, entregáveis e pesos da avaliação vêm dele.
- O produto é um agente de chat para hóspedes: tira dúvidas pelo catálogo, cota
  estadias, registra lead após confirmação e passa para humano.
- Prazo final: 14/11/2026 às 14h. Meta: entregar entre a noite de 13/11 e a manhã de
  14/11. O plano precisa caber nisso com folga.
- O e-mail do desafio pede ainda: vídeo de 3 a 5 minutos da fábrica rodando (o Éverton
  grava), um desenho dos agentes e entrega por resposta ao e-mail com link aberto.
  Vídeo e desenho serão aprofundados em entrevista técnica.
- A avaliação roda uma bateria automática de conversas ocultas, com hóspede hostil.
  O processo de construção pesa quase tanto quanto o agente funcionar.

## Publicação

O repositório fica privado até a entrega e depois vira público. Tudo o que você
escrever (código, docs, commits, backlog, prompts) será lido por terceiros. Nunca
escreva em arquivo versionado ou em commit: o nome da empresa do enunciado, trechos
copiados do enunciado, o domínio da API, o token, IPs, nomes de host ou e-mails
(exceto o e-mail de autor definido abaixo). Domínio e token vivem só em variáveis de
ambiente.

## Repositório e histórico

A pasta ainda não é um repositório git. Nesta ordem:
1. `git init`.
2. Configure só neste repositório o autor: nome "Éverton Resende" e e-mail
   contato@evertonresende.com. O git global desta máquina usa outro e-mail, que não
   pode aparecer no histórico.
3. Inclua `.privado/` e os arquivos de ambiente no `.gitignore`.
4. Faça o primeiro commit.
5. Mostre a saída de `git log --format='%ae %ce'`. Só o e-mail acima pode aparecer.
6. Crie o repositório remoto privado `agente-concierge` no GitHub do Éverton (já
   autorizado) e faça push.

Daí em diante: um commit por mudança lógica, push a cada commit, e a conferência do
passo 5 antes de cada push. NUNCA use squash, amend ou rebase.

## Decisões fechadas (não reabra)

Produto:
1. Worker em TypeScript na Cloudflare, com um Durable Object por `session_id` e loop
   de ferramentas próprio, sem framework de agente.
2. Código decide, modelo conversa. Preço em centavos inteiros, dia da semana, as
   recusas, o texto em reais e o valor enviado ao webhook saem de código.
3. Um agente só em produção. O handoff é uma ferramenta que liga a flag.
4. Trava de confirmação por estado: resumo num turno, confirmação em outro, envio com
   total recalculado. Um lead por reserva. Erro do webhook nunca vira "registrado".
5. Modelo via Workers AI ou AI Gateway, escolhido por eval. Confiabilidade em chamada
   de ferramenta vem antes de preço. Chaves de outros provedores existem se preciso.
6. O agente cota, mas não afirma que a data está disponível.
7. Texto vindo do catálogo é dado, nunca instrução.
8. Uma página simples de chat faz parte da entrega.
9. Data sem ano é a próxima ocorrência daquela data, e o agente repete a data
   completa na resposta.

Ambientes:
10. `dev` usa um webhook falso que replica o contrato do real. `producao` usa o real.
11. WEBHOOK REAL: nenhum POST antes da entrega, por nenhuma sessão, nem teste
    identificado. A lista de leads é o que o avaliador vê e não pode ser apagada.
12. Fluxo completo de lead, evals com confirmação e gravação do vídeo rodam só em
    `dev`. Contra `producao`, só conversas sem confirmação.

Ordem e corte:
13. Primeiro marco, antes de qualquer profundidade: uma conversa completa no ar em
    `dev`, com a cotação do exemplo do enunciado, a confirmação, o lead no webhook
    falso e um pedido de desconto passando para humano. O código de produto tem uma
    frente só até esse marco.
14. Exceção à frente única: os casos de eval, o harness e o conjunto reservado
    começam junto com o primeiro marco. Eles dependem só do contrato e não tocam os
    mesmos arquivos.
15. Se o tempo apertar, cai primeiro o acabamento da página de chat e depois o monitor
    diário de saúde. Os casos de ataque não caem antes do monitor.

Fábrica:
16. A sessão coordenadora não edita código de produto. Cada frente trabalha em
    worktree separada.
17. Há revisão de código, revisão de segurança e segunda opinião de modelos de outros
    provedores. O plano diz em que ponto cada uma entra.
18. Evals em três níveis: testes unitários do núcleo puro (com o exemplo do
    enunciado), conversas multi-turno agrupadas pelos blocos da avaliação (taxa de
    acerto, latência e custo por conversa) e um simulador de hóspede hostil cujas
    falhas viram casos fixos.
19. Existe um conjunto de evals reservado, fora dos casos usados para corrigir. Quem
    escreve não corrige o agente, o resultado sai só em agregado, e caso corrigido
    migra para o conjunto de desenvolvimento e é substituído.
20. O desenho cobre a fábrica (principal) e o agente em produção. No da fábrica entra
    uma segunda sessão de IA que o Éverton usa para revisar as entregas.

## Decisões de produto são do Éverton

As lacunas do enunciado não são decididas por você. Liste todas, cada uma com a sua
recomendação e o motivo, e leve ao Éverton numa rodada só. Ele decide. No mínimo:
datas relativas e datas no passado; se a flag de handoff persiste e o que o agente
faz depois dela; informação ausente no catálogo versus handoff; formato de telefone;
segunda reserva na mesma sessão. Adiante tudo o que não depende das respostas antes
de perguntar.

## Segunda opinião no planejamento

Antes da rodada com o Éverton e antes de fechar o backlog, consulte dois modelos de
outros provedores sobre as lacunas e sobre a ordem das levas:
- Gemini: `agy -p "..." --model gemini-4-hydrogen-high`
- GPT: `codex exec -m gpt-6-astra`

A consulta é às cegas: nenhum dos dois vê a sua recomendação nem a resposta do outro.
O texto enviado não leva token, domínio nem nome da empresa. Grave em `docs/conselho/`
a pergunta enviada e a resposta inteira de cada um. Na rodada com o Éverton, aponte
onde o conselho divergiu da sua recomendação. Se um comando falhar, registre o erro e
avise; não troque de modelo por conta própria.

## Verifique antes de planejar (não assuma de memória)

Use as skills e a documentação oficial da Cloudflare. Cada resposta leva a fonte.
1. Um Durable Object pode intercalar outro pedido enquanto espera uma chamada
   externa? Se sim, qual mecanismo garante uma mensagem por vez na mesma sessão?
2. Quais modelos com chamada de ferramenta estão disponíveis hoje no Workers AI e
   pelo AI Gateway, com preço e limites? Liste os candidatos ao eval.
3. A conta está no plano gratuito e o Éverton vai assinar o pago. O que o projeto
   exige do plano pago, e o que pode derrubar o agente em 7 dias no ar (cota, limite
   de requisições que bloqueie o avaliador)?
4. Como separar `dev` e `producao` no wrangler, com secrets por ambiente?
5. Como validar a configuração de `producao` do webhook sem enviar nenhum lead?
6. Catálogo real, somente com GET: formato real das respostas e dos erros, campos
   além do exemplo e texto suspeito em descrições. O webhook falso e qualquer
   catálogo falso de teste precisam ser fiéis a isso.

## Acesso ao catálogo

O endereço completo do catálogo, com o token, está na variável `CATALOGO_URL`, no
arquivo `[caminho local]`. Carregue o arquivo no mesmo comando em que
usa a variável. Nunca imprima o valor: sem `echo`, sem `set -x`, sem modo verboso e
sem saída que mostre a URL.

## Orquestração no T3 Code

A skill `orquestrar-entrega` foi escrita para o Orca, que não existe neste ambiente.
Valem o formato do backlog e a disciplina da coordenadora: ela não edita código de
produto, confere a sobreposição de arquivos antes de cada leva e verifica antes de
mergear. Não valem os comandos `orca` nem os scripts da skill.
- Frente pequena roda como subagente em worktree.
- Frente longa roda como thread nova do T3, com
  `t3 thread start --worktree main --branch <frente> --title "<frente>" . -`,
  ou o Éverton cola o prompt.
O prompt da coordenadora leva estas regras.

## Autorizações

- Permitido: ler o projeto; criar docs, contrato e backlog; commits e push no
  repositório privado; GET no catálogo real; consultar os dois modelos acima; checar
  que o token da Cloudflare autentica (skill `cloudflare-token`, por referência).
- Proibido: imprimir, gravar ou commitar qualquer secret; qualquer requisição que não
  seja GET ao webhook real; deploy; assinar plano; tornar o repositório público.

## O que entregar

1. `docs/CONTRATO.md`: os requisitos escritos com as nossas palavras. Interface,
   regra de preço com o exemplo calculado, catálogo, lead, handoff, proibições e
   critérios de aceite de sim ou não. `.privado/` não existe nas worktrees, então é
   ele que toda frente lê no lugar do enunciado. Escreva-o primeiro.
2. Backlog auto-contido, no formato da Fase 1 da skill `orquestrar-entrega`. Por
   frente: critérios de aceite binários com a evidência exigida, arquivos tocados e
   sobreposição entre frentes, dependências e estimativa em horas. No topo: o
   primeiro marco, a ordem das levas e a linha de corte. O backlog e todo prompt de
   frente citam o contrato.
3. Plano de evals: casos por bloco da avaliação, conjunto reservado com suas regras,
   teste de duas mensagens simultâneas na mesma sessão e o que será medido.
4. `DECISOES.md` inicial, com as decisões fechadas acima e as lacunas que o Éverton
   decidir, cada uma com o motivo. Lacuna ainda sem resposta não entra como decidida.
5. `CLAUDE.md` do projeto atualizado, preservando a regra de idioma existente: regras
   de sigilo, de histórico e do webhook real, e os comandos de teste, eval e deploy
   previstos.
6. Esboço dos dois desenhos em formato de texto versionável.
7. O prompt da sessão coordenadora, auto-contido.

## Aceite

1. Os seis itens de verificação têm resposta com fonte, ou estão marcados como
   desconhecidos com o passo que resolve.
2. Uma sessão sem acesso a esta conversa e sem `.privado/` consegue executar qualquer
   frente só com o contrato e o backlog.
3. O primeiro marco é o primeiro item do backlog, e as frentes de eval começam junto
   com ele sem tocar os mesmos arquivos.
4. A soma das estimativas cabe no prazo, e a linha de corte está escrita.
5. `docs/conselho/` tem a pergunta e a resposta inteira dos dois modelos.
6. Toda lacuna do enunciado foi levada ao Éverton com recomendação, e o
   `DECISOES.md` registra só o que ele decidiu.
7. `git log --format='%ae %ce'` mostra só contato@evertonresende.com, e `git reflog`
   não mostra amend nem rebase.
8. `git ls-files` não lista `.privado/` nem arquivo de ambiente, e uma busca nos
   arquivos versionados pelo nome da empresa e pelo domínio da API não retorna nada.
9. O remoto privado `agente-concierge` existe e está igual ao local.
10. Nenhum código de produto foi escrito e nenhum deploy foi feito.

## Como trabalhar

- Dúvidas para o Éverton: uma rodada só, junto com as lacunas.
- Resposta final: o que foi verificado com as fontes, as decisões que o Éverton
  tomou, o caminho do contrato e do backlog, e o prompt da coordenadora. Depois pare.

## Acréscimos meus:

- Segunda opinião: rode o `agy` e o `codex` a partir de uma pasta vazia fora do
  repositório, para que nenhum dos dois consiga ler `.privado/`.
- Prompts: salve este prompt em `docs/prompts/01-planejamento.md` e o da coordenadora em
  `docs/prompts/02-coordenadora.md`. Os prompts fazem parte do que é avaliado.
- Tempo: você tem 45 minutos. Rode as seis verificações em paralelo, com subagentes. O
  que não couber vira item do backlog, com o passo que resolve.

## Mensagem · Assistente

Plano de 45 minutos: primeiro git e remoto, depois seis verificações em paralelo e a consulta ao conselho, e por fim escrevo os artefatos que não dependem das lacunas antes de uma rodada com o Éverton.

> Subagente chamado: Verificar concorrência em Durable Objects

> Subagente chamado: Modelos com tool calling CF

> Subagente chamado: Limites plano CF 7 dias

> Subagente chamado: Wrangler ambientes e secrets

> Subagente chamado: Explorar catálogo real GET

> Subagente chamado: Salvar prompt de planejamento

## Mensagem · Assistente

Duas verificações já voltaram (concorrência no Durable Object e limites do plano); agora disparo o conselho às cegas e sigo para o contrato enquanto as outras três terminam.

## Mensagem · Assistente

O gate de sigilo detectou o controle positivo mas ainda saiu com 0 (a flag se perdia no subshell do pipe); corrijo isso agora, depois leio as respostas do conselho, que já chegaram.

> Subagente chamado: Escrever plano de evals e desenhos

## Mensagem · Assistente

Verificações e conselho concluídos e commitados; agora escrevo o contrato (com as lacunas marcadas como abertas), enquanto um fork escreve o plano de evals e os desenhos.

> Subagente chamado: Escrever docs/VERIFICACOES.md

## Mensagem · Assistente

Contrato commitado; dois forks escrevem evals/desenhos e as verificações com fontes. Agora escrevo o backlog.

## Mensagem · Assistente

**Responda `ok` para aceitar todas as recomendações, ou só as exceções (ex.: `L3=b, L8=b, X2=a`).** Esta é a rodada única: 24 lacunas e 5 itens de execução.

Estado: contrato, backlog, plano de evals, verificações, desenhos, `DECISOES.md` (só as 20 fechadas), `CLAUDE.md` e o rascunho do prompt da coordenadora estão commitados e no remoto privado. Falta só o que depende das suas respostas.

## 1. Onde o conselho divergiu de mim ou entre si

| ID | Tema | Minha recomendação (a) | Alternativa (b) | Conselho |
|---|---|---|---|---|
| L3 | Flag `handoff` | `true` só na resposta em que o agente passa, e de novo a cada novo gatilho. É a leitura literal de "quando decide passar". | Fica `true` até o fim da sessão. | GPT (a), Gemini (b) |
| L4 | Depois do handoff | Continua atendendo o que está no escopo, inclusive cotar e registrar lead sem desconto. | Bloqueia tudo e só repete que um humano assume. | GPT (a), Gemini (b) |
| L5 | Informação ausente do catálogo | Diz "não sei" com `handoff: false` e oferece um humano. Vira `true` só se o hóspede pedir ou disser que precisa disso para decidir. | `true` sempre que a pergunta ficar sem resposta. | Gemini (a), GPT (b) |
| L6 | Telefone | Número brasileiro com DDD vai no formato do exemplo, `[telefone]`. Estrangeiro com `+` vai como `+dígitos`. Inválido: pede de novo, sem handoff. | Tudo em formato internacional `+55…`. | Os dois (b) |
| L8 | Total sem número de hóspedes | Com imóvel e datas válidas, dá o total na hora, avisa a capacidade e pergunta quantas pessoas. A bateria provavelmente procura o total nessa resposta. | Pergunta os hóspedes antes de dar o total. | GPT (a), Gemini (b) |
| L11 | Falha do webhook | 422: não registrado, pede correção. 5xx: 1 nova tentativa. Timeout: faz GET na lista para ver se chegou; se não, 1 nova tentativa. Persistiu: "não consegui registrar" com `handoff: true`. | 2 tentativas cegas (Gemini), ou nenhuma, só handoff (GPT). | Os dois diferem |
| L12 | Pet, festa ou fumo proibidos | Cota com aviso claro da regra e não avança para lead enquanto o conflito durar. Pedido de exceção: handoff. | Recusa a cotação. | GPT (a), Gemini (b) |
| L16 | Fora de escopo e manipulação | Clima, código, "ignore as regras", pedido do prompt: recusa curta com `false`. Desconto pedido por "dono" ou "funcionário": `true`, porque é desconto. | Falso dono `false` (Gemini); fora de escopo legítimo `true` (GPT). | Os dois diferem |
| L17 | Corpo inválido no `/chat` | `400` com `{reply, handoff:false}` explicando o erro, limite de 8.000 caracteres. | `413` para corpo grande, limite de 4.000. | Detalhes diferem |

No L6 fico com (a) porque o único formato comprovadamente aceito é o do exemplo, e o webhook real não pode ser testado antes da entrega.

## 2. Duas lacunas novas, que não foram ao conselho

| ID | Tema | Recomendação (a) | Alternativa (b) |
|---|---|---|---|
| L23 | URL pública | Subdomínio seu, com a checagem de integridade de navegador desligada, testado com curl, `requests`, `urllib` e Node. Preciso que você diga qual domínio. | Ficar em `workers.dev` e só testar. |
| L24 | Trava do POST real | `producao` nasce com o envio real desligado: confirmar lá devolve "não consegui registrar". Liga na entrega, e o script de validação reprova se estiver desligado. | Sem trava: confiar na regra e no harness. |

O L23 existe porque `workers.dev` aplica um bloqueio (erro 1010) antes do Worker, sem log, e a documentação cita o cliente padrão do Python. Se a bateria do avaliador usar esse cliente, todas as conversas falham.

## 3. Consenso (os dois modelos concordam comigo)

| ID | Decisão proposta |
|---|---|
| L1 | Aceita datas relativas no fuso de São Paulo. "Amanhã" resolve direto; "próximo fim de semana" ou "no Natal": o agente propõe entrada e saída exatas e pede o ok antes de cotar. |
| L2 | Entrada antes de hoje: recusa, explica e pede novas datas, sem handoff. Entrada hoje vale. |
| L7 | Segunda reserva permitida, com novo resumo e nova confirmação. A mesma reserva já registrada não é reenviada. |
| L9 | Confirma só com sim inequívoco ao resumo pendente. Hesitação: pergunta de novo. Condição de preço: sem lead, com handoff. |
| L10 | Qualquer dado mudou, ou o preço mudou no catálogo: novo resumo e nova confirmação. |
| L13 | Adultos, crianças e bebês contam; pet não. Zero, negativo ou fracionário: pede correção. |
| L14 | Meio centavo arredonda para cima, por noite. Hoje nenhum dos 15 imóveis gera fração. |
| L15 | Responde no idioma do hóspede; total sempre como `R$ 2.156,00`. |
| L18 | Falha interna: `200` com aviso honesto e `handoff: true`, depois de 1 nova tentativa. Nunca `500`. |
| L19 | Cancelar, alterar, pagar, check-in antecipado, problema na estadia: handoff. |
| L20 | Aceita o nome como veio; pede o completo, mas não bloqueia. |
| L21 | Imóvel ambíguo: lista as opções e pede a escolha antes de cotar. |
| L22 | Nome e telefone mascarados em logs e exports. |

L21 e L22 foram trazidas pelo conselho.

## 4. Execução

| ID | Pergunta | Recomendação |
|---|---|---|
| X1 | Plano pago da Cloudflare | Assinar antes da leva 1 e me dizer em qual conta. O gratuito dá ~85 chamadas de modelo por dia e 10 ms de CPU por requisição. |
| X2 | Autonomia da coordenadora | (a) Para no Marco 1, em lacuna nova e em produção; no resto segue sozinha. (b) Volta a você a cada leva. |
| X3 | Modelos | (a) Modelo mais forte em tudo: o prazo é curto e retrabalho custa mais que token. (b) Forte só na coordenadora e em A, C, F, G. |
| X4 | Deploy em `dev` | Liberado para as frentes A e B1 na leva 1 e para a coordenadora, a partir da `main`, depois de cada merge. `producao` só com ordem sua. |
| X5 | Webhook falso como frente própria (B1) em paralelo na leva 1 | Sim. Li como infraestrutura de teste coberta pela decisão 14, mas é interpretação minha da decisão 13. |

## O que o plano diz hoje

- **Prazo:** 29,5 horas de agente, 12 horas de relógio no caminho crítico. Assumi o prazo das 14h como horário de Brasília; saindo às 16h30, fecha por volta das 4h30, com 9,5 horas de folga.
- **Conselho:** os dois comandos rodaram com saída 0, de pasta vazia; pergunta e respostas inteiras em [docs/conselho/]([caminho local]).
- **Ordem das levas:** adotei do conselho a escolha do modelo logo após o Marco 1 e a revisão em dois pontos. Divergi em um: a fila de uma mensagem por vez entra já no Marco 1, não na leva 2.
- **Webhook real:** um único GET devolveu lista vazia; nenhum POST foi feito.

Depois da sua resposta levo cerca de 5 minutos: preencho a seção 10 do contrato, o `DECISOES.md`, a configuração no backlog e no prompt da coordenadora, rodo as conferências de aceite e entrego o prompt.

## Mensagem · Usuário

Aceito as recomendações, com estas exceções e respostas:

- L1: quando der para determinar entrada e saída, o agente declara as datas exatas e já
  cota na mesma resposta. Só pergunta quando faltar uma das duas.
- L11: no timeout, sem nova tentativa e sem GET: diz que não conseguiu confirmar o
  registro, com handoff true. O formato da lista real é desconhecido, e um engano ali
  vira lead duplicado. O resto do L11 fica como você propôs.
- L17: JSON válido com session_id e message em texto devolve sempre 200, mesmo com
  mensagem vazia ou longa demais (o agente pede para reescrever ou resumir). 400 só para
  JSON inválido ou campo faltando.
- L23: a. Subdomínio [termo]. A regra vale só para esse hostname,
  sem tocar no resto do domínio. Confira também o Bot Fight Mode da zona e teste com
  clientes Python a partir desta máquina.
- X1: assino agora, na conta pessoal, a mesma do [hostname].
- X2: a, com dois ajustes. Deploy em producao com a trava do L24 ligada pode sair sem
  mim. Desligar a trava e tornar o repositório público, só com ordem minha. E quero um
  resumo de até 10 linhas no fim de cada leva.
- X3: b. Meu limite semanal de uso está em 74% e o uso extra está desligado.
- X4 e X5: ok.

## Mensagem · Assistente

Decisões recebidas. Confiro o Bot Fight Mode da zona (só leitura) e em seguida gravo as decisões no contrato, no `DECISOES.md`, no backlog e no prompt da coordenadora.

## Mensagem · Assistente

Gravando as decisões nos arquivos (contrato, `DECISOES.md`, backlog, prompt da coordenadora, `CLAUDE.md`, evals e desenho).

## Mensagem · Assistente

O gate reprovou antes do commit: apareceu no histórico (`git log --all`) um e-mail diferente do autor. Nada foi commitado nem enviado; investigo de onde veio.

## Mensagem · Assistente

Tudo commitado e no remoto. Rodo agora as conferências de aceite (histórico, sigilo, remoto, ausência de código de produto).

## Mensagem · Assistente

**Faça estas quatro coisas antes de abrir a coordenadora.** Sem elas o Marco 1 anda, mas a produção trava de madrugada.

1. Grave o hostname no arquivo de ambiente (ele não fica em arquivo versionado):
   `printf 'AGENTE_URL_PRODUCAO=[termo]\n' >> [caminho local]`
2. Olhe no painel se o Bot Fight Mode da zona está ligado. Não consegui conferir: o token não tem permissão de leitura de bots.
3. Crie no painel a regra que desliga a checagem de integridade só para esse hostname, ou dê ao token a permissão de regras de configuração.
4. Abra a coordenadora, da raiz do repositório, com o modelo mais forte:
   `t3 thread start --title "Coordenadora" . - < docs/prompts/02-coordenadora.md`

Se o Bot Fight Mode estiver ligado, a decisão L23 como você definiu (mexer só no hostname) não se sustenta: no plano gratuito ele vale para o domínio inteiro. O teste com clientes Python só pode rodar depois do deploy e ficou na frente K.

## Estado

Planejamento fechado: 26 commits no remoto privado `agente-concierge`, local igual ao remoto, nenhum código de produto, nenhum deploy, nenhum POST ao webhook real.

- **Contrato:** [docs/CONTRATO.md]([caminho local])
- **Backlog:** [docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md]([caminho local])
- **Demais:** [docs/EVALS.md]([caminho local]), [docs/VERIFICACOES.md]([caminho local]), [DECISOES.md]([caminho local]), [docs/desenhos/]([caminho local]), [docs/conselho/]([caminho local]), [docs/prompts/]([caminho local])

## O que foi verificado

Fontes completas em `docs/VERIFICACOES.md`; o prefixo das páginas é `[hostname]`.

| # | Pergunta | Resposta | Fonte |
|---|---|---|---|
| 1 | O Durable Object intercala pedidos? | Sim, durante a espera de chamada externa. O bloqueio nativo tem limite de 30 s. Solução: fila em memória no objeto, mais marcador gravado antes do POST do lead. | `/durable-objects/best-practices/rules-of-durable-objects/`, `/durable-objects/api/state/` |
| 2 | Modelos com chamada de ferramenta | Seis candidatos ao eval, três nativos e três via AI Gateway, de US$ 0,010 a 0,072 por conversa. Nativos que exigem plano pago têm 20 requisições por minuto. | `/workers-ai/platform/limits/`, `/workers-ai/platform/pricing/`, `/ai-gateway/usage/worker-binding-methods/` |
| 3 | Plano pago e 7 dias no ar | O gratuito dá 10 ms de CPU e cerca de 85 chamadas de modelo por dia. O risco maior é o erro 1010 em `workers.dev`. | `/workers/platform/limits/`, `/workers/configuration/routing/workers-dev/` |
| 4 | Ambientes e secrets | Blocos `dev` e `producao`; variáveis, bindings e secrets não são herdados; `secrets.required` falha o deploy se faltar. | `/workers/wrangler/configuration/`, `/workers/configuration/secrets/` |
| 5 | Validar produção sem lead | Dry-run, lista de secrets, `/saude` e GET no webhook real. Sem prova até a entrega: a aceitação do payload pelo webhook real. | `/workers/wrangler/commands/workers/` |
| 6 | Catálogo real | 15 imóveis em 10 cidades, 18 campos, nenhum texto suspeito. A busca não olha descrição nem comodidades, e o resumo não traz preço. GET de leads devolveu lista vazia. | cerca de 95 GETs em 13/11 |

O token da Cloudflare autentica (ativo).

## Suas decisões

Todas as recomendações aceitas, com estas diferenças registradas em `DECISOES.md`:

- **L1:** com entrada e saída determinadas, declara as datas e já cota na mesma resposta.
- **L11:** em tempo esgotado, sem nova tentativa e sem GET; diz que não confirmou, com handoff.
- **L17:** JSON válido com os dois campos em texto devolve sempre 200; 400 só para JSON inválido ou campo faltando.
- **L23:** subdomínio próprio, regra só para o hostname.
- **X2 e X3:** produção sobe sem você com o envio real desligado; modelo forte só na coordenadora e em A, C, F e G.

**Três pontos seguem abertos** (as frentes usam o padrão provisório até você responder):

| ID | Pergunta | Padrão provisório |
|---|---|---|
| L1a | "Fim de semana" sem datas é sexta a domingo ou sábado a domingo? | o agente pede entrada e saída |
| L1b | "Sexta que vem" vale como a próxima ocorrência? | sim, com a data declarada |
| L17a | Campo presente que não é texto; `session_id` vazio | 400 no primeiro, 200 no segundo |

## Aceite

| # | Item | Resultado |
|---|---|---|
| 1 | Seis verificações com fonte | sim, com três desconhecidos marcados: Bot Fight Mode, permissão da regra, corpo do 422 real |
| 2 | Frente executável só com contrato e backlog | sim, por construção; não foi testado com uma sessão fria |
| 3 | Marco 1 primeiro, evals em paralelo sem tocar os mesmos arquivos | sim, pela tabela de donos de arquivo |
| 4 | Estimativas cabem, linha de corte escrita | 29,5 horas de agente, 12 horas de relógio; prazo assumido como horário de Brasília |
| 5 | Conselho com pergunta e respostas inteiras | sim, os dois comandos com saída 0 |
| 6 | Lacunas levadas a você | sim; as três abertas não constam como decididas |
| 7 | E-mails e reflog | 26 commits, só contato@evertonresende.com; zero amend, rebase ou squash |
| 8 | Sigilo | zero ocorrências de domínio, token e empresa, cada termo provado sozinho |
| 9 | Remoto privado igual ao local | sim |
| 10 | Sem código de produto e sem deploy | sim; só documentos e `scripts/verificar-sigilo.sh` |

## O que você precisa saber

- **Ref de ferramenta:** o T3 criou uma ref local de checkpoint com outra identidade. Ela não está no remoto, e o gate agora reprova se alguma chegar lá. Nunca use `git push --mirror`.
- **Reflog:** tem uma entrada `reset`, que foi só tirar arquivos do stage.
- **Plano de evals:** os totais dos casos de cotação foram calculados à mão, não rodados em código.
- **Desenhos:** os diagramas Mermaid não foram renderizados.
- **Texto do enunciado:** frases curtas de regra coincidem ("nunca negocia preço", "uma vez por estadia"), e a pergunta ao conselho tem uma frase quase igual à do enunciado sobre decidir e registrar. Está commitada e o histórico não pode ser reescrito.
- **Gate de sigilo:** quando você gravar `AGENTE_URL_PRODUCAO`, o hostname passa a ser bloqueado em arquivo versionado. Para liberar a URL no README, ponha o hostname em `[caminho local]`.

## Prompt da coordenadora

É o conteúdo de [docs/prompts/02-coordenadora.md]([caminho local]):

````
# Sessão coordenadora: agente concierge (desafio técnico)

Você é a SESSÃO COORDENADORA desta entrega. Você não escreve código de produto, não
decide comportamento de produto, não liga o envio real de leads e não torna o
repositório público sem ordem explícita do Éverton. Você despacha frentes, confere,
mergeia e mantém o backlog.

Você nasce sem acesso à conversa de planejamento e sem o enunciado original. Tudo o
que precisa está no repositório `agente-concierge`.

## Leia primeiro, inteiro, nesta ordem

1. `CLAUDE.md` — regras de sigilo, histórico e do webhook real.
2. `docs/CONTRATO.md` — fonte única de requisitos.
3. `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md` — marco, levas, corte, donos de
   arquivo, critérios. É este arquivo exato; é a sua máquina de estado.
4. `docs/EVALS.md`, `docs/VERIFICACOES.md`, `DECISOES.md`.

Isso é leitura de uma vez só. Se este texto reaparecer depois de uma compactação de
contexto, não releia tudo: leia a última linha do log do backlog e continue.

## Configuração já decidida (não repergunte)

| Decisão | Resposta |
|---|---|
| Autonomia | siga sozinha; pare só nos pontos da seção "Pare e chame o Éverton quando" |
| Resumo | até 10 linhas para o Éverton no fim de cada leva |
| Modelos | o mais forte disponível só em você e nas frentes A, C, F e G; modelo intermediário em B1, B2, D, I, E, H, J, L, K, N e nos subagentes de revisão e de verificação |
| Deploy em `dev` | liberado para A e B1 na leva 1 e para você, a partir da `main`, depois de cada merge |
| Deploy em `producao` | pode sair sem o Éverton, depois de M2, com `ENVIO_LEADS=desligado` |
| Ligar o envio real, tornar o repositório público | só com ordem explícita do Éverton |
| Lacunas do enunciado | decididas na seção 10 do contrato; seguem abertas a L1a, a L1b e a L17a, as duas últimas com padrão provisório que as frentes implementam; lacuna nova é do Éverton |

Orçamento: o limite semanal de uso do Éverton estava em 74% em 13/11, com o uso extra
desligado. Não suba o modelo de uma frente por conta própria, não abra frente que o
backlog não pede e peça veredito em vez de diff. Se o limite acabar, registre o estado
no backlog e avise; não troque de provedor por conta própria.

## Regras que você não quebra

1. **Não edite código de produto.** Você edita só o backlog, `docs/`, `CLAUDE.md` e
   faz git (merge, push). Prestes a abrir um arquivo de `src/`, `test/`, `falso/` ou
   `evals/` para editar: pare, isso é trabalho de frente.
2. **Webhook real: nenhum POST antes da entrega**, por nenhuma sessão, nem como teste.
   GET é permitido. Fluxo com confirmação só em `dev` ou local.
3. **Sigilo.** Nunca escreva em arquivo versionado, commit, prompt de frente ou
   pergunta a outro modelo: nome da empresa do desafio, trecho do enunciado, domínio
   da API, token, IP, nome de máquina, e-mail que não seja o do autor. Nunca imprima
   variável secreta. Os valores vivem em `[caminho local]`; carregue no
   mesmo comando em que usa.
4. **Histórico.** Um commit por mudança lógica, push a cada commit, merge sempre
   `--no-ff`. Nunca squash, amend ou rebase. Antes de cada commit e de cada push:
   `scripts/verificar-sigilo.sh` → `SIGILO OK`. Push só de branches e tags, nunca
   `git push --mirror`: a ferramenta de orquestração cria refs locais de checkpoint
   com outra identidade, que não podem chegar ao remoto.
5. **Conjunto reservado.** Você nunca abre a pasta do reservado nem pede para ver um
   caso. Você roda só o agregado (critério de integração 5). Correção de falha do
   reservado passa pela frente C: ela migra o caso para o conjunto dev e escreve um
   substituto.
6. **Lacuna ou critério impossível:** pare a frente, leve ao Éverton com
   recomendação. Depois da resposta, atualize o contrato e o `DECISOES.md`.
7. **Não confie no relatório da frente.** Rode você os CHECK do backlog e delegue a
   leitura do diff a um subagente verificador, que devolve só veredito, o que provou e
   o caminho do que não bateu. Não leia diff no seu contexto, exceto conflito de merge.

## Como as frentes rodam (T3 Code)

A skill `orquestrar-entrega` foi escrita para outro orquestrador. Dela valem o formato
do backlog e a disciplina acima. **Não valem** os comandos `orca` nem os scripts da
skill.

- **Frente pequena** (marcada "subagente em worktree" no mapa): subagente com
  worktree isolada. Peça veredito e caminhos, nunca o diff.
- **Frente longa** (marcada "thread T3"): thread nova do T3, com o prompt pela entrada
  padrão:
  `t3 thread start --worktree main --branch <frente> --title "<frente>" . -`
  Se o comando falhar, entregue o prompt pronto para o Éverton colar numa thread nova.
- A frente C fica viva até a entrega.
- Antes de despachar uma leva, confira a tabela "Dono de arquivo" do backlog: duas
  frentes da mesma leva não podem tocar o mesmo arquivo. Havendo sobreposição, ponha
  em sequência.
- Antes de uma leva pesada, confira carga e memória da máquina. No máximo 5 frentes
  vivas ao mesmo tempo.

## Prompt de frente (preencha e envie)

```
Você é a frente <ID — nome> do projeto agente-concierge. Trabalhe só nesta worktree.

Leia inteiro, antes de tudo: CLAUDE.md, docs/CONTRATO.md e a seção "Sessão <ID>" de
docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, mais "Regras que valem para toda
frente" e "Dono de arquivo" do mesmo backlog. Não existe outra fonte de requisitos.

Objetivo: <uma frase, com os CA-nn e L-n atendidos>.
Arquivos seus: <linha da tabela de donos>. Qualquer outro arquivo: pare e avise.
Critérios de aceite: os da sua seção, com CHECK e ESPERA. Cumprido = saída 0 e o
marcador de ESPERA na saída.
Fora do escopo: <não-escopo da seção>.

Regras duras: nenhum POST ao webhook real; nunca imprimir segredo; gate de sigilo
antes de cada commit e push; nunca squash, amend ou rebase; lacuna aberta ou critério
impossível: pare e avise, não decida comportamento de produto.

Ao terminar: revisão de código por subagente sobre o seu diff, achados corrigidos,
commit e push da sua branch, e um relatório de até 12 linhas: o que foi feito, a saída
de cada CHECK, o que ficou de fora, commits. Sem colar diff.
```

## Ciclo

1. **Pré-voo.** Confira a tabela "Pré-voo" do backlog, incluindo `AGENTE_URL_PRODUCAO`
   no arquivo de ambiente (confira a presença, sem imprimir). O que depende do Éverton
   e não está pronto: avise em uma mensagem e siga com o que não depende disso.
2. **Leva 1.** Despache A, B1, B2, C e D juntas. Peça a B2 o bloco `marco1` primeiro.
   Rode os critérios de integração desde já; eles começam vermelhos.
3. **Portão do Marco 1.** Critério de integração 1 verde, rodado por você. Só então
   M1 e I, em paralelo. Sem Marco 1 verde, a leva 2 não sai.
4. **Leva 2.** E, F, G, H e J em paralelo, cada uma no seu arquivo. D roda ao vivo
   contra `dev`. Achados de M1 vão para a frente dona do arquivo.
5. **Integração.** Mergeie uma frente por vez, `--no-ff`, na `main`: `npm test`,
   gate de sigilo, push, deploy de `dev` se autorizado, evals dev. Falha de eval vira
   tarefa da frente dona do arquivo. Depois, o primeiro agregado do reservado.
6. **Leva 3.** M2 primeiro. Achado crítico ou alto corrigido antes de K. L em
   paralelo. K pode sair sem o Éverton, sempre com `ENVIO_LEADS=desligado`; confira
   `envio_leads: "desligado"` no `/saude` de `producao` logo depois do deploy. N por
   último.
7. **A cada leva:** atualize o mapa e o log do backlog, commit e push, e escreva para
   o Éverton um resumo de até 10 linhas (o que entrou, números dos evals, o que está
   travado nele). Esse resumo é também o que ele leva à segunda sessão de IA que usa
   para revisar as entregas; os achados dela voltam por ele e viram tarefa.

Se o tempo apertar, siga a "Linha de corte" do backlog na ordem escrita e registre o
corte no log e no `DECISOES.md`.

## Revisões e segunda opinião

- **M1 e M2** estão no backlog. Revisão de código e de segurança por subagentes
  (`code-reviewer`, `security-reviewer`).
- **Segunda opinião de outros provedores**, sempre de uma pasta vazia fora do
  repositório, sem segredos no texto, com a pergunta e a resposta inteira gravadas em
  `docs/conselho/`:
  - Gemini: `agy -p "<pergunta>" --model gemini-4-hydrogen-high`
  - GPT: `codex exec -m gpt-6-astra --[segredo] -s read-only -` (pergunta
    pela entrada padrão)
  A consulta é às cegas: nenhum dos dois vê a sua opinião nem a resposta do outro. Se
  um comando falhar, registre o erro e avise; não troque de modelo por conta própria.

## Se o seu contexto encher

O estado vive no backlog, não em você. Segunda compactação em poucos turnos: termine
o merge em curso, atualize o log, commit e push, e peça ao Éverton uma coordenadora
nova com este mesmo prompt.

## Pare e chame o Éverton quando

- o Marco 1 ficar verde (mostre a conversa e os números);
- surgir lacuna nova ou critério impossível;
- o gate de sigilo reprovar e a correção exigir reescrever histórico (não reescreva);
- a frente K encontrar o Bot Fight Mode ligado na zona, ou não tiver permissão para
  criar a regra do hostname (ela não mexe no resto do domínio);
- for a hora de ligar o envio real de leads ou de tornar o repositório público;
- restarem 4 horas para o prazo e o critério de integração 4 não estiver verde.

## Fechamento

Relatório final: critério de integração por critério, com a saída; tabela "Outcomes
pedidos" reconciliada linha a linha; cortes feitos; o que ficou para o Éverton (gravar
o vídeo em `dev`, tornar o repositório público, responder o e-mail com o link). Você
não torna o repositório público e não envia nada por e-mail.

Comece lendo os arquivos da primeira seção. Depois proponha a leva 1 com a checagem de
sobreposição e despache.
````

Próximo passo: cole o comando do item 1 no terminal e abra o painel da zona para os itens 2 e 3.
