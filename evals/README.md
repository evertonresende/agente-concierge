# Evals do agente concierge

Harness de avaliação nível 2 (`evals/rodar.mjs`), em Node 24 sem dependências externas. Mede o agente exclusivamente pelo contrato HTTP (`GET /saude`, `POST /chat` e `GET` no webhook falso em `dev`).

## Como rodar

```bash
# Listar casos e conferir se os 8 blocos de docs/EVALS.md têm >= 6 casos
node evals/rodar.mjs --listar

# Rodar um bloco específico contra dev (com LEADS_URL_DEV no ambiente)
node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev --bloco marco1

# Rodar vários blocos
node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev --bloco robustez-handoff --bloco contrato

# Rodar conjunto reservado (força --so-agregado; lê RESERVADO_DIR, evals/casos/reservado/ ou ~/.config/agente-concierge/reservado/)
node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto reservado --so-agregado
node evals/rodar.mjs --conjunto reservado --listar
```

### Opções da CLI

- `--alvo <url>`: URL base do agente (obrigatória fora de `--listar`).
- `--conjunto <dev|reservado>`: conjunto de casos (padrão: `dev`). No `reservado`, `--so-agregado` é forçado automaticamente.
- `--bloco <nome>`: filtra por bloco; pode ser repetida.
- `--so-agregado`: imprime apenas o percentual por bloco e o veredito final (nunca id, mensagem ou resposta).
- `--listar`: lista contagem por bloco. No `dev`, imprime `CASOS OK` quando os 8 blocos de `docs/EVALS.md` têm 6 ou mais casos cada.
- `--paralelo <n>`: número de casos executados simultaneamente (padrão: `2`).
- `--relatorio <arquivo>` / `--sem-relatorio`: sobrescreve o destino do relatório JSON ou omite a gravação.

### Variáveis de ambiente

- `LEADS_URL_DEV`: URL do webhook falso em `dev` para conferência de `leads_esperados` e `leads_ate_agora` (nunca é impressa nem gravada no relatório).
- `RESERVADO_DIR`: caminho alternativo para a pasta do conjunto reservado.

## Formato do arquivo de caso (`.json`)

Cada caso fica em `evals/casos/dev/<bloco>/<id>.json` (ou `<RESERVADO_DIR>/<bloco>/<id>.json`). O contrato mínimo de `docs/EVALS.md` é totalmente preservado:

```json
{
  "id": "lead-01-feliz",
  "bloco": "funciona-leads",
  "confirma": true,
  "turnos": [
    {
      "mensagem": "Quero o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas.",
      "espera": {
        "resposta_contem": ["R\\$ 2\\.156,00"],
        "handoff": false,
        "estadia": { "imovel_id": "GRM-301", "checkin": "2027-01-15", "checkout": "2027-01-18", "hospedes": 2 }
      }
    },
    {
      "mensagem": "Quero fechar. Sou {{nome}}, telefone {{telefone}}.",
      "espera": {
        "resposta_contem": ["R\\$ 2\\.156,00", "15/01/2027", "18/01/2027"],
        "leads_ate_agora": 0,
        "handoff": false
      }
    },
    {
      "mensagem": "Sim, confirmo.",
      "espera": {
        "resposta_contem": ["registrad"],
        "handoff": false
      }
    }
  ],
  "leads_esperados": [
    {
      "imovel_id": "GRM-301",
      "checkin": "2027-01-15",
      "checkout": "2027-01-18",
      "hospedes": 2,
      "valor_total": 2156
    }
  ]
}
```

### Campos do caso

- `id` (string, obrigatório): identificador único do caso.
- `bloco` (string, obrigatório): nome do bloco (igual ao diretório).
- `confirma` (boolean, opcional, padrão `false`): `true` se o caso confirma reserva / gera lead. Casos com `confirma: true` ou `leads_esperados` não vazio são recusados fora de `ambiente: "dev"`.
- `turnos` (array, obrigatório): sequência de turnos da conversa.
- `leads_esperados` (array, opcional): lista exata de leads esperados no webhook falso ao fim da conversa para o telefone gerado no caso (`[]` exige zero leads). Campos conferidos: `imovel_id`, `checkin`, `checkout`, `hospedes`, `valor_total`, além de presença de `nome` e formato válido de `telefone` (L6; ou `formato_telefone: "estrangeiro"` para `+dígitos`).

### Placeholders por execução

Gerados de forma única a cada execução e caso, substituídos em `mensagem`, `payload`, `corpo_bruto` e nas regexes de `espera`:

- `{{nome}}`: nome completo sintético do hóspede.
- `{{telefone}}`: número brasileiro válido no formato `(11) 9XXXX-XXXX`.
- `{{telefone_digitos}}`: apenas os 11 dígitos (`119XXXXXXXX`).
- `{{telefone_e164}}`: `+55119XXXXXXXX`.
- `{{telefone_estrangeiro}}`: número estrangeiro único no formato `+1415XXXXXXX`.
- `{{session_id}}`: `session_id` gerado para aquele turno.

### Campos de cada turno

- Turno comum: `{ "mensagem": "...", "sessao": "principal", "espera": { ... } }`.
  - `sessao` (opcional): permite intercalar sessões distintas no mesmo caso (ex.: `"A"` e `"B"`).
  - `payload` (objeto, opcional): envia corpo JSON arbitrário no lugar de `{ session_id, message }` (útil para testar campos faltando/inválidos no bloco `contrato`).
  - `corpo_bruto` (string, opcional): envia texto bruto no `POST /chat` (útil para testar JSON quebrado).
- Turno paralelo: `{ "paralelo": [turnoA, turnoB], "espera_conjunto": { ... } }`.
  - Dispara os subturnos simultaneamente via `Promise.all` na mesma sessão (ou nas sessões indicadas).
  - `espera_conjunto` aceita `todos_contem`, `pelo_menos_um_contem`, `exatamente_um_contem` e `nenhum_contem` (listas de regex aplicadas sobre o conjunto das respostas paralelas).

### Campos de `espera`

- `status` (número, padrão `200`): status HTTP esperado.
- `handoff` (booleano, opcional): compara com `resposta.handoff`.
- `resposta_contem` (array de strings regex, case-insensitive): todas precisam casar.
- `resposta_contem_algum` (array de strings regex, case-insensitive): ao menos uma precisa casar.
- `resposta_nao_contem` (array de strings regex, case-insensitive): nenhuma pode casar.
- `sem_total` (booleano, opcional): se `true`, falha caso a resposta cite qualquer valor em `R$`.
- `formato_total_estrito` (booleano, padrão `true` em `200`): verifica que toda menção `R$ ...` segue `R$ d.ddd,dd`.
- `estadia` (objeto ou array de `{ imovel_id, checkin, checkout, hospedes?, obrigatorio? }`): aciona o juiz determinístico independente em centavos inteiros (`evals/lib/juiz-preco.mjs`). Se `obrigatorio` for `true` (padrão), exige o total exato na resposta e rejeita valores fora dos componentes da estadia; se `false`, valida apenas se algum `R$` aparecer.
- `leads_ate_agora` (número, opcional): em `dev`, consulta `GET` no webhook falso logo após o turno e exige exatamente essa quantidade de leads para o telefone do caso.

## Trava e sigilo nos relatórios

1. Antes de executar, o runner consulta `GET <alvo>/saude`. Se `ambiente` não for `"dev"`, todo caso com `confirma: true` ou `leads_esperados` não vazio é recusado pela trava.
2. Os relatórios gravados em `evals/relatorios/` registram apenas `ambiente` (nunca a URL do alvo nem do webhook), mascaram `nome` e `telefone` (L22) e, no modo `--conjunto reservado`, omitem IDs, mensagens, respostas e falhas individuais.
3. Limiares de aprovação: `≥ 95%` por bloco em `dev` (`EVAL OK`), `≥ 90%` agregado no `reservado` (`RESERVADO OK`), zero leads antecipados/duplicados, latência p95 `≤ 20 s` e máxima `< 60 s`.
