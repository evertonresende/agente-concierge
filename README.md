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
  pedido, escolhe a ferramenta e redige. Antes de sair, o texto do modelo é conferido por
  código: valor em reais que nenhuma ferramenta calculou não chega ao hóspede. A frente G
  amplia essa conferência para concessão, registro afirmado sem `201` e afirmação de
  disponibilidade; ela está em integração. Descrição final: a preencher.
  <!-- PREENCHER: conferir a descrição da conferência depois que a G entrar na main -->

  > Estado deste rascunho: a `main` já tem o adaptador do modelo (Haiku 5.5 em nível alto,
  > reserva e gateway em `dev`), mas ainda não tem as frentes F, G e H. O que está descrito
  > como decidido e depende delas (conferência ampliada, limite de corpo) entra com elas.
- **Modelo.** Decidido pelo Éverton por medição (`DECISOES.md` X22 e X24): Claude Haiku
  5.5, com o raciocínio em nível alto, como principal. O reserva está em aberto; o
  provisório é o GLM-5.3 Flash, de outro fornecedor. Recusa por limite de pedidos vai
  direto ao reserva (L18). Nível final e reserva: a preencher.
  <!-- PREENCHER: nível final do raciocínio e modelo reserva escolhido -->
- **AI Gateway** da Cloudflare entre o Worker e os modelos (P9 e X24): guarda a chave do
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
| Gate de sigilo e de histórico | `scripts/verificar-sigilo.sh` | `SIGILO OK` |
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
- O conjunto de desenvolvimento tem 98 casos em 9 blocos. O reservado tem 60 casos, fica
  fora do repositório até a entrega e só mostra o agregado por bloco. Caminho no
  repositório depois da entrega: a preencher.
  <!-- PREENCHER: caminho do reservado no repositório depois da cópia de entrega -->
- O simulador usa um modelo de outro provedor no papel do hóspede, por uma ferramenta de
  linha de comando (`--cli`, padrão `agy`).

## Como validar `producao` sem enviar lead

O webhook real não recebe nenhum POST antes da entrega, nem como teste. A validação é por
composição:

1. `GET /saude` em `producao` mostra `ambiente: "producao"`, `leads_destino: "real"`,
   `envio_leads: "desligado"` e a presença das variáveis.
2. `GET` no webhook real (permitido) confere endereço e token e devolve a lista de leads,
   que precisa estar vazia.
3. O caminho do POST é o mesmo código que roda em `dev` contra o webhook falso.
4. Contra `producao` só rodam conversas sem confirmação.

O script `scripts/validar-producao.sh` junta essas conferências: `--so-leitura` imprime
`LEADS REAIS: 0` e `--entrega` só imprime `ENTREGA OK` com o envio ligado. Ele está sendo
escrito pela frente K e ainda não está na `main`: comando e saída a preencher.
<!-- PREENCHER: confirmar opções e saídas de scripts/validar-producao.sh quando entrar na main -->

## Custo por conversa

O Worker devolve em cada resposta os tokens de entrada e de saída e o número de chamadas
ao modelo. O runner soma por conversa e converte em dólar com o preço do modelo.

Custo medido no código final: a preencher.
<!-- PREENCHER: custo por conversa medido (média e p95) no código final, com o modelo e o nível finais -->

## Resultados dos evals

Critérios (`docs/EVALS.md`): 95% ou mais por bloco no conjunto de desenvolvimento, 90% ou
mais no agregado do reservado, zero lead sem confirmação, zero lead duplicado, p95 de até
20 s e nenhuma resposta acima de 60 s. A prova dos 95% são três rodadas seguidas em `dev`,
com o critério na soma por bloco (X24).

Notas por bloco e do reservado: a preencher.
<!-- PREENCHER: nota dos evals por bloco (três rodadas em dev) e agregado do conjunto reservado -->

A história da escolha do modelo, com a tabela de medições, está em
[`docs/COMO-FOI-FEITO.md`](docs/COMO-FOI-FEITO.md).

## Revisões

Revisão do primeiro marco: [`docs/revisoes/m1.md`](docs/revisoes/m1.md). Revisão de
código, de segurança e segunda opinião antes de produção: a preencher.
<!-- PREENCHER: resultado das revisões de código e de segurança (M2) -->

## Limites conhecidos

Pela X24, só bloqueia a entrada na `main` o que é determinístico ou gera lead errado; o
resto fica listado aqui. A lista fecha no fim: a preencher.
<!-- PREENCHER: lista final de limites -->

Já decididos ou declarados:

1. **Handoff depende do modelo.** Palavra na mensagem do hóspede não liga `handoff` por
   código: ela só provoca uma segunda chamada ao modelo, focada no pedido (P17). Se o
   modelo errar também nessa chamada, o handoff não acontece. Concessão sem palavra de
   desconto e sem valor escapa à conferência quando o modelo erra duas vezes.
2. **Mudança misturada com pergunta.** Com resumo pendente, a separação entre afirmação e
   pergunta na mensagem do hóspede reconhece vírgula, ponto, ponto e vírgula, exclamação
   e quebra de linha. Com outras formas (travessão, reticências, dois-pontos, emoji,
   parênteses, "e" ou sem pontuação), perceber a mudança depende do modelo (P18).
3. **Número por extenso** fica fora da conferência de valores, e o total citado é amarrado
   à estadia só pelo rótulo e pelas datas.
4. **Grupo cotado.** A trava que impede resumo com menos pessoas do que o grupo cotado se
   solta se o modelo recotar com menos pessoas.
5. **Corpo muito grande.** Acima de 64 KB o Worker devolve `200` com o pedido para
   resumir, sem ler o resto (P12). Com corpo de vários megabytes, o cliente às vezes vê a
   conexão cair antes de ler a resposta.
6. **Webhook real.** O corpo do `422` e o formato de um item da lista são desconhecidos até
   o primeiro lead real. Qualquer resposta diferente de `201` é tratada como não
   registrado.
7. **Disponibilidade.** O catálogo não informa datas livres. O agente cota, mas não diz que
   a data está disponível, e lead registrado é pedido encaminhado, não reserva garantida.
8. **Simulador.** O juiz de handoff do simulador não enxerga gatilho que o modelo do
   hóspede inventa; reprovação de handoff no simulador se lê à mão.
9. **Conferência no nível do hóspede.** Quando o código pede ao modelo que corrija a
   resposta, a mensagem de conferência chega como texto de usuário, no mesmo nível de uma
   fala do hóspede. Um hóspede que copie esse texto não ganha autoridade, mas o modelo
   também não distingue os dois.
10. **Sem limite de gasto por cliente ou por sessão.** O custo de modelo não tem teto por
    quem conversa.
11. **O `session_id` é a única credencial da conversa.** Quem conhece o identificador de uma
    sessão continua aquela conversa.
12. **Dados de terceiros nos leads.** Com o envio real ligado, nome e telefone do hóspede
    vão ao webhook do time comercial.
13. **Página de chat sem cabeçalhos de proteção** do navegador.
14. **Dados da sessão sem prazo de apagamento** no armazenamento do objeto.
15. **Medição do nível alto.** A comparação de níveis do Haiku teve uma rodada só no nível
   alto, e entre duas rodadas do mesmo nível 13 casos trocaram de resultado.

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
| [`docs/sessoes/`](docs/sessoes/) | exports de sessão, com dados pessoais e segredos removidos: a preencher <!-- PREENCHER: exports de sessão --> |
| [`evals/`](evals/) | runner, casos, simulador e relatórios |
| [`falso/`](falso/) | webhook falso de `dev` |

Vídeo da fábrica rodando: a preencher. <!-- PREENCHER: link e roteiro do vídeo -->

Contato: contato@evertonresende.com
