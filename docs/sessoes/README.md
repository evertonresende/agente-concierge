# Sessões de trabalho exportadas

As 12 sessões de trabalho desta entrega, uma por arquivo: as duas de planejamento, a de coordenação e as 9 sessões de frente. Entram no repositório por decisão do Éverton de 14/11 (X40 em [`DECISOES.md`](../../DECISOES.md)), que substituiu a parte 2 da X33.

## Antes de ler

- **Ninguém leu estes arquivos inteiros, linha por linha.** O que há é checagem automática, descrita no fim desta página. Ela procura o que não pode aparecer; não garante que o texto esteja certo nem completo.
- **Nas sessões das frentes, quem escreve como usuário é a coordenação**, que é outro agente, e não o Éverton. O título de cada mensagem diz quem escreveu: `Usuário (coordenação)` é a sessão coordenadora; `Usuário`, sem mais nada, é mensagem que não veio da coordenação (1 nas sessões de frente).
- Na sessão de coordenação há 47 mensagens do usuário. A coordenação tratou todas como ordem do Éverton.
- **Sem data e hora.** Nenhum título de mensagem e nenhum cabeçalho de arquivo traz carimbo de data ou de hora. O texto das mensagens não foi mudado por causa disso: hora escrita dentro de uma mensagem continua lá.
- **A sessão de coordenação vai até a mensagem anterior ao pedido de exportar as sessões.**
- Os arquivos foram gerados de uma vez, do registro de conversas da ferramenta de orquestração, por um script que fica fora do repositório.

## Sessões

| Arquivo | Sessão | Aberta por | Mensagens de usuário | Respostas do agente | Sessões que abriu |
|---|---|---|---|---|---|
| [`01-planejar-entrega-do-desafio-tecnico.md`](01-planejar-entrega-do-desafio-tecnico.md) | Planejar entrega do desafio técnico | Éverton, na interface | 4 | 4 | 0 |
| [`02-planejamento-do-agente-concierge.md`](02-planejamento-do-agente-concierge.md) | Planejamento do agente concierge | Éverton, na interface | 2 | 11 | 8 |
| [`03-coordinate-concierge-challenge-delivery.md`](03-coordinate-concierge-challenge-delivery.md) | Coordinate Concierge Challenge Delivery | Éverton, na interface | 47 | 476 | 95 |
| [`04-frente-a-esqueleto-ate-o-marco-1.md`](04-frente-a-esqueleto-ate-o-marco-1.md) | Frente A — esqueleto até o Marco 1 | Coordinate Concierge Challenge Delivery | 4 | 22 | 1 |
| [`05-frente-b2-harness-e-casos-dev.md`](05-frente-b2-harness-e-casos-dev.md) | Frente B2 — harness e casos dev | Coordinate Concierge Challenge Delivery | 41 | 230 | 0 |
| [`06-frente-c-conjunto-reservado.md`](06-frente-c-conjunto-reservado.md) | Frente C — conjunto reservado | Coordinate Concierge Challenge Delivery | 4 | 13 | 0 |
| [`07-frente-d-simulador-de-hospede-hostil.md`](07-frente-d-simulador-de-hospede-hostil.md) | Frente D — simulador de hóspede hostil | Coordinate Concierge Challenge Delivery | 4 | 4 | 0 |
| [`08-frente-j-pagina-de-chat-design.md`](08-frente-j-pagina-de-chat-design.md) | Frente J — página de chat (design) | Coordinate Concierge Challenge Delivery | 3 | 17 | 3 |
| [`09-frente-f-lead-robusto.md`](09-frente-f-lead-robusto.md) | Frente F — lead robusto | Coordinate Concierge Challenge Delivery | 35 | 203 | 1 |
| [`10-frente-g-robustez-e-handoff.md`](10-frente-g-robustez-e-handoff.md) | Frente G — robustez e handoff | Coordinate Concierge Challenge Delivery | 41 | 221 | 1 |
| [`11-frente-k-producao-infraestrutura-envio-real-desl.md`](11-frente-k-producao-infraestrutura-envio-real-desl.md) | Frente K — produção (infraestrutura, envio real desligado) | Coordinate Concierge Challenge Delivery | 22 | 92 | 0 |
| [`12-frente-n-entregaveis-de-processo-rascunhos.md`](12-frente-n-entregaveis-de-processo-rascunhos.md) | Frente N — entregáveis de processo (rascunhos) | Coordinate Concierge Challenge Delivery | 37 | 139 | 0 |

Sessão que não pôde sair: nenhuma.

## Árvore

O projeto teve 112 sessões no registro. As 12 com arquivo têm link. As outras 100 são sub-sessões delegadas e subagentes (verificadores, revisões e as frentes que rodaram como sub-sessão da coordenação): aparecem só pelo nome, aqui e no ponto da conversa em que foram abertas. O texto delas não foi exportado.

- [Planejar entrega do desafio técnico](01-planejar-entrega-do-desafio-tecnico.md)
- [Planejamento do agente concierge](02-planejamento-do-agente-concierge.md)
  - Verificar concorrência em Durable Objects (subagente, sem arquivo)
  - Modelos com tool calling CF (subagente, sem arquivo)
  - Limites plano CF 7 dias (subagente, sem arquivo)
  - Wrangler ambientes e secrets (subagente, sem arquivo)
  - Explorar catálogo real GET (subagente, sem arquivo)
  - Salvar prompt de planejamento (subagente, sem arquivo)
  - Escrever plano de evals e desenhos (subagente, sem arquivo)
  - Escrever docs/VERIFICACOES.md (subagente, sem arquivo)
- [Coordinate Concierge Challenge Delivery](03-coordinate-concierge-challenge-delivery.md)
  - Frente B1 — webhook falso (sub-sessão delegada, sem arquivo)
  - [Frente A — esqueleto até o Marco 1](04-frente-a-esqueleto-ate-o-marco-1.md)
    - Revisão de código frente A (subagente, sem arquivo)
  - [Frente B2 — harness e casos dev](05-frente-b2-harness-e-casos-dev.md)
  - [Frente C — conjunto reservado](06-frente-c-conjunto-reservado.md)
  - [Frente D — simulador de hóspede hostil](07-frente-d-simulador-de-hospede-hostil.md)
  - Verificar frente B1 (subagente, sem arquivo)
  - Reverificar frente B1 (subagente, sem arquivo)
  - Verificar runner da B2 (subagente, sem arquivo)
  - Verificar casos dev da B2 (subagente, sem arquivo)
  - [Frente J — página de chat (design)](08-frente-j-pagina-de-chat-design.md)
    - Revisão de design do canvas (subagente, sem arquivo)
    - Revisão da página contra o canvas (subagente, sem arquivo)
    - Revisão de código da página (subagente, sem arquivo)
  - Verificar frente D (subagente, sem arquivo)
  - Verificar frente A e M1 (subagente, sem arquivo)
  - Reverificar B2 (recorte) (subagente, sem arquivo)
  - [Frente F — lead robusto](09-frente-f-lead-robusto.md)
    - Revisão do diff da frente F (subagente, sem arquivo)
  - [Frente G — robustez e handoff](10-frente-g-robustez-e-handoff.md)
    - Revisão de código frente G (subagente, sem arquivo)
  - Frente E — datas (sub-sessão delegada, sem arquivo)
  - Frente H — concorrência e falha interna (sub-sessão delegada, sem arquivo)
  - Frente I — escolha do modelo (sub-sessão delegada, sem arquivo)
  - Verificar frente H (sessão) (subagente, sem arquivo)
  - Verificar frente F (lead) (subagente, sem arquivo)
  - Verificar frente H — rodada 2 (sub-sessão delegada, sem arquivo)
  - Verificar frente G — robustez e handoff (sub-sessão delegada, sem arquivo)
  - Verificar frente F — rodada 2 (sub-sessão delegada, sem arquivo)
  - Verificar frente I — adaptador do modelo (sub-sessão delegada, sem arquivo)
  - Verificar frente F — rodada 3 (sub-sessão delegada, sem arquivo)
  - Verificar frente G — rodada 2 (sub-sessão delegada, sem arquivo)
  - Verificar frente I — rodada 2 (adaptador do modelo) (sub-sessão delegada, sem arquivo)
  - Verificar frente B2 — juiz de preço e expressões (Haiku) (sub-sessão delegada, sem arquivo)
  - Verificar frente F — rodada 4 (sub-sessão delegada, sem arquivo)
  - Verificar frente I — rodada 3 (delta do adaptador) (sub-sessão delegada, sem arquivo)
  - Verificar frente F — rodada 5 (delta) (sub-sessão delegada, sem arquivo)
  - [Frente K — produção (infraestrutura, envio real desligado)](11-frente-k-producao-infraestrutura-envio-real-desl.md)
  - [Frente N — entregáveis de processo (rascunhos)](12-frente-n-entregaveis-de-processo-rascunhos.md)
  - Frente L — custo por conversa (sub-sessão delegada, sem arquivo)
  - M2 parcial — revisão de segurança (main atual) (sub-sessão delegada, sem arquivo)
  - M2 parcial — revisão de código (módulos estáveis) (sub-sessão delegada, sem arquivo)
  - M2 parcial — segunda opinião do Gemini sobre o cálculo (sub-sessão delegada, sem arquivo)
  - Verificar frente L — script de custo (sub-sessão delegada, sem arquivo)
  - Verificar frente K — script de validação de producao (sub-sessão delegada, sem arquivo)
  - Verificar frente I — rodada 4 (delta do log e gateway de producao) (sub-sessão delegada, sem arquivo)
  - Verificar frente N — sigilo e fatos dos rascunhos (sub-sessão delegada, sem arquivo)
  - Verificar frente F — rodada 6 (delta do C10 e C11) (sub-sessão delegada, sem arquivo)
  - Frente S — gate de sigilo (achados da M2) (sub-sessão delegada, sem arquivo)
  - Verificar frente G — rodada 3 (sub-sessão delegada, sem arquivo)
  - Verificar frente H — rodada 3 (sub-sessão delegada, sem arquivo)
  - Verificar frente K — rodada 2 (delta do script de producao) (sub-sessão delegada, sem arquivo)
  - Verificar frente S — gate de sigilo (sub-sessão delegada, sem arquivo)
  - Verificar frente B2 — rodada 2 (juiz e runner) (sub-sessão delegada, sem arquivo)
  - Frente T — datas sem ano (P21) (sub-sessão delegada, sem arquivo)
  - Verificar frente T — datas sem ano (P21) (sub-sessão delegada, sem arquivo)
  - Verificador K3: delta do script de producao (sub-sessão delegada, sem arquivo)
  - Verificar frente H — rodada 4 (delta da fila: B1 e B2) (sub-sessão delegada, sem arquivo)
  - Verificar frente S — rodada 2 (delta do gate de sigilo) (sub-sessão delegada, sem arquivo)
  - Verificar frente F — rodada 7 (delta da P20: nome do lead) (sub-sessão delegada, sem arquivo)
  - Verificar frente H — P24 e testes do nome (delta 03e1605..a4abacb) (sub-sessão delegada, sem arquivo)
  - Verificar frente B2 — rodada 3 (delta do juiz, barra fechada) (sub-sessão delegada, sem arquivo)
  - M2 segunda passada — revisão de segurança do delta (main atual) (sub-sessão delegada, sem arquivo)
  - Verificar frente H — rodada 5 (B6 e regressão, cabeça 38ae72f) (sub-sessão delegada, sem arquivo)
  - Verificar frente B2 — rodada 4 (três correções do juiz, f4ee189..bd6e... (sub-sessão delegada, sem arquivo)
  - M2 segunda passada, parte 2: frente H na main (6daffb1), itens 7, 8, ... (sub-sessão delegada, sem arquivo)
  - Verificar frente F — rodada 8 (delta: "sim" limpo e P29, cabeça 248f479) (sub-sessão delegada, sem arquivo)
  - Verificar frente G — rodada 4 (delta da P30: teto de chamadas de ferr... (sub-sessão delegada, sem arquivo)
  - Verificar frente B2 — rodada 5, a última (rótulo com parêntese, vírgu... (sub-sessão delegada, sem arquivo)
  - Verificar frente G — rodada 5 (delta do R1: invalidador cortado segur... (sub-sessão delegada, sem arquivo)
  - Papel da frente C — diagnóstico do conjunto reservado (sub-sessão delegada, sem arquivo)
  - Verificador B2 — rodada 6 (juiz: cabeçalho elíptico e inv-07) (sub-sessão delegada, sem arquivo)
  - Papel da frente C — segundo revisor do reservado (veto) (sub-sessão delegada, sem arquivo)
  - Verificador F — rodada 9 (P35: formas de confirmação) (sub-sessão delegada, sem arquivo)
  - Verificador final N — entregáveis de processo (sub-sessão delegada, sem arquivo)
  - Verificador final N — rodada 2 (correções e delta, cabeça f015880) (sub-sessão delegada, sem arquivo)
  - Verificador final N — rodada 3 (cabeça e096681 da frente-n-textos) (sub-sessão delegada, sem arquivo)
  - Papel da frente C — cópia do conjunto reservado para o repositório (e... (sub-sessão delegada, sem arquivo)
  - Auditoria · reconhecimento 1a (produto, stack, operação local) (sub-sessão delegada, sem arquivo)
  - Auditoria · reconhecimento 1b (principais, autoridade, controles) (sub-sessão delegada, sem arquivo)
  - Auditoria · reconhecimento 1c (entradas, cópias, destinos) (sub-sessão delegada, sem arquivo)
  - Auditoria · reconhecimento 1d (execução local e implantação) (sub-sessão delegada, sem arquivo)
  - Auditoria · caçador h1 (chat e sessão) (sub-sessão delegada, sem arquivo)
  - Auditoria · caçador h2 (ferramentas e lead) (sub-sessão delegada, sem arquivo)
  - Auditoria · caçador h3 (contexto e saída) (sub-sessão delegada, sem arquivo)
  - Auditoria · caçador h4 (saídas e webhook falso) (sub-sessão delegada, sem arquivo)
  - Auditoria · caçador h5 (configuração e segredos) (sub-sessão delegada, sem arquivo)
  - Auditoria · caçador h6 (óbvio, curinga, encadeado) (sub-sessão delegada, sem arquivo)
  - Frente V — correções de segurança (página, catálogo, nome de ferramenta) (sub-sessão delegada, sem arquivo)
  - Auditoria · verificador v01 (sub-sessão delegada, sem arquivo)
  - Auditoria · verificador v02 (sub-sessão delegada, sem arquivo)
  - Verificador V1 — cabeçalhos da página e leitura do catálogo (cabeça 8... (sub-sessão delegada, sem arquivo)
  - Verificador V2 — nome de ferramenta, texto do catálogo e preview_urls... (sub-sessão delegada, sem arquivo)
  - Auditoria · crítico de cobertura final (sub-sessão delegada, sem arquivo)
  - Auditoria · verificador v03 (sub-sessão delegada, sem arquivo)
  - Verificador V3 — política da página com o que a borda insere (cabeça ... (sub-sessão delegada, sem arquivo)
  - Frente V2 — ajustes dos verificadores (testes do catálogo e corte do ... (sub-sessão delegada, sem arquivo)
  - Verificador V5 — confirmação recusa entrada que já passou (commit loc... (sub-sessão delegada, sem arquivo)
  - Verificador V4 — ajustes dos verificadores (delta 413d619..36e31cb) (sub-sessão delegada, sem arquivo)
  - Verificador V6 — os cinco 3xx conferem redirect manual (commit 905a42d) (sub-sessão delegada, sem arquivo)
  - Verificador V7 — entrada passada no nível do turno (commit local 2bbb... (sub-sessão delegada, sem arquivo)

## O que entrou

- O texto das mensagens de usuário e o texto das respostas do agente, na ordem em que aconteceram.
- No cabeçalho de cada arquivo: quem abriu a sessão e quais sessões ela abriu.
- No corpo, uma linha com o nome no ponto em que uma sub-sessão ou um subagente foi aberto, e outra no ponto em que o retorno dela chegou.

## O que ficou de fora

- Chamada e resultado de ferramenta, raciocínio, anexo, lembrete de sistema, bloco de instrução injetado e resumo de compactação.
- Data e hora de cada mensagem.
- O texto das sub-sessões e dos subagentes, e o texto do retorno que eles devolveram à sessão que os abriu.

| O que saiu | Quantas vezes |
|---|---|
| notificação de tarefa em segundo plano | 29 |
| retorno de sessão filha (só o nome fica) | 234 |
| bloco injetado dentro de mensagem | 0 |

## Máscaras aplicadas

Cada máscara troca o trecho por um marcador entre colchetes. As contagens somam os 12 arquivos.

| O que sai | Marcador | Quantas vezes |
|---|---|---|
| endereço do catálogo e do webhook, token, nome da empresa do desafio, nome de máquina e todo valor do arquivo de ambiente | `[termo]` | 2 |
| URL, menos o perfil do autor e o endereço da ferramenta citados no rodapé dos commits | `[url]` | 255 |
| e-mail que não seja o de contato | `[e-mail]` | 0 |
| IP | `[endereço de rede]` | 3 |
| caminho local, inclusive pasta pessoal, pasta temporária e pasta de sistema | `[caminho local]` | 234 |
| nome de host com domínio | `[hostname]` | 2 |
| identificador longo (UUID ou hexadecimal de 16 caracteres ou mais) | `[id]` | 15 |
| cadeia com cara de segredo (chave com prefixo conhecido ou 24 caracteres ou mais misturando letra e número) | `[segredo]` | 2 |
| telefone | `[telefone]` | 8 |
| nome de pessoa: nome sintético dos evals, nome ao lado de telefone, frase de apresentação e campo de nome (L22) | `[nome]` | 65 |
| frase sobre circunstância pessoal do autor (a frase inteira) | `[trecho pessoal retirado]` | 5 |
| trecho igual ao enunciado do desafio (janela de 8 palavras iguais) | `[trecho do enunciado retirado]` | 0 |

As máscaras erram para o lado seguro: há trecho inofensivo trocado por marcador, como nome de arquivo dentro de um caminho e número comprido que não é telefone.

## Checagens automáticas

Rodadas sobre esta pasta, com este índice dentro, antes do commit. Todas deram zero:

- token do catálogo e qualquer valor do arquivo de ambiente, inteiro ou partido por quebra de linha;
- endereço do catálogo e do webhook, e os outros hosts do arquivo de ambiente;
- nome da empresa do desafio e nomes de máquina;
- credencial da conta de nuvem, chave com prefixo conhecido, chave privada, cabeçalho de autorização e cadeia com cara de segredo;
- janela de 8 palavras igual ao enunciado do desafio;
- IP, URL fora das duas liberadas, nome de host com domínio e e-mail que não é o de contato;
- nome sintético dos evals e campo de nome com valor;
- caminho local, com busca crua pelas pastas pessoal e temporária;
- frase de circunstância pessoal, bloco injetado e resumo de compactação;
- data ou hora em título de mensagem e em cabeçalho de arquivo.

O gate de sigilo do repositório (`scripts/verificar-sigilo.sh`) também roda sobre estes arquivos antes do commit e do push, como em todo o resto.
