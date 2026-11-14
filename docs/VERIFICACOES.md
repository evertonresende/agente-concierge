# Verificações feitas antes do planejamento

Feitas em 13/11/2026 por subagentes em paralelo, na documentação oficial da Cloudflare
e, no caso do catálogo, por GET na API real. Cada item traz a pergunta, a resposta, a
consequência para o projeto, as fontes e o que ficou desconhecido (com o passo que
resolve e a frente responsável). Nada aqui foi assumido de memória.

## 1. Concorrência no Durable Object

**Pergunta.** Um Durable Object pode intercalar outro pedido enquanto espera uma
chamada externa? Qual mecanismo garante uma mensagem por vez na mesma sessão?

**Resposta.**
- Sim. `await fetch()` abre o input gate e outros pedidos intercalam. O input gate só
  protege operações de storage. O output gate só retém respostas e fetches de saída até
  as gravações pendentes persistirem; não serializa nada.
- `blockConcurrencyWhile` tem timeout de 30 s e, se estourar, o objeto é resetado. Não
  serve em volta de uma chamada de modelo de 5 a 40 s. A própria doc diverge: uma página
  admite uso em volta de `fetch()` externo, outra chama isso de anti-padrão.
- O remédio da doc para I/O externo é checagem otimista, que só detecta o conflito
  depois: não impede duas chamadas de modelo nem dois POSTs de lead.
- Duração do pedido: ilimitada enquanto o chamador estiver conectado. CPU: 30 s por
  pedido (até 5 min configurável); espera de I/O não conta. Pedido em andamento impede
  hibernação e eviction. Em atualização do runtime, pedidos em andamento têm 30 s.
- Memória se perde em eviction, hibernação (10 s ocioso) ou exceção não capturada.
  `ctx.storage.sql` e `ctx.storage.kv` são síncronos e só existem em classes SQLite.

**Consequência.** Mecanismo escolhido: fila de promises em memória dentro do objeto
(uma mensagem por vez, na ordem de chegada) mais um marcador de idempotência gravado no
storage **antes** do POST do lead. A fila não sobrevive a reset; o marcador sim. Estado
da conversa e do lead vive no storage, nunca só em memória.

**Fontes.**
- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- https://developers.cloudflare.com/durable-objects/api/state/
- https://developers.cloudflare.com/durable-objects/reference/glossary/
- https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/reference/in-memory-state/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/
- https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/

**Desconhecido.**
- `env.AI.run` não é citado na doc de concorrência; tratado como I/O comum por analogia.
  Fila em memória também não aparece na doc (é inferência). → Frente A prova com o teste
  de duas mensagens simultâneas (modelo travado por uma promise, assert de ordem).
- Não há exemplo documentado desse teste; existem `runInDurableObject` e
  `evictDurableObject`. → Frente A monta; frente H endurece.

## 2. Modelos com chamada de ferramenta

**Pergunta.** Quais modelos com chamada de ferramenta estão disponíveis no Workers AI e
pelo AI Gateway, com preço e limites? Quais vão ao eval?

**Resposta.** Candidatos (custo para 8 chamadas, ~24 mil tokens de entrada e 2,4 mil de
saída, sem cache; ordem é estimativa, a doc não mede confiabilidade):

| # | Modelo | Contexto | US$/M entrada/saída | US$/conversa | Observação |
|---|---|---|---|---|---|
| 1 | `anthropic/claude-sonnet-5.5` | 1M | 2,00 / 10,00 | 0,072 | via gateway; formato Messages exige adaptador |
| 2 | `openai/gpt-5.4-mini` | 128k | 0,75 / 4,50 | 0,029 | via gateway; `tools` e `tool_choice` documentados |
| 3 | `google/gemini-3.8-flash` | 1M | 0,75 / 3,75 | 0,027 | via gateway; idem |
| 4 | `@cf/zai-org/glm-5.3` | 1M | 1,40 / 4,40 | 0,044 | nativo; reasoning não desliga, risco para os 60 s |
| 5 | `@cf/deepseek-ai/deepseek-v4.1-flash-1017` | 1M | 0,30 / 1,20 | 0,010 | nativo; reasoning `none` disponível |
| 6 | `@cf/openai/gpt-oss-120b` | 128k | 0,35 / 0,75 | 0,010 | nativo; baseline barato, 300 req/min |

- Fora do eval: dois modelos nativos com depreciação marcada para 20/11/2026.
- Limites do Workers AI: 10.000 neurons/dia grátis (no Free estourar dá erro; no Paid
  custa US$ 0,011 por mil); 300 req/min em geração de texto; **20 req/min** por
  conta/modelo nos modelos que exigem plano pago (50 com créditos pré-pagos).
- AI Gateway: gratuito. Autenticação por chave na requisição, BYOK armazenada ou billing
  unificado (créditos pré-pagos, taxa de 5%, 200 req/60 s). Retries e timeout por
  cabeçalho (`cf-aig-max-attempts`, `cf-aig-request-timeout`); fallback por array no
  endpoint universal ou roteamento dinâmico; custo estimado nos logs.
- Chamada: `env.AI.run(modelo, { messages, tools }, { gateway: { id } })`; terceiros usam
  a mesma forma com id `autor/modelo`.

**Consequência.** O marco 1 começa com modelo nativo do Workers AI atrás da variável
`MODELO`, sem chave externa. A escolha final sai do eval comparativo (frente I), com
confiabilidade de ferramenta e teto de 60 s antes de preço. O limite de 20 req/min dos
nativos pagos pesa contra eles se a bateria do avaliador rodar em paralelo.

**Fontes.**
- https://developers.cloudflare.com/workers-ai/features/function-calling/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/platform/limits/
- https://developers.cloudflare.com/ai/models/
- https://developers.cloudflare.com/ai-gateway/reference/pricing/
- https://developers.cloudflare.com/ai-gateway/reference/limits/
- https://developers.cloudflare.com/ai-gateway/features/unified-billing/
- https://developers.cloudflare.com/ai-gateway/configuration/request-handling/
- https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/
- https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/
- Página de cada modelo em https://developers.cloudflare.com/workers-ai/models/ e
  https://developers.cloudflare.com/ai/models/

**Desconhecido.**
- O filtro "Function calling" do catálogo não foi lido; a confirmação foi modelo a
  modelo. → Frente I confere no painel antes do eval.
- Dois modelos pequenos de terceiros aparecem com preços idênticos e suspeitos, e a
  página de um deles não menciona ferramentas; ficaram fora da tabela. → Frente I
  confirma no painel antes de considerar.
- `tools` via binding para modelo de terceiros não tem exemplo na doc. → Frente I prova
  com uma chamada real no eval.

## 3. Plano pago e riscos de 7 dias no ar

**Pergunta.** O que o projeto exige do plano pago e o que pode derrubar o agente em 7
dias (cota, limite que bloqueie o avaliador)?

**Resposta.**

| Item | Free | Paid |
|---|---|---|
| CPU por pedido | 10 ms (estourou: erro 1102) | 30 s, até 5 min via `limits.cpu_ms` |
| Tempo de relógio esperando I/O | sem limite rígido com cliente conectado | igual |
| Pedidos | 100 mil/dia (estourou: erro 1027) | 10 milhões/mês inclusos |
| Subrequests por pedido | 50 | 10.000 |
| Durable Objects | só SQLite; 100 mil pedidos/dia, 13.000 GB-s/dia, 5 GB | sem cota diária |
| Workers AI | 10.000 neurons/dia; estourou: 429 | mesma franquia; excedente cobrado |
| Logs | 200 mil eventos/dia, 3 dias | 20 milhões/mês, 7 dias |

O que derruba:
- **Erro 1010 (Browser Integrity Check).** Ativo em todo `workers.dev`, não desliga,
  acontece antes do Worker e não aparece nos logs. A doc cita o User-Agent padrão do
  `urllib` do Python como bloqueado; curl e `requests` não são citados.
- Rate limit do modelo (item 2) e falta de capacidade (429).
- Cota diária do Free: com modelo nativo médio, cerca de 85 chamadas de modelo por dia.
- Limite de gasto do tipo `usage_block`: bloqueia a conta inteira com erro 1103.

**Consequência.**
- Plano pago é pré-requisito antes dos evals em volume (leva 2) e da entrega.
- O erro 1010 vira a lacuna **L23** (URL pública) e um teste obrigatório da URL
  publicada com curl, python-requests, urllib e fetch do Node (frente K).
- `observability.enabled = true`; retry com backoff em 429; alertas de gasto por
  `notification`, nunca `usage_block`.

**Fontes.**
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers-ai/platform/errors/
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/
- https://developers.cloudflare.com/workers/platform/spend-management/
- https://developers.cloudflare.com/billing/manage/spend-management/cli/
- https://developers.cloudflare.com/ai-gateway/features/spend-limits/

**Desconhecido.**
- Se os 10 ms de CPU do Free valem para o Durable Object. → Irrelevante com o plano pago.
- Limite de rajada e Bot Fight Mode em `workers.dev` não constam na doc atual. → Frente K
  mede com rajada de pedidos contra a URL publicada.
- Qual cliente o avaliador usa. → Não dá para saber; o teste com quatro clientes cobre.

## 4. Ambientes e secrets no wrangler

**Pergunta.** Como separar `dev` e `producao`, com secrets por ambiente?

**Resposta.**

```jsonc
{
  "name": "concierge", "main": "src/index.ts",
  "compatibility_date": "2026-11-13",
  "observability": { "enabled": true },
  "exports": { "Sessao": { "type": "durable-object", "storage": "sqlite" } },
  "env": {
    "dev": {
      "ai": { "binding": "AI" },
      "durable_objects": { "bindings": [{ "name": "SESSAO", "class_name": "Sessao" }] },
      "vars": { "AMBIENTE": "dev" },
      "secrets": { "required": ["CATALOGO_URL", "LEADS_URL"] }
    },
    "producao": { /* mesmo bloco, AMBIENTE "producao" */ }
  }
}
```

- Herdado do topo: `name`, `main`, `compatibility_date`, `observability`, `triggers`,
  `exports`. **Não herdado**, repetir por ambiente: `vars`, `durable_objects`, `secrets`
  e demais bindings (`ai` incluso).
- Nome final: `<nome>-dev` e `<nome>-producao`, cada um com sua URL e seus namespaces.
- `secret put|bulk|list` aceitam `--env`. `secret put` cria versão e **implanta na
  hora**. `list` devolve só nome e tipo.
- `secrets.required` faz o deploy falhar se faltar algum secret.
- Local: com `wrangler dev --env dev`, se existir `.dev.vars.dev`, só ele é carregado.
- `exports` substitui `migrations` (legado, ainda funciona); os dois são mutuamente
  exclusivos e não há volta.
- O pacote de teste foi renomeado no npm para `@cloudflare/vitest-plugin`; bindings
  falsos entram por `miniflare.bindings`; fetch de saída por mock global ou receita
  `@msw/cloudflare`.
- Primeiro deploy de um Worker que ainda não existe exige `deploy --secrets-file`.
- Deploy sem `--env` só emite aviso e mira o topo.

**Consequência.** Topo sem variáveis nem secrets (um deploy acidental dele não tem
webhook para chamar) e scripts npm com `--env` explícito. `wrangler.jsonc`, não TOML.

**Fontes.**
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/wrangler/environments/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/
- https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/
- https://developers.cloudflare.com/workers/configuration/compatibility-dates/

**Desconhecido** (frente A confere na doc ao implementar):
- Se `secrets.required` é checado no `--dry-run`.
- Se o plugin de teste carrega `.dev.vars`.
- Wrangler instalado (4.156.1) é anterior ao do npm; com `compatibility_date` de hoje
  pode haver aviso no dev.

## 5. Validar `producao` sem enviar lead

**Pergunta.** Como validar a configuração de `producao` do webhook sem nenhum POST?

**Resposta.**

| Mecanismo | Prova | Não prova |
|---|---|---|
| `deploy --dry-run --env producao` | config e bundle compilam | secrets, conta, Durable Object |
| `secret list --env producao` | os nomes existem | valor correto |
| `types --check` | tipos em dia com a config | corpo dos tipos |
| deploy real com `secrets.required` | secrets presentes | URL certa |
| `GET /saude` do Worker | presença das variáveis e destino dos leads (`falso` ou `real`), sem ler valor | que o POST é aceito |
| `GET` no webhook real (permitido) | URL e token corretos; precisa devolver lista vazia | aceitação do payload |
| Fluxo completo em `dev` contra o webhook falso | o caminho de POST, com o **mesmo código** | o receptor real |
| Harness | recusa casos com confirmação quando o alvo não é `dev` | — |

`versions upload` não é rota confiável com Durable Object (a doc diverge).

**Consequência.** Produção é validada por composição: config e secrets (wrangler),
destino (GET), caminho de envio (dev). O que continua sem prova até a entrega é a
aceitação real do payload: o corpo do 422 real é desconhecido. Mitigação: o webhook
falso valida os 7 campos e o agente trata qualquer resposta diferente de 201 como não
registrado.

**Fontes.**
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/languages/typescript/
- https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/

**Desconhecido.** Formato do 422 e de um item da lista de leads do webhook real. → Só se
resolve com o primeiro lead real, depois da entrega; nenhuma frente tenta antes.

**Atualização de 14/11 (X36 em `DECISOES.md`).** O Éverton autorizou um lead de teste no
webhook real, um só. Ele saiu às 07h26 de uma conversa em `producao`, pelo caminho real do
agente (cotação, resumo e "sim"), com o exemplo do Marco 1.

- A lista real, lida por GET, foi de 0 (07h26:39) para 1 (07h26:47), com os sete campos
  iguais aos do resumo.
- O webhook respondeu `201`: o agente devolveu o texto fixo de registrado, que o código só
  escreve depois de um `201` (`src/lead.ts:697`), e o log de `producao` tem nessa janela 1
  turno com envio `registrado`. O número da resposta não vai para o log.
- Com isso a aceitação real do payload está provada para os sete campos desse exemplo.
- O formato de um item da lista ficou conhecido: um objeto com `lead` (os sete campos
  enviados), `recebido_em` (data e hora) e `token`. O corpo do 422 real continua
  desconhecido.
- A linha da tabela que pede lista vazia não vale mais. O modo completo e o `--so-leitura`
  do script exigem zero lead real e reprovam por construção; a conferência passa a ser
  `--entrega` (`LEADS REAIS: 1` às 07h28) e `--clientes`.
- Qualquer outro POST ao webhook real continua proibido.

Fonte: leitura por GET da lista real em 14/11, antes e depois do envio; `src/lead.ts`; log
do Worker de `producao`.

## 6. Catálogo real

**Pergunta.** Qual o formato real das respostas e dos erros, há campos além do exemplo
e há texto suspeito nas descrições?

**Resposta.** Cerca de 95 requisições, todas GET. A versão normativa está em
`docs/CONTRATO.md`, seção 4.

- `/cidades` → `{ "cidades": [{ cidade, uf, imoveis }] }`, 10 cidades.
- `/imoveis` → `{ "imoveis": [...], "total": N }`; item com 7 campos, sem preço.
- Ficha: 18 campos, iguais nos 15 imóveis, sem extras nem ausentes.

| id | cidade | diária | limpeza | mínimo | capacidade | pet |
|---|---|---|---|---|---|---|
| BMB-201 | Bombinhas | 320,00 | 110,00 | 2 | 3 | sim |
| BMB-202 | Bombinhas | 1.150,00 | 320,00 | 4 | 10 | sim |
| CGT-901 | Caraguatatuba | 540,00 | 170,00 | 2 | 8 | não |
| FLN-101 | Florianopolis | 280,00 | 90,00 | 2 | 2 | não |
| FLN-102 | Florianopolis | 890,00 | 250,00 | 3 | 7 | sim |
| FLN-103 | Florianopolis | 640,00 | 180,00 | 2 | 5 | não |
| FOZ-701 | Foz do Iguacu | 420,00 | 130,00 | 2 | 5 | sim |
| GRM-301 | Gramado | 590,00 | 150,00 | 2 | 4 | não |
| GRM-302 | Gramado | 430,00 | 120,00 | 3 | 2 | não |
| IMB-801 | Imbituba | 475,00 | 140,00 | 2 | 4 | sim |
| NAT-601 | Natal | 365,90 | 95,00 | 2 | 3 | não |
| NAT-602 | Tibau do Sul | 760,00 | 210,00 | 3 | 6 | sim |
| RIO-401 | Rio de Janeiro | 980,00 | 260,00 | 3 | 4 | não |
| RIO-402 | Rio de Janeiro | 245,50 | 75,00 | 1 | 2 | sim |
| SAO-501 | Sao Paulo | 310,00 | 100,00 | 1 | 2 | não |

- Busca: cobre id, nome, bairro, tipo e cidade; **não** cobre descrição nem
  comodidades. `cidade` casa o nome inteiro. `hospedes=0` não filtra. Id não diferencia
  maiúsculas.
- Preço: o acréscimo de 20% dá centavos inteiros nos 15, mas em ponto flutuante a
  diária de 245,50 vira 294,59999999999997.
- Erros: 400 e 404 em JSON com campo `erro`; cidade inexistente devolve 200 com lista
  vazia. Latência de 0,3 a 0,6 s; nenhum 429 em rajada de 12 paralelas.
- Texto suspeito: nenhum. Sem instrução embutida, link, contato ou preço contraditório.
  `permite_fumar` e `permite_festas` são falsos em todos.
- Webhook de leads, um GET: 200 com `{"leads": []}`.

**Consequência.** Cálculo em centavos inteiros; comodidade se responde lendo fichas, não
pela busca; injeção via catálogo se testa com catálogo falso, fiel a este formato.

**Fontes.** GET na API real em 13/11/2026 (respostas brutas fora do repositório).

**Desconhecido.** Campos de um lead na listagem (lista vazia). → Não se resolve antes da
entrega. (Resolvido em 14/11 com o lead de teste da X36: ver a atualização no fim da
seção 5.) Se o catálogo muda com o tempo. → Frente L: o monitor diário compara a
contagem de imóveis.

**Atualização de 14/11/2026 (X37, antes de o agente deixar de seguir redirecionamento).** 73
GETs diretos, sem seguir redirecionamento, em todas as rotas que o agente usa: `/cidades`, a
busca com `cidade`, `busca`, `hospedes` e `aceita_pet`, e as 15 fichas por id (também com o id
em minúsculas). Nenhuma resposta 3xx e nenhum cabeçalho `Location`. O maior corpo tem 593
bytes; o teto do agente é 1.048.576. A busca sem `cidade` nem `busca` responde 400. Dos 777
textos lidos em 26 documentos, nenhum tem caractere invisível ou de direção, e nenhum tem
emoji.

## Token da Cloudflare

O token da conta autentica: verificado na API em 13/11/2026, estado ativo. É usado
sempre por referência, no mesmo comando que precisa dele, nunca ecoado e nunca como
secret de runtime de um Worker.

## Zona do subdomínio de produção (leitura na API em 13/11/2026)

Feita depois da decisão L23 (produção em subdomínio próprio), só com GET.

| Item | Resultado |
|---|---|
| Zona do domínio | ativa, plano gratuito |
| Checagem de integridade de navegador | **ligada** na zona inteira; por isso a regra que a desliga só para o hostname de produção é necessária |
| Registro de DNS do subdomínio de produção | não existe ainda |
| Bot Fight Mode | **desconhecido**: o token não tem permissão de leitura de bots (erro de autenticação na rota) |
| Permissão para criar regra de configuração por hostname | **desconhecida**: a leitura da fase de regras falhou sem código claro |

**Atualização de 14/11/2026 (X37), só com leitura do HTML servido.** No hostname de
produção, a borda insere na página de chat um script de detecção de robôs e, em parte dos
pedidos, um link oculto com atributo de estilo. No endereço padrão do Worker e em `dev`, não
insere. O script e o estilo da própria página saem iguais nos três endereços. Consequência
para a política de conteúdo da página: P43 em `DECISOES.md`.

Passo que resolve os dois desconhecidos: frente K. Se o Bot Fight Mode estiver ligado,
ela não desliga (vale para o domínio inteiro) e leva ao Éverton; se faltar permissão
para a regra, o Éverton cria a regra no painel. Fonte do risco:
https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
