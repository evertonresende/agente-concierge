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
- `--pausa-ms <n>`: espera `n` ms antes de enviar cada turno de cada conversa (padrão: `0`, inteiro `>= 0`); use com `--paralelo 1` em modelo com limite por minuto.
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
- `webhook_modo` (objeto, opcional, só em `dev`): ativa um modo de falha no webhook falso escopado exclusivamente para o `telefone` desta conversa (`PUT /modos/<segmento>` antes do turno alvo e `DELETE /modos/<segmento>?telefone=<dígitos>` sempre no `finally`, inclusive em erro). Campos: `{ "modo": "500" | "422" | "atraso", "validade_s"?: 60, "atraso_ms"?: 30000, "antes_do_turno"?: N }`. Também pode ser declarado diretamente dentro de um turno específico.

### Placeholders por execução

Gerados de forma única a cada execução e caso, substituídos em `mensagem`, `payload`, `corpo_bruto`, `espera.estadia`, `leads_esperados` e nas regexes de `espera`:

- `{{nome}}`: nome completo sintético do hóspede.
- `{{primeiro_nome}}`: primeiro nome sintético do hóspede.
- `{{telefone}}`: número brasileiro válido no formato `(11) 9XXXX-XXXX`.
- `{{telefone_digitos}}`: apenas os 11 dígitos (`119XXXXXXXX`).
- `{{telefone_e164}}`: `+55119XXXXXXXX`.
- `{{telefone_estrangeiro}}`: número estrangeiro único no formato `+1415XXXXXXX`.
- `{{session_id}}`: `session_id` gerado para aquele turno.
- Datas relativas calculadas na hora no fuso `America/Sao_Paulo` (sufixos `_iso` para `AAAA-MM-DD`, `_br` para `DD/MM/AAAA`, `_extenso` para `D de mês de AAAA`):
  - `{{hoje_iso}}`, `{{hoje_br}}`, `{{hoje_extenso}}`
  - `{{amanha_iso}}`, `{{amanha_br}}`, `{{amanha_extenso}}`
  - `{{hoje_mais_<N>_iso}}`, `{{hoje_mais_<N>_br}}`, `{{hoje_mais_<N>_extenso}}` (e `hoje_menos_<N>_*`)
  - `{{prox_<dia>_iso}}`, `{{prox_<dia>_mais_<N>_br}}`, etc., para `<dia>` em `domingo | segunda | terca | quarta | quinta | sexta | sabado` (próxima ocorrência estritamente futura, `1..7` dias à frente).

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
- `sem_total` (booleano ou `{ "imovel_id": "..." }`, opcional): se ativo, proíbe qualquer total em `R$`. Sem `imovel_id`, proíbe qualquer `R$` (salvo `valores_tolerados`); com `imovel_id` (ou `espera.imovel_id`), tolera a diária, diária de fds e taxa de limpeza daquele imóvel, proibindo totais.
- `formato_total_estrito` (booleano, padrão `true` em `200`): verifica que toda menção `R$ ...` segue `R$ d.ddd,dd`, inclusive em turnos sem `espera`, e acusa valores monetários escritos sem `R$`.
- `valores_tolerados` (array de números ou strings BRL, opcional): valores extras legítimos na resposta (ex.: valor citado pelo hóspede ao recusar total ditado ou cotação anterior ao alterar datas).
- `estadia` (objeto ou array de `{ imovel_id, checkin, checkout, hospedes?, obrigatorio? }`): aciona o juiz determinístico independente em centavos inteiros (`evals/lib/juiz-preco.mjs`). Se `obrigatorio` for `true` (padrão), exige o total exato na resposta e aceita apenas os componentes/subtotais coerentes nomeados como componente no texto (ex.: diárias, taxa de limpeza) e `valores_tolerados`; se `false`, valida apenas se algum `R$` aparecer.
- `leads_ate_agora` (número, opcional): em `dev`, consulta `GET` no webhook falso logo após o turno e exige exatamente essa quantidade de leads para o telefone do caso. Dentro de um turno `paralelo`, a consulta é feita depois de todos os subturnos responderem e vale o maior `leads_ate_agora` declarado entre eles.

### Juiz de preço: rótulo de componente e limites conhecidos

Um valor igual a um componente da estadia (diária, diária de sexta e sábado, taxa de limpeza,
subtotal de noites) só passa quando a resposta o apresenta como componente
(`evals/lib/rotulo-componente.mjs`): valor "por noite" tem de ser a diária das noites nomeadas,
valor ao lado de uma contagem tem de caber nela, valor com "total" ao lado é total, e resposta que
concede preço reprova. A regressão do juiz são os corpora do verificador em
`evals/lib/corpus-juiz.json` (100 respostas da rodada 1, 134 da rodada 2 e as respostas reais do ensaio que o juiz errava), conferidos no
autoteste (`node evals/teste-do-runner.mjs`).

Limites conhecidos: formatos que o agente não escreveu nos cinco registros reais revisados. O
veredito atual deles fica fixado no corpus; o juiz erra nestes exemplos.

Respostas certas que reprovam:

- conta com "×": "2 noites × R$ 590,00 = R$ 1.180,00"
- conta com "+": "R$ 708,00 + R$ 708,00 + R$ 590,00 + R$ 150,00 = R$ 2.156,00"
- subtotal entre parênteses: "Noites: 2, a R$ 590,00 cada (R$ 1.180,00)"
- conta entre parênteses: "Diárias: R$ 2.006,00 (1 × R$ 590,00 + 2 × R$ 708,00)"
- "em vez de": "custam R$ 708,00 em vez de R$ 590,00"
- tabela com vírgula no rótulo: "| Sexta, 15/01 | R$ 708,00 |"
- subtotal com verbo de total: "The 3 nights come to R$ 2.006,00, plus the R$ 150,00 cleaning fee"
- subtotal chamado de total: "Total for the nights: R$ 2.006,00"
- concessão hipotética: "Eu adoraria poder dar um desconto, mas quem decide isso é o time."
- diária comum "por noite" com o acréscimo só descrito, sem a diária de sexta e sábado na frase: "A diária é R$ 590,00 por noite, com 20% a mais na sexta e no sábado"
- negação longe da palavra nos casos de desconto (mais de 3 palavras): "I can't waive the cleaning fee or give a discounted rate"
- vírgula colada na negação, nos casos de desconto: "We never, ever waive the cleaning fee." (o "Não," de resposta não pode desculpar "Não, posso isentar a limpeza.")

Respostas erradas que aprovam:

- "a partir de": "A estadia fica a partir de R$ 2.156,00, dependendo da disponibilidade."
- noites entre parênteses: "Valor da estadia: R$ 2.006,00 (3 noites)."
- total sem a limpeza sem a palavra "total": "The full price is R$ 2.006,00 for the 3 nights."
- componente trocado com o total certo: "Taxa de limpeza: R$ 590,00" seguido de "Total: R$ 2.156,00"
- limpeza por noite em `sem_total`: "a limpeza custa R$ 150,00 a cada noite"
- contagem em inglês por extenso: "Two regular nights at R$ 590,00 each" numa estadia com 1 noite comum
- valor por pessoa: "A diária é R$ 590,00 por pessoa"
- fronteira: "São 2 noites, R$ 1.416,00 de diárias" (as 2 noites de R$ 708,00 cabem na estadia de 3)

O juiz reconhece concessão pela construção, não pelo significado. Contra um agente que conceda com
palavras novas, a guarda mais forte é o `handoff` com o valor fora da tabela. Nos casos de desconto
(`hand-01`, `hand-03`, `marco1-02`, `man-12`), proibidas cobrem a limpeza tirada e a diária comum
aplicada à sexta e ao sábado.

## Trava e sigilo nos relatórios

1. Antes de executar, o runner consulta `GET <alvo>/saude`. Todo caso com `confirma: true` (booleano estrito), `webhook_modo`, `leads_esperados` ou `leads_ate_agora` exige `ambiente: "dev"` e `LEADS_URL_DEV` definida; caso contrário, é pulado pela trava. Fora de `dev` a trava é por negação: só roda o caso que declara `confirma: false` explícito; caso sem a marca é pulado, porque pode confirmar um lead pelas mensagens sem declarar campo nenhum.
   Na carga, caso sem nenhum `espera` (em turno, subturno ou `espera_conjunto`) e sem `leads_esperados` é recusado: ele passaria sem conferir nada.
   O runner nunca segue redirecionamento (`redirect: "manual"` em todas as chamadas): um 3xx no `POST /chat` é falha do turno, registrada com o status e sem o endereço do `Location`, para que um 307 ou 308 não repita o POST com corpo em outro servidor.
2. Códigos de saída: `0` (`EVAL OK` / `RESERVADO OK`) só quando nenhum caso foi pulado e todos os limiares passaram; `2` (`EVAL PARCIAL` / `RESERVADO PARCIAL`) quando houve qualquer caso pulado pela trava/ambiente e os casos executados passaram; `1` (`EVAL REPROVADO` / `RESERVADO REPROVADO`) quando algum bloco ou critério global reprovou.
3. Uso por conversa (`uso_entrada`, `uso_saida`, `chamadas_modelo`) vem dos cabeçalhos `x-uso-entrada`, `x-uso-saida` e `x-chamadas-modelo` da resposta; `x-uso-entrada` já inclui os tokens de cache. Pedido sem esses cabeçalhos (erro de rede, timeout ou resposta sem eles) entra em `pedidos_sem_uso` por conversa e em `uso.pedidos_sem_uso_total`: quando esse número não é zero, o uso do relatório é um mínimo. O agente não informa o modelo, o nível nem o cache separado, e o relatório não os registra.
4. Os relatórios gravados em `evals/relatorios/` registram apenas `ambiente` (nunca a URL do alvo nem do webhook), mascaram `nome` e `telefone` (L22) e, no modo `--conjunto reservado` (`--so-agregado`), omitem por completo o campo `conversas`, IDs, mensagens, respostas e falhas individuais.
5. Limiares de aprovação: `≥ 95%` por bloco em `dev` (`EVAL OK`), `≥ 90%` agregado no `reservado` (`RESERVADO OK`), zero leads antecipados/duplicados, latência p95 `≤ 20 s` e máxima `< 60 s`.

## Validade dos casos com datas fixas

Casos com datas fixas no calendário devem ser atualizados caso a data de execução ultrapasse os limites abaixo (após essas datas, as estadias passam a cair no passado ou perdem o marco da conversa):

| Casos | Válido até | Motivo |
| :--- | :--- | :--- |
| `robustez-nao-inventa/inv-05-feriado` | `25/12/2026` | Feriado fixo em `25/12/2026`–`28/12/2026` |
| `robustez-nao-inventa/inv-02-disponibilidade` | `30/12/2026` | Check-in em `30/12/2026` |
| `funciona-cotacoes/cot-06-virada` | `01/01/2027` | Virada de ano `31/12/2026`–`02/01/2027` |
| `robustez-handoff/hand-03-ano-novo` | `11/01/2027` | Estadia em `10/01/2027`–`15/01/2027` |
| `funciona-cotacoes/cot-07-festa` | `15/01/2027` | Check-in em `14/01/2027` |
| Demais casos com `15/01/2027` (`cot-*`, `lead-*`, `rec-*`, `con-*`, etc.) | `16/01/2027` | Check-in padrão em `15/01/2027` |
