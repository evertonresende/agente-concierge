# Escolha do modelo (frente I)

Estado em 14/11/2026: **principal escolhido pelo Éverton: Claude Haiku 5.5, raciocínio
em nível médio (`DECISOES.md` X22).** O reserva está em aberto entre GLM-5.3 Flash
(provisório, X22), DeepSeek 4.1 Flash e GLM-5.3; o Éverton decide com a tabela abaixo.

**Todos os números deste documento são de código anterior às frentes G e B2 mais
recentes** (prompt, loop e casos novos). A fase 2 remede tudo com F, G e H na `main`.

## Candidatos

| Modelo | Fornecedor | Onde roda | Limite de pedidos (doc) | US$ por milhão (entrada / saída) |
|---|---|---|---|---|
| `anthropic/claude-haiku-5.5` | Anthropic | AI Gateway, chave do Éverton guardada no gateway (BYOK) | o da conta Anthropic dele (4.000 por minuto, informado por ele) | 0,10 / 0,50 |
| `@cf/zai-org/glm-5.3-flash` | Z.ai | Workers AI, plano pago | 20 por minuto por conta e modelo | 0,15 / 0,50 |
| `@cf/deepseek-ai/deepseek-v4.1-flash-1017` | DeepSeek | Workers AI, plano pago | 20 por minuto por conta e modelo | 0,30 / 1,20 |
| `@cf/zai-org/glm-5.3` | Z.ai | Workers AI, plano pago | 20 por minuto por conta e modelo | 1,40 / 4,40 |
| `@cf/openai/gpt-oss-120b` | OpenAI (pesos abertos) | Workers AI | 300 por minuto | 0,35 / 0,75 |

- `gpt-oss-120b`: medido na fase 1; **recusado como principal por decisão do Éverton**.
- Candidato da OpenAI com a chave do Éverton: saiu do plano por decisão dele.
- GPT pelo AI Gateway com billing unificado (`openai/gpt-5.4-mini`): **não medido**, a
  conta não tem créditos do gateway (`AiGatewayError: 2021: Insufficient AI Gateway
  credits`, HTTP 402). Nenhum crédito foi comprado.
- GPT-6 Luna: **não medido**, crédito do gateway indisponível (402).

Os modelos do Workers AI rodam com `reasoning_effort: "low"` (o padrão deles, "high" ou
"max", ameaça o teto de 60 s). O Haiku vai pela mesma binding, no formato Messages, sem
`temperature` e com `output_config.effort` vindo de `MODELO_ESFORCO`.

## Tabela (medida do modelo)

Conjunto dev, 98 casos, servidor local, webhook falso local, código do commit `895d8aa`
(anterior à G e à B2), reserva desligado salvo no Haiku. Nos três modelos do Workers AI,
`--paralelo 1 --pausa-ms 13000`, abaixo do limite de 20 por minuto, com **zero 429** na
janela de cada rodada (contagem do log do AI Gateway por modelo). No Haiku,
`--paralelo 2` sem pausa, reserva GLM-5.3 Flash ligado.

| Modelo | contrato | cotações | leads | recusas | respostas | marco1 | handoff | manipulação | não inventa | total | p50 / p95 / máx | chamadas por conversa | tokens por conversa (entrada / saída) | US$ por conversa | 429 | reserva usado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Haiku 5.5, médio | 77% | 92% | 80% | 81% | 90% | 100% | 78% | 84% | 70% | **82% (81)** | 2,0 / 4,4 / 11,1 s | 2,70 | 12.532 / 528 | 0,0015 | 0 | 0 |
| Haiku 5.5, baixo | 66% | 92% | 80% | 72% | 90% | 100% | 85% | 76% | 70% | 80% (79) | 1,9 / 3,7 / 12,0 s | 2,68 | 12.415 / 447 | 0,0015 | 0 | 0 |
| GLM-5.3 Flash | 77% | 100% | 73% | 100% | 100% | 100% | 92% | 76% | 100% | 89% (88) | 2,0 / 7,7 / 14,3 s | 2,68 | 7.829 / 185 | 0,0013 | 0 | — |
| DeepSeek 4.1 Flash | 77% | 100% | 80% | 90% | 100% | 100% | 100% | 100% | 90% | 92% (91) | 4,3 / 7,9 / 17,0 s | 2,73 | 8.828 / 323 | 0,0030 | 0 | — |
| GLM-5.3 | 77% | 100% | 86% | 90% | 100% | 100% | 100% | 84% | 90% | 91% (90) | 1,9 / 7,9 / 16,6 s | 2,68 | 7.822 / 177 | 0,0117 | 0 | — |

- Nenhum lead antecipado ou duplicado em nenhuma rodada. Nenhum turno acima de 60 s.
- Haiku: nenhum `stop_reason: "refusal"`, nenhuma resposta de contingência causada pelo
  modelo, todas as chamadas com a chave guardada no gateway (`byok: default`).
- A latência dos modelos do Workers AI é por turno com uma conversa por vez; a do Haiku,
  com duas.
- Custo: média de `x-uso-entrada` e `x-uso-saida` vezes o preço da página de cada modelo
  (https://developers.cloudflare.com/ai/models/anthropic/claude-haiku-5.5/ e as páginas
  em https://developers.cloudflare.com/workers-ai/models/).

### Rajada de 10 conversas simultâneas × 4 turnos (só o Haiku)

| Nível | turnos | normais | pelo reserva | contingência | p50 / máx | acima de 60 s |
|---|---|---|---|---|---|---|
| médio | 40 | 40 | 0 | 0 | 2,0 / 4,1 s | 0 |
| baixo | 40 | 40 | 0 | 0 | 2,0 / 3,2 s | 0 |

### Blocos de raciocínio do Haiku

O loop guarda no histórico o texto e as chamadas, sem os blocos de raciocínio. A API
aceita (todas as chamadas 200). No nível médio, com os blocos devolvidos intactos (cópia
de medição, `src/agente/loop.ts` alterado só nela), o resultado foi 81% (80 de 98) contra
82% sem eles: nenhum ganho medido. A linha do loop não mudou.

### Falhas por caso (Haiku contra os outros, mesmo código)

Falham também em pelo menos um dos outros três (são do agente ou do caso, não do
modelo): `con-07-confirmacoes`, `con-10-idioma`, `lead-05-ambigua`, `lead-08-telefone`
(nos quatro modelos), `lead-06-duplo-sim`, `rec-11-hospedes-invalidos`,
`man-13-burlar-capacidade-com-bebes`, `man-07-capacidade` (só no baixo).

Só do Haiku, em dois padrões de redação: cita a diária ou a noite com acréscimo sem um
rótulo que o juiz do runner reconheça ("Valor ... aparece sem rótulo de componente"), e
diz que o catálogo não informa com palavras que a expressão do caso não aceita
(`inv-01`, `inv-06`, `inv-07`, `inv-10`). Os valores citados batem com o cálculo do
código. Na conferência da coordenadora no runtime real (83 de 98), 8 das 15 falhas são
desse juiz de rótulo, já com a dona dos casos.

## Medidas que não medem o modelo (registro)

**Fase 1, sem pausa, `--paralelo 2`, commit `8bc3d2a` a `4c7f1c7`, 87 casos.** Nos
modelos pagos o número mediu o limite de 20 por minuto: DeepSeek 22% com 241 de 289
chamadas em 429, GLM-5.3 18% com 245 de 284. O `gpt-oss-120b` (300 por minuto) deu 83%,
p95 de 7,8 s e máximo de 31,8 s, sem nenhum 429.

**Incidente da porta 8793.** Entre 22h53 e 22h58 UTC de 13/11, rodadas de CHECK de
outra frente foram apontadas por engano para o servidor local do DeepSeek, no meio da
rodada com pausa dele. O log do gateway mostra 173 respostas 429 do DeepSeek em
22h55–22h56 (antes e depois, 4 a 8 chamadas por minuto, todas 200). Como o relatório do
runner não registra a hora de cada caso, a rodada inteira foi descartada e **refeita do
zero no mesmo ritmo** a partir de 23h17; a linha do DeepSeek acima é a refeita (zero 429
na janela). O parcial contaminado ficou fora do repositório.

**Recusa simultânea do principal e do reserva** (GLM-5.3 Flash e DeepSeek, 10 conversas
de 4 turnos em duas ondas, sem pausa, commit `895d8aa`): 80 turnos, todos HTTP 200; 26
normais e 54 no aviso de contingência com `handoff: true`, em menos de 1 s; nenhum acima
de 60 s; 136 respostas 429 do GLM-5.3 Flash e 110 do DeepSeek. Por decisão do Éverton
(L18 nova), recusa por limite vai direto ao reserva e, se o reserva também recusar, sai o
aviso sem repetir o turno (`porLimite`, testado em `test/modelo.test.ts`).

## Modelo reserva

- Configuração: `MODELO_RESERVA`, hoje `@cf/zai-org/glm-5.3-flash` em `dev` e em
  `producao` (provisório, X22). Fornecedor diferente do principal (Z.ai contra
  Anthropic) e infraestrutura diferente (Workers AI contra a API da Anthropic pelo
  gateway).
- Comportamento: o principal tem 20 s; se lançar, recusar (`refusal`) ou passar do
  prazo, o reserva responde a mesma chamada.
- Prova em teste: `npm test -- modelo`, teste `reserva assume quando o principal falha`,
  e `test/modelo-producao-i.test.ts` (sem gateway, o Haiku falha e o reserva responde;
  sem reserva, aviso honesto com `handoff: true`).
- Prova local (fase 1): com o principal num modelo inexistente, o principal falhou com
  `AiError: 5007` e o reserva respondeu (log do gateway: 400 do principal, 200 do
  reserva). A prova em `dev` publicado fica com a coordenadora.

## O que falta para `producao` usar o Haiku (frente K, com ordem do Éverton)

Hoje `producao` tem o Haiku em `MODELO`, mas não tem `AI_GATEWAY` (P10): toda chamada ao
Haiku falha e o GLM-5.3 Flash responde.

1. Criar o gateway `concierge-producao` com autenticação ligada e o Secrets Store da
   conta associado (a API exige o `store_id` antes de guardar chave).
2. Guardar a chave da Anthropic: secret `concierge-producao_anthropic_default` no
   Secrets Store, com escopo `ai_gateway`, e a configuração de provedor `anthropic` com
   apelido `default`. O valor vai por entrada padrão, nunca em argumento.
3. Pôr `"AI_GATEWAY": "concierge-producao"` em `env.producao.vars` e publicar. Antes do
   gateway existir, não nomear: um gateway inexistente derruba também o reserva, que
   passa pelo mesmo gateway.
4. Conferir no log do gateway de `producao` que as chamadas ao Haiku saem com
   `byok: default`.

## Opinião da frente (não é decisão)

Para reserva, o GLM-5.3 Flash: no mesmo código mediu 89%, perto do DeepSeek (92%) e do
GLM-5.3 (91%), é o mais barato por conversa (US$ 0,0013 contra 0,0030 e 0,0117) e tem o
p95 de 7,7 s. Os três têm o mesmo limite de 20 por minuto, então o limite não desempata;
a diferença de acerto entre eles é de 3 casos em 98, dentro da variação que medimos entre
duas rodadas do mesmo modelo.

## Método

1. AI Gateway `concierge-dev` (logs ligados, sem cache, sem retry do gateway). A única
   chave guardada é a da Anthropic (BYOK); a da OpenAI foi removida do gateway e do
   Secrets Store por ordem do Éverton.
2. Um servidor local por candidato (`wrangler dev --env dev`, `MODELO` por `--var`,
   estado próprio), webhook falso local, `/saude` com `leads_destino: "falso"` antes de
   cada rodada.
3. `node evals/rodar.mjs --conjunto dev` com `LEADS_URL_DEV` no webhook falso local; nos
   modelos de 20 por minuto, `--paralelo 1 --pausa-ms 13000`, abortando se houver 429
   nos 3 primeiros minutos.
4. Qual modelo respondeu, 429 e reserva: log do AI Gateway por modelo e status na janela
   de cada rodada, conferido com a linha `modelo_falhou` do log local.
5. Rajada: 10 sessões simultâneas de 4 turnos, sem confirmação, com o texto, o status, o
   `handoff` e a latência de cada turno.
