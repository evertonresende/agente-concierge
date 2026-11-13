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

_(vazio: aguardando a rodada de decisão. As lacunas abertas estão listadas na seção
10 de `docs/CONTRATO.md`; a consulta às cegas a dois modelos está em `docs/conselho/`.)_

## Decisões de engenharia do planejamento

Escolhas técnicas que decorrem das verificações em `docs/VERIFICACOES.md`.

| Decisão | Motivo |
|---|---|
| Uma mensagem por vez na sessão por fila de promises em memória no Durable Object, mais marcador de idempotência gravado antes do POST do lead | o objeto intercala pedidos durante a espera de I/O externo, e o bloqueio nativo tem limite de 30 s, menor que uma chamada de modelo |
| O conjunto reservado fica fora do repositório até a entrega | dentro do repositório, toda worktree conseguiria ler os casos |
| O harness de eval não tem dependências e fala só pelo contrato HTTP | deixa as frentes de eval começarem junto com o marco 1 sem tocar na configuração do produto |
| Termos proibidos não ficam no repositório: o gate de sigilo os deriva da variável de ambiente | uma lista de termos proibidos versionada seria o próprio vazamento |
| O harness recusa casos com confirmação quando o alvo não é `dev` | torna mecânica a regra de não tocar no webhook real |
