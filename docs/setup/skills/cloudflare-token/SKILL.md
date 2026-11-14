---
name: cloudflare-token
description: Credencial única da API da Cloudflare do autor: uso só por referência, tipo de token, segurança e os gotchas medidos (PATCH de settings de Worker, wrangler deploy reescreve vars, Builds API só aceita token de usuário, Observability). Use ANTES de qualquer chamada à API da Cloudflare, wrangler deploy que mexa em vars, ou leitura de telemetria.
---

<!--
  Cópia para docs/setup/ (entrega do agente concierge). Versão reduzida: saíram o
  caminho do arquivo da credencial, identificadores de conta, nomes de Workers, contas e
  tokens de outros projetos, e as seções que só valem para eles. Ficou o que esta
  entrega usou: credencial por referência, nunca ecoada, nunca secret de Worker, e os
  gotchas de plataforma.
-->

# Token da Cloudflare

Uma credencial de API cobre as contas da Cloudflare do autor. Fica num arquivo local com
permissão `600`, **fora de qualquer repositório**, e é consumida por referência — nunca
ecoada, nunca colada em prompt, issue, PR ou log.

```bash
T=$(cat <arquivo da credencial>)   # sempre assim; nunca `echo $T`
curl -s -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/accounts
```

Nesta entrega, o comando de deploy recebe a credencial como `CLOUDFLARE_API_TOKEN`,
carregada por referência no mesmo comando, e a conta vem do arquivo de ambiente do
projeto.

## Tipo de token

🔴 **Tem que ser token de USUÁRIO** (Meu perfil → Tokens de API). A área de tokens da conta
gera outro tipo, e a **Builds API só aceita o de usuário** — token de conta responde
`12006 Invalid token` em `/builds/...` enquanto lê `/workers/scripts` normalmente, o que
parece falta de permissão e não é. Diagnóstico de 1 comando: `GET /user/tokens/verify` →
usuário devolve `status: active`, conta falha com `Invalid API Token`.

Gravar no terminal do usuário, nunca pelo atalho de shell da sessão de IA (o texto do
comando entra na transcrição junto com o valor):

```bash
umask 077
cat > <arquivo da credencial>     # colar o valor, Enter, Ctrl-D
chmod 600 <arquivo da credencial>
```

⚠️ Uma varredura só de LEITURA (`200` num GET) não prova permissão de escrita no mesmo
recurso.

## Segurança

- 🔴 **Nunca como secret de runtime de Worker.** A credencial edita Workers, bancos,
  armazenamento, cofre de segredos e DNS em todas as contas — dentro de um Worker vira
  chave-mestra num processo que normalmente só precisa ler uma coisa. Worker que precisa
  de telemetria leva token separado, só `Workers Observability:Read`.
- Vazou (colado em chat, log, screenshot)? **Rotacionar**, não torcer. Apagar a conversa não
  garante a limpeza de caches e logs intermediários.

## Gotchas medidos — economizam horas

### Editar `vars` de Worker sem apagar os secrets

`PATCH /accounts/{conta}/workers/services/{worker}/environments/production/settings`

1. **`multipart/form-data`, campo `settings`.** JSON cru → `10001 Content-Type must be one of:
   multipart/form-data`. Use `curl -F "settings=@patch.json;type=application/json"`.
2. **A lista de bindings é REPLACE.** O GET devolve `secret_text` **sem valor**; reenviar assim
   apaga o secret. Preservar com `{"type":"inherit","name":"X"}`.
3. **A resposta do PATCH omite o binding herdado.** Não é sinal de que sumiu — confira com um
   GET novo.
4. **`10214: the latest version isn't currently deployed`** não é payload errado: existe
   versão enviada e não publicada, e editar var publicaria ela junto. Parar e avisar.
5. **`wrangler deploy` reescreve os `vars` a partir do `wrangler.jsonc`.** Var setada à mão
   morre em todo deploy → reaplicar DEPOIS, sempre.

### Worker novo no endereço padrão → `404 error code: 1042`

Worker **recém-criado** pode responder `404` com corpo `error code: 1042` em qualquer rota,
sem nenhuma invocação no log. Fix: `"compatibility_flags": [..., "global_fetch_strictly_public"]`.
Esta entrega usa o flag no `wrangler.jsonc`.

### Observability

- `POST /accounts/{conta}/workers/observability/telemetry/query`. O dataset é
  **`cloudflare-workers`**; `cf-workers-logs` responde `success: true` com resultado VAZIO —
  falha silenciosa.
- `telemetry/keys` é **POST**, não GET (o GET devolve `404 Not Found`, que parece caminho
  errado).
- O resultado da query vive em **`result.calculations`**, não em `result.run.calculations`.
- Amostragem: janelas de até 24h dão `abr_level: 1` (exato); janelas maiores amostram e
  multiplicam de volta. Para contar, só `view: "calculations"` — `view: "events"` amostra
  mesmo em 24h. O teto de grupos é `parameters.limit`, com padrão silencioso de 10.
