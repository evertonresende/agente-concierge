# Escolha do modelo (frente I)

Estado: **fase 1, preliminar**. A escolha e o `MODELO` fixo saem na fase 2, depois que a
frente G (prompt e loop) entrar na `main`; a classificação pode mudar com ela.

## Candidatos

| Modelo | Fornecedor | Onde roda | Limite de pedidos (doc) |
|---|---|---|---|
| `@cf/openai/gpt-oss-120b` | OpenAI (pesos abertos) | Workers AI | 300 por minuto |
| `@cf/deepseek-ai/deepseek-v4.1-flash-1017` | DeepSeek | Workers AI, plano pago | 20 por minuto por conta e modelo |
| `@cf/zai-org/glm-5.3` | Z.ai | Workers AI, plano pago | 20 por minuto por conta e modelo |

- O candidato da OpenAI com a chave do Éverton saiu do plano por decisão dele.
- O candidato GPT pelo AI Gateway com billing unificado (`openai/gpt-5.4-mini`) não pôde
  ser medido: a conta não tem créditos do gateway. Erro devolvido:
  `AiGatewayError: 2021: Insufficient AI Gateway credits` (HTTP 402 no log do gateway).
  Por ordem do Éverton, nenhum crédito foi comprado e nada de cobrança foi alterado.

Os três passam pelo mesmo código (`src/modelo.ts`), trocando só `MODELO`. DeepSeek e GLM
rodam com `reasoning_effort: "low"`: o padrão deles ("high" e "max") ameaça o teto de 60 s.

## Tabela preliminar (fase 1)

Conjunto dev contra o servidor local, `--paralelo 2`, código do commit `8bc3d2a` (gpt-oss)
e `4c7f1c7` (DeepSeek e GLM; a diferença é só o ajuste de raciocínio do GLM), antes da
frente G. Reserva desligado durante a medida. 87 conversas por candidato, nenhuma pulada
pela trava.

| Modelo | contrato | cotações | leads | recusas | respostas | marco1 | handoff | manipulação | não inventa | total | p95 | máx | US$/conversa | 429 no eval | 10 simultâneas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | 88% | 84% | 75% | 63% | 90% | 100% | 90% | 88% | 90% | 83% | 7,8 s | 31,8 s | 0,0022 | 0 de 253 | 10 × 200, 0 contingência, 0 erro de limite |
| deepseek-v4.1-flash | 77% | 7% | 8% | 0% | 0% | 50% | 60% | 44% | 0% | 22% | 4,8 s | 8,5 s | (0,0006)* | 241 de 289 | 10 × 200, 0 contingência, 0 erro de limite |
| glm-5.3 | 66% | 0% | 0% | 0% | 0% | 50% | 60% | 33% | 0% | 18% | 2,4 s | 8,8 s | (0,0018)* | 245 de 284 | 10 × 200, 0 contingência, 0 erro de limite |

\* Subestimado: a maior parte das conversas terminou na resposta de contingência depois do
429, então gastou menos tokens do que uma conversa completa gastaria.

Leitura: nos dois modelos pagos o número mede o limite de 20 pedidos por minuto, não a
qualidade. Um turno faz de 2 a 3 chamadas de modelo; com duas conversas em paralelo o
runner passa de 20 por minuto e o 429 (`AiError: 3021: rate limiting`) vira resposta de
contingência. Nas 10 simultâneas, com a janela de um minuto zerada, os três responderam
tudo (21 chamadas). Nenhum lead antecipado ou duplicado em nenhuma rodada.

## Modelo reserva

- Variável `MODELO_RESERVA` (só no bloco `dev` por enquanto): hoje
  `@cf/deepseek-ai/deepseek-v4.1-flash-1017`, de outro fornecedor que o principal
  (gpt-oss), alcançável sem chave de terceiro.
- Comportamento: o principal tem 20 s; se lançar ou passar disso, o reserva responde a
  mesma chamada. Sem reserva, o erro sobe para o loop, que tenta de novo e depois dá a
  resposta de contingência (contrato L18).
- Prova em teste: `npm test -- modelo`, teste `reserva assume quando o principal falha`.
- Prova local: com `MODELO=@cf/frente-i/modelo-inexistente` e o reserva ligado, o
  principal falhou com `AiError: 5007: No such model` e o DeepSeek respondeu à pergunta do
  hóspede (log do gateway: 2 chamadas 400 do principal, 2 chamadas 200 do reserva).
  A prova em `dev` publicado fica para a fase 2 (o deploy é da coordenadora).

## Método

1. AI Gateway `concierge-dev` (logs ligados, sem cache, sem retry do gateway), criado pela
   API com a credencial da Cloudflare por referência. Nenhuma chave de provedor guardada.
2. Por candidato: `.dev.vars.dev` com `MODELO=<candidato>` e `MODELO_RESERVA` vazio;
   `npx wrangler dev --env dev --port 8793`; webhook falso local na porta 8794, com
   `/saude` mostrando `leads_destino: "falso"` antes de cada rodada.
3. `node evals/rodar.mjs --alvo http://127.0.0.1:8793 --conjunto dev --paralelo 2`, com
   `LEADS_URL_DEV` apontando para o webhook falso local. Uma rodada por vez.
4. Qual modelo respondeu e quantos 429 houve: contagem do log do AI Gateway por modelo e
   status na janela da rodada, conferida com a linha `modelo_falhou` do log local.
5. 10 conversas simultâneas: 10 sessões diferentes, uma mensagem cada (cotações e
   perguntas de catálogo), sem confirmação, disparadas juntas depois de 60 s sem
   chamadas ao modelo.
6. Custo por conversa: média de `x-uso-entrada` e `x-uso-saida` do relatório vezes o
   preço da página de cada modelo no Workers AI (US$ por milhão de tokens de entrada e de
   saída: gpt-oss 0,35 e 0,75; DeepSeek 0,30 e 1,20; GLM 1,40 e 4,40).
