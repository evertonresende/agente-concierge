# Agente concierge

Agente de chat para quem quer se hospedar em imóveis de temporada. Ele faz quatro coisas:

1. Responde dúvidas sobre os imóveis usando só o catálogo. O que o catálogo não traz, ele
   diz que não sabe.
2. Cota estadias pela regra de preço, com o total calculado por código.
3. Registra o pedido de reserva (lead): coleta os dados, mostra um resumo, espera a
   confirmação do hóspede em outro turno e só então envia ao webhook.
4. Passa a conversa para uma pessoa em reclamação, pedido de desconto, negociação ou
   assunto fora do alcance dele. Nunca negocia preço.

Os requisitos estão em [`docs/CONTRATO.md`](docs/CONTRATO.md). Este README é um rascunho:
o que ainda depende do fim da integração está marcado como "a preencher".

**URL pública:** a preencher. <!-- PREENCHER: URL pública do agente (só com ordem do Éverton, L23) -->

## Interface

```
POST /chat
Content-Type: application/json

{ "session_id": "abc-123", "message": "texto do hóspede" }
```

Resposta `200`: `{ "reply": "texto do agente", "handoff": false }`. A mesma `session_id`
é a mesma conversa. A resposta sai em menos de 60 s.

Outras rotas: `GET /` (página de chat) e `GET /saude` (ambiente, destino dos leads, estado
do envio e presença das variáveis, nunca o valor). O `POST /chat` devolve também os
cabeçalhos `x-uso-entrada`, `x-uso-saida` e `x-chamadas-modelo`, usados para medir custo.

## Arquitetura

- **Worker** em TypeScript na Cloudflare. Recebe o `POST /chat`, valida o corpo e entrega
  a mensagem ao objeto da sessão.
- **Um Durable Object por `session_id`.** Uma fila em memória processa uma mensagem por
  vez, na ordem de chegada. Histórico, rascunho da reserva e estado do lead ficam no
  armazenamento do objeto. O marcador de envio do lead é gravado antes do POST, para um
  reinício no meio não gerar um segundo envio.
- **Laço de ferramentas próprio**, sem framework de agente. A cada turno o modelo recebe
  o histórico e as ferramentas (catálogo, cotação, resumo, confirmação e passar para
  humano), pede chamadas, recebe os resultados e escreve a resposta. O laço tem limite de
  voltas e um orçamento de 45 s para o trabalho externo.
- **Código decide, modelo conversa.** Saem de código: preço em centavos inteiros, dia da
  semana, as recusas, o texto em reais (`R$ 2.156,00`), o valor enviado ao webhook, as
  transições do lead, o resumo para confirmação e o aviso de falha. O modelo entende o
  pedido, escolhe a ferramenta e redige. Antes de sair, o texto do modelo passa por uma
  conferência de código: valor em reais que nenhuma ferramenta calculou, concessão,
  registro afirmado sem `201` e afirmação de disponibilidade não chegam ao hóspede (frente
  G). Os limites dessa conferência estão na lista do fim.
- **Nome do lead.** Só pode ser formado por palavras que o hóspede escreveu na conversa
  (P20), sem dígito nem símbolo de moeda (P29); se não for, a ferramenta do resumo recusa e
  o modelo pede o nome.
- **Teto de chamadas de ferramenta** (P30): 16 por resposta do modelo, 32 por turno e no
  máximo 2 buscas por comodidade por turno. As que passam do teto voltam ao modelo como
  erro, sem executar.

  > Estado deste rascunho: a árvore final é 9d37f9a, com todas as frentes de produto
  > verificadas (G com a P30 e a correção do teto no caminho do lead, T, F com a P20, a P29
  > e as formas de confirmação da P35, H, B2, K e S). Juiz e runner são idênticos byte a
  > byte aos de 193d1bf (P34).
- **Modelo.** Decidido pelo Éverton por medição (`DECISOES.md` X24 e X30;
  [`docs/revisoes/modelos.md`](docs/revisoes/modelos.md)). Principal: Claude Haiku 5.5, com
  o raciocínio em nível alto, direto do provedor pelo AI Gateway. Reserva: GLM-5.3 Flash,
  de outro fornecedor, no Workers AI, que só entra quando o principal falha. Recusa por
  limite de pedidos vai direto ao reserva, sem nova tentativa (L18).
- **AI Gateway** da Cloudflare entre o Worker e os modelos (X21 e X24): guarda a chave do
  provedor do principal, registra qual modelo respondeu e os erros de limite. Sem gateway
  configurado, o reserva responde direto (decisão provisória P16).
- **Dois ambientes.** `dev` usa o catálogo real e um webhook falso, nosso (`falso/`), que
  replica o contrato do real. `producao` usa o webhook real, com o envio desligado
  (`ENVIO_LEADS=desligado`) até a ordem do Éverton (L24).

Desenhos: [`docs/desenhos/`](docs/desenhos/).

## Como rodar localmente

Pré-requisitos: Node 24 e uma conta da Cloudflare com Workers AI (o servidor local chama
o modelo pela conta).

1. Instale as dependências: `npm install`.
2. Suba o webhook falso numa porta própria:

   ```bash
   cd falso && npm install && npx wrangler dev --port 8795
   ```

3. Crie `.dev.vars.dev` na raiz (o arquivo não é versionado) com duas linhas:
   `CATALOGO_URL=<base do catálogo, com o token, sem barra final>` e
   `LEADS_URL=http://127.0.0.1:8795/leads/<um-segmento-seu>`. O contrato, seção 8, mostra
   como gerar o arquivo sem imprimir os valores.
4. Suba o agente: `npm run dev` (ambiente `dev`, porta 8787). Para outra porta, use
   `npx wrangler dev --env dev --port <porta>`; `npm run dev -- --port <porta>` falha
   porque o script já passa `--port`.
5. Abra `http://127.0.0.1:8787/` ou mande uma mensagem:

   ```bash
   curl -s http://127.0.0.1:8787/chat -H 'content-type: application/json' \
     -d '{"session_id":"teste-1","message":"Quanto fica o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas?"}'
   ```

   A resposta traz `R$ 2.156,00`, o exemplo da seção 3 do contrato.

Para o Haiku responder no servidor local, a variável `AI_GATEWAY` precisa nomear um
gateway da conta com a chave da Anthropic guardada nele. Sem isso, responde o reserva.

## Como testar

| Para | Comando | O que espera |
|---|---|---|
| Testes unitários e de integração local | `npm test` | vitest sem falha e sem erro não tratado |
| Tipos | `npm run tipos` | sem erro |
| Gate de sigilo e de histórico (termos de sigilo em todo o histórico; IP e e-mail só nos arquivos atuais) | `scripts/verificar-sigilo.sh` | `SIGILO OK` |
| Teste do gate | `scripts/verificar-sigilo.teste.sh` | `TESTE DO GATE OK` |
| Teste do script de custo | `node --test scripts/custo.test.mjs` | sem falha |
| Listar os casos de eval | `node evals/rodar.mjs --listar` | contagem por bloco e `CASOS OK` |
| Teste do próprio runner | `node evals/teste-do-runner.mjs` | `TRAVA OK` e `RUNNER OK` |
| Evals de desenvolvimento | `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev` | `EVAL OK` |
| Um bloco | acrescente `--bloco <nome>` | `BLOCO <nome>: N%`, limiar de 95% |
| Conjunto reservado, só agregado | `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto reservado --so-agregado` | `RESERVADO OK` |
| Simulador de hóspede hostil (só `dev`) | `node evals/simulador/rodar.mjs --alvo "$AGENTE_URL_DEV"` | `SIMULADOR OK` |
| Teste do simulador | `node evals/simulador/teste.mjs` | sem falha |
| Teste do webhook falso | `node falso/teste.mjs http://127.0.0.1:8795/leads/<segmento>` | `FALSO OK` |

- O runner fala só pelo contrato HTTP (`GET /saude`, `POST /chat` e `GET` no webhook
  falso) e não importa código de `src/`. Detalhes em [`evals/README.md`](evals/README.md).
- Casos com confirmação de reserva só rodam contra alvo que responde `ambiente: "dev"`. O
  runner pula esses casos em qualquer outro alvo, e o simulador recusa alvo que não seja
  `dev`.
- `LEADS_URL_DEV` aponta para o webhook falso, para o runner conferir os leads de cada
  conversa. Ela nunca é impressa.
- O conjunto de desenvolvimento tem 104 casos em 9 blocos. O reservado tem 60 casos, fica
  fora do repositório até a entrega e só mostra o agregado por bloco. Caminho no
  repositório depois da entrega: a preencher.
  <!-- PREENCHER: caminho do reservado no repositório depois da cópia de entrega -->
- O simulador usa um modelo de outro provedor no papel do hóspede, por uma ferramenta de
  linha de comando (`--cli`, padrão `agy`).

## Como validar `producao` sem enviar lead

`producao` está no ar com o envio real desligado, no endereço padrão do Worker e no
hostname próprio, que chega ao Worker por uma rota, sem escrita no DNS (X26, P22). O
endereço padrão não serve como URL de entrega: a plataforma barra nele alguns clientes
HTTP, e isso não se desliga (X28). No teste da frente K, `Python-urllib` e `libwww-perl`
levam 403 no endereço padrão, em POST e em GET, e passam no hostname próprio; os outros
15 clientes testados passam nos dois. As URLs de pré-visualização do Worker de `producao`
estão desligadas (P25). É só proteção: a plataforma não gera URL por versão para Worker com
Durable Object, então nenhuma existia. A confirmar no congelamento.
<!-- PREENCHER: a confirmar no congelamento (clientes) -->

O webhook real não recebe nenhum POST antes da entrega, nem como teste. A validação é por
composição:

1. `GET /saude` em `producao` mostra `ambiente: "producao"`, `leads_destino: "real"`,
   `envio_leads: "desligado"` e a presença das variáveis.
2. `GET` no webhook real (permitido) confere endereço e token e devolve a lista de leads,
   que precisa estar vazia.
3. O caminho do POST é o mesmo código que roda em `dev` contra o webhook falso.
4. Contra `producao` só rodam conversas sem confirmação.

O script `scripts/validar-producao.sh` junta essas conferências. Os endereços vêm do
arquivo de ambiente e nunca aparecem na saída.

| Modo | O que faz | Saída de sucesso |
|---|---|---|
| sem modo | `/saude`, leads reais antes e depois e o conjunto dev sem os casos de confirmação | `PRODUCAO OK` |
| `--so-leitura` | só o GET no webhook real; exige zero lead real | `LEADS REAIS: 0` |
| `--clientes` | um turno sem confirmação com curl, Python `requests`, Python `urllib` e `fetch` do Node | `CLIENTES OK` |
| `--entrega` | `/saude` com o envio ligado e leads reais; reprova com o envio desligado | `ENTREGA OK` |
| `--autoteste` | confere o próprio script contra servidores falsos locais, sem tocar em `producao` | `AUTOTESTE OK` |

## Custo por conversa

O Worker devolve em cada resposta os tokens de entrada e de saída e o número de chamadas
ao modelo. O runner grava esses números no relatório de cada rodada, e
`node scripts/custo.mjs <relatório.json>` calcula o custo por conversa com o preço do
modelo. O número sai de uma rodada nova com o modelo final; os relatórios antigos do
repositório são de outro código.

Custo medido no código final: a preencher.
<!-- PREENCHER: custo por conversa medido (média e p95) no código final, com o modelo e o nível finais -->

## Resultados dos evals

Critérios (`docs/EVALS.md`): 95% ou mais por bloco no conjunto de desenvolvimento, 90% ou
mais no agregado do reservado, zero lead sem confirmação, zero lead duplicado, p95 de até
20 s e nenhuma resposta acima de 60 s. A prova dos 95% são três rodadas seguidas em `dev`,
com o critério na soma por bloco (X24). Falso vermelho do juiz conta como falha na soma do
bloco; se um bloco só fecha 95% sem os falsos vermelhos classificados, roda-se mais uma
rodada e os dois números, com e sem eles, vão ao Éverton, que escolhe qual vale (P34).

Latência medida pela frente K em `producao`, no registro de cada turno do Worker: 2,2 a
4,0 s nas perguntas simples (2 chamadas ao modelo) e 5,0 a 5,9 s nas cotações (3
chamadas). Bate com a rodada local (p50 2,5 s, p95 5,3 s). O número final sai das rodadas
oficiais: a confirmar no congelamento.
<!-- PREENCHER: latência final das rodadas oficiais (a confirmar no congelamento) -->

Fumaças em `dev`, que não contam como rodada: com G, T e F publicadas, bloco `marco1` com
100% (p50 1,2 s, p95 4,5 s) e bloco `funciona-leads` inteiro pelo proxy de registro com 100%
(p50 1,6 s, p95 5,7 s). Com a árvore final publicada, a sonda de pós-deploy respondeu 32
de 32 perguntas de ficha em dois minutos, sem contingência, e o `marco1` deu 100%.

Conjunto reservado: as duas primeiras leituras do agregado em `dev`, na árvore b5af852,
deram 83% e 80%, abaixo do limiar de 90%. Ficam registradas como estão. A telemetria do
Worker nas duas janelas não tem contingência nem falha do catálogo. A regra para o que vem
depois foi escrita antes de alguém ver quais casos falharam (P33): a conferência dos casos
contra o contrato cobre todos os casos, uma expectativa só muda com a cláusula ou a decisão
citada, há uma passada única de correção com um segundo revisor com veto, e o número final é
a soma de duas leituras seguidas na árvore congelada. Se a soma ficar abaixo de 90%, o
número vai ao Éverton como está.

O segundo revisor vetou as 9 mudanças de expectativa da passada única, e os casos voltaram
ao original: nas 7 afrouxadas, a expressão nova aprovava respostas erradas; das 2
apertadas, uma reprovava respostas certas e a outra ficou em dúvida. Ele apertou 3 casos
frouxos. O conjunto mede com as expectativas originais. Ele também achou um erro real do
agente: em 4 casos o hóspede confirmava de um jeito que a L9 e a P13 aceitam, e o agente
repetia o resumo sem enviar. Pela regra 6 de `docs/EVALS.md`, esses 4 casos foram revelados,
corrigidos no agente (P35), migraram para o conjunto de desenvolvimento e ganharam
substitutos conferidos por dois revisores. O agregado final sai de duas leituras na árvore
final e vai ao Éverton como estiver: a preencher.
<!-- PREENCHER: soma das duas leituras finais do reservado na árvore 9d37f9a (P33) -->

Notas por bloco das rodadas oficiais: a preencher.
<!-- PREENCHER: nota dos evals por bloco (três rodadas em dev) e agregado do conjunto reservado -->

A história da escolha do modelo, com a tabela de medições, está em
[`docs/COMO-FOI-FEITO.md`](docs/COMO-FOI-FEITO.md).

## Revisões

Revisão do primeiro marco: [`docs/revisoes/m1.md`](docs/revisoes/m1.md). Primeira passada
da revisão final (segurança da `main`, código dos módulos estáveis e segunda opinião sobre
o cálculo de preço): [`docs/revisoes/m2.md`](docs/revisoes/m2.md). Segunda passada, no
mesmo arquivo, em duas partes sobre o delta da leva 2: nenhum achado crítico ou alto, e
nenhum caminho sondado gera lead sem resumo visto, duplicado ou diferente do resumo. Os
achados médios viraram correção (P29, P30 e a trava do runner por mensagem); os demais estão
na lista de limites abaixo.

## Limites conhecidos

Pela X24, só bloqueia a entrada na `main` o que é determinístico ou gera lead errado; o
resto fica listado aqui. A lista fecha no fim: a preencher.
<!-- PREENCHER: lista final de limites -->

Já decididos ou declarados, por área. Os de segurança vêm das duas passadas da revisão
([`docs/revisoes/m2.md`](docs/revisoes/m2.md)); os demais, das decisões (P) e dos
verificadores das frentes, no log do backlog.

**Conversa e modelo**

1. **Handoff depende do modelo.** Palavra na mensagem do hóspede não liga `handoff` por
   código: ela só provoca uma segunda chamada ao modelo, focada no pedido (P17). Se o
   modelo errar também nessa chamada, o handoff não acontece.
2. **Pedido de humano.** "Quero falar com um humano" só vira `handoff` se o modelo chamar
   a ferramenta.
3. **Mudança misturada com pergunta.** Com resumo pendente, a separação entre afirmação e
   pergunta na mensagem do hóspede reconhece só algumas formas de pontuação. Nas outras,
   perceber a mudança depende do modelo (P18).
4. **Pergunta com dado, sem sinal claro.** Com resumo pendente, derrubar o resumo diante
   de uma pergunta que traz um dado novo depende do modelo.
5. **Grupo cotado.** A trava que impede resumo com menos pessoas do que o grupo cotado
   depende da cotação que o modelo fizer.
6. **Data no formato americano.** "01/15/2027" não é lida como data; o agente pede as
   datas de novo.
7. **Conversa muito longa.** Sem resumo aberto, depois que a cotação sai da janela de 80
   mensagens, o agente não repete o total: diz que não tem o valor confirmado e pede o
   imóvel e as datas de novo (P26). Nenhum valor errado é dito.

**Conferência do texto do modelo**

8. **Número por extenso** fica fora da conferência de valores, e o total citado é amarrado
   à estadia só pelo rótulo e pelas datas.
9. **Milhar com espaço.** Um valor escrito com espaço no lugar do ponto ("R$ 2 156,00") é
   cortado, mesmo quando certo.
10. **Contagem de chamadas.** Quando o prazo do turno vence com o modelo reserva rodando, o
    cabeçalho de chamadas conta uma a menos.
11. **Motivo do handoff.** O motivo registrado tem falsos positivos quando a ferramenta de
    handoff já tinha sido chamada.
12. **Conferência no nível do hóspede.** Quando o código pede ao modelo que corrija a
    resposta, a mensagem de conferência chega como texto de usuário, no mesmo nível de uma
    fala do hóspede, e o modelo não distingue as duas.

**Lead e nome (P20, P28)**

13. **Ordem do nome.** Palavras que o hóspede escreveu, em outra ordem ou combinação,
    passam. Depois de "na verdade o titular é o Pedro Alves", um modelo que passe o nome
    antigo é aceito, porque as palavras foram escritas.
14. **Pontuação do nome** não é conferida.
15. **Nome fora da janela.** Turno com ferramenta gasta 4 ou mais mensagens; numa conversa
    com cotações o nome sai da janela de 80 mensagens bem antes de 40 turnos e é pedido de
    novo.
16. **Modelo que insiste no nome errado** esgota as chamadas do turno e o hóspede recebe o
    aviso de contingência com `handoff`, sem resumo e sem envio.
17. **Recusa do nome derruba o resumo pendente.** O "sim" seguinte não envia nada: o
    hóspede recebe a pergunta do agente e um resumo novo (P28).
18. **Nome em chinês, japonês ou coreano** grudado na frase ("meu nome é" e o nome sem
    espaço) é recusado; mandado sozinho, passa (P28).
19. **Webhook real.** O corpo do `422` e o formato de um item da lista são desconhecidos até
    o primeiro lead real. Qualquer resposta diferente de `201` é tratada como não
    registrado.
20. **Disponibilidade.** O catálogo não informa datas livres. O agente cota, mas não diz que
    a data está disponível, e lead registrado é pedido encaminhado, não reserva garantida.

**Pedido HTTP**

21. **Corpo muito grande.** Acima de 64 KB o Worker devolve `200` com o pedido para
    resumir, sem ler o resto (P12). Com corpo de vários megabytes, o cliente às vezes vê a
    conexão cair antes de ler a resposta.
22. **Corpo grande com resumo pendente.** Acima de 64 KB o pedido não toca na sessão, e o
    "sim" seguinte não reapresenta o resumo (P24).
23. **Sessão nova com mensagem vazia.** Um `session_id` novo com mensagem vazia cria a
    sessão com as tabelas vazias.

**Segurança e dados**

24. **Sem limite de gasto por cliente ou por sessão.** O custo de modelo não tem teto por
    quem conversa. A fila de uma sessão também não tem teto de quantidade, só de tempo:
    mensagem que espera mais de 50 s não chama o modelo.
25. **O `session_id` é a única credencial da conversa.**
26. **Dados de terceiros nos leads.** Com o envio real ligado, nome e telefone do hóspede
    vão ao webhook do time comercial.
27. **Página de chat sem cabeçalhos de proteção** do navegador.
28. **Dados da sessão sem prazo de apagamento** no armazenamento do objeto. O histórico
    nunca é podado; só a leitura usa a janela de 80 mensagens.
29. **Log.** Até 4 dígitos de um dado podem ir para o log se a plataforma ecoar o pedido
    numa mensagem de erro.

**Ferramentas de verificação**

30. **Juiz de preço dos evals.** Reconhece pela forma da frase, não pelo sentido. Pela P34
    ele fica no estado de 193d1bf, o último aprovado por verificador independente, e não é
    mais corrigido nesta entrega. A lista completa, com um exemplo cada, está em
    `evals/README.md`:
    - **15 formatos de resposta certa que ele reprova:** conta com "×" ou com "+";
      subtotal ou conta entre parênteses; subtotal chamado de total ou com verbo de total;
      "em vez de"; tabela com vírgula no rótulo; concessão hipotética; diária comum "por
      noite" com o acréscimo só descrito; nos casos de desconto, negação longe da palavra
      ou com vírgula colada; no caso de cancelamento, "nem se"/"ou se" seguido de
      afirmação e "multa em caso de"; contagem por tipo de noite sem repetir "noite"
      depois de "N noites".
    - **10 formatos de resposta errada que ele aprova:** "a partir de"; noites entre
      parênteses; total sem a limpeza sem a palavra "total"; componente trocado com o
      total certo; limpeza por noite; contagem em inglês por extenso; valor por pessoa;
      contagem que cabe na estadia sem ser a dela; negação solta antes da concessão nos
      casos de desconto; tipo de noite trocado só dentro do parêntese.

    Em compensação, as rodadas oficiais passam por um proxy local que só grava as
    conversas; nos quatro casos de desconto, toda resposta é lida à mão, e a leitura
    confere também o tipo de noite contra a diária (P27, P31). Falso vermelho conta como
    falha na soma do bloco (P34).
31. **Simulador.** O juiz de handoff do simulador não enxerga gatilho que o modelo do
    hóspede inventa; reprovação de handoff no simulador se lê à mão. O resultado também é
    lido no relatório, não só na linha final.
32. **Validação de `producao`.** No modo completo, interromper o script com Ctrl-\ ou
    `kill -9` deixa o runner das conversas rodando sozinho (só conversas sem confirmação).
33. **Gate de sigilo.** Procura IP e e-mail só nos arquivos atuais, não em commits antigos
    nem em mensagens; não procura IPv6; não vê reescrita de histórico com push forçado nem
    termo partido por quebra de linha; alguns formatos do arquivo de ambiente fazem ele
    sair com 2, do lado seguro. Lista completa no cabeçalho de `scripts/verificar-sigilo.sh`.
34. **Medição do nível alto.** A comparação de níveis do Haiku teve uma rodada só no nível
    alto, e entre duas rodadas do mesmo nível 13 casos trocaram de resultado.

**Fila da sessão (frente H)**

35. **Reinício com o "sim" na fila.** Se o objeto reinicia com o "sim" ainda na fila, a marca
    de reapresentação se perde, e o "sim" confirma o resumo criado no turno anterior (1 lead).
36. **Pergunta e "sim" na fila.** O "sim" responde só "Certo.", sem lead.
37. **Corpo enviado devagar** até o prazo do Worker: o hóspede recebe a contingência com
    `handoff`, mas a sessão não fica marcada.
38. **Worker desiste com o "sim" em curso.** O lead sai (um só, igual ao resumo) e o hóspede
    recebe a contingência.
39. **Cabeçalhos de uso.** Mostram a qualquer cliente os tokens e as chamadas ao modelo do
    turno.

**Lead (frente F)**

40. **Valor por extenso no nome** passa ("Ana quinhentos reais"); dígito e símbolo de moeda
    são recusados (P29).
41. **Catálogo fora do ar e "sim" limpo.** Quando o modelo pede o resumo de novo em vez de
    confirmar, o resumo pendente cai; o hóspede recebe a contingência e nada é enviado.

**Teto de chamadas de ferramenta (P30, frente G)**

42. **Chamada acima do teto** volta ao modelo como erro; o hóspede recebe o que já foi lido
    ou o pedido para reduzir a busca.
43. **Lote de 17 ou mais chamadas.** O resumo do pedido é cortado e o modelo precisa pedir
    de novo.
44. **Catálogo instável.** A nova tentativa dobra o pior turno: 168 pedidos ao catálogo na
    sonda, contra 84 com ele saudável.
45. **Teto e confirmação no mesmo turno.** Quando o teto corta um `cotar` ou um
    `montar_resumo` no turno em que o hóspede confirma, a confirmação daquele turno não
    roda, mesmo que a chamada cortada não mudasse a reserva. O hóspede confirma de novo no
    turno seguinte. Fica do lado seguro.

**Segunda passada da revisão de segurança**

46. **Valor sem marca de moeda** escrito pelo modelo ("consigo deixar o total em 1500")
    chega ao hóspede sem corte (S2-2).
47. **Mensagem do hóspede na pergunta fechada.** Entra crua; o ganho máximo é manter o
    próprio resumo (S2-4).
48. **Nome de imóvel de ficha hostil** vai para o resumo (S2-5).
49. **Repetição das instruções.** A trava deixa passar tradução e frase curta (S2-7).

**Catálogo**

50. **Catálogo fora do ar.** O hóspede recebe a contingência com `handoff`, e a sessão fica
    em `handoff`. Visto uma vez em `dev`, em 14/11, por 95 segundos (25 turnos); a causa não
    foi determinada (P32).

**Confirmação (P35, frente F)**

51. **Palavra de preço junto do sim.** Mesmo sem número ("pelo valor normal"), não
    confirma: o agente repete o resumo, que mostra o total, e pede o sim.
52. **Confirmação natural fora da gramática** também repete o resumo e pede o sim. Custa
    um turno; nunca gera lead errado.
53. **"Pode encaminhar" sozinho** confirma quando há resumo pendente.

**Conferências com o modelo real** (servidor local com a `main`, a F e a branch da H; uma
repetição de cada roteiro, não são rodadas de eval):
oito roteiros de nome, nenhum travado em recusa, e os sete leads com o nome exatamente como
o hóspede escreveu; quatro pedidos com saída sem ano anterior à entrada, nenhum valor em
reais e nenhum ano completado pelo modelo; 20 sessões com resumo pendente e mensagem que
mistura mudança e pergunta, zero lead com dado velho e zero nome sujo.

## Onde está cada documento

| Arquivo | Para quê |
|---|---|
| [`docs/CONTRATO.md`](docs/CONTRATO.md) | requisitos e decisões de comportamento (lacunas L1 a L24) |
| [`DECISOES.md`](DECISOES.md) | decisões e motivos: produto, execução (X), provisórias (P), engenharia |
| [`docs/COMO-FOI-FEITO.md`](docs/COMO-FOI-FEITO.md) | o processo de construção, com o que deu errado |
| [`docs/EVALS.md`](docs/EVALS.md) | plano de evals, blocos, conjunto reservado, limiares |
| [`docs/VERIFICACOES.md`](docs/VERIFICACOES.md) | fatos de plataforma verificados, com fonte |
| [`docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`](docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md) | frentes, donos de arquivo, critérios de aceite e o log da execução |
| [`docs/desenhos/`](docs/desenhos/) | desenhos do agente e da fábrica |
| [`docs/revisoes/`](docs/revisoes/) | revisões e escolha do modelo |
| [`docs/conselho/`](docs/conselho/) | perguntas e respostas da consulta às cegas a modelos de outros provedores |
| [`docs/prompts/`](docs/prompts/) | prompts das sessões de planejamento e de coordenação |
| [`docs/setup/`](docs/setup/) | regras, skills e subagentes do ambiente do autor usados nesta entrega |
| [`evals/`](evals/) | runner, casos, simulador e relatórios |
| [`falso/`](falso/) | webhook falso de `dev` |

Exports de sessão, com dados pessoais e segredos removidos: a preencher.
<!-- PREENCHER: exports de sessão (docs/sessoes/), se o Éverton decidir publicar -->

Vídeo da fábrica rodando: a preencher. <!-- PREENCHER: link e roteiro do vídeo -->

Contato: contato@evertonresende.com
