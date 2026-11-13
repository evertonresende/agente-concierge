# Webhook de leads falso

Worker próprio deste diretório, separado do Worker do agente. Replica o contrato §5
do `docs/CONTRATO.md` para o ambiente `dev`: valida os 7 campos do lead, guarda e
lista por segmento. Não tem secret, não usa a URL real e não faz nenhuma chamada de
saída.

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

## Rotas

- `POST /leads/<segmento>` — valida presença e tipo dos 7 campos (`nome`, `telefone`,
  `imovel_id`, `checkin` e `checkout` em `AAAA-MM-DD` válido, `hospedes` inteiro,
  `valor_total` número). Válido: `201` com o lead guardado e a hora de chegada
  (`recebido_em`). Inválido: `422` com `{ "erros": [ { "campo", "erro" } ] }` e nada
  é guardado. JSON inválido também devolve `422`, com `campo: "corpo"`.
- `GET /leads/<segmento>` — `{ "leads": [ ... ] }` só daquele segmento.
- `DELETE /leads/<segmento>` — limpa a lista daquele segmento. **Só existe no falso.**
- `GET /` — `{ "ok": true, "servico": "webhook-falso" }`, só para conferir que o
  servidor está no ar.

Cada segmento tem um Durable Object com SQLite próprio: a lista sobrevive entre
requisições e reinícios do `wrangler dev` (estado local em `.wrangler/`, que não é
versionado), e segmentos diferentes nunca se misturam.

## Modos de teste

Os modos valem só para `POST /leads/<segmento>`; `GET` e `DELETE` nunca são afetados.
Duas formas de ligar: cabeçalho por requisição ou modo gravado no segmento.

### Por cabeçalho

- `x-falso-modo: 500` — devolve `500` e **não guarda** o lead.
- `x-falso-modo: 422` — devolve `422` com `{ "erros": [...] }` e **não guarda**.
- `x-falso-modo: atraso` — espera `x-falso-atraso-ms` milissegundos (padrão 30000,
  máximo 120000), depois processa normalmente: lead válido é **guardado** e responde
  `201`. Serve para simular tempo esgotado do cliente; mesmo que o cliente desista, o
  lead pode ter sido guardado, como num resultado incerto de verdade. Cabeçalho
  inválido devolve `400`.

### Por modo gravado no segmento (controle)

Rotas de controle, só no falso:

- `PUT /modos/<segmento>` com `{ "modo": "500" }`, `{ "modo": "422" }` ou
  `{ "modo": "atraso", "atraso_ms": 30000 }` grava o modo que passa a valer para todos
  os POSTs seguintes daquele segmento, sem cabeçalho. `{ "modo": "nenhum" }` limpa.
- `GET /modos/<segmento>` mostra o modo atual.
- `DELETE /modos/<segmento>` limpa o modo.

Efeito de cada modo no armazenamento: `500` e `422` **não guardam**; `atraso` guarda
depois da espera.
