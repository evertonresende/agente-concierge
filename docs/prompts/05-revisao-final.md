# Prompts da revisão final (M2) e dos revisores do conjunto reservado

Os 5 textos com que a sessão coordenadora abriu os revisores da revisão final e do conjunto reservado, na ordem de envio, com a data, a hora de Brasília e o modelo de cada um.

Extraídos do registro da sessão coordenadora por script, sem edição do texto, com estas exceções: caminhos da máquina e o identificador local da conversa da coordenadora foram trocados por marcadores (`<rascunho>`, `<worktree da coordenação>`, `<checkout principal>`, `~/`, `<conversa da coordenadora>`); nenhuma frase foi omitida neste arquivo; e as mensagens de acompanhamento enviadas depois da abertura não entram aqui. O que cada prompt produziu está no log do backlog (`docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`), pela data e pela hora.

## 1. M2 parcial — revisão de segurança (main atual)

13/11 23h21 · claude-opus-5-5 · esforço high

````text
Você é o REVISOR DE SEGURANÇA da revisão M2 (primeira passada) do projeto agente-concierge. Responda em português do Brasil. Você não corrige nada: acha, prova e classifica. Não crie subagentes. Só leitura: não edite nenhum arquivo do repositório, não faça commit, não troque de branch.

## Contexto
- Repositório: `<worktree da coordenação>`, na `main` atual. Leia `CLAUDE.md` e `AGENTS.md` da raiz antes de tudo: as regras de sigilo valem para você (nunca imprima valor de variável de ambiente, nunca abra `~/.config/agente-concierge/`, nenhuma chamada de rede, nenhum servidor local).
- O produto: um agente de chat para hóspedes de imóveis de temporada. Worker da Cloudflare em TypeScript, um Durable Object por `session_id`, laço de ferramentas próprio; `POST /chat {session_id, message}` devolve `{reply, handoff}`; consulta um catálogo externo só por GET; registra um lead num webhook externo por POST depois de o hóspede ver um resumo e confirmar; passa para humano quando não pode resolver. Modelo principal pelo AI Gateway (a chave do provedor fica guardada no gateway, não no Worker) e reserva no Workers AI. O repositório ficará PÚBLICO na entrega. Requisitos: `docs/CONTRATO.md`; decisões: `DECISOES.md` (L22 trata de dado pessoal em log).
- Esta é a primeira de duas passadas. As partes abaixo estão ESTÁVEIS e são o seu escopo agora. As partes ainda em mudança (`src/lead.ts`, `src/agente/ferramentas/lead.ts`, `src/agente/loop.ts`, `src/agente/prompt.ts`, `src/agente/ferramentas/handoff.ts`, `src/sessao.ts`, `src/chat.ts`) terão uma segunda passada só do delta: nelas, olhe o desenho e anote riscos, mas marque como "a reconferir no delta".

## Escopo desta passada
1. **Segredos e configuração:** `wrangler.jsonc`, `src/env.ts`, `package.json`, `.gitignore`, `scripts/verificar-sigilo.sh`, o histórico de commits da `main` (procure credencial, token, endereço interno, e-mail, IP em qualquer commit: `git log -p` com busca por padrão; o gate só olha a árvore atual e as mensagens). Como cada segredo chega ao Worker; o que `/saude` expõe; o que a página `/` expõe.
2. **Adaptador do modelo:** `src/modelo.ts` (final): o que vai para o log, o que acontece com erro do provedor, se algum texto do provedor ou do hóspede vaza em log ou em resposta de erro, uso da chave.
3. **Cliente do catálogo:** `src/catalogo.ts` e `src/agente/ferramentas/catalogo.ts`: todo parâmetro que sai para a API externa vem de onde? O modelo ou o hóspede conseguem montar caminho, consulta ou host (SSRF, travessia de caminho, injeção de parâmetro)? Só GET? Tempo limite? O que entra no prompt vindo do catálogo é tratado como dado (injeção indireta por texto de ficha)?
4. **Entrada HTTP:** `src/index.ts` e as rotas: tamanho do corpo, tipos, `session_id` hostil (tamanho, caracteres, colisão entre sessões, enumeração), métodos, cabeçalhos devolvidos, mensagens de erro (vazam pilha, caminho, variável?), CORS.
5. **Página de chat:** `src/pagina.ts`: XSS (a resposta do agente e a mensagem do hóspede entram no DOM como?), CSP, dados em `localStorage`, vazamento de `session_id`.
6. **Dado pessoal:** nome e telefone do hóspede em log, em resposta de erro, em cabeçalho, no relatório de eval (`evals/lib/relatorio.mjs`), no webhook falso (`falso/**`).
7. **Abuso de custo:** o que impede uma sessão ou um cliente de gastar sem limite (turnos, tamanho de mensagem, histórico, chamadas ao modelo por turno, repetições, tokens de saída)? O que existe e o que falta, com o custo aproximado de um abuso simples.
8. **Webhook falso** (`falso/**`): exposto publicamente em `dev`; o que alguém de fora consegue ler ou escrever nele; mistura de dados entre segmentos.
9. **Injeção de instrução:** leia `src/agente/prompt.ts` e o laço como desenho: o que o código garante mesmo se o modelo obedecer ao hóspede (preço calculado por código, lead só com confirmação, handoff), e o que depende só do modelo.

## Entrega
Relatório em `<rascunho>/m2-seguranca-1.md`. Abre com o commit revisado e a contagem por severidade. Cada achado: severidade (CRÍTICO, ALTO, MÉDIO, BAIXO), `arquivo:linha`, o cenário de ataque passo a passo, o impacto, a evidência (trecho ou comando que você rodou, sem valor de segredo) e a correção sugerida em uma frase. Diga explicitamente o que conferiu e está certo (lista curta) e o que não conseguiu verificar. Não invente achado para encher: se uma área está limpa, diga. Regra do dono do produto para o que bloqueia: só defeito determinístico ou que gere lead errado ou vazamento; o resto vira limite conhecido documentado. Sua última mensagem: resumo de até 20 linhas. Confirme que não alterou nada no repositório e não deixou processo rodando.
````

## 2. M2 parcial — revisão de código (módulos estáveis)

13/11 23h21 · claude-opus-5-5 · esforço high

````text
Você é o REVISOR DE CÓDIGO da revisão M2 (primeira passada) do projeto agente-concierge. Responda em português do Brasil. Você não corrige nada: acha defeito de comportamento, prova e classifica. Não crie subagentes. Não edite nenhum arquivo do repositório, não faça commit, não troque de branch.

## Contexto
- Repositório: `<worktree da coordenação>`, na `main` atual. Leia `CLAUDE.md` e `AGENTS.md` da raiz antes de tudo (sigilo: nunca imprima valor de variável de ambiente, nunca abra `~/.config/agente-concierge/`; nenhuma chamada de rede; nenhum servidor local).
- O produto: agente de chat para hóspedes de imóveis de temporada. Worker da Cloudflare em TypeScript, um Durable Object por sessão, laço de ferramentas próprio; o código calcula preço e decide envio de lead, o modelo só conversa. Requisitos: `docs/CONTRATO.md` (regra de preço na seção 3; lacunas decididas na seção 10) e `DECISOES.md`.
- Esta é a primeira de duas passadas. Agora você revisa só os módulos ESTÁVEIS, que nenhuma frente em andamento altera. O resto (`src/lead.ts`, `src/agente/ferramentas/lead.ts`, `src/agente/loop.ts`, `src/agente/prompt.ts`, `src/agente/ferramentas/handoff.ts`, `src/sessao.ts`, `src/chat.ts`, `src/index.ts`, `evals/lib/juiz-preco.mjs`) fica para a segunda passada: não revise.

## Escopo
1. `src/nucleo/dinheiro.ts`, `src/nucleo/preco.ts`: cálculo em centavos inteiros, a regra da seção 3 do contrato (diária, noite que começa em sexta ou sábado com acréscimo, taxa de limpeza uma vez), arredondamento, formatação em reais, entradas de borda.
2. `src/nucleo/datas.ts`: interpretação de datas ditas pelo hóspede, data civil em São Paulo, "hoje" e "amanhã", viradas de mês e de ano, ano bissexto, formatos aceitos e recusados, saída antes da entrada, mesmo dia. (Há uma função `dataComDia` que entra por outra frente; se não existir na `main`, ignore.)
3. `src/nucleo/telefone.ts`, `src/nucleo/idioma.ts`: normalização e validação de telefone brasileiro, detecção de idioma português ou inglês.
4. `src/agente/ferramentas/cotacao.ts`, `src/agente/ferramentas/pedido.ts`: como os argumentos do modelo viram uma cotação; o que acontece com argumento ausente, de tipo errado, negativo, enorme; capacidade do imóvel. (Outra frente mexe em trechos destes dois arquivos: marque cada achado aqui como "a reconferir no delta".)
5. `src/catalogo.ts`: tratamento de erro e de resposta inesperada do catálogo (formato, campos ausentes, tempo limite), cache se houver.
6. `src/pagina.ts`: comportamento da página de chat (estados de carregando, erro, envio duplo, sessão), sem entrar em estilo.
7. `falso/**`: o webhook falso usado em `dev` e nos evals (modos de falha por telefone, validade, isolamento por segmento, o que ele responde).
8. `evals/rodar.mjs`, `evals/lib/relatorio.mjs`, `evals/simulador/**`: o runner mede o que diz medir? Procure caso que passa sem conferir nada, erro engolido que vira "passou", contagem de bloco errada, limiar errado, p95 calculado errado, corrida entre casos em paralelo, mascaramento de dado pessoal no relatório. NÃO revise `evals/lib/juiz-preco.mjs` (está em correção).
9. `scripts/verificar-sigilo.sh`: o gate faz o que promete? O que ele deixa passar?

## Como
- Leia o código e os testes de cada módulo (`test/**`). Para cada suspeita, escreva uma sonda pequena numa pasta sua, `<rascunho>/m2-codigo-sondas/`, e rode. Para vitest, crie uma worktree descartável sua (`git -C <repositório> worktree add --detach <pasta-no-seu-scratchpad> main`, `ln -s <repositório>/node_modules node_modules`), copie a sonda para `test/` dela e rode SEMPRE pela trava: `~/.cache/agente-concierge/com-trava.sh npx vitest run test/<arquivo> --maxWorkers=3`. Nunca `--root`. Remova a worktree no fim.
- Achado sem sonda que falha é hipótese: marque como tal.
- Não reporte estilo, nome de variável, falta de comentário nem refatoração. Só comportamento errado, risco real ou teste que não testa.

## Entrega
Relatório em `<rascunho>/m2-codigo-1.md`. Abre com o commit revisado e a contagem por severidade. Cada achado: severidade (CRÍTICO, ALTO, MÉDIO, BAIXO), `arquivo:linha`, a entrada exata, o que saiu, o que deveria sair (com a regra do contrato), a sonda que prova e a correção sugerida em uma frase. Diga o que conferiu e está certo (lista curta por módulo) e o que não conseguiu verificar. Regra do dono do produto para o que bloqueia: só defeito determinístico ou que gere lead ou preço errado; o resto vira limite conhecido documentado. Sua última mensagem: resumo de até 20 linhas. Só mande a mensagem final quando todo trabalho em segundo plano tiver terminado. Confirme que removeu a worktree descartável, não alterou nada no repositório e não deixou processo rodando.
````

## 3. M2 parcial — segunda opinião do Gemini sobre o cálculo

13/11 23h21 · gemini-4-argon

````text
Você é um revisor independente, de outro fornecedor de modelo, chamado para dar uma SEGUNDA OPINIÃO sobre o cálculo de preço de um agente de chat para hóspedes de imóveis de temporada. Responda em português do Brasil. Você não corrige nada e não escreve em arquivo nenhum do repositório: sua entrega é só a sua mensagem final. Não crie subagentes, não faça commit, não troque de branch, não suba servidor, não faça chamada de rede.

## O que ler (nesta pasta, que é uma cópia do repositório)
1. `CLAUDE.md` e `AGENTS.md` da raiz (regras do projeto; as de sigilo valem para você: nunca abra `~/.config/agente-concierge/`, nunca imprima variável de ambiente).
2. `docs/CONTRATO.md`, seção 3 (a regra de preço e o exemplo com total de R$ 2.156,00) e, na seção 10, as lacunas que tratam de datas, hóspedes e capacidade.
3. O código do produto que calcula: `src/nucleo/dinheiro.ts`, `src/nucleo/preco.ts`, `src/nucleo/datas.ts`, `src/agente/ferramentas/cotacao.ts`, `src/agente/ferramentas/pedido.ts`, e os testes em `test/nucleo/`.
4. A segunda implementação da mesma regra, escrita por outra pessoa para os evals, que NÃO pode compartilhar código com a primeira: `evals/lib/juiz-preco.mjs` (só a parte que calcula a estadia esperada) e `evals/lib/tarifas.json`.

## O que eu quero saber
1. A regra da seção 3 do contrato está implementada exatamente? Procure erro de uma noite a mais ou a menos, noite de sexta e de sábado (a noite que COMEÇA nesses dias), acréscimo aplicado sobre a base certa, taxa de limpeza somada uma vez, arredondamento para centavos (em que passo, para que lado), estadia longa atravessando várias semanas, virada de mês e de ano, ano bissexto, fuso (a data é civil, em São Paulo), entrada no mesmo dia da saída, saída antes da entrada, datas no passado.
2. As duas implementações (produto e juiz dos evals) discordam em algum caso? Monte entradas e compare. Uma discordância é achado, mesmo que você não saiba qual lado está certo: diga qual segue o contrato.
3. Há valor em ponto flutuante em algum passo que possa errar um centavo? Mostre com os valores reais de `evals/lib/tarifas.json` (por exemplo diárias com centavos multiplicadas pelo acréscimo).
4. A formatação do valor para o hóspede (reais, separador de milhar, centavos) pode sair errada para algum valor?
5. O que os testes de `test/nucleo/` NÃO cobrem e deveria estar coberto?

## Como provar
Você pode rodar código só de leitura: pequenos scripts em Node (salve em `/tmp`, não nesta pasta) que importam os módulos e imprimem resultados. Se rodar a suíte de testes, use só `~/.cache/agente-concierge/com-trava.sh npx vitest run test/nucleo --maxWorkers=3` (depois de `ln -s <worktree da coordenação>/node_modules node_modules`, se a pasta não tiver `node_modules`; remova o link no fim). Nunca `--root`.

## Entrega: a sua mensagem final, em Markdown
- Primeira linha: `SEGUNDA OPINIÃO — cálculo de preço — <concordo | discordo em N pontos>`.
- Depois, cada achado: gravidade (ALTO: preço errado mostrado ou enviado; MÉDIO; BAIXO), `arquivo:linha`, a entrada exata (imóvel, datas, hóspedes), o que saiu, o que deveria sair pela regra do contrato e como você provou (comando e saída). Achado que você não rodou vem marcado como hipótese.
- Uma tabela com pelo menos 12 estadias que você calculou à mão, o resultado do produto e o do juiz.
- O que você conferiu e está certo; o que não conseguiu verificar.
Não escreva o relatório em arquivo. Não cite nome de empresa, endereço de serviço nem credencial.
````

## 4. M2 segunda passada — revisão de segurança do delta (main atual)

14/11 01h34 · claude-opus-5-5 · esforço high

````text
Você é o REVISOR DE SEGURANÇA da segunda passada da revisão final (M2) do repositório `agente-concierge`: um agente de chat para hóspedes de imóveis de temporada, Worker da Cloudflare em TypeScript com um Durable Object por sessão, que cota estadias por código, registra lead depois de confirmação e passa para humano. Responda em português do Brasil. Prazo-alvo: 40 minutos. Grave os achados no relatório assim que os tiver.

## Escopo: só o delta desde a primeira passada
- A primeira passada cobriu a `main` no commit `c6764a0`. Leia o resultado dela em `docs/revisoes/m2.md` (tabela de achados e a seção "Segunda passada").
- Reveja com olhar de ataque o que mudou em `src/` de `c6764a0` até `origin/main` (anote o hash que usou): `git diff c6764a0 origin/main -- src`. Entraram, cada uma já com verificador independente de comportamento: a frente G (matriz de handoff por código, conferência da resposta, trava de valores, pergunta fechada antes de rearmar o resumo, chamada focada), o complemento da frente F e a regra do nome do lead (P20), a frente T (datas sem ano, P21), o delta da frente I (log e gateway). Leia as decisões P17 a P28 e X24 no `DECISOES.md` antes.
- Fora do escopo desta tarefa: a frente H (fila da sessão, limite de corpo, P24) ainda não entrou; o juiz dos evals; os scripts `scripts/validar-producao.sh` e `scripts/verificar-sigilo.sh` (já têm verificador próprio). Não revise comportamento funcional que não seja de segurança.

## O que procurar (em ordem de prioridade)
1. **Achado 2 da primeira passada está fechado?** A trava "nenhum valor que não saiu do código" aceitava um valor em reais escrito pelo modelo junto com uma chamada de ferramenta, e um valor dentro do nome do hóspede no resumo. Tente de novo os dois cenários e variações (valor em outro campo de texto que vai ao resumo; valor em outro formato; valor que o hóspede dita e o modelo repete; valor no nome agora que a P20 só aceita palavras do hóspede: "Ana R$ 10,00").
2. **Injeção pela mensagem do hóspede nos pontos novos:** a pergunta fechada da G recebe a mensagem crua do hóspede; a chamada focada; os textos de recusa das ferramentas que voltam ao modelo (P20 devolve ao modelo as palavras "que o hóspede não escreveu": dá para o hóspede fazer o modelo receber instrução por esse caminho?). O que o atacante consegue no máximo: manter o próprio resumo? enviar lead sem confirmação? fazer o agente afirmar desconto, disponibilidade ou regra falsa? tirar o prompt de sistema?
3. **Lead errado ou sem confirmação por caminho novo:** qualquer sequência de mensagens de um hóspede hostil que leve a um POST de lead sem a confirmação do resumo mostrado, ou com dado diferente do resumo confirmado, usando as regras novas (P18, P19, P20, P21).
4. **Abuso de custo novo:** a G pode fazer até 13 chamadas ao modelo por turno (26 com o reserva) dentro do prazo de 45 s. Uma mensagem barata do hóspede força o pior caso sempre? Quanto custa por pedido, em chamadas, e existe teto por sessão? Compare com o achado 1 da primeira passada (sem limite por cliente) e diga se piorou.
5. **Dado pessoal em log e em erro:** o delta da I diz que até 4 dígitos de dado ecoado podem chegar ao log de falha. Confirme o teto e procure outro caminho novo em que nome, telefone ou mensagem do hóspede vá para `console`, para o texto de um erro devolvido ao cliente ou para o gateway de `producao` (que está com o log desligado; confira pela configuração versionada, sem rede).
6. **Vazamento entre sessões e dados da ficha:** algum estado novo em módulo (variável global, cache) que carregue dado de uma sessão para outra? Instrução vinda da ficha do catálogo continua tratada como dado?

## Como trabalhar
- Leitura do código e sondas suas numa cópia descartável: `git worktree add --detach <pasta> origin/main` em `<rascunho>/m2-seg2/`, com `node_modules` por link simbólico para o do checkout em que você nasceu. Sondas como testes do vitest com modelo falso roteirizado, copiadas para `test/zz-*` só para rodar e retiradas depois. No fim, remova a worktree.
- Regras duras: nenhuma rede, nenhum modelo real, nenhuma requisição a `producao`, a `dev` nem ao webhook; não abra `~/.config/agente-concierge/` nem o conjunto reservado; não edite, não faça commit, não faça push, não crie branch nem arquivo no checkout em que você nasceu; toda suíte ou `tsc` por `~/.cache/agente-concierge/com-trava.sh <comando>` com `--maxWorkers=3`; sem subagentes; sem servidor local.
- Sigilo: no relatório e nas sondas, nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail.

## Entrega
- Relatório em `<rascunho>/m2-seguranca-2.md`: primeiro uma tabela de achados (id, gravidade crítica/alta/média/baixa, onde com arquivo e linha, cenário de ataque em uma frase, o que o atacante ganha, prova: sonda rodada ou só leitura, correção sugerida); depois, para cada um dos seis itens acima, o que você testou e o resultado; depois o que NÃO verificou.
- Classifique com rigor: crítico ou alto só com cenário reproduzido por sonda, que gere lead errado, lead sem confirmação, vazamento de dado de outra sessão ou de segredo, ou custo sem teto por pedido. Hipótese sem sonda é no máximo média e vem marcada "só leitura".
- Mensagem final curta: quantos achados por gravidade, uma linha para cada crítico, alto e médio, e o caminho do relatório.
````

## 5. M2 segunda passada, parte 2: frente H na main (6daffb1), itens 7, 8, 13, 15 e runner da B2 (bd6e28b)

14/11 01h58 · claude-opus-5-5 · esforço high

````text
Você é o REVISOR da segunda passada da revisão final (M2), parte 2, do repositório `agente-concierge` (agente de chat para hóspedes de imóveis de temporada; Worker em TypeScript na Cloudflare, um Durable Object por sessão). Responda em português do Brasil. Você revisa com olhar de ataque e de defeito determinístico; não corrige nada. Prazo-alvo: 35 minutos. Grave o relatório assim que tiver os achados; não espere fechar tudo para escrever.

## Leia antes
- `docs/revisoes/m2.md` na `main` (primeira passada e "Segurança do delta"). Esta parte 2 cobre o que lá está como "Falta nesta passada".
- `docs/CONTRATO.md` (requisitos) e, em `DECISOES.md`, as linhas P11 a P30 e L18, L22 (só o que precisar).
- Relatório do verificador da frente H, rodada 5, para não repetir o que já foi provado: `<rascunho>/ver-h6-relatorio.md` (as sondas dele estão em `ver-h6-sondas/`, mesma pasta; reaproveite).

## Escopo (use os hashes)
**A. Frente H, já na `main` em `6daffb1`.** O delta é `git diff c6764a0..6daffb1 -- src/sessao.ts src/chat.ts src/index.ts`. O que entrou: fila por sessão (uma mensagem por vez), identificador por pedido para a retentativa do Worker, pedido abandonado na fila não roda depois e a cópia repetida devolve a mesma contingência, "sim" na fila não confirma resumo não visto, resposta do Worker fora do turno (P24), teto de 64 KB no corpo e de 8.000 caracteres na mensagem, tabela `pedidos` podada a 20, log `falha_no_chat` com origem e classe. Perguntas que você precisa responder com prova (leitura com `arquivo:linha` ou sonda com modelo falso):
1. O identificador do pedido vem de onde? Um cliente consegue escolher, repetir ou adivinhar o identificador de outro pedido ou de outra sessão e receber a resposta gravada de outra pessoa, ou fazer um pedido novo ser tratado como cópia?
2. A fila tem teto? Um cliente que manda N mensagens para a mesma sessão segura memória, tempo de CPU ou chamadas ao modelo sem limite? Quantas chamadas ao modelo um cliente consegue disparar com uma rajada numa sessão, e o que acontece com o prazo de 45 s?
3. O teto de 64 KB é aplicado antes de ler e interpretar o corpo inteiro? Corpo sem `content-length`, com `content-length` mentiroso ou em fluxo lento: o que acontece?
4. Algum caminho novo gera lead sem o hóspede ter visto o resumo, lead duplicado, ou lead diferente do resumo mostrado? (O verificador já provou a barra dele; procure o que ele NÃO cobriu: ele listou "ordem aviso antes da cópia" e "cópia em curso + cópia na fila" como não medidos. Meça esses dois.)
5. O log `falha_no_chat` e as linhas de `pedidos` guardam dado pessoal (nome, telefone, texto da mensagem)? Por quanto tempo? Confronte com a L22.
6. A resposta de contingência ou de erro vaza detalhe interno (pilha, nome de classe, endereço)?
7. Há estado de módulo (fora do objeto) que leve dado de uma sessão para outra?

**B. Itens 13 e 15 da primeira passada, na `main` `6daffb1`.** (13) `cotar()` e `diasEntre()` aceitam data ISO inexistente por transbordo: confirme que continua inalcançável pela ferramenta depois das frentes T e G, com sonda. (15) Hóspedes passado pelo modelo como texto não numérico vira "não informado": confirme o que acontece e que nenhum lead sai com número de hóspedes errado por causa disso.

**C. Runner e juiz da frente B2, no hash `bd6e28b` (ainda fora da `main`).** Só o olhar de segurança e os itens 7, 8 e 14 da primeira passada; a correção do juiz já tem verificador próprio, não a refaça.
- Item 7: a trava de `producao` do runner dependia de campos declarados no caso. Em `bd6e28b`, um caso que confirma lead consegue rodar contra um alvo de `producao`? Prove com o autoteste (`node evals/teste-do-runner.mjs --trava`) e com um caso seu, contra servidor falso em `127.0.0.1`.
- Item 8: `leads_ate_agora` dentro de turno em paralelo. Fechado ou limite?
- Item 14: o juiz valida hóspedes zero, negativo ou fracionário?
- O relatório de eval versionável guarda resposta do agente, nome ou telefone? `--so-agregado` no conjunto reservado vaza enunciado de caso?

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede. Servidores falsos só em `127.0.0.1`, portas 8788 a 8792, conferindo com `ss -ltn` antes e derrubando no fim.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópias de trabalho: `git worktree add --detach <pasta> <hash>` dentro de `<rascunho>/`, pastas `m2p2-main` (6daffb1) e `m2p2-b2` (bd6e28b). No fim, remova. Não edite, não faça commit (nem local), não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules` por link simbólico para o do checkout em que você nasceu se o `package.json` não mudou.
- Carga: suíte e `tsc` só por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3`; prefira rodar só os arquivos de teste das suas sondas. Sem subagentes.
- Sigilo: nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail no relatório e nas sondas.

## Severidade e critério
Classifique cada achado em crítica, alta, média ou baixa, e diga em colunas separadas: é determinístico? gera lead errado (sem confirmação, duplicado ou diferente do resumo)? Só o que é determinístico ou gera lead errado bloqueia; o resto vira limite conhecido no README. Não infle: achado sem prova (linha ou sonda) vai numa lista à parte, "hipóteses sem prova".

## Entrega
- Relatório em `<rascunho>/m2-parte2.md`: primeira linha `CRÍTICOS: n | ALTOS: n | MÉDIOS: n | BAIXOS: n`; depois a tabela de achados (id, achado, onde, severidade, determinístico, gera lead errado, prova, destino sugerido); as respostas às perguntas A1 a A7, B e C, uma por uma; "o que dei como fechado"; "hipóteses sem prova"; "o que não verifiquei".
- Sondas em `m2p2-sondas/` na mesma pasta.
- Mensagem final curta: a primeira linha do relatório, os achados médios para cima em uma linha cada, e o caminho do relatório.
````
