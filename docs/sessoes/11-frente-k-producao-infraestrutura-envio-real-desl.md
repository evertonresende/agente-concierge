# Frente K — produção (infraestrutura, envio real desligado)

- Export de sessão de trabalho. Índice e regras em [README.md](README.md).
- Tipo: sessão de frente.
- Aberta por: [Coordinate Concierge Challenge Delivery](03-coordinate-concierge-challenge-delivery.md).
- Branch: `frente-k`. Provedor: claudeAgent.
- Sessões que ela abriu: nenhuma.
- Só o texto das mensagens: sem chamada e resultado de ferramenta, raciocínio, anexo, lembrete de sistema, bloco de instrução injetado e resumo de compactação. Sem data e hora. Máscaras descritas no índice.

---

## Mensagem · Usuário (coordenação)

Você é a frente K do projeto agente-concierge: o ambiente `producao` do agente (um Worker da Cloudflare), com o envio real de leads DESLIGADO. Trabalhe só nesta worktree (branch `frente-k`). Responda em português do Brasil. Não crie subagentes.

Leia inteiro, antes de tudo: `CLAUDE.md` e `AGENTS.md` da raiz; `docs/VERIFICACOES.md` (seções 3 e 5); em `docs/CONTRATO.md`, a lacuna L23; em `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`, as seções "Sessão K", "Regras que valem para toda frente" e "Dono de arquivo"; em `DECISOES.md`, a X24 e as provisórias P10 e P16. Os passos do gateway de `producao` estão em `docs/revisoes/modelos.md` da branch da frente I, que ainda não entrou na `main`: leia com `git show origin/t3/modelo-evals-fallback:docs/revisoes/modelos.md`.

## O que o Éverton autorizou (X24, dita hoje)
- "K começar já pela infraestrutura de `producao` (rota, gateway, segredos, `/saude` respondendo), com o envio real desligado; o deploy final fica para depois da M2. Hoje `producao` devolve 530 (erro 1033). Se a rota esbarrar em registro de DNS que aponta para um túnel, pare e me pergunte antes de mexer no DNS."
- "Gateway de `producao`: pode criar e guardar nele a chave da Anthropic. Mesma regra de sempre: a chave vai por referência, sem aparecer em log, commit ou conversa."

## Regras que não se quebram
1. **Webhook real: nenhum POST, por nenhum motivo, nem como teste.** GET é permitido. Contra `producao`, só conversa SEM confirmação; nunca mande um "sim" depois de um resumo lá.
2. **Nunca suba o ambiente `producao` localmente.**
3. **Sigilo.** Valores ficam em `[caminho local]` (nomes das variáveis: `CATALOGO_URL`, `CLOUDFLARE_ACCOUNT_ID`, `AGENTE_URL_PRODUCAO`, `AGENTE_URL_DEV`, `LEADS_URL_DEV`, `ANTHROPIC_API_KEY`; a `OPENAI_API_KEY` que está lá NÃO é para usar). Carregue o arquivo no mesmo comando que usa a variável. Nunca imprima valor: sem `echo`, sem `set -x`, sem modo verboso; filtre toda saída de API antes de mostrar; nenhum valor em argumento de linha de comando (aparece na lista de processos), em arquivo versionado, em mensagem de commit, em relatório ou em conversa. A credencial da Cloudflare é `[caminho local]`, só por referência (`$(cat [caminho local])` dentro do comando), e nunca vira secret de Worker. A chave da Anthropic vive SÓ no AI Gateway: nunca em secret de Worker, `.dev.vars`, `--var` ou arquivo. Não escreva em lugar nenhum o domínio do agente, o do catálogo nem o do webhook: o hostname entra pelo ambiente no comando.
4. **Zona de DNS e configuração da zona: nada é alterado sem o Éverton**, fora a regra do item 6 abaixo, restrita ao hostname de produção.
5. **Histórico.** Um commit por mudança lógica, push a cada commit, mensagem em português com o rodapé `Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)`. Nunca squash, amend nem rebase (essas palavras também não entram em assunto de commit). Não mude a configuração de autor. Antes de cada commit (tudo em stage) e de cada push: `scripts/verificar-sigilo.sh` termina com `SIGILO OK`; se reprovar, não commite.
6. Arquivo seu: `scripts/validar-producao.sh` (e um teste dele, se fizer). Nada em `src/`, `test/` das outras frentes, `wrangler.jsonc`, `package.json`, `evals/`. Precisou de outro arquivo: pare e me avise (a variável `AI_GATEWAY` de `producao` no `wrangler.jsonc` é da frente I; eu passo para ela).
7. Suíte e tipos, se rodar: só por `[caminho local] npm test -- --maxWorkers=3` e `[caminho local] npm run tipos`. Nunca `--root`. Nenhum servidor local.

## Trabalho, nesta ordem. PARE e me reporte nos pontos marcados.
1. **Diagnóstico, só leitura (GET).** Por que o endereço de `producao` devolve 530 com erro 1033? Leia os registros de DNS da zona que cobrem esse hostname (o exato e curingas) e diga o tipo de cada um e se aponta para um túnel, SEM escrever o valor nem o hostname no relatório (descreva: "curinga do tipo CNAME apontando para um túnel", por exemplo). Leia como o deploy de `producao` liga o Worker ao hostname (`wrangler.jsonc`, `package.json`): rota ou domínio personalizado? Esse deploy criaria, trocaria ou dependeria de um registro de DNS? Confira também o estado do Bot Fight Mode e da checagem de integridade de navegador.
   **PARE AQUI e me mande o diagnóstico** se: há registro apontando para túnel; o deploy escreveria ou trocaria DNS; ou o Bot Fight Mode está ligado. Não escreva nada no DNS. Enquanto espera a resposta, siga com os itens 2 e 3, que não dependem disso.
2. **AI Gateway de `producao`.** Crie o gateway `concierge-producao` espelhando a configuração do `concierge-dev` (leia a do `dev` por GET) e guarde nele a chave da Anthropic, por referência, seguindo os passos do documento da frente I. Prova, sem valor: leitura da configuração mostrando o gateway e o provedor com chave configurada. Diga quais chamadas de API você fez (método e caminho, sem identificadores de conta).
3. **`scripts/validar-producao.sh`**, como descrito em "Sessão K" do backlog: `--so-leitura` (GET no webhook real, imprime `LEADS REAIS: <n>`), modo completo (secrets presentes, `/saude` com `envio_leads: "desligado"`, conjunto dev SEM casos de confirmação), `--clientes` (curl, Python `requests`, Python `urllib` com o agente de usuário padrão, `fetch` do Node) e `--entrega` (reprova se o envio estiver desligado). O script nunca faz POST ao webhook real e nunca imprime endereço.
4. **Prova de que "desligado" é zero POST, ANTES de qualquer deploy.** No commit exato que iria para `producao` (a `origin/main` do momento), ache o teste que prova que com `ENVIO_LEADS=desligado` nenhum POST sai para o webhook, mesmo com resumo confirmado, e rode-o. Me diga o nome do teste e o resultado. Se esse teste não existir ou não provar isso: **PARE**; não configure secret do webhook real nem faça deploy.
5. **Secrets e primeiro deploy de `producao`**, só depois de: item 1 resolvido (sem escrita de DNS pendente de aprovação), item 4 provado e o meu "pode". Secrets por referência (entrada padrão, nunca argumento). Deploy a partir de um checkout limpo da `origin/main`, com `ENVIO_LEADS=desligado`. Depois: `/saude` mostra `ambiente: "producao"` e `envio_leads: "desligado"`; `scripts/validar-producao.sh --so-leitura` mostra `LEADS REAIS: 0`.
6. **Regra de configuração que desliga a checagem de integridade de navegador só para o hostname de produção.** Nada mais na zona. Se o token não tiver permissão: PARE e me avise, para o Éverton criar no painel.
7. **Clientes**: `scripts/validar-producao.sh --clientes` → `CLIENTES OK`.

Fora do escopo agora: ligar o envio real (só com ordem do Éverton), o deploy final (depois da revisão M2 e de as frentes da leva 2 entrarem na `main`; eu aviso), tornar o repositório público.

## Relatórios
Mande cada relatório para a conversa da coordenadora (thread `[id]`, pela ferramenta de envio entre threads do T3) e deixe o mesmo texto como última mensagem. O primeiro é o diagnóstico do item 1, o mais cedo possível. Em todo relatório: o que foi feito, a saída de cada verificação (sem valores), o que ficou parado e por quê, e a pergunta exata que o Éverton precisa responder, se houver.

## Mensagem · Assistente

Lendo os documentos; em seguida começo o diagnóstico só-leitura do item 1.

## Mensagem · Assistente

Now the config: wrangler.jsonc and package.json on origin/main.

## Mensagem · Usuário (coordenação)

Coordenadora → Frente K. Atualização para o seu item 2 (gateway):

1. A frente I acabou de completar os passos do gateway de `producao` no documento dela, conferidos contra o `concierge-dev` que funciona. Releia a versão nova: `git fetch origin && git show origin/t3/modelo-evals-fallback:docs/revisoes/modelos.md` (commit `11cca93`). Traz as opções a espelhar do `dev`, o corpo exato da configuração do provedor (apelido `default`), a forma de mandar a chave pela entrada padrão a partir da variável de ambiente e como conferir depois.
2. Hoje o `concierge-producao` não existe (a consulta devolve erro 7002). Ordem obrigatória: primeiro o gateway existir com a chave; só depois a variável `AI_GATEWAY` de `producao` entra no `wrangler.jsonc`. Um gateway nomeado que não existe derruba também o modelo reserva. Essa linha do `wrangler.jsonc` NÃO é sua: quando o gateway estiver criado e conferido, me avise e eu peço à frente I.
3. O nível de raciocínio do Haiku ficou fixado em `high` (decisão do Éverton). Na prova final de `producao` (depois do deploy final, não agora), o log do gateway tem de mostrar chamadas do Haiku com status 200, a chave do apelido `default` e `"effort": "high"`, sem chamada ao reserva no mesmo turno.

## Mensagem · Assistente

Diagnóstico enviado à coordenadora. Agora item 2: lendo os passos novos do gateway.

## Mensagem · Assistente

Gateway criado e chave guardada. Aviso a coordenadora e sigo para o script (item 3).

## Mensagem · Assistente

Contrato seção 8 diz como o webhook real é montado; lendo.

## Mensagem · Assistente

Achei os testes candidatos do item 4; lendo-os para ver se provam "zero POST com resumo confirmado".

## Mensagem · Assistente

Item 4 provado (6 testes verdes na `origin/main` 7c54fb3). Escrevendo o script do item 3.

## Mensagem · Assistente

Script funciona nos quatro caminhos. Dado novo: em `dev` (endereço padrão do Worker), o `urllib` do Python leva **1010**. Isso confirma o risco da L23. Commitando.

## Mensagem · Assistente

Itens 2, 3 e 4 estão feitos. O 1 parou numa pergunta de DNS e o 5 espera o seu "pode". Mandei este relatório à coordenadora em [Coordinate Concierge Challenge Delivery]([url]).

**Pergunta para o Éverton**
1. Como ligar o hostname de produção ao Worker, já que hoje ele cai num curinga CNAME que aponta para um túnel?
   - (a) Rota de Worker: não escreve DNS e o curinga fica intacto. É a minha recomendação.
   - (b) Domínio personalizado: cria um registro exato só para esse nome.
2. Bot Fight Mode e a regra que desliga a checagem de integridade só para esse hostname: você confere e cria no painel, ou amplia o token? O token não lê bots e não lê as regras de configuração.

**Item 1 — diagnóstico (só GET, nada escrito): PARADO**
- **Causa do 530/1033:** o hostname não tem registro próprio e cai num curinga do tipo CNAME, com proxy ligado, que aponta para um túnel. O erro 1033 é o que a Cloudflare devolve quando o túnel não tem conector ativo para esse nome. O token não consegue ler o estado do túnel (401).
- **Deploy:** o `wrangler.jsonc` não tem rota nem domínio personalizado. Do jeito que está, o deploy só publica no endereço padrão do Worker e não toca no DNS.
- **Checagem de integridade de navegador:** ligada na zona inteira.
- **Bot Fight Mode:** desconhecido. A leitura dá 403.

**Item 2 — gateway `concierge-producao`: FEITO**
- Chamadas, nesta ordem:
  1. GET no gateway `concierge-dev`.
  2. POST para criar o gateway.
  3. POST da configuração do provedor: recusado, 7001, porque o secret precisa existir antes.
  4. POST do secret `concierge-producao_anthropic_default` no Secrets Store, escopo `ai_gateway`.
  5. POST da configuração do provedor de novo: aceito.
- O documento da frente I não tem o passo 4; avisei a coordenadora.
- **Prova:** campo a campo, o gateway é igual ao do `dev`. A configuração mostra `anthropic`, apelido `default`, `default_config: true`. A chave não apareceu em lugar nenhum.

**Item 3 — `scripts/validar-producao.sh`: FEITO**
- Commit `33c8316`, publicado na `frente-k`. `SIGILO OK` antes do commit e antes do push.
- **Saídas de hoje:**
  - `--autoteste` → `AUTOTESTE OK`.
  - `--so-leitura` → `LEADS REAIS: 0`.
  - Os outros modos → `REPROVADO: /saude: HTTP 530`, porque produção ainda não existe. Nenhuma conversa foi enviada.
- **Contra `dev`:** curl, `requests` e `fetch` do Node receberam 200. O `urllib` do Python recebeu **403 com erro 1010**, o que confirma que o risco da L23 é real.
- **Limite:** `PRODUCAO OK` exige cada bloco em pelo menos 95% sem os casos de confirmação. Com o modelo em 86%, isso não passa ainda. Não afrouxei o limiar.

**Item 4 — "desligado" é zero POST: PROVADO**
- Rodei num checkout limpo da `origin/main` (`7c54fb3`): 6 testes passaram, 0 falharam.
- O principal é `test/sessao.test.ts > ENVIO_LEADS diferente de ligado: a confirmação pela sessão não faz nenhum POST`. Ele monta o resumo, manda "sim" e confere zero POST.

**Ainda não feito**
- Revisão pelo subagente `code-reviewer`, que o backlog pede: não rodei, porque a sua ordem proíbe subagentes.
- Itens 5 a 7 esperam a sua resposta à pergunta 1 e o "pode" da coordenadora.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Relatórios 2 e 3 recebidos. Pontos:

1. **Tarefa nova, agora: desligar o log do gateway `concierge-producao`** (`collect_logs: false`). Motivo: a revisão de segurança apontou que o gateway guarda o pedido inteiro, com nome e telefone íntegros, e a L22 só admite esses dados no estado da sessão e no corpo enviado ao webhook. O de `dev` fica como está (dados sintéticos, e o log é a prova do nível do modelo). Credencial por referência, nada de valor na tela. Prova: GET do gateway de `producao` mostrando o campo desligado e todo o resto igual. Se a API exigir reenviar o objeto inteiro, reenvie as opções lidas, sem tocar na chave.
2. **Correção de um dado seu:** a main já tem `producao` com `MODELO` Haiku 5.5 e nível alto desde 27c3093. O que falta em `producao` é só a linha `AI_GATEWAY`, que a frente I já escreveu (d561a05, na branch dela) e que entra na main depois do ensaio e do verificador. Eu aviso.
3. **Limiar do `PRODUCAO OK`:** não afrouxe. Ele é o portão final, depois da qualidade. Para o primeiro deploy (só infraestrutura) a prova vai ser `/saude` certo, `--clientes` e `--so-leitura` com zero lead. Não precisa de modo novo.
4. **Verificador do `scripts/validar-producao.sh`:** saiu agora, independente (você não podia usar subagente). Não mude o script enquanto ele roda, salvo defeito que você mesma ache. O achado dele eu repasso.
5. **O 403 (erro 1010) do python-urllib no endereço padrão:** guarde a saída como evidência para a pergunta da regra de integridade. Vou levar ao Éverton junto com a da rota.
6. Itens 1 e 5 seguem parados: rota e Bot Fight Mode são do Éverton, e o deploy espera o meu "pode".

Relatório curto quando o item 1 desta mensagem estiver provado.

## Mensagem · Assistente

O log do gateway `concierge-producao` está desligado. Conferi por leitura e mandei o relatório 4 em [Coordinate Concierge Challenge Delivery]([url]).

**Chamadas feitas** (credencial por referência, nenhum valor na tela):
1. GET no gateway `concierge-producao` → 200, `collect_logs` estava `true`.
2. PUT no mesmo gateway, reenviando as opções lidas e mudando só `collect_logs: false`, sem tocar na chave → 200, `success: true`.

**Prova:**
- A leitura depois mostra `collect_logs = false`. Comparei todos os outros campos com a leitura de antes, menos `modified_at`: nenhum mudou.
- A configuração do provedor continua `anthropic`, apelido `default`, `default_config: true`.
- O `concierge-dev` não foi tocado e segue com o log ligado.

**Decisão sua:** com o log desligado, a prova final que você descreveu (Haiku com status 200, `byok: default` e `"effort": "high"` no log do gateway) não tem mais de onde sair. Opções:
- (a) Ligar o log só durante uma conversa de prova sem dado pessoal e desligar logo depois.
- (b) Provar pelo log do Worker (`wrangler tail --env producao`, sem `principal_pulado` nem `modelo_falhou`) e pelo cabeçalho `x-chamadas-modelo`.
- (c) Aceitar a prova do nível já feita em `dev`.

Não mudo nada até a escolha.

**Outros pontos:**
- **Evidência do 1010:** guardada fora do repositório em `[caminho local]`. Contra o endereço padrão de `dev`: curl, `requests` e `fetch` do Node deram 200; o `urllib` deu 403 com erro 1010.
- **Modelo:** corrijo o relatório 3. A `main` já tem o Haiku em `producao` desde `27c3093`; falta só a linha `AI_GATEWAY` da frente I.
- **Script:** não mexo nele enquanto o verificador roda, e o limiar do `PRODUCAO OK` continua o mesmo.

**Parados:**
- Item 1: o Éverton escolhe entre rota de Worker e domínio personalizado, e decide como tratar o Bot Fight Mode e a regra de integridade.
- Item 5: o deploy espera o seu "pode".

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Relatório 4 recebido: log do gateway de `producao` desligado e conferido. Decisão sobre a prova do modelo em `producao`: **(b) mais (c), sem religar o log.**
- O nível alto já está provado em `dev` pelo log do gateway (41 chamadas, todas com o nível alto), e o valor da variável em `producao` fica preso por teste de configuração.
- Em `producao` a prova é: log do Worker sem `principal_pulado` e sem `modelo_falhou` durante as conversas de validação, e o cabeçalho `x-chamadas-modelo` maior que zero nas respostas. Se o `validar-producao.sh` ainda não confere isso, anote como acréscimo para depois do verificador; não mexa agora.
- A opção (a) fica descartada: ligar e desligar log em `producao` é uma operação a mais para esquecer ligada.

Nada mais por enquanto. Você continua parada nos itens 1 e 5 até a resposta do Éverton e o meu "pode".

## Mensagem · Assistente

Decisão anotada: em `producao`, o modelo se prova pelo log do Worker e pelo cabeçalho `x-chamadas-modelo`, e o log do gateway fica desligado.

O `scripts/validar-producao.sh` ainda não confere o `x-chamadas-modelo`. Fica como acréscimo para depois do verificador: o `--clientes` passa a exigir esse cabeçalho maior que zero em cada resposta. Não mexo no script agora.

Sigo parada:
- **Item 1:** espera a resposta do Éverton sobre rota de Worker ou domínio personalizado, e sobre o Bot Fight Mode e a regra de integridade.
- **Item 5:** espera o seu "pode" para os secrets e o primeiro deploy.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Veredito do verificador do `scripts/validar-producao.sh` (cabeça 33c8316): REPROVADO por um falso verde. O que passou: o servidor que fingia o webhook recebeu só GET nos 5 modos e em 30 cenários de falha; a trava decide pelo `ambiente` do `/saude`, não pela forma do endereço; nenhum endereço em argumento de processo; sem argumentos extras, toda falha reprova.

Relatório: [caminho local] Sondas: ver-k-sondas/ na mesma pasta.

Corrija, um commit por item:
1. **ALTO (bloqueia): falso `PRODUCAO OK` com argumentos extras.** Com `-h`, `--listar`, `--bloco marco1` ou `--alvo <outro>` repassados ao runner, o script imprime `PRODUCAO OK` e sai com 0 sem nenhuma conversa contra `producao`. Causa: aceita a saída 0 ou 2 do runner sem conferir quantos casos rodaram, e o código 2 também quer dizer "nenhum caso elegível". Correção: lista fechada de extras aceitos (os que não mudam o alvo nem o conjunto; `--alvo`, `-h` e `--listar` nunca), e `PRODUCAO OK` só com um número mínimo de casos realmente executados, lido da saída do runner. Sem esse número, reprova.
2. **MÉDIO: redirecionamento no `/chat` é seguido com POST e corpo.** Um 307 ou 308 leva o `requests` e o `fetch` do Node (modo `--clientes`) a repetir o POST no endereço do `Location`. Correção no seu script: `allow_redirects=False` no Python, `redirect: "manual"` no Node, `curl` sem `-L`, e qualquer 3xx no `/chat` reprova. A parte do runner (`evals/rodar.mjs`) é da frente B2; eu roteio.
3. **BAIXO: o `--autoteste` pega 4 de 12 defeitos plantados.** Acrescente os casos que faltam: GET trocado por POST, conferência do antes ou do depois retirada, código de saída do runner ignorado, alvo impresso na saída, e o falso verde do item 1.
4. **BAIXO, se couber em poucas linhas:** o limpador de saída não esconde hostname em maiúsculas nem endereço IP resolvido; ferramenta ausente (curl, node, requests) deve dizer qual falta; tempo limite para o runner; `curl -q` para não ler configuração pessoal.

Acréscimo combinado antes (não bloqueia): conferir que o cabeçalho `x-chamadas-modelo` das respostas vem maior que zero.

Regras de sempre: sem requisição ao webhook real além de GET, nada contra `producao` (não existe ainda), SIGILO OK antes de cada commit e push, sem amend, sem rebase. Relatório com os hashes e a saída do `--autoteste`; depois roda um verificador curto só do delta.

## Mensagem · Assistente

Lido o relatório. Antes de corrigir, conto quantos casos do conjunto dev rodam em `producao`, para fixar o mínimo do item 1.

## Mensagem · Assistente

69 casos rodam em `producao`. Mínimo fixado em 60. Commit 1: lista fechada de extras e veredito lido da saída do runner.

## Mensagem · Assistente

Commit 2: nenhum redirecionamento é seguido.

## Mensagem · Assistente

Commit 3: os itens baixos (limpador, ferramenta ausente, tempo limite do runner, `curl -q`, limites documentados).

## Mensagem · Assistente

Commit 4: exigir `x-chamadas-modelo` maior que zero.

## Mensagem · Assistente

Commit 5: o `--autoteste` passa a cobrir os modos, com servidores falsos em [endereço de rede].

## Mensagem · Assistente

Autoteste passa. Agora planto os defeitos do verificador, um por vez, para ver se ele pega cada um.

## Mensagem · Assistente

Faltam dois. Acrescento um caso de saída 1 com linha PARCIAL e um `/saude` que redireciona.

## Mensagem · Assistente

21 de 21 defeitos pegos. Commitando.

## Mensagem · Assistente

Os quatro achados do verificador e o acréscimo estão corrigidos, um commit por item, todos na `frente-k` (cabeça `f28ce3e`). Mandei o relatório 5 em [Coordinate Concierge Challenge Delivery]([url]). `SIGILO OK` antes de cada commit e de cada push.

| Commit | Achado | O que mudou |
|---|---|---|
| `defdab8` | ALTO, falso verde | Extras aceitos só `--paralelo`, `--pausa-ms` e `--timeout-ms`, com valor inteiro. `PRODUCAO OK` exige o veredito do runner e pelo menos 60 casos executados (hoje rodam 69 dos 98). |
| `30e9fcf` | MÉDIO, redirecionamento | Nenhum dos quatro clientes segue 3xx, e qualquer 3xx no `/chat` reprova. |
| `482ee2a` | BAIXOS | Limpador ignora maiúsculas e esconde também os IPs do hostname. Ferramenta ausente diz qual falta. Runner com teto de 2 h; `curl -q`. Os dois limites por desenho ficaram escritos no cabeçalho. |
| `b436ad6` | Acréscimo | `--clientes` exige `x-chamadas-modelo` maior que zero. Contra `dev`: curl, `requests` e Node deram 200 com 2 chamadas; o `urllib` continua com 1010. |
| `f28ce3e` | BAIXO, autoteste | O autoteste agora roda os modos contra agente e webhook falsos em [endereço de rede]. |

**Saídas:**
- `--autoteste` → `AUTOTESTE OK`.
- Defeitos plantados um por vez numa cópia do script: o autoteste pegou **21 de 21** (os 12 do verificador e 9 meus). O script das sondas está fora do repositório, em `[caminho local]`.
- `--so-leitura` → `LEADS REAIS: 0`.
- `-h`, `--listar`, `--bloco marco1` e `--alvo …` → `REPROVADO`, saída 1.

Nada foi enviado a `producao`, e o webhook real só recebeu GET. A parte do runner que segue redirecionamento é da frente B2.

Sigo parada nos itens 1 e 5: esperam a resposta do Éverton sobre rota e Bot Fight Mode e o "pode" da coordenadora. Próximo passo é o verificador curto do delta `33c8316..f28ce3e`, que a coordenadora dispara.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Ordem do Éverton (X26) e o meu "pode" para o PRIMEIRO deploy de `producao`, só no endereço padrão do Worker, com o envio real desligado. Nada é escrito na zona nem no DNS até ele responder sobre a rota.

**Antes de publicar**
1. Cópia limpa e destacada de `origin/main` na cabeça atual (hoje c538d78; diga o hash exato que você publicou). Nunca publique da sua branch nem de árvore com mudança local. `producao` na main: Haiku 5.5 em nível alto, `AI_GATEWAY` igual a `concierge-producao`, `ENVIO_LEADS` desligado.
2. Prova de zero POST NESSE commit: rode de novo, pela trava, os testes do envio desligado (os 6 do seu relatório 3; a main mudou desde 7c54fb3, entrou o complemento da frente F). Todos verdes, senão não publica.
3. Confira por leitura que `npm run deploy:producao`, como está nesse commit, só publica no endereço padrão (sem rota, sem domínio personalizado, sem escrita de DNS). Se o comando fizer qualquer outra coisa, pare e me avise.
4. Segredos de `producao` por referência, sem valor na tela, em argumento ou em arquivo do repositório. A chave do modelo NÃO vira segredo do Worker: ela vive só no gateway.

**Depois de publicar, validar (só conversa SEM confirmação)**
5. `/saude`: ambiente producao, destino real, envio desligado, variáveis presentes.
6. Modelo: um ou dois turnos sem confirmação (por exemplo, pergunta de cidade e uma cotação sem nome nem telefone). Status 200, `x-chamadas-modelo` maior que zero, e no log do Worker (`wrangler tail --env producao`, sem modo verboso, saída mascarada) nenhum `principal_pulado` nem `modelo_falhou`. Isso prova o gateway de `producao`; o nível alto fica provado em `dev` e preso pelo teste de configuração.
7. `--clientes` do seu script (versão da sua branch, em verificação) contra o endereço padrão de `producao`: curl, requests, urllib e fetch do Node. Anote o status de cada um.
8. `--so-leitura` antes e depois: `LEADS REAIS: 0` nas duas.
9. NÃO rode o modo completo (o conjunto de evals contra `producao`) ainda: ele espera a trava por negação do runner (frente B2) e a aprovação do verificador do seu script.

**Em paralelo, só por leitura**
10. O token consegue criar rota do Worker na zona? Confira a permissão sem criar nada.

**Pergunta do Éverton, para você responder com medição**
11. O endereço padrão do Worker serve como URL de entrega se o hostname emperrar? As configurações de bot da zona valem para ele? Diga: o que o contrato exige da URL (leia `docs/CONTRATO.md`), o que cada um dos quatro clientes recebe no endereço padrão de `producao`, e de onde vem o 403 com erro 1010 do urllib que você mediu em `dev` (configuração da zona não deveria alcançar o endereço padrão: descubra o que alcança, por documentação oficial ou por leitura da API, sem mudar nada).

**Regras que não mudam**
- Nenhum POST ao webhook real. GET é permitido. Nunca inicie o ambiente `producao` localmente.
- O endereço padrão de `producao` é sigiloso como os outros: não aparece em relatório, arquivo versionado, commit nem argumento de processo. Mascare toda saída de deploy e de log. Para eu usar depois, grave-o só no arquivo de ambiente (variável `AGENTE_URL_PRODUCAO`), sem imprimir; se a variável já existir com outro valor, não sobrescreva: avise.
- Ligar o envio real: só com ordem explícita do Éverton.
- Se qualquer passo falhar, pare e relate; não tente contornar.

Relatório: o hash publicado, o resultado de cada item acima (sem endereço) e a resposta à pergunta 11.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Complemento ao "pode", um item só:

12. Logo depois de publicar, acrescente o hostname do endereço padrão de `producao` ao arquivo `sigilo-extra` da pasta de configuração (uma linha, sem imprimir, com redirecionamento de acréscimo; não reescreva o arquivo, que já tem 3 linhas). Assim o gate de sigilo de todas as frentes passa a barrar esse hostname em arquivo, commit e histórico. Depois rode `scripts/verificar-sigilo.sh` e confirme que continua `SIGILO OK`. Se a variável `AGENTE_URL_PRODUCAO` do arquivo de ambiente já aponta para o hostname próprio, deixe como está e guarde o endereço padrão numa variável nova, `AGENTE_URL_PRODUCAO_PADRAO`, também sem imprimir.

## Mensagem · Assistente

Começo pela cópia limpa da `origin/main` e pela leitura do deploy.

## Mensagem · Assistente

Diferença desde c538d78 é só documentação. Instalando dependências limpas (`npm ci`) na cópia.

## Mensagem · Assistente

6 testes verdes nesse commit. Agora o `--dry-run`, para confirmar que o deploy não toca rota nem DNS.

## Mensagem · Assistente

Config limpa: sem rota, sem domínio, só endereço padrão. Preparando os segredos por pipe e publicando.

## Mensagem · Assistente

`--so-leitura` antes do deploy:

## Mensagem · Assistente

Publicado. Os dois segredos aparecem como "(hidden)", mas com tipo "Environment Variable". Confiro o tipo real pela API.

## Mensagem · Assistente

Segredos são `secret_text`; a chave do modelo não está no Worker. Gate de sigilo com a linha nova:

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Decisão do Éverton sobre a rota (X27, provisória P22): **rota do Worker na zona, no hostname próprio de producao.** Entra como passo seguinte ao que você já tem em mãos, nesta ordem e com estas condições:

1. **Só depois** de `producao` validada no endereço padrão do Worker, com o envio real desligado (os itens 5 a 8 da minha mensagem do "pode", todos verdes). Se a validação no endereço padrão falhar, não crie a rota: relate.
2. **O padrão da rota é o hostname exato de producao, sem curinga** no nome do host (o caminho leva `/*`). Uma rota só, apontando para o Worker de `producao`.
3. **Criada pela API da zona, não pelo `wrangler.jsonc`:** o hostname é sigiloso e não pode entrar em arquivo versionado. Credencial por referência, hostname lido do arquivo de ambiente dentro do programa, nada na tela nem em argumento de processo. Antes de criar, liste as rotas existentes da zona (leitura) e confirme que nenhuma já cobre esse hostname.
4. **Depois de criar:** `/saude` NESSE hostname tem de dar 200, com ambiente producao e envio desligado. Tente por até 2 minutos (propagação). Se não der 200, **apague a rota** que você criou, confirme por leitura que ela saiu, e me avise com o status que veio (sem endereço).
5. **Nenhuma escrita no DNS e nenhum domínio personalizado.** O registro curinga e o túnel ficam exatamente como estão. Se a rota só funcionar mexendo em DNS, pare e avise: não mexa.
6. Com o 200: rode `--clientes` e `--so-leitura` também nesse hostname (os quatro clientes; `LEADS REAIS: 0` antes e depois) e relate o status de cada cliente. Aqui valem as configurações de bot da zona; Bot Fight Mode e regra de integridade continuam com o Éverton, você só mede.
7. Confira que um novo `npm run deploy:producao` não apaga a rota criada pela API (por documentação oficial do wrangler ou por leitura; não precisa publicar de novo para testar). Se apagar, diga como evitar sem pôr o hostname no repositório.

No relatório: o identificador da rota (não é sigiloso), o resultado de cada passo e a resposta à pergunta do Éverton sobre o endereço padrão como URL de entrega.

## Mensagem · Assistente

Validando o endereço padrão. Primeiro o log do Worker em segundo plano, gravando só nomes de evento.

## Mensagem · Assistente

O tail em JSON não imprime "Connected". Sigo com `/saude` e dois turnos sem confirmação.

## Mensagem · Assistente

Log do Worker: 2 eventos `turno`, nenhum `principal_pulado` nem `modelo_falhou`. Agora `--clientes` no endereço padrão:

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Dois passos a mais, pedidos pelo Éverton (X28). Entram DEPOIS da rota, na ordem. [trecho pessoal retirado]

**Passo A · teste de clientes por agente de usuário, nos dois endereços de `producao`** (o padrão do Worker e o hostname próprio, quando a rota existir).
O Éverton mediu em `dev` (endereço padrão), só GET no `/saude`, trocando o agente de usuário: `Python-urllib` e `libwww-perl` levam 403 com erro 1010; curl, requests, httpx, aiohttp, Node, Go, Java, Postman, k6 e wget passam com 200. Repita exatamente isso em `producao`:
- só GET no `/saude`, um pedido por agente de usuário, com a cadeia de agente de usuário típica de cada cliente (os 12 acima; acrescente `PostmanRuntime`, `okhttp`, `axios`, `python-httpx` e um navegador comum se já não estiverem cobertos);
- uma tabela por endereço: cliente, status, e o código de erro quando vier 403. Sem endereço no relatório;
- depois, o mesmo com POST no `/chat` para os dois clientes barrados e dois que passam (uma pergunta sem confirmação), para saber se o bloqueio vale também para o POST.
Você só MEDE. Bot Fight Mode, regra de integridade do navegador e qualquer configuração de segurança da zona continuam só com o Éverton: não crie regra, não mude nada.

**Passo B · limite de taxa no gateway `concierge-producao`** (decisão provisória P23 da coordenação: 300 pedidos por minuto, janela fixa de 60 segundos).
Motivo: a revisão de segurança apontou que não há limite de gasto por cliente, por sessão nem no gateway. O gateway de `dev` não muda.
- Leia as opções atuais, mude só os campos do limite de taxa (limite 300, intervalo 60, técnica de janela fixa), reenvie o resto igual, sem tocar na chave nem no log (que fica desligado). Prova por leitura depois, campo a campo.
- Diga o que o gateway devolve ao Worker quando o limite estoura (status e código), por documentação oficial, e confira por leitura do adaptador (`src/modelo.ts`) o que o agente faz nesse caso (deve ir ao reserva e, se o reserva também recusar, responder a contingência do contrato). Não force o limite em `producao` para testar.
- Se a API não aceitar esses campos ou o efeito for diferente do esperado, não improvise: relate.

**Continua proibido, com ou sem resposta do Éverton:** ligar o envio real; escrever no DNS; mexer em configuração de segurança da zona; POST ao webhook real; iniciar `producao` localmente.

Ordem completa do que está com você: (1) prova de zero POST e primeiro deploy no endereço padrão; (2) validação no endereço padrão; (3) rota no hostname exato, com `/saude` 200 ou rota apagada; (4) passo A; (5) passo B. Um relatório curto ao fim de cada número, para eu acompanhar.

## Mensagem · Assistente

Mando o relatório de (1) e (2) e sigo para a rota.

## Mensagem · Assistente

Item (3): rota no hostname exato.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Relatório 6 recebido: `producao` no ar no endereço padrão, de 3e053cb, com o envio real desligado, zero lead antes e depois, gateway de `producao` respondendo. Bom trabalho. Siga com a rota (3), o passo A (4) e o passo B (5).

Duas coisas a mais, que não mudam a ordem:

1. **Latência.** Os dois turnos da validação levaram cerca de 11 s cada. Na rodada integrada local, com o mesmo modelo e nível, o p50 foi 2,5 s e o p95 5,3 s. Antes de fechar o passo A, meça de novo em `producao` (endereço padrão): 8 turnos sem confirmação, em 4 sessões novas (pergunta de cidade e cotação sem nome nem telefone), anotando o tempo de cada um e o `x-chamadas-modelo`. Diga se o primeiro turno de cada sessão é o lento (sessão nova, catálogo ainda não lido) ou se todos são. Se todos ficarem perto de 10 s, procure a causa por leitura (log do Worker com os tempos, se o adaptador registra; opções do gateway de `producao` comparadas com o de `dev`), sem mudar nada, e relate.
2. **URLs de pré-visualização.** Você viu que estão ligadas por padrão no Worker de `producao`. São endereços públicos a mais para o mesmo código. Não mude agora; diga no relatório do passo A quantas existem e se dá para desligar pela configuração do Worker sem tocar na zona. Eu decido depois.

Sobre a L23: entendido que o endereço padrão não cumpre o contrato e que, no hostname próprio, a checagem de integridade tem de sair só para ele. Isso é configuração de segurança da zona: continua só com o Éverton. No passo A, meça o hostname próprio como ele estiver e relate; não crie regra.

## Mensagem · Assistente

Rota criada (`[id]`). Agora tento o `/saude` no hostname por até 2 minutos.

## Mensagem · Assistente

200 em 6 s, sem problemas. Agora clientes e leitura de leads no hostname próprio, e confiro que o DNS não mudou.

## Mensagem · Assistente

Hostname próprio: **CLIENTES OK, os quatro com 200**, inclusive o urllib. DNS intacto. Agora o item 7: o deploy do wrangler apaga a rota?

## Mensagem · Assistente

Deploy sem `routes` no config não chama `publishRoutes`, então a rota fica. Relatório (3):

## Mensagem · Assistente

Passo A: agentes de usuário no GET `/saude`, nos dois endereços.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Relatório 7 recebido: rota criada, hostname respondendo, DNS intacto. Respostas do Éverton que mudam a sua fila (X29):

1. **Ele desligou o Bot Fight Mode e a checagem de integridade do navegador no painel, para a zona inteira.** O passo A passa a ter um portão: o `/saude` de `producao` no hostname próprio, com o agente de usuário do `Python-urllib`, tem de dar **200**. Meça todos os agentes da lista, nos dois endereços, como combinado, e destaque esse. Se o urllib não der 200 no hostname, relate o status e o código; não mude nada na zona.
2. **Passo B (limite de taxa no gateway de `producao`) CANCELADO.** O Éverton resolveu o limite de gasto do lado dele e não quer número novo. Não aplique. Se você já aplicou, volte os campos do limite de taxa ao que estavam antes (sem limite), sem tocar no resto, e prove por leitura, campo a campo.
3. **Plano B do endereço, autorizado mas hoje desnecessário:** se a rota do Worker falhar, você pode criar o domínio personalizado do Worker para o hostname de produção, só esse registro, sem mexer no curinga nem no túnel. A rota está funcionando, então NÃO crie. Fica registrado caso a rota pare.

Fila atual: passo A (com o portão do urllib), a latência (8 turnos em 4 sessões) e as URLs de pré-visualização. Depois disso, relatório, e você fica parada até o deploy final. Continua proibido: ligar o envio real, POST ao webhook real, iniciar `producao` localmente.

## Mensagem · Assistente

Portão do urllib no hostname próprio: **200** (medido acima). O passo B não foi aplicado, então não há nada a desfazer. Agora o POST `/chat` por agente e a latência.

## Mensagem · Assistente

Todos os turnos ficam entre 8 e 12 s, não só o primeiro. Procuro a causa por leitura.

## Mensagem · Assistente

O log `turno` registra `ms`, tokens e ferramentas. Comparo com `dev` publicado, que usa o mesmo modelo, para separar a causa.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Veredito do verificador do delta do `scripts/validar-producao.sh` (cabeça f28ce3e): REPROVADO por um ponto só, que você resolve em duas linhas. Entra na sua fila DEPOIS do passo A, da latência e das URLs de pré-visualização.

Relatório: [caminho local] Sondas: ver-k2-sondas/ na mesma pasta.

**O que passou:** nenhum `PRODUCAO OK` em 46 combinações de argumentos; contagem mínima; os quatro clientes não seguem redirecionamento (35 de 35 cenários, 0 pedidos no destino); o webhook de mentira só recebeu GET em 162 cenários; nenhum endereço na saída nem em argumento de processo; o cabeçalho de chamadas ausente, zero ou inválido reprova; os 39 cenários da rodada 1 continuam reprovando; o autoteste usa portas temporárias altas e não deixa processo.

**O que bloqueia (um commit):** no modo completo, o runner ainda segue redirecionamento. Com 307 ou 308 no `/chat`, ele mandou os POSTs com corpo para o endereço do `Location`. O runner é da frente B2, e a correção dela (808d6a8) está na branch dela, em verificação. Mesmo assim, o seu script tem de se proteger sozinho: ponha no `NODE_RUNNER` um envoltório do `fetch` que força `redirect: "manual"` (o verificador provou: 0 pedidos no destino). Com o runner corrigido na main, a proteção fica redundante, e é isso que se quer. Teste no autoteste: agente de mentira que responde 307 no `/chat` no modo completo; nenhum pedido no destino, e o script reprova.

**Baixos (um commit, o que couber):**
1. `--pausa-ms` maior que zero sempre reprova: o runner imprime `EVAL PARCIAL (pausa_ms=N)` e o script exige a linha exata. Aceite a linha com o sufixo.
2. Se só o processo Python morre (SIGTERM), o runner fica órfão e continua conversando. Mate o grupo de processos na saída.
3. O autoteste não pega o `principal` que deixa de chamar `validar_extras`, que é o conserto da rodada 1. Acrescente o caso.
4. `isdigit()` aceita "²": use conversão que só aceite dígitos comuns.
5. O limpador não mascara token nem caminho soltos: hoje nada imprime, deixe documentado no cabeçalho.

**Informação do verificador, sem ação:** hoje rodam 69 casos contra `producao`, folga de 9 sobre o mínimo de 60; com a trava por negação da B2 continuam 69.

Regras de sempre. Relatório com os hashes e a saída do autoteste; depois eu rodo um verificador curto do delta e o script entra na main.

## Mensagem · Assistente

`dev` publicado também fica em cerca de 10 s por turno, então não é algo só de `producao`. Leio os eventos `turno` pela observabilidade para ver onde vai o tempo.

## Mensagem · Assistente

Achado: o tempo do turno dentro do Worker (`ms`) fica em 2–4 s para cidades e 5–6 s para cotação, mas o cliente vê 8–12 s. Meço onde vão os ~5 s de diferença.

## Mensagem · Assistente

A conexão (DNS+TCP+TLS) leva 4–6 s a partir da VPS; o `/chat` em si leva 3–4 s. Detalho com o curl:

## Mensagem · Assistente

A falha está na VPS, onde o IPv6 de saída não funciona: o curl volta ao IPv4 em 0,2 s, mas o `http.client` do Python leva 4–6 s em cada conexão nova. Vou passar agora às URLs de pré-visualização.

## Mensagem · Assistente

Relatório do passo A, da latência e das URLs de pré-visualização:

## Mensagem · Assistente

Agora o veredito do verificador. Lendo o relatório da rodada 2:

## Mensagem · Assistente

Commit A (o bloqueio): envoltório do `fetch` no `NODE_RUNNER`, mais um teste com runner falso de verdade em Node.

## Mensagem · Assistente

Com o envoltório passa; sem ele o autoteste pega. Commit A:

## Mensagem · Assistente

Commit B, os baixos:

## Mensagem · Assistente

Contagem errada: o `pgrep` casava com a própria linha de comando. Refaço pelo PID do filho.

## Mensagem · Assistente

O filho morreu pelo pipe fechado (EPIPE), não pela correção. Refaço com um runner que não escreve:

## Mensagem · Assistente

O controle prova a correção. Commit B e a rodada de defeitos plantados:

## Mensagem · Assistente

A geração do arquivo de defeitos falhou no escape. Escrevo direto:

## Mensagem · Assistente

Dois defeitos antigos apontam para linhas que mudaram. Atualizo os textos:

## Mensagem · Assistente

25 de 25. Relatório:

## Mensagem · Assistente

`producao` está no ar, com o envio real desligado, no endereço padrão do Worker e no hostname próprio, e `LEADS REAIS: 0`. A correção do `scripts/validar-producao.sh` pedida pelo segundo verificador está publicada na `frente-k` (cabeça `b57b4ee`), e eu fico parada até o deploy final. Os relatórios 6 a 9 foram para [Coordinate Concierge Challenge Delivery]([url]).

**Deploy e rota**
- Publiquei a `origin/main` `3e053cb` de uma cópia limpa. Antes, os 6 testes de "desligado é zero POST" passaram nesse commit.
- Os dois segredos (`CATALOGO_URL`, `LEADS_URL`) entraram por pipe e estão como segredo no Worker; a chave do modelo não está nele.
- O endereço padrão ficou só no arquivo de ambiente, em `AGENTE_URL_PRODUCAO_PADRAO`, e o hostname dele entrou no `sigilo-extra`. O gate continua em `SIGILO OK`.
- Rota `[id]`, no hostname exato. O DNS e o curinga do túnel não mudaram.
- `/saude` está certo nos dois endereços.
- Dois turnos de teste do modelo deram 200, com `x-chamadas-modelo` maior que zero. No log do Worker não houve `principal_pulado` nem `modelo_falhou`.
- Um novo `npm run deploy:producao` não apaga a rota, pelo que li no wrangler 4.162.0. Ela só sairia se alguém pusesse `routes` na config ou passasse `--route`.

**Agentes de usuário (passo A)**
- **Portão:** o `Python-urllib` no hostname próprio dá **200**.
- No endereço padrão, `Python-urllib` e `libwww-perl` levam 403 com erro 1010, no GET e no POST. Os outros 15 agentes testados passam.
- No hostname próprio, os 17 agentes passam, e `--clientes` dá `CLIENTES OK`.
- O 1010 vem da zona `workers.dev`, que é da Cloudflare: pela documentação oficial ela não desliga. Por isso o endereço padrão não serve como URL de entrega (L23).
- O passo B, limite de taxa no gateway, foi cancelado antes de eu aplicar. Não há nada a desfazer.

**Latência**
- Os ~10 s por turno vêm quase todos da VPS de onde medi: o IPv6 de saída dela falha, e o Python leva 4 a 6 s em cada conexão nova antes de cair no IPv4.
- O log do Worker mostra o turno em 2,2 a 4,0 s nas perguntas de cidade e 5,0 a 5,9 s nas cotações. O primeiro turno de cada sessão não é mais lento que o segundo, e `dev` dá o mesmo.

**URLs de pré-visualização**
- Hoje existe 1, uma por versão enviada; cada novo upload cria mais uma.
- Dá para desligar no próprio Worker, sem tocar na zona: pela API (sobrevive aos deploys) ou com `"preview_urls": false` no `wrangler.jsonc`. Não mudei; a coordenadora decide.

**Script, segunda verificação**
- `86c00c1` resolve o bloqueio: o runner de evals deixa de seguir redirecionamento no modo completo.
- `b57b4ee` resolve os cinco itens baixos. O runner não fica mais órfão depois de um SIGTERM; conferi com e sem a correção.
- `--autoteste` → `AUTOTESTE OK`, e ele pega 25 de 25 defeitos plantados um por vez numa cópia do script. O script dos defeitos fica fora do repositório, em `[caminho local]`.

Próximo passo: a coordenadora rodar o verificador curto do delta `f28ce3e..b57b4ee`. Depois disso o script entra na `main`.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Relatórios 8 e 9 recebidos. Portão do urllib no hostname: passou, registrado.

1. **Script:** o verificador curto do delta f28ce3e..b57b4ee já está rodando. Não mexa em `scripts/validar-producao.sh` até o veredito.
2. **URLs de pré-visualização (decisão provisória da coordenação, P25):** desligue pela forma (b), no Worker `concierge-producao`: `previews_enabled: false`, mantendo o `enabled` do endereço padrão como está. Motivo: cada versão enviada ganha um endereço público a mais, e a versão antiga (sem as correções da leva 2) continuaria no ar depois do deploy final. Não toca na zona nem no DNS. Depois confira e me mande: o GET do estado (`previews_enabled: false`, `enabled` igual a antes); `/saude` 200 no endereço padrão e no hostname; um GET no endereço de pré-visualização da versão atual, que tem que parar de responder 200; `LEADS REAIS: 0`. Se o POST pedir o campo `enabled` junto, mande o valor que o GET devolveu. Se der erro, não insista: me diga o código.
3. **Latência:** aceito a causa (conexão nova da máquina de medição, não o agente). Daqui em diante, medição de latência a partir desta máquina força IPv4 ou reusa a conexão, e o número que vai para o README é o do evento `turno` do Worker ou o do runner. Sem ação sua agora.
4. **Convenção de registro (pedido do Éverton):** decisão dele é citada só com a data, sem hora e sem circunstância pessoal. Vale para qualquer texto seu que vá para o repositório.

Depois do item 2, fique parada até o deploy final. Responda só com o resultado do item 2.

## Mensagem · Assistente

Desliguei as URLs de pré-visualização do Worker `concierge-producao`, mas a URL da versão atual nunca chegou a responder 200: já dava 404 antes. Mandei este resultado à coordenadora em [Coordinate Concierge Challenge Delivery]([url]). Não mexi na zona nem no DNS.

- **Estado antes:** `{enabled: true, previews_enabled: true}`.
- **Mudança:** um POST com `{enabled: true, previews_enabled: false}` deu 200, `success: true`. Repeti o `enabled` que o GET devolveu.
- **Estado depois:** `{enabled: true, previews_enabled: false}`, com o `enabled` igual ao de antes.
- **URL de pré-visualização da versão 3fea6d10:** 404 antes de desligar e 404 com `error code: 1042` depois. A documentação oficial explica por quê: a Cloudflare não gera essas URLs para Workers com Durable Object, e este tem a `Sessao`. Então eram 0, não 1 como eu disse no relatório 8. O desligamento só protege para o caso de o Worker deixar de ter Durable Object.
- **`/saude`:** 200 no endereço padrão e 200 no hostname.
- **Leads reais:** `--so-leitura` dá `LEADS REAIS: 0`.

Fico parada até o deploy final.

## Mensagem · Usuário (coordenação)

Coordenação → K. Chegou a hora do deploy final de `producao`, com o envio real DESLIGADO. A árvore final está congelada: `main` em 25c3d5a (código do agente = commit 9d37f9a: b5af852 + correção da G eb5c7d4 + formas de confirmação da F a4b13fa; juiz e runner no estado de 193d1bf; 104 casos em dev). Três rodadas oficiais em `dev` nessa árvore: 310 de 312, todos os blocos acima de 95%.

**Faça, nesta ordem, e pare em qualquer anomalia:**
1. `scripts/validar-producao.sh --so-leitura` → espera `LEADS REAIS: 0`.
2. Deploy de `producao` a partir de uma CÓPIA LIMPA da `main` em 25c3d5a (não da sua branch): mesmo procedimento do primeiro deploy (linha de 14/11 00h07 do log do backlog), com `ENVIO_LEADS=desligado` como está no `wrangler.jsonc`, segredos só por referência, o hostname entrando pelo ambiente no comando e nunca em arquivo. Não escreva DNS, não mude configuração de segurança da zona, não ligue o envio. Confira antes que `git diff 25c3d5a -- src wrangler.jsonc package.json` na cópia está vazio. Saída do deploy sempre mascarada (URL e host).
3. Depois do deploy: `/saude` (ambiente `producao`, destino real, envio `desligado`); a P25 continua aplicada (URLs de pré-visualização desligadas); o hostname próprio e o endereço padrão respondem; o registro de log do gateway de `producao` continua desligado; log do Worker sem `principal_pulado` nem `modelo_falhou` nos primeiros turnos.
4. `scripts/validar-producao.sh --clientes` → `CLIENTES OK`.
5. **Só depois que o arquivo `[caminho local]` deixar de existir** (o simulador hostil está rodando em `dev` e só pode haver uma rodada sem pausa por vez; espere com um laço `until [ ! -e [caminho local] ]; do sleep 20; done`, até 30 minutos): `scripts/validar-producao.sh` em modo completo → espera `PRODUCAO OK`, `LEADS REAIS: 0` e `ENVIO: desligado`. Enquanto o seu modo completo roda, mantenha o arquivo `[caminho local]` e apague-o ao terminar, mesmo em erro.
6. `scripts/validar-producao.sh --so-leitura` de novo no fim → `LEADS REAIS: 0`.

**Proibido, como sempre:** qualquer POST ao webhook real; conversa com confirmação contra `producao`; subir `producao` localmente; ligar o envio; imprimir valor de variável ou endereço.

Relato curto, com a saída de cada CHECK (mascarada), a versão publicada, a hora de cada passo (`TZ=America/Sao_Paulo date`) e o que não rodou. Se o modo completo reprovar por falso vermelho do juiz (P34: o juiz não é mais corrigido), mande as falhas com a conversa, sem tentar de novo.

## Mensagem · Assistente

Script igual na `main` e na minha branch, sem mudança local. Passo 1 e cópia limpa:

## Mensagem · Assistente

Cópia idêntica a `25c3d5a`. Instalando dependências e conferindo o deploy por `--dry-run`:

## Mensagem · Assistente

Config sem rota nem domínio, envio desligado. Rodo de novo os testes de zero POST nesse commit (3 s) e publico.

## Mensagem · Assistente

Anomalia: o wrangler avisou que religou as URLs de pré-visualização neste deploy, o contrário do que li no código dele. Confiro o estado:

## Mensagem · Assistente

O deploy desfez a P25 (`previews_enabled: true`). Restauro o estado decidido com o mesmo POST de antes:

## Mensagem · Assistente

Agora o passo 3: `/saude` nos dois endereços, os primeiros turnos e o log do Worker.

## Mensagem · Assistente

Passo 3 verde. Passo 4:

## Mensagem · Assistente

Passo 4 verde. O arquivo de uso do `dev` existe, então o modo completo espera em segundo plano (até 30 min) e roda a partir da cópia limpa, com o runner e os casos de `25c3d5a`.

## Mensagem · Assistente

Enquanto espera, aviso a coordenadora da anomalia das URLs de pré-visualização:

## Mensagem · Assistente

Os passos 1 a 4 do deploy final estão verdes. O modo completo (passo 5) segue em segundo plano: espera o `dev` ficar livre por até 30 min e depois roda. Ainda não tenho o resultado dele nem do passo 6.

Versão publicada: `[id]`, da cópia limpa de `25c3d5a`, com `ENVIO_LEADS` desligado. A cópia é idêntica à `main` nesse commit e o `src` é igual a `9d37f9a`.

| Hora | Passo | Resultado |
|---|---|---|
| 05:01 | 1. `--so-leitura` | `LEADS REAIS: 0` |
| 05:01 | 2. preparação | `--dry-run` sem rota nem domínio, envio desligado; os 6 testes de "desligado é zero POST" passaram nesse commit |
| 05:01–05:01 | 2. deploy | segredos por pipe, saída mascarada; nada escrito no DNS nem na zona |
| 05:03 | anomalia | o deploy religou as URLs de pré-visualização (`previews_enabled: true`); reapliquei `false` e conferi por leitura |
| 05:04 | 3. depois do deploy | `/saude` certo nos dois endereços; dois turnos 200 com `x-chamadas-modelo` 2; log do Worker sem `principal_pulado`, `modelo_falhou` nem falhas; segredos como segredo; rota intacta; log do gateway desligado |
| 05:06 | 4. `--clientes` no hostname | curl, `requests`, `urllib` e Node com 200, `CLIENTES OK` |

**Anomalia das URLs de pré-visualização:** no relatório 8 eu disse que desligá-las pela API sobrevivia aos deploys. Estava errado: o wrangler avisou que as religou porque `preview_urls` não está no `wrangler.jsonc`. Como o Worker tem Durable Object, nenhuma URL de versão chegou a existir nesse intervalo. Para não religar a cada deploy, falta `"preview_urls": false` em `env.producao` do `wrangler.jsonc`, que não é arquivo meu. Já avisei a coordenadora e a decisão é dela.

**Ainda rodando:** o modo completo roda o script da cópia limpa, para usar o runner e os casos de `25c3d5a`. Ele cria `producao-em-validacao` e apaga ao sair, mesmo em erro. A saída vai para `[caminho local]`. Quando ele terminar, rodo o `--so-leitura` final e mando o relatório com as horas.

## Mensagem · Usuário (coordenação)

Coordenação → K. Parcial recebida; bom ter pego e corrigido na hora. Decisão sobre a P25: o `wrangler.jsonc` NÃO muda agora (a árvore está congelada e a mudança só valeria no próximo deploy). Fica como procedimento: depois de TODO deploy de `producao`, reaplicar a P25 pela API e conferir por leitura (`previews_enabled: false`). Inclua isso no seu relato final como passo fixo do deploy de entrega (o de ligar o envio, que só sai com ordem do Éverton). Eu corrijo o texto da P25 em `DECISOES.md`.

Siga com os passos 5 e 6 quando o marcador `dev-em-uso-coordenacao` sair: o simulador hostil ainda está rodando em `dev`. Se o laço de 30 minutos estourar, não rode o modo completo por conta própria: mande o relato com o que há e eu te chamo de novo.

## Mensagem · Assistente

O procedimento está anotado: depois de **todo** deploy de `producao`, inclusive o de entrega, reaplico a P25 pela API e confiro por leitura que `previews_enabled` ficou `false`.

O laço em segundo plano já faz o que você pediu:
1. Espera desde 05:07:06 o marcador `dev-em-uso-coordenacao` sair, por no máximo 30 min.
2. Se o tempo estourar, ele não roda o modo completo, só registra "NÃO RODOU". Nesse caso mando o relato com o que já tenho.
3. Se o marcador sair, ele roda o modo completo a partir da cópia limpa de `25c3d5a`, mantendo `producao-em-validacao` enquanto roda.

Depois disso rodo o `--so-leitura` final e mando o relato com as horas de cada passo.

## Mensagem · Assistente

Modo completo REPROVADO por 1 caso: `robustez-nao-inventa` ficou em 90% (9 de 10), abaixo de 95%. Lendo o caso para o relato:

## Mensagem · Assistente

O valor R$ 708,00 é a diária correta de sexta e sábado (590 × 1,2), mas o texto da resposta não ficou guardado. Passo 6:

## Mensagem · Assistente

A versão final de `producao` está publicada com o envio desligado, mas o modo completo **reprovou** por 1 caso e não saiu `PRODUCAO OK`. Nenhum lead real foi criado do início ao fim. Mandei o relato à coordenadora em [Coordinate Concierge Challenge Delivery]([url]).

Versão publicada: `[id]`, a partir de uma cópia limpa da `main` em `25c3d5a`. Conferi que a cópia é idêntica a esse commit.

| Hora | Passo | Resultado |
|---|---|---|
| 05:01 | 1. `--so-leitura` | `LEADS REAIS: 0` |
| 05:01 | 2. antes do deploy | `--dry-run` sem rota e sem domínio, envio desligado; os 6 testes de zero POST passaram nesse commit |
| 05:01 | 2. deploy | saída mascarada; nada escrito no DNS nem na zona |
| 05:03 | P25 | o deploy religou as URLs de pré-visualização; reapliquei e conferi `previews_enabled: false` |
| 05:04 | 3. depois do deploy | `/saude` certo nos dois endereços; 2 turnos com 200; log do Worker sem `principal_pulado` nem `modelo_falhou`; rota e log do gateway como antes |
| 05:06 | 4. `--clientes` | curl, `requests`, `urllib` e Node com 200, `CLIENTES OK` |
| 05:15–05:18 | 5. modo completo | **`EVAL REPROVADO`**: 69 de 70 casos passaram; o bloco `robustez-nao-inventa` ficou em 90%, abaixo de 95% |
| 05:19 | 6. `--so-leitura` | `LEADS REAIS: 0` |

**A falha:** o caso `inv-05-feriado` pergunta se há acréscimo de Natal no GRM-301, de 24 a 27/12. O juiz reprovou porque a resposta disse "R$ 708,00 cada noite" sem dizer quais noites.
- R$ 708,00 é a diária certa de sexta e sábado (590 × 1,2); a quinta custa R$ 590.
- Se a resposta disse "sexta e sábado custam R$ 708,00 cada noite", é falso vermelho do juiz (P34). Se aplicou R$ 708,00 às três noites, é erro real.
- Não dá para decidir: o texto da resposta não ficou guardado. Meu script chama o runner com `--sem-relatorio` e o Worker não registra texto (L22).
- Como você pediu, não rodei o caso de novo.

O script pode passar a guardar o relatório do runner numa pasta temporária fora do repositório, para a próxima reprovação vir com a conversa. Só faço se a coordenadora pedir.

Ficou como passo fixo do deploy de entrega: depois de todo deploy de `producao`, reaplicar a P25 pela API e conferir por leitura. Enquanto o `wrangler.jsonc` não tiver `preview_urls`, o wrangler religa as URLs de pré-visualização a cada deploy.

Fico parada até nova chamada.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. Relato recebido e conferido. A primeira passada do modo completo fica registrada como foi: REPROVADO, 69 de 70, `inv-05-feriado` sem texto gravado, portanto falha não classificada. Não será descartada nem reescrita.

O que eu conferi do meu lado: as 16 respostas gravadas do `inv-05` em `dev` (três árvores, nove rodadas oficiais e sete sondas) estão todas certas e rotuladas ("2 noites de sexta e sábado: R$ 708,00 cada"). Isso não prova o texto que saiu em `producao`; só mostra que a forma reprovada é rara.

Pedido, uma vez só:

1. `scripts/validar-producao.sh --so-leitura` (espera `LEADS REAIS: 0`).
2. Segunda passada do modo completo, com o script exatamente como está na `main`. Não edite o arquivo: a árvore está congelada e a sugestão de gravar o relatório fora do repositório fica anotada para depois da entrega.
3. `scripts/validar-producao.sh --so-leitura` de novo.
4. Me devolva: hora de início e fim, a linha de `ENVIO`, as duas linhas de `LEADS REAIS`, quantos casos a trava recusou, quantos rodaram e passaram, o acerto por bloco, a latência (p50, p95, máximo) e a linha final literal (`PRODUCAO OK` ou `REPROVADO`).

Regras desta passada:
- Uma passada só. Se reprovar de novo, não repita: me devolva o id de cada caso reprovado e a mensagem do juiz, e eu colho o texto com o runner direto e relatório fora do repositório.
- `dev` está livre (apaguei o meu marcador às 05h15). Use o seu marcador `producao-em-validacao` como da outra vez e confira que ele saiu no fim.
- Saída sempre mascarada, sem endereço nem host. Nenhum POST ao webhook real, nenhuma escrita no DNS nem na zona.
- Sem subagentes. Carga: uma rodada de eval por vez na máquina; eu não rodo nada contra `dev` nem `producao` até o seu retorno.

Anotei o procedimento fixo do deploy de entrega (reaplicar a P25 depois de todo deploy de `producao` e conferir por GET). Depois do retorno desta passada você volta a ficar parada.

## Mensagem · Assistente

A segunda passada do modo completo terminou com **`PRODUCAO OK`**, e o webhook real seguiu com zero lead antes e depois. Rodei uma vez só, com o script igual ao da `main` e sem edição, contra a versão `9e309710`. Mandei o resultado à coordenadora em [Coordinate Concierge Challenge Delivery]([url]).

| Item | Resultado |
|---|---|
| `--so-leitura`, 05:22:14 | `LEADS REAIS: 0` |
| Modo completo | início 05:22:20, fim 05:25:21 |
| Linha de envio | `ENVIO: desligado` |
| Leads reais dentro da passada | `LEADS REAIS: 0` antes das evals e depois |
| Casos | a trava recusou 34; rodaram 70 e os 70 passaram |
| Latência | p50 3,0 s · p95 5,3 s · máximo 13,6 s |
| Linha final | `PRODUCAO OK` (o runner deu `EVAL PARCIAL`; o script saiu com 0) |
| `--so-leitura`, 05:25:21 | `LEADS REAIS: 0` |

Acerto por bloco:
- 100% em contrato, cotações, recusas, respostas, handoff, manipulação e não-inventa.
- `funciona-leads` e `marco1` não rodaram: todos os casos deles têm confirmação, e a trava recusa esses casos fora de `dev`.

O marcador `producao-em-validacao` existiu durante a passada e já foi apagado. A primeira passada continua registrada como foi: REPROVADO, 69 de 70.

Fico parada até nova chamada.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. **O Éverton deu a ordem em 14/11: ligar o envio real em `producao` e rodar a validação de entrega.** Condição dele: nenhuma conversa com confirmação contra `producao`, nem de teste. E ele quer o `ligado` gravado de modo que um deploy posterior não desligue.

São duas etapas, com uma parada no meio. Não faça o deploy antes do meu sinal.

**Etapa 1: gravar o `ligado` na configuração versionada (agora).**
Fato que conferi: o envio de `producao` é a variável `ENVIO_LEADS` de `env.producao.vars` no `wrangler.jsonc`, hoje "desligado", e `npm run deploy:producao` publica o que está nesse arquivo. Ligar por argumento de linha de comando não serve: o próximo deploy regravaria "desligado". O teste `test/configuracao-i.test.ts` fixa "desligado" para `producao`.
Autorizo você a editar, só para isto, o `wrangler.jsonc` e o `test/configuracao-i.test.ts` (os donos dessas linhas já fecharam).
1. Na sua branch `frente-k`, com a `main` atual mesclada (merge comum, sem reescrever histórico).
2. Commit 1: `env.producao.vars.ENVIO_LEADS` passa a "ligado" e o teste passa a esperar "ligado" em `producao`. Nada mais nesse commit. Se outro teste fixar o "desligado" lendo o arquivo de configuração, ajuste só a expectativa e me diga qual; teste que usa ambiente de mentira não muda.
3. Commit 2, separado e opcional: `"preview_urls": false` em `env.producao`, para a P25 sobreviver a deploy. Só entra se `npx wrangler deploy --env producao --dry-run` aceitar o campo sem aviso de campo desconhecido, e se a documentação da versão instalada do wrangler confirmar o nome do campo. Na dúvida, não faça: a reaplicação pela API continua valendo.
4. Rode pela trava de carga, uma coisa por vez: `[caminho local] npm test -- --maxWorkers=3`, depois `[caminho local] npm run tipos`, depois `scripts/validar-producao.sh --autoteste`. Tudo verde, ou pare e me diga.
5. `scripts/verificar-sigilo.sh` com `SIGILO OK` antes de cada commit e do push. Push da `frente-k`.
6. **Pare** e me mande: os hashes, o diff em palavras (quais linhas), a saída de cada comando do item 4 e o resultado do `--dry-run` (variáveis de `producao` que ele lista, sem endereço).

**Etapa 2: deploy e validação de entrega (só depois que eu responder "pode publicar", com o hash da `main`).**
Eu ensaio o merge, confiro o diff, mesclo na `main` e te passo o hash. Aí, de uma cópia limpa da `main` nesse hash:
1. `scripts/validar-producao.sh --so-leitura` → `LEADS REAIS: 0`.
2. `--dry-run`: confere `ENVIO_LEADS` ligado, sem rota e sem domínio novos.
3. Deploy de `producao`, saída mascarada. Nada escrito no DNS nem na zona.
4. P25: leia por GET se a pré-visualização ficou desligada; se o deploy religou, reaplique pela API e confira de novo.
5. `/saude` no endereço padrão e no hostname: ambiente `producao`, destino real, **envio ligado**.
6. `scripts/validar-producao.sh --entrega` → espera `ENTREGA OK` e a contagem de leads reais.
7. `scripts/validar-producao.sh --clientes` → `CLIENTES OK` (um turno sem confirmação por cliente; isso é permitido).
8. Leia de novo a contagem de leads reais pelo modo `--entrega`: tem de ser a mesma do item 6.
**Proibido nesta etapa:** o modo completo (o runner com o conjunto dev) contra `producao` com o envio ligado, e qualquer conversa que chegue a um resumo com "sim". Nenhum POST seu ao webhook real.

No relato final: hora de cada passo, as linhas literais (`LEADS REAIS`, `ENTREGA OK`, `CLIENTES OK`), a versão publicada, o estado da pré-visualização, e uma frase para o Éverton dizendo onde o `ligado` está gravado e o que um deploy posterior faz com ele.

Regras de sempre: saída mascarada, nenhum endereço ou host em arquivo, commit ou mensagem; a credencial da Cloudflare só por referência; sem subagentes.

## Mensagem · Assistente

`chat.test.ts:189` usa ambiente de mentira, então não muda. Edição do commit 1:

## Mensagem · Assistente

A suíte não imprimiu nada. Confiro a saída completa:

## Mensagem · Assistente

Suíte verde: 54 arquivos, 1565 testes. Tipos e autoteste:

## Mensagem · Assistente

Commit 2 (opcional): confiro o campo `preview_urls` na versão instalada do wrangler.

## Mensagem · Assistente

O schema da versão instalada aceita `preview_urls` por ambiente. Acrescento e rodo o `--dry-run`:

## Mensagem · Assistente

Sem aviso. Faço um controle: um campo inventado deve gerar aviso, para provar que o `--dry-run` mostraria o problema.

## Mensagem · Assistente

O controle avisou do campo inventado; o `preview_urls` passou sem aviso. Suíte de novo antes do commit 2:

## Mensagem · Assistente

O `git diff @{u}` falhou por falta de upstream e cortou a cadeia antes do push. Confiro o que sobe e publico:

## Mensagem · Assistente

`origin/frente-k` está em `caac4c5`. Relatório da etapa 1:

## Mensagem · Assistente

A etapa 1 está feita e a `frente-k` está no remoto em `caac4c5`. Não houve deploy: estou parada esperando o "pode publicar" com o hash da `main`. Mandei este relatório à coordenadora em [Coordinate Concierge Challenge Delivery]([url]).

**Commits**
- `b8d5339`: merge comum da `main` (`b176885`) na `frente-k`, sem reescrever histórico.
- `d3ac00e`: em `env.producao.vars` do `wrangler.jsonc`, `ENVIO_LEADS` passa de "desligado" a "ligado". O comentário de cima diz "Ligado por ordem do Éverton em 14/11 (contrato L24)". Em `test/configuracao-i.test.ts`, a linha de `producao` passa a esperar "ligado". Nada mais entrou nesse commit.
- `caac4c5`: `"preview_urls": false` em `env.producao`, com um comentário, para a P25 sobreviver aos deploys.
  - O schema do wrangler 4.162.0 instalado traz esse campo por ambiente, e o `--dry-run` não deu aviso.
  - Fiz um controle: um campo inventado no mesmo lugar gerou o aviso de campo desconhecido.

O único outro teste que fixa "desligado" em `producao` é `test/chat.test.ts:189`. Ele usa ambiente de mentira e prova a regra de que "diferente de ligado vira desligado", então não mexi nele.

**Verificações**, pela trava, uma por vez e depois de cada commit:
- `npm test -- --maxWorkers=3`: 54 de 54 arquivos e 1565 de 1565 testes verdes, nas duas vezes.
- `npm run tipos`: saída 0.
- `scripts/validar-producao.sh --autoteste`: `AUTOTESTE OK`.
- `scripts/verificar-sigilo.sh`: `SIGILO OK` antes de cada commit e antes do push.
- Para rodar a suíte, instalei as dependências da worktree com `npm ci`. `node_modules` está no `.gitignore` e o status ficou limpo.

**`--dry-run` de `producao` em `caac4c5`:**
- **`ENVIO_LEADS` "ligado"**.
- `AMBIENTE` "producao", Haiku 5.5 em nível "high", reserva GLM-5.3 Flash, `AI_GATEWAY` "concierge-producao".
- Sem rota e sem domínio novos.

## Mensagem · Usuário (coordenação)

Coordenadora → frente K. **Pode publicar.** A `main` está em **a97777b**, com caac4c5 mesclada por hash. Conferi o diff (só as linhas que você descreveu, em `wrangler.jsonc` e `test/configuracao-i.test.ts`) e ensaiei o merge: limpo, 54 arquivos e 1565 testes verdes, tipos e gate verdes na árvore mesclada.

Etapa 2, de uma cópia limpa da `main` em a97777b (confira que a cópia é idêntica a esse hash em `src`, `wrangler.jsonc` e `package.json`):
1. `scripts/validar-producao.sh --so-leitura` → `LEADS REAIS: 0`.
2. `--dry-run` de `producao`: `ENVIO_LEADS` ligado, sem rota e sem domínio novos.
3. Deploy de `producao`, saída mascarada. Nada escrito no DNS nem na zona.
4. P25: leia por GET o estado da pré-visualização. Com o `preview_urls: false` na configuração, a expectativa é que já venha desligada; se vier ligada, reaplique pela API, confira de novo e me diga que o campo não bastou.
5. `/saude` no endereço padrão e no hostname: ambiente `producao`, destino real, envio ligado.
6. `scripts/validar-producao.sh --entrega` → `ENTREGA OK` e a contagem de leads reais.
7. `scripts/validar-producao.sh --clientes` → `CLIENTES OK`.
8. `--entrega` de novo: a contagem de leads reais tem de ser a mesma do item 6.

Proibido: o modo completo contra `producao` com o envio ligado; qualquer conversa que chegue a resumo e "sim"; qualquer POST seu ao webhook real. Se qualquer passo sair diferente do esperado, pare ali e me diga; não tente desligar nem republicar sozinha.

No relato final: hora de cada passo, as linhas literais, a versão publicada, o estado da pré-visualização, e uma frase para o Éverton dizendo onde o "ligado" está gravado e o que um deploy posterior faz com ele.

## Mensagem · Assistente

No preview warning this time. Passos 4 e 5:

## Mensagem · Assistente

Pré-visualização já veio desligada pelo campo. Passos 6, 7 e 8:

## Mensagem · Assistente

`producao` está publicada com o envio real **ligado**. A validação de entrega passou, e o webhook real seguiu com zero lead antes e depois. Nenhum passo saiu diferente do esperado. Mandei o relato à coordenadora em [Coordinate Concierge Challenge Delivery]([url]).

Versão publicada: `[id]`, a partir de uma cópia limpa da `main` em `a97777b`. Conferi que a cópia é idêntica a esse hash em `src`, `wrangler.jsonc`, `package.json` e no lockfile.

| Hora | Passo | Linha literal |
|---|---|---|
| 06:40:38 | 1. `--so-leitura` | `LEADS REAIS: 0` |
| 06:40:51 | 2. `--dry-run` | `env.ENVIO_LEADS ("ligado")`, sem rota, domínio nem aviso |
| 06:41:00 | 3. deploy | `Current Version ID: 4d457dc2-…`; nada escrito no DNS nem na zona |
| 06:41:14 | 4. pré-visualização | `previews_enabled: false` sem reaplicar: o `preview_urls: false` no arquivo bastou |
| 06:42:10 | 5. `/saude` | endereço padrão e hostname: ambiente `producao`, destino real, envio ligado |
| 06:42:29 | 6. `--entrega` | `ENVIO: ligado`, `LEADS REAIS: 0`, `ENTREGA OK` |
| 06:42:48 | 7. `--clientes` | os quatro clientes com `200 OK`, `CLIENTES OK` |
| 06:43:20 | 8. `--entrega` | `LEADS REAIS: 0` (igual ao passo 6), `ENTREGA OK` |

Não rodei o modo completo e nenhuma conversa chegou a resumo nem a "sim". Não fiz nenhum POST ao webhook real: os quatro turnos do `--clientes` foram a pergunta fixa de cidades.

**Para o Éverton:** o "ligado" está gravado no repositório, em `wrangler.jsonc`, na linha `env.producao.vars.ENVIO_LEADS`, e o teste `test/configuracao-i.test.ts` exige esse valor. Um novo `npm run deploy:producao` publica o que está nesse arquivo, então mantém o envio ligado. Ele só desliga se alguém mudar essa linha, e nesse caso o teste quebra antes do commit.

Fico parada até nova chamada.

## Mensagem · Usuário (coordenação)

Frente K: preparação de um deploy de `producao` que vem em seguida (correções de segurança, ordem do Éverton de 14/11, registrada como X37). AGORA é só leitura; NÃO faça deploy ainda. O deploy só sai com uma segunda mensagem minha, com o hash exato da `main`.

Confira `TZ=America/Sao_Paulo date` e faça, sem imprimir endereço, host, token nem variável de ambiente:

1. Liste as versões e o deployment ativo do Worker de `producao` (wrangler, ambiente `producao`; confira a sintaxe na ajuda do próprio wrangler antes de rodar). Confirme que a versão ativa, com 100% do tráfego, é a que começa por `4d457dc2`. Guarde o id COMPLETO dela num arquivo fora do repositório, na sua pasta de rascunho: é o alvo da volta se a validação falhar. No relatório, escreva só os 8 primeiros caracteres.
2. Confira na ajuda do wrangler o comando exato de volta para uma versão anterior no ambiente `producao` (`rollback`, com o id da versão) e escreva o comando pronto no mesmo arquivo de rascunho, sem executar.
3. Confira, só lendo, que o secret de destino dos leads e os demais secrets de `producao` não dependem do deploy (o deploy reescreve só as `vars` do `wrangler.jsonc`).

O que vai mudar no deploy (para você saber o que validar depois): `GET /` passa a responder com cabeçalhos de proteção (política de conteúdo por hash, bloqueio de moldura); a leitura do catálogo não segue redirecionamento e tem teto de 1 MiB; o nome de ferramenta vindo do modelo é cortado em 64 caracteres e, no log, nome fora da lista vira `desconhecida`; texto do catálogo perde caracteres invisíveis; `preview_urls: false` também em `dev`. O contrato do `POST /chat` não muda. `ENVIO_LEADS` continua `ligado` em `env.producao` no `wrangler.jsonc`.

Regras de sempre: nenhum POST ao webhook real; nenhuma conversa com confirmação contra `producao`; nada de `--so-leitura` nem do modo completo do script de validação (reprovam por desenho); nenhum subagente.

Responda curto: versão ativa (8 caracteres), se está com 100%, o comando de volta conferido (sem o id completo), e a hora.

## Mensagem · Assistente

Estou conferindo no código do wrangler que o deploy preserva os secrets (`keepSecrets`); falta só identificar qual comando liga essa opção.

## Mensagem · Assistente

A versão ativa de `producao` é a **`4d457dc2`**, com 100% do tráfego. Conferi às 10:02 (horário de São Paulo), só lendo, sem deploy.

1. **Versões:** há 3 deployments e 3 versões. Na ordem: `3fea6d10`, `9e309710` e `4d457dc2`, cada um com uma versão a 100%. O id completo da ativa ficou fora do repositório, em `[caminho local]`.
2. **Comando de volta**, conferido em `wrangler rollback --help` (4.162.0) e gravado no mesmo arquivo, sem executar:
   `npx wrangler rollback <id de 4d457dc2> --env producao --message "volta X37" --yes`
   Roda de uma cópia da `main`, com o token e a conta passados por referência no mesmo comando.
3. **Secrets:** `CATALOGO_URL` e `LEADS_URL` são `secret_text` na API.
   - No wrangler instalado, o `deploy` mantém os secrets da versão anterior e só reescreve as `vars` do `wrangler.jsonc`.
   - O próximo deploy não precisa reenviar os secrets, e o `ENVIO_LEADS` vai como está no arquivo, `ligado`.

Mandei o mesmo relato à coordenadora em [Coordinate Concierge Challenge Delivery]([url]). Fico parada até a mensagem com o hash da `main`.

## Mensagem · Usuário (coordenação)

Frente K: PODE PUBLICAR. Deploy de `producao` da `main` no hash exato `c5817a0` (merge das correções de segurança, X37; já publicada no remoto). Prazo: validação fechada até 10h40.

1. Numa cópia limpa da `main` em `c5817a0` (`git fetch origin && git rev-parse origin/main` tem de dar `c5817a0…`; confira `git status` limpo e que `wrangler.jsonc` tem `ENVIO_LEADS` `ligado` em `env.producao`): `npm run deploy:producao`, com conta e token por referência no mesmo comando, saída mascarada. Anote o id da versão nova (no relatório, só 8 caracteres) e guarde o id completo no seu arquivo de rascunho, ao lado do da `4d457dc2`.
2. Validação, nesta ordem: `scripts/validar-producao.sh --entrega` (espera `ENVIO: ligado`, `LEADS REAIS: 1` e `ENTREGA OK`; a contagem tem de ser a mesma de antes: 1) e `scripts/validar-producao.sh --clientes` (espera `CLIENTES OK`).
3. Confira por GET, sem imprimir endereço: `GET /` em `producao` responde 200 com `content-security-policy` presente, `x-frame-options: DENY` e `x-content-type-options: nosniff`; e `GET /saude` como antes.
4. **Se o deploy falhar, ou `--entrega` ou `--clientes` reprovar, ou `GET /` não vier 200 com a política:** rode na hora o comando de volta para a `4d457dc2` que você deixou pronto, repita `--entrega` e `--clientes`, e relate. Não tente consertar.
5. Regras de sempre: nenhum POST ao webhook real; nenhuma conversa com confirmação; nada de `--so-leitura` nem do modo completo; nenhum subagente; nada de endereço, host ou variável impressa.

Responda curto: versão nova (8 caracteres), hora do deploy, a linha final de `--entrega` com a contagem de leads, a linha final de `--clientes`, os três cabeçalhos de `GET /` (presente ou ausente), e se houve volta.

Aviso: é provável um SEGUNDO deploy logo depois deste, com mais um commit (correção no caminho da confirmação do lead, ainda em verificação). Deixe a cópia e os comandos prontos; a versão que você publicar agora passa a ser o alvo da volta do segundo.

## Mensagem · Assistente

Cópia limpa em `c5817a0`, `ENVIO_LEADS` ligado. Publicando:

## Mensagem · Assistente

O deploy da X37 saiu e a validação passou. Não precisei voltar.

- **Versão nova:** `3b2ebbd0`. O id completo está no arquivo de rascunho, ao lado do da `4d457dc2`.
- **Hora do deploy:** 10:28:40, de um clone limpo da `main` em `c5817a0`, com `git status` vazio e `ENVIO_LEADS` `ligado` em `env.producao`.
- **`--entrega`:** `ENVIO: ligado`, `LEADS REAIS: 1` (a mesma contagem de antes), `ENTREGA OK`.
- **`--clientes`:** `CLIENTES OK`; curl, requests, urllib e Node responderam 200.
- **`GET /`:** 200 no hostname e no endereço padrão, com os três cabeçalhos presentes: `content-security-policy`, `x-frame-options: DENY` e `x-content-type-options: nosniff`.
- **`GET /saude`:** 200 nos dois endereços, ambiente `producao`, destino real, envio ligado.

Para o segundo deploy, a `3b2ebbd0` passa a ser o alvo da volta, e o comando de volta para ela já está no mesmo arquivo. Com o hash novo, faço um clone limpo nele. Mandei este relato à coordenadora em [Coordinate Concierge Challenge Delivery]([url]).

## Mensagem · Usuário (coordenação)

Frente K: prepare o SEGUNDO deploy de `producao`. NÃO publique ainda: espere a minha próxima mensagem dizendo "PODE" (falta só fechar a rodada de `dev` desta árvore, em poucos minutos). Adiante tudo o que não é o deploy.

## O que é

A `main` LOCAL está em `fca6d6d`: a `c5817a0` que você publicou mais um merge com dois commits (`e85de28` e `2bbbc63`), a correção do achado confirmado da auditoria: a confirmação do lead passa a recusar entrada que já passou (8 linhas em `src/agente/ferramentas/lead.ts`, mais teste). O Éverton mandou entrar hoje.

## ATENÇÃO: este hash NÃO está no remoto, de propósito

Ordem do Éverton: o teste só vai a público DEPOIS de a correção estar em `producao`. Então:
- `fca6d6d` existe só no repositório local `[caminho local]` (branch `main` local). `git fetch origin` não o traz.
- Faça a cópia limpa a partir do repositório LOCAL: `git clone --no-hardlinks [caminho local] <pasta de rascunho nova>` e `git checkout --detach fca6d6d` (ou uma worktree descartável desse repositório no hash). Confira `git rev-parse HEAD` = `fca6d6d…`, `git status` limpo, `git diff --stat c5817a0 HEAD` listando só `src/agente/ferramentas/lead.ts` e `test/lead-entrada-passada-v.test.ts`, e `ENVIO_LEADS` `ligado` em `env.producao`.
- **Nenhum `git push`, de nada, por você.** O push é da coordenação, depois da sua validação.
- `npm ci` na cópia (ou reaproveite o `node_modules` da cópia da `c5817a0`: `package.json` e `package-lock.json` são idênticos).

## Quando eu disser "PODE"

1. `npm run deploy:producao` da cópia em `fca6d6d`, conta e token por referência, saída mascarada. Guarde o id completo da versão nova no rascunho; no relatório, 8 caracteres.
2. `scripts/validar-producao.sh --entrega` (espera `ENVIO: ligado`, `LEADS REAIS: 1`, `ENTREGA OK`) e `scripts/validar-producao.sh --clientes` (`CLIENTES OK`). `GET /` com a política e `GET /saude` como antes.
3. **Se qualquer coisa falhar: volta imediata para a `3b2ebbd0`** (a que você publicou às 10h28; NÃO para a `4d457dc2`), repete `--entrega` e `--clientes`, e relata.
4. Regras de sempre: nenhum POST ao webhook real, nenhuma conversa com confirmação, nada de `--so-leitura` nem do modo completo, nenhum subagente, nada de endereço ou variável impressa.

Agora responda só: cópia pronta em `fca6d6d` (sim ou não), os dois arquivos do diff conferidos, e o comando de volta para a `3b2ebbd0` escrito no rascunho.

## Mensagem · Assistente

- **Cópia pronta em `fca6d6d`: sim.**
  - Clonei o repositório local com `--no-hardlinks` e fiz checkout destacado nesse hash: `git rev-parse HEAD` dá `fca6d6da…` e o `git status` está limpo.
  - O `ENVIO_LEADS` está `ligado` em `env.producao`.
  - Reaproveitei o `node_modules` da cópia da `c5817a0`, porque o `package.json` e o `package-lock.json` são idênticos.
  - Tirei o remoto do clone, então dele não sai push.
- **Diff conferido:** `git diff --stat c5817a0 HEAD` lista só `src/agente/ferramentas/lead.ts` (+8 linhas) e `test/lead-entrada-passada-v.test.ts` (+134 linhas).
- **Comando de volta para a `3b2ebbd0`, escrito no rascunho:** `npx wrangler rollback <id completo de 3b2ebbd0> --env producao --message "volta segundo deploy" --yes`. Está em `[caminho local]`, marcado para não confundir com a `4d457dc2`. Não executei.

Não fiz deploy nem push. Mandei o mesmo à coordenadora em [Coordinate Concierge Challenge Delivery]([url]) e espero o "PODE".

## Mensagem · Usuário (coordenação)

Frente K: PODE. A rodada de `dev` da árvore `fca6d6d` fechou 104 de 104, sem contingência. Publique `producao` da cópia em `fca6d6d` agora, valide (`--entrega` com `LEADS REAIS: 1` e `ENTREGA OK`; `--clientes` com `CLIENTES OK`; `GET /` com a política; `GET /saude`) e, se qualquer coisa falhar, volte na hora para a `3b2ebbd0` e relate. Nenhum push. Responda curto: versão nova (8 caracteres), hora, as duas linhas finais, os cabeçalhos, e se houve volta.

## Mensagem · Assistente

O segundo deploy de `producao` está publicado e a validação passou. Não houve volta e não fiz push.

- **Versão nova:** `9e8b35d1`, publicada às 10:37 a partir do clone limpo em `fca6d6d`. O id completo está no rascunho.
- **`--entrega`:** `ENVIO: ligado`, `LEADS REAIS: 1`, `ENTREGA OK`.
- **`--clientes`:** `CLIENTES OK`; curl, requests, urllib e Node responderam 200.
- **`GET /`:** 200 no hostname e no endereço padrão, com `content-security-policy` presente, `x-frame-options: DENY` e `x-content-type-options: nosniff`.
- **`GET /saude`:** 200 nos dois endereços, com ambiente `producao`, destino real e envio ligado.

Se precisar voltar, o alvo é a `3b2ebbd0`, e o comando está pronto em `[caminho local]`. O push da `fca6d6d` fica com a coordenadora; mandei este relato a ela em [Coordinate Concierge Challenge Delivery]([url]).
