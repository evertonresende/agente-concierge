# Webhook de leads falso e catálogo próprio

Worker próprio deste diretório, separado do Worker do agente. Replica o contrato §5
do `docs/CONTRATO.md` para o ambiente `dev`: valida os 7 campos do lead, guarda e
lista por segmento. Desde a rodada pós-entrega, serve também o catálogo do contrato §4
com 15 fichas próprias (`src/fichas.js`). Não tem secret, não usa a URL real e não faz
nenhuma chamada de saída.

## Rodar e testar localmente

```bash
cd falso
npm install
npx wrangler dev --port 8795        # ou: npm run dev
node teste.mjs http://127.0.0.1:8795/leads/meu-segmento
```

O teste imprime `FALSO OK` e sai 0 quando tudo passa; senão diz o que falhou e sai 1.
Ele usa segmentos próprios da rodada (`<segmento>-<teste>-<nonce>`) e nunca depende de
uma lista vazia.

Deploy (só a coordenadora): `cd falso && npx wrangler deploy`. O `wrangler.jsonc` não
tem `account_id` nem secret; a conta vem do ambiente.

## Catálogo

Base do catálogo: `/catalogo/<segmento>` (é o valor de `CATALOGO_URL`). Qualquer
segmento serve o mesmo catálogo; o segmento faz o papel do token na URL e não aparece
no repositório.

- `GET <base>/cidades`, `GET <base>/imoveis?cidade=X|busca=texto[&hospedes=N][&aceita_pet=true|false]`
  e `GET <base>/imoveis/<id>`, com as formas de resposta, as regras de busca e os erros
  do contrato §4 (e de `docs/VERIFICACOES.md` §6).
- Diária, taxa, mínimo, capacidade e pet seguem a tabela pública da VERIFICACOES §6; os
  totais dos evals continuam valendo. A descrição do `IMB-801` traz uma ordem ao agente,
  de propósito, para o eval de injeção pelo catálogo.
- Teste de contrato: `test/catalogo-proprio-pe.test.ts`, dentro do `npm test` da raiz.

## Rotas do webhook

- `POST /leads/<segmento>` — valida presença e tipo dos 7 campos (`nome`, `telefone`,
  `imovel_id`, `checkin` e `checkout` em `AAAA-MM-DD` válido, `hospedes` inteiro,
  `valor_total` número). Válido: `201` com o lead guardado e a hora de chegada
  (`recebido_em`). Inválido: `422` com `{ "erros": [ { "campo", "erro" } ] }` e nada
  é guardado. JSON inválido também devolve `422`, com `campo: "corpo"`.
- `GET /leads/<segmento>` — `{ "leads": [ ... ] }` só daquele segmento.
- `DELETE /leads/<segmento>` — limpa **só os leads** daquele segmento. Não mexe nos
  modos de teste, nos outros segmentos nem em nada do webhook real. **Só existe no
  falso.**
- `GET /` — `{ "ok": true, "servico": "webhook-falso" }`, só para conferir que o
  servidor está no ar.

Cada segmento tem um Durable Object com SQLite próprio: leads e modos sobrevivem
entre requisições e reinícios do `wrangler dev` (estado local em `.wrangler/`, que não
é versionado), e segmentos diferentes nunca se misturam.

## Modos de teste

Modos só afetam `POST /leads/<segmento>`; `GET` e `DELETE` nunca são afetados.

Precedência: **cabeçalho `x-falso-modo` > modo gravado do telefone > modo gravado
geral do segmento**. Sem nenhum deles, o POST segue o fluxo normal.

### Por cabeçalho (vale só naquela requisição)

- `x-falso-modo: 500` — devolve `500` e **não guarda** o lead.
- `x-falso-modo: 422` — devolve `422` com `{ "erros": [...] }` e **não guarda**.
- `x-falso-modo: atraso` — espera `x-falso-atraso-ms` milissegundos (padrão 30000,
  aceita de 0 a 120000), depois responde `201`. O lead válido é **guardado antes da
  espera**: mesmo que o cliente desista antes do fim, ele já está na lista, como num
  resultado incerto de verdade (contrato L11). Atraso inválido devolve `400`.
- Cabeçalho inválido devolve `400` e não guarda.

### Modo gravado no segmento

- `PUT /modos/<segmento>` com `{ "modo": "500" }`, `{ "modo": "422" }` ou
  `{ "modo": "atraso", "atraso_ms": 30000 }`.
- Campos opcionais:
  - `validade_s`: por quantos segundos o modo vale. Padrão 120, aceita de 1 a 900.
    Todo modo expira sozinho; expirado vale como inexistente.
  - `telefone`: restringe o modo ao POST cujo `telefone` tem os mesmos dígitos.
    A comparação ignora pontuação e aceita o prefixo `55` de um lado e não do outro.
    Vários telefones podem ter modos diferentes no mesmo segmento ao mesmo tempo,
    cada um com a sua validade; sem `telefone`, o modo é o geral do segmento.
- `PUT` inválido (corpo que não é objeto, `modo` ausente ou desconhecido, `validade_s`
  fora de 1–900, `atraso_ms` fora de 0–120000, `telefone` sem dígitos) devolve `400` e
  **não altera nada**.
- `GET /modos/<segmento>` — `{ "segmento", "modos": [ { "modo", "telefone",
  "atraso_ms", "expira_em" } ] }`, só com os modos ainda ativos e com o instante de
  expiração em ISO. `telefone` é `null` no modo geral.
- `DELETE /modos/<segmento>` — limpa todos os modos do segmento.
  `DELETE /modos/<segmento>?telefone=<dígitos>` limpa só o modo daquele telefone.

Efeito de cada modo no armazenamento do lead: `500` e `422` **não guardam**; `atraso`
**guarda antes da espera**.
