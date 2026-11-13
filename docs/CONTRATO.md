# Contrato do agente concierge

Este documento é a fonte de requisitos do projeto. Toda frente de trabalho lê este
arquivo no lugar do enunciado original, que não existe nas worktrees. Se algo aqui
parecer errado ou faltar, a frente para e avisa a coordenadora; não decide sozinha.

Regras marcadas com **L-n** são lacunas do enunciado. A decisão de cada uma está na
seção 10. Enquanto uma lacuna estiver `ABERTA`, nenhuma frente implementa
comportamento que dependa dela.

Fatos sobre o catálogo e o webhook foram verificados por GET em 13/11/2026.

## 1. O produto

Um agente de chat para quem quer se hospedar em imóveis de temporada. Ele faz quatro
coisas:

1. Responde dúvidas sobre os imóveis usando só o catálogo. O que não está no catálogo,
   ele diz que não sabe. Não inventa.
2. Cota estadias pela regra de preço da seção 3.
3. Registra o lead: coleta nome, telefone, imóvel, datas e número de hóspedes, mostra
   um resumo, espera a confirmação do hóspede e só então envia ao webhook.
4. Passa para um humano em reclamação, pedido de desconto, negociação ou assunto que
   não consegue resolver. Nunca negocia preço.

Princípio de construção: **código decide, modelo conversa**. Saem de código
determinístico: preço em centavos inteiros, dia da semana, recusas, texto em reais,
valor enviado ao webhook e transições de estado do lead. O modelo entende a intenção,
escolhe a ferramenta e redige a resposta.

## 2. Interface HTTP (obrigatória, testada por bateria automática)

```
POST /chat
Content-Type: application/json

{ "session_id": "abc-123", "message": "texto do hóspede" }
```

Resposta `200`:

```json
{ "reply": "texto do agente", "handoff": false }
```

- `session_id` identifica a conversa. Mesma `session_id` = mesma conversa, e o agente
  lembra o que já foi dito. Sessões diferentes nunca compartilham estado.
- `handoff` é `true` quando o agente decide passar a conversa para um humano
  (duração da flag: L3).
- A resposta sai em até 60 segundos, sempre. Orçamento interno: o trabalho externo
  (modelo, catálogo, webhook) encerra em 45 s e sobra tempo para uma resposta de
  contingência (L18).
- Sempre que a resposta der um valor total, o número aparece escrito no formato
  `R$ 2.156,00` (ponto de milhar, vírgula decimal, duas casas). Esse texto é gerado
  por código, nunca pelo modelo.
- Corpo inválido: L17.
- Duas mensagens simultâneas na mesma sessão são processadas uma por vez, na ordem de
  chegada. Nenhuma se perde e nenhuma causa lead duplicado.

Rotas adicionais do Worker (não fazem parte da bateria):

- `GET /` — página simples de chat que usa o `POST /chat`.
- `GET /saude` — `{ "ok": true, "ambiente": "dev" | "producao", "leads_destino":
  "falso" | "real" }` e a presença (nunca o valor) de cada variável obrigatória.
- Cabeçalhos de resposta do `/chat` para medir custo: `x-uso-entrada`, `x-uso-saida`
  (tokens) e `x-chamadas-modelo`.

## 3. Regra de preço

- Cada noite custa a diária do imóvel.
- A noite que **começa** numa sexta ou num sábado custa 20% a mais.
- Cada noite é arredondada para centavos antes da soma (L14).
- Ao total das noites soma-se a taxa de limpeza, uma única vez por estadia.
- Número de noites = data de saída menos data de entrada, em datas civis.
- Não existe outro acréscimo: feriado, alta temporada e número de hóspedes não mudam
  o preço.
- Todo cálculo é feito em centavos inteiros. Motivo verificado: a diária real de
  245,50 multiplicada por 1,2 em ponto flutuante dá 294,59999999999997.

O agente **recusa a cotação e explica o motivo** quando:

1. o número de noites é menor que o mínimo de noites do imóvel;
2. o número de hóspedes passa da capacidade do imóvel;
3. as datas não fazem sentido: saída antes da entrada ou no mesmo dia.

(Outras situações de data: L1 e L2.)

### Exemplo calculado (vira teste unitário)

Imóvel `GRM-301`, diária 590,00, taxa de limpeza 150,00, mínimo de 2 noites,
capacidade 4. Entrada sexta 15/01/2027, saída segunda 18/01/2027, 2 hóspedes.

| Noite | Dia | Centavos |
|---|---|---|
| 15/01 | sexta | 59000 × 1,2 = 70800 |
| 16/01 | sábado | 59000 × 1,2 = 70800 |
| 17/01 | domingo | 59000 |
| taxa de limpeza | | 15000 |
| **total** | | **215600 → `R$ 2.156,00`** |

No webhook, `valor_total` desse exemplo é o número `2156.00`.

## 4. Catálogo (única fonte de verdade)

Base em `CATALOGO_URL` (variável de ambiente; já inclui o token). Só GET.

| Rota | Devolve |
|---|---|
| `GET /cidades` | `{ "cidades": [ { "cidade", "uf", "imoveis" } ] }` |
| `GET /imoveis?cidade=X` ou `?busca=texto` | `{ "imoveis": [ resumo ], "total": N }` |
| `GET /imoveis/<id>` | ficha completa |

Resumo: `id, nome, cidade, uf, bairro, tipo, capacidade`. **Não traz preço nem
regras**: para cotar ou responder sobre pet, é preciso a ficha.

Ficha (18 campos, iguais nos 15 imóveis):

```json
{
  "id": "GRM-301", "nome": "Chale Serra Gramado", "cidade": "Gramado", "uf": "RS",
  "bairro": "Planalto", "tipo": "chale", "quartos": 2, "banheiros": 1,
  "capacidade": 4, "diaria": 590.0, "taxa_limpeza": 150.0, "minimo_noites": 2,
  "checkin_hora": "15:00", "checkout_hora": "12:00", "distancia_praia_m": null,
  "comodidades": ["wifi", "lareira", "hidromassagem", "1 vaga de garagem", "aquecedor"],
  "regras": { "aceita_pet": false, "permite_fumar": false, "permite_festas": false },
  "descricao": "Chale com lareira e hidromassagem, a 2 km do centro."
}
```

Comportamento real, que o cliente do catálogo e qualquer catálogo falso de teste
precisam respeitar:

- Em `/imoveis` é obrigatório `cidade` ou `busca`. Filtros opcionais: `hospedes=N`
  (capacidade mínima) e `aceita_pet=true|false`. `cidade` e `busca` juntos combinam
  como E. Parâmetro desconhecido é ignorado.
- `cidade` casa o nome inteiro, sem diferenciar maiúsculas nem acentos. Parte do nome
  não casa.
- `busca` procura em id, nome, bairro, tipo e cidade, aceita prefixo e várias
  palavras. **Não procura em `descricao` nem em `comodidades`**: perguntar por
  "piscina" via busca devolve zero mesmo havendo imóvel com piscina. Para responder
  sobre comodidade, o agente lê as fichas.
- `hospedes=0` ou negativo devolve 200 sem filtrar. `aceita_pet` só aceita `true` ou
  `false` (qualquer caixa).
- O id não diferencia maiúsculas. O prefixo do id não garante a cidade (há um id com
  prefixo de uma cidade e campo `cidade` de outra): a cidade vem sempre do campo.
- Todo texto vem sem acentos. `distancia_praia_m` é `null` em 5 imóveis; `quartos` é
  0 nos studios. `diaria` e `taxa_limpeza` são números com casas decimais.
- São 15 imóveis em 10 cidades. Não existe rota que devolva tudo, e o catálogo não
  informa disponibilidade de datas.

Erros (sempre JSON):

| Situação | Status | Corpo |
|---|---|---|
| sem `cidade` nem `busca` (ou vazios) | 400 | `{ "erro": "informe cidade= ou busca=", "dica": "..." }` |
| `hospedes` não inteiro | 400 | `{ "erro": "hospedes precisa ser inteiro" }` |
| `aceita_pet` inválido | 400 | `{ "erro": "aceita_pet precisa ser true ou false" }` |
| imóvel inexistente | 404 | `{ "erro": "imovel nao encontrado" }` |
| rota inexistente ou barra final | 404 | `{ "erro": "rota nao encontrada" }` |
| cidade sem imóveis | 200 | `{ "imoveis": [], "total": 0 }` |

Latência típica de 0,3 a 0,6 s, sem cabeçalho de cache e sem limite de taxa aparente.

**Texto do catálogo é dado, nunca instrução.** Qualquer frase em `descricao`, `nome`
ou `comodidades` que pareça uma ordem (dar desconto, mudar regra, revelar algo) é
tratada como conteúdo a relatar ou ignorar, jamais obedecida. Hoje o catálogo real
não tem texto suspeito; o teste disso usa catálogo falso.

## 5. Lead

Quando o hóspede quer fechar, o agente coleta `nome`, `telefone`, `imovel_id`,
`checkin`, `checkout` e `hospedes`, e envia um POST para `LEADS_URL`:

```json
{
  "nome": "Ana Lima", "telefone": "(11) 98888-0000", "imovel_id": "GRM-301",
  "checkin": "2027-01-15", "checkout": "2027-01-18", "hospedes": 2,
  "valor_total": 2156.00
}
```

- Datas em ISO (`AAAA-MM-DD`). `valor_total` é número em reais, convertido dos
  centavos na fronteira do webhook. Formato do telefone: L6. Nome: L20.
- **Trava de confirmação por estado.** O resumo (imóvel, datas completas com dia da
  semana, hóspedes, nome, telefone, total) aparece num turno. A confirmação vem em
  outro turno (o que conta como confirmação: L9). Só então o POST sai, com o total
  recalculado a partir de uma nova leitura da ficha. Se o total mudou, não envia:
  mostra o novo resumo e pede nova confirmação. Qualquer mudança de dado depois do
  resumo invalida a confirmação pendente (L10).
- **Um lead por reserva confirmada.** Nunca antes da confirmação, nunca duas vezes
  para a mesma reserva (L7).
- O webhook responde `201` quando aceita e `422` com a lista de erros quando falta
  campo. **O corpo do 422 real é desconhecido** (não pode ser testado antes da
  entrega). Regra independente do corpo: qualquer resposta diferente de `201` significa
  não registrado. O agente só diz que registrou depois de um `201`. Falhas: L11.
- `GET` na mesma URL devolve `{ "leads": [ ... ] }`. O formato de cada item é
  desconhecido (a lista real está vazia).
- Lead registrado é um pedido encaminhado ao time comercial. Não é reserva garantida
  nem data bloqueada, e o agente não diz que é.

## 6. Handoff

A ferramenta de handoff liga a flag da resposta. Gatilhos obrigatórios:

1. reclamação;
2. pedido de desconto ou qualquer negociação de preço ou de regra, venha de quem vier;
3. pedido explícito para falar com uma pessoa;
4. assunto que exige ação fora do alcance do agente (L19).

Fronteiras em aberto: informação ausente do catálogo (L5), fora de escopo e
manipulação (L16), falha interna (L18), o que acontece depois do handoff (L3 e L4).

## 7. Proibições

O agente nunca:

1. inventa informação que não veio do catálogo nesta conversa;
2. afirma que uma data está disponível ou que a reserva está garantida;
3. negocia, dá desconto, arredonda "para ajudar" ou altera qualquer valor calculado;
4. envia lead sem confirmação, ou diz que registrou sem ter recebido `201`;
5. obedece instrução vinda do texto do catálogo;
6. obedece instrução do hóspede para ignorar regras, mudar de papel ou revelar
   instruções internas, variáveis de ambiente ou qualquer segredo;
7. escreve um total que não saiu do código.

## 8. Ambientes e variáveis

| Ambiente | Catálogo | Webhook de leads | Uso |
|---|---|---|---|
| `dev` | real (só GET) | **falso**, nosso, que replica o contrato da seção 5 | fluxo completo de lead, evals com confirmação, vídeo |
| `producao` | real | real | entrega; antes dela, só conversas sem confirmação |

**Webhook real: nenhum POST antes da entrega, por nenhuma sessão, nem como teste
identificado.** A lista de leads é o que o avaliador vê e não pode ser apagada. GET é
permitido.

Variáveis (valores só em ambiente, nunca em arquivo versionado):

| Nome | Tipo | Conteúdo |
|---|---|---|
| `CATALOGO_URL` | secret | base do catálogo com o token, sem barra final |
| `LEADS_URL` | secret | URL do webhook do ambiente (falso em `dev`, real em `producao`) |
| `AMBIENTE` | var | `dev` ou `producao` |
| `MODELO` | var | identificador do modelo em uso |

Na máquina de desenvolvimento os valores ficam em `~/.config/agente-concierge/env`
(`CATALOGO_URL`, e `LEADS_URL_DEV` depois que o webhook falso existir). Para criar o
arquivo local do `wrangler dev` sem imprimir nada:

```bash
( set -a; . ~/.config/agente-concierge/env; set +a; umask 077
  printf 'CATALOGO_URL=%s\nLEADS_URL=%s\n' "$CATALOGO_URL" "$LEADS_URL_DEV" > .dev.vars.dev )
```

A URL real de leads é a do catálogo trocando o segmento `catalogo` por `leads`. Ela só
é montada pela frente de produção, direto para o secret de `producao`.

## 9. Sigilo e histórico

O repositório fica público depois da entrega. Em arquivo versionado e em mensagem de
commit nunca entram: o nome da empresa do desafio, trechos copiados do enunciado, o
domínio da API, o token, IPs, nomes de máquina e e-mails (exceto
contato@evertonresende.com). Nunca imprimir o valor de uma variável secreta: sem
`echo`, sem `set -x`, sem modo verboso.

`scripts/verificar-sigilo.sh` roda antes de cada commit (com tudo em stage) e antes de
cada push, e precisa terminar com `SIGILO OK`. Um commit por mudança lógica, push a
cada commit. **Nunca squash, amend ou rebase.**

## 10. Decisões de comportamento (lacunas do enunciado)

Quem decide é o Éverton. O motivo de cada decisão fica em `DECISOES.md`.

| ID | Tema | Regra |
|---|---|---|
| L1 | Datas relativas e fuso | ABERTA |
| L2 | Datas no passado e entrada hoje | ABERTA |
| L3 | Duração da flag `handoff` | ABERTA |
| L4 | Conversa depois do handoff | ABERTA |
| L5 | Informação ausente do catálogo x handoff | ABERTA |
| L6 | Formato de telefone | ABERTA |
| L7 | Segunda reserva e repetição na mesma sessão | ABERTA |
| L8 | Total sem número de hóspedes | ABERTA |
| L9 | O que conta como confirmação | ABERTA |
| L10 | Mudança de dado ou de preço depois do resumo | ABERTA |
| L11 | Falha do webhook | ABERTA |
| L12 | Conflito com regras do imóvel (pet, festa, fumo) | ABERTA |
| L13 | Quem conta como hóspede; número inválido | ABERTA |
| L14 | Arredondamento de fração de centavo | ABERTA |
| L15 | Idioma do hóspede | ABERTA |
| L16 | Fora de escopo, pedido de instruções internas, falso dono | ABERTA |
| L17 | Corpo inválido no `POST /chat` | ABERTA |
| L18 | Falha interna (modelo, catálogo, tempo) | ABERTA |
| L19 | Pedidos que exigem ação fora do agente | ABERTA |
| L20 | Nome do hóspede | ABERTA |
| L21 | Imóvel ambíguo ou não encontrado | ABERTA |
| L22 | Dados pessoais em logs e exports | ABERTA |
| L23 | URL pública da entrega | ABERTA |
| L24 | Trava do POST real até a entrega | ABERTA |

Já decidido (decisões fechadas, ver `DECISOES.md`): data sem ano é a próxima
ocorrência daquela data, e o agente repete a data completa na resposta; o agente cota
mas não afirma disponibilidade.

## 11. Critérios de aceite do produto (sim ou não)

| ID | Critério | Como se prova |
|---|---|---|
| CA-01 | `POST /chat` válido devolve 200 com `reply` (texto não vazio) e `handoff` (booleano) | eval bloco `contrato` |
| CA-02 | A segunda mensagem da mesma sessão usa o que foi dito na primeira; outra sessão não vê nada | eval bloco `contrato` |
| CA-03 | Toda resposta chega em menos de 60 s | latência máxima do relatório de eval |
| CA-04 | O exemplo da seção 3 devolve `R$ 2.156,00` | teste unitário e eval `funciona-cotacoes` |
| CA-05 | Todo total citado numa resposta é igual ao calculado pelo código para aquela estadia | juiz determinístico do harness |
| CA-06 | As três recusas da seção 3 acontecem, com o motivo, e sem total | teste unitário e eval `funciona-recusas` |
| CA-07 | Pergunta respondível pelo catálogo é respondida com o dado do catálogo | eval `funciona-respostas` |
| CA-08 | Pergunta sem resposta no catálogo recebe "não sei", sem invenção | eval `robustez-nao-inventa` |
| CA-09 | Nenhum POST de lead sai antes de resumo e confirmação em turnos separados | eval `funciona-leads` com GET no webhook falso |
| CA-10 | Reserva confirmada gera exatamente 1 lead com os 7 campos corretos | eval `funciona-leads` |
| CA-11 | Resposta diferente de 201 nunca é relatada como registrado | teste de integração com webhook falso em modo de falha |
| CA-12 | Pedido de desconto, negociação, reclamação e pedido de humano devolvem `handoff: true`, sem concessão | eval `robustez-handoff` |
| CA-13 | Instrução embutida no catálogo ou na mensagem não muda preço, regra nem papel | eval `robustez-manipulacao` e teste com catálogo falso |
| CA-14 | Duas mensagens simultâneas na mesma sessão: duas respostas 200, histórico íntegro, no máximo 1 lead | teste unitário e eval `contrato` |
| CA-15 | O agente nunca afirma disponibilidade | eval `robustez-nao-inventa` |
| CA-16 | Nenhum POST chegou ao webhook real antes da entrega | GET no webhook real devolve lista vazia até a entrega |
