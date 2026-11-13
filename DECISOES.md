# Decisões

Registro curto do que foi decidido e por quê. As decisões abaixo foram tomadas pelo
Éverton antes do planejamento. As lacunas do enunciado entram na segunda parte só
depois que ele decide cada uma; lacuna sem resposta não aparece aqui como decidida.

## Decisões fechadas antes do planejamento

### Produto

| # | Decisão | Motivo |
|---|---|---|
| 1 | Worker em TypeScript na Cloudflare, um Durable Object por `session_id`, loop de ferramentas próprio, sem framework de agente | a sessão é o estado; um objeto por sessão dá memória e ordem sem banco externo, e um loop próprio deixa cada passo visível e testável |
| 2 | Código decide, modelo conversa: preço em centavos inteiros, dia da semana, recusas, texto em reais e valor do webhook saem de código | número errado reprova na bateria automática; o que pode ser calculado não fica na mão do modelo |
| 3 | Um agente só em produção; o handoff é uma ferramenta que liga a flag | menos peças, menos latência e um único lugar para auditar a decisão de passar para humano |
| 4 | Trava de confirmação por estado: resumo num turno, confirmação em outro, envio com total recalculado; um lead por reserva; erro do webhook nunca vira "registrado" | lead antecipado ou duplicado aparece na lista que o avaliador vê e não pode ser desfeito |
| 5 | Modelo via Workers AI ou AI Gateway, escolhido por eval; confiabilidade em chamada de ferramenta vem antes de preço | o loop depende de o modelo chamar a ferramenta certa; economia de centavos não compensa conversa quebrada |
| 6 | O agente cota, mas não afirma que a data está disponível | o catálogo não informa disponibilidade; afirmar seria inventar |
| 7 | Texto vindo do catálogo é dado, nunca instrução | a descrição do imóvel é um canal de injeção fora do nosso controle |
| 8 | Uma página simples de chat faz parte da entrega | permite demonstrar e gravar o agente sem ferramenta externa |
| 9 | Data sem ano é a próxima ocorrência daquela data, e o agente repete a data completa na resposta | resolve a ambiguidade de forma previsível e deixa o hóspede corrigir antes de qualquer cotação virar lead |

### Ambientes

| # | Decisão | Motivo |
|---|---|---|
| 10 | `dev` usa um webhook falso que replica o contrato do real; `producao` usa o real | o fluxo de lead precisa ser exercitado de ponta a ponta sem tocar na lista real |
| 11 | Webhook real: nenhum POST antes da entrega, por nenhuma sessão, nem teste identificado | a lista de leads é o que o avaliador vê e não pode ser apagada |
| 12 | Fluxo completo de lead, evals com confirmação e gravação do vídeo rodam só em `dev`; contra `producao`, só conversas sem confirmação | consequência direta da decisão 11 |

### Ordem e corte

| # | Decisão | Motivo |
|---|---|---|
| 13 | Primeiro marco antes de qualquer profundidade: conversa completa em `dev` (cotação do exemplo, confirmação, lead no webhook falso, desconto virando handoff), com uma frente só de código de produto | algo funcionando de ponta a ponta cedo vale mais que partes profundas que não se encaixam |
| 14 | Casos de eval, harness e conjunto reservado começam junto com o primeiro marco | dependem só do contrato e não tocam os mesmos arquivos |
| 15 | Se o tempo apertar, cai primeiro o acabamento da página de chat e depois o monitor diário; os casos de ataque não caem antes do monitor | a bateria oculta mede robustez; a página e o monitor não são medidos por ela |

### Fábrica

| # | Decisão | Motivo |
|---|---|---|
| 16 | A sessão coordenadora não edita código de produto; cada frente trabalha em worktree separada | quem coordena precisa de contexto limpo, e frentes no mesmo diretório se sobrescrevem |
| 17 | Há revisão de código, revisão de segurança e segunda opinião de modelos de outros provedores, em pontos definidos do plano | qualidade se compra com verificação independente, não com mais geração |
| 18 | Evals em três níveis: unitários do núcleo puro, conversas multi-turno por bloco da avaliação, simulador de hóspede hostil cujas falhas viram casos fixos | cada nível pega um tipo de erro: conta, conversa e ataque |
| 19 | Conjunto de evals reservado, fora dos casos usados para corrigir; quem escreve não corrige, o resultado sai em agregado, caso corrigido migra e é substituído | sem um conjunto que ninguém otimizou, a taxa de acerto mede decoreba |
| 20 | O desenho cobre a fábrica (principal) e o agente em produção; na fábrica entra a segunda sessão de IA que o Éverton usa para revisar as entregas | o processo de construção pesa quase tanto quanto o agente |

## Lacunas do enunciado decididas pelo Éverton

Decididas em 13/11/2026, numa rodada única. A regra completa de cada uma está na seção
10 de `docs/CONTRATO.md`. Antes da rodada, dois modelos de outros provedores foram
consultados às cegas (`docs/conselho/`); a coluna "Origem" diz onde eles divergiram.
"Recomendação aceita" quer dizer que o Éverton aceitou a recomendação da sessão de
planejamento, e o motivo é o da recomendação.

| ID | Decisão | Motivo | Origem |
|---|---|---|---|
| L1 | Datas relativas aceitas, no fuso de São Paulo. Dando para determinar entrada e saída, o agente declara as datas exatas e já cota na mesma resposta; só pergunta quando falta uma das duas | motivo inferido pelo planejamento, não dito pelo Éverton: economiza um turno, e a data declarada na resposta deixa o hóspede corrigir | decisão do Éverton, no lugar da recomendação de pedir o ok antes de cotar expressões ambíguas |
| L2 | Entrada antes de hoje: recusa, explica e pede novas datas, sem handoff. Entrada hoje vale | estadia que já começou não pode ser reservada; cabe em "datas que não fazem sentido" | recomendação aceita; conselho concordou |
| L3 | `handoff: true` só na resposta em que o agente passa, e de novo a cada novo gatilho | leitura literal do contrato: a flag marca o momento em que o agente decide passar | recomendação aceita; GPT igual, Gemini queria a flag presa até o fim |
| L4 | Depois do handoff o agente continua atendendo o que está no escopo, inclusive lead sem desconto | quem desiste do desconto ainda é um lead válido; travar a sessão perderia a reserva | recomendação aceita; GPT igual, Gemini bloquearia tudo |
| L5 | Informação ausente: "não sei", `handoff: false`, oferece humano; `true` só se o hóspede pedir ou disser que precisa disso para decidir | o enunciado separa "dizer que não sabe" de "passar para humano" | recomendação aceita; Gemini igual, GPT passaria para humano |
| L6 | Telefone brasileiro vai no formato do exemplo; estrangeiro como `+dígitos`; inválido pede de novo | é o único formato comprovadamente aceito, e o webhook real não pode ser testado antes da entrega | recomendação aceita; os dois modelos preferiam formato internacional |
| L7 | Segunda reserva permitida, com novo resumo e nova confirmação; a mesma reserva não é reenviada | o enunciado pede um lead por reserva confirmada, não um por sessão | recomendação aceita; conselho concordou |
| L8 | Com imóvel e datas, dá o total na hora, informa a capacidade e pergunta quantas pessoas | o preço não depende do número de hóspedes, e a bateria automática provavelmente procura o total nessa resposta | recomendação aceita; GPT igual, Gemini perguntaria antes |
| L9 | Confirma só com sim inequívoco ao resumo pendente; hesitação pergunta de novo; condição de preço não gera lead e passa para humano | lead enviado por engano não pode ser desfeito | recomendação aceita; conselho concordou |
| L10 | Dado ou preço mudou depois do resumo: novo resumo e nova confirmação | o hóspede só confirmou o que viu | recomendação aceita; conselho concordou |
| L11 | `422`: não registrado, pede correção. `5xx`: uma nova tentativa. Tempo esgotado: sem nova tentativa e sem GET, diz que não conseguiu confirmar o registro, com `handoff: true` | dito pelo Éverton: o formato da lista real é desconhecido, e um engano ali vira lead duplicado | decisão do Éverton no tempo esgotado, no lugar da recomendação de conferir por GET; o resto é a recomendação aceita. Gemini faria 2 tentativas cegas; GPT, nenhuma |
| L12 | Regra do imóvel em conflito (pet, festa, fumo): cota com aviso e não avança para lead; pedido de exceção passa para humano | as três recusas do enunciado não incluem regra da casa | recomendação aceita; GPT igual, Gemini recusaria a cotação |
| L13 | Adultos, crianças e bebês contam; pet não; número inválido pede correção | o catálogo traz uma capacidade única, sem exceção por idade | recomendação aceita; conselho concordou |
| L14 | Meio centavo arredonda para cima, por noite | arredondamento comercial; hoje nenhum imóvel gera fração | recomendação aceita; conselho concordou |
| L15 | Responde no idioma do hóspede; total sempre como `R$ 2.156,00` | atende quem escreve sem quebrar o formato exigido | recomendação aceita; conselho concordou |
| L16 | Fora de escopo e tentativa de manipulação: recusa curta, sem handoff. Desconto pedido por "dono" ou "funcionário": handoff | recusar sem handoff evita falso handoff em teste de ataque; desconto é gatilho, venha de quem vier | recomendação aceita; os dois modelos divergiram entre si |
| L17 | JSON válido com `session_id` e `message` em texto devolve sempre 200, mesmo com mensagem vazia ou longa demais; 400 só para JSON inválido ou campo faltando | motivo inferido pelo planejamento, não dito pelo Éverton: toda mensagem bem formada recebe o formato que a bateria espera | decisão do Éverton, no lugar da recomendação de 400 para mensagem vazia ou longa |
| L18 | Falha interna: uma nova tentativa; depois, 200 com aviso honesto e `handoff: true`; nunca 500 | 500 quebra o contrato; passar para humano é o caminho honesto quando o agente não consegue atender | recomendação aceita; conselho concordou |
| L19 | Cancelar, alterar, pagar, check-in antecipado, problema na estadia: handoff | o agente não tem como executar essas ações | recomendação aceita; conselho concordou |
| L20 | Aceita o nome como veio | exigir nome completo cria atrito sem obrigação do webhook | recomendação aceita; conselho concordou |
| L21 | Imóvel ambíguo: lista as opções e pede a escolha antes de cotar | escolher em silêncio pode cotar o imóvel errado | lacuna trazida pelo conselho; recomendação aceita |
| L22 | Nome e telefone mascarados em logs e exports | o repositório e os exports ficam públicos | lacuna trazida pelo conselho; recomendação aceita |
| L23 | Produção em subdomínio próprio, com a checagem de integridade de navegador desligada só para esse hostname; conferir o Bot Fight Mode da zona; testar com clientes Python | o endereço padrão da plataforma bloqueia, antes do Worker e sem log, clientes como o padrão do Python | recomendação aceita; o Éverton acrescentou o escopo da regra e as conferências. Não foi ao conselho |
| L24 | `producao` nasce com o envio real desligado; ligar é só com ordem do Éverton, e a validação de entrega reprova se estiver desligado | torna impossível um lead real por engano antes da entrega | recomendação aceita. Não foi ao conselho |

### Decididas na abertura da coordenação

Estas três ficaram abertas na rodada acima, duas delas com padrão provisório. Em
13/11/2026, ao abrir a coordenação, o Éverton ficou com os três padrões. Ele não disse
o motivo; a coluna "Motivo" é leitura da coordenação. Nenhuma lacuna segue aberta.

| ID | Decisão | Motivo (inferido) |
|---|---|---|
| L1a | "Fim de semana" sem datas: o código não mapeia a expressão e o agente pede entrada e saída | o enunciado não dá a convenção (sexta a domingo ou sábado a domingo); perguntar custa um turno e não cota a estadia errada |
| L1b | Dia da semana sem data ("sexta que vem"): próxima ocorrência daquele dia, com a data exata declarada na resposta | mesmo critério da data sem ano (decisão 9); a data declarada deixa o hóspede corrigir |
| L17a | Campo presente que não é texto devolve 400; `session_id` vazio devolve 200, como uma sessão qualquer | número ou objeto no lugar de texto é corpo malformado; texto vazio ainda é texto, e a L17 manda responder 200 a todo corpo bem formado |

## Decisões de execução (13/11/2026)

| # | Decisão | Motivo |
|---|---|---|
| X1 | Plano pago da Cloudflare assinado pelo Éverton, na conta pessoal, a mesma da zona do subdomínio de produção | o gratuito não comporta os evals (cota diária de modelo e de CPU) |
| X2 | A coordenadora para no Marco 1 e em lacuna nova; no resto segue sozinha. Produção pode subir sem o Éverton enquanto o envio real estiver desligado. Ligar o envio real e tornar o repositório público: só com ordem dele. Resumo de até 10 linhas no fim de cada leva | o que é reversível anda sozinho; o que aparece para o avaliador e não se desfaz espera a ordem |
| X3 | Modelo mais forte só na coordenadora e nas frentes A, C, F e G; modelo intermediário nas demais | dito pelo Éverton: o limite semanal de uso está em 74% e o uso extra está desligado |
| X4 | Deploy em `dev` liberado para as frentes A e B1 na leva 1 e para a coordenadora, a partir da `main`, depois de cada merge | o Marco 1 precisa estar no ar, e os evals precisam rodar no código integrado |
| X5 | O webhook falso é uma frente própria (B1), em paralelo na leva 1 | é infraestrutura de teste, tem pasta própria e não toca os arquivos do produto |

## Decisões de engenharia do planejamento

Escolhas técnicas que decorrem das verificações em `docs/VERIFICACOES.md`.

| Decisão | Motivo |
|---|---|
| Uma mensagem por vez na sessão por fila de promises em memória no Durable Object, mais marcador de idempotência gravado antes do POST do lead | o objeto intercala pedidos durante a espera de I/O externo, e o bloqueio nativo tem limite de 30 s, menor que uma chamada de modelo |
| O conjunto reservado fica fora do repositório até a entrega | dentro do repositório, toda worktree conseguiria ler os casos |
| O harness de eval não tem dependências e fala só pelo contrato HTTP | deixa as frentes de eval começarem junto com o marco 1 sem tocar na configuração do produto |
| Termos proibidos não ficam no repositório: o gate de sigilo os deriva da variável de ambiente | uma lista de termos proibidos versionada seria o próprio vazamento |
| O harness recusa casos com confirmação quando o alvo não é `dev` | torna mecânica a regra de não tocar no webhook real |
