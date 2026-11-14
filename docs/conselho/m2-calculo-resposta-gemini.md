# Resposta do Gemini — cálculo de preço, primeira passada da M2

Pergunta: [`m2-calculo-pergunta.md`](m2-calculo-pergunta.md). Consulta de 13/11/2026 ao
Gemini 4 Argon, com raciocínio em nível alto, numa cópia de trabalho própria. Resposta
inteira; a única edição foi trocar caminhos de pasta local por caminhos relativos ao
repositório. O que a coordenação fez com cada achado está em
[`../revisoes/m2.md`](../revisoes/m2.md).

---

SEGUNDA OPINIÃO — cálculo de preço — discordo em 6 pontos

Para todas as estadias válidas do catálogo (15 imóveis de [tarifas.json](../../evals/lib/tarifas.json), testadas em malha exaustiva de durações de 1 a 35 noites, iniciando nos 7 dias da semana, incluindo virada de mês/ano e ano bissexto), a regra matemática da seção 3 e L14 do [CONTRATO.md](../../docs/CONTRATO.md#L70-L103) está implementada com exatidão tanto no produto quanto no juiz, produzindo `0` divergências em centavos.

Os 6 pontos de discordância concentraram-se em casos de borda na orquestração da ferramenta de cotação com resumo pendente (L8/L10), higienização de argumento não numérico de hóspedes (L13) e divergências de validação de fronteira entre as funções puras do produto e do juiz.

---

### Achados

#### Achado 1 — [MÉDIO] Cotação sem `hospedes` de outro imóvel com capacidade menor, quando há resumo pendente na sessão, herda `aberto.hospedes` e recusa indevidamente em vez de cotar (ou monta resumo de imóvel não confirmado)
- **Local:** [cotacao.ts:36](../../src/agente/ferramentas/cotacao.ts#L36) e [cotacao.ts:48-56](../../src/agente/ferramentas/cotacao.ts#L48-L56)
- **Entrada exata:**
  1. Turno 1: `montar_resumo` para `GRM-301` (capacidade `4`), entrada `15/01/2027`, saída `18/01/2027`, `hospedes: 4`, nome `Ana Lima`, telefone `(11) 98888-0000`.
  2. Turno 2: o hóspede apenas consulta o preço de outro imóvel sem informar hóspedes (`cotar` com `imovel_id: "RIO-402"` — capacidade `2` —, `checkin: "15/01/2027"`, `checkout: "18/01/2027"`, `hospedes: undefined`).
- **O que saiu:**
  `cotarEstadia` passa `aberto?.hospedes` (`4`) como `hospedesPadrao` para `prepararPedido`. A cotação do `RIO-402` é **recusada por capacidade** (`recusa: true`, `motivo: "Este imóvel acomoda no máximo 2 pessoas, e o pedido é para 4."`), sem devolver o preço do `RIO-402`. Além disso, se a cotação no outro imóvel couber na capacidade, a linha 54 (`if (pedido.cotacao.ok) return resumir(...)`) devolve imediatamente o texto fixo de **"Resumo do seu pedido de reserva"** para o novo imóvel como `respostaFinal`, mesmo quando o hóspede só fez uma pergunta de preço.
- **O que deveria sair pela regra do contrato:**
  Pela **L8** ([CONTRATO.md:293](../../docs/CONTRATO.md#L293)), *"Com imóvel e datas válidas, o agente dá o total na hora, informa a capacidade e pergunta quantas pessoas são"*. Pela **L10** ([CONTRATO.md:295](../../docs/CONTRATO.md#L295)), cotar outra estadia invalida a confirmação pendente anterior, mas consultar outro imóvel sem informar hóspedes não deveria impedir a cotação do `RIO-402` (`R$ 958,70`) por herdar `4` pessoas do imóvel anterior.
- **Como foi provado:**
  Script executado com Node importando `montarResumo` e `cotarEstadia`:
  ```text
  Comando: node --experimental-transform-types ... /tmp/prova-pendente.mjs
  Saída:
  Após turno 1 (pendente): { imovel_id: 'GRM-301', checkin: '2027-01-15', checkout: '2027-01-18', hospedes: 4, ... }
  Resultado de cotar RIO-402 sem hospedes quando havia resumo pendente de 4 hospedes: {
    recusa: true,
    paraOModelo: {
      imovel: { id: 'RIO-402', nome: 'Studio Copacabana', capacidade: 2, minimo_noites: 1 },
      entrada: 'sexta-feira, 15/01/2027',
      saida: 'segunda-feira, 18/01/2027',
      recusada: true,
      motivo: 'Este imóvel acomoda no máximo 2 pessoas, e o pedido é para 4.',
      instrucao: 'Explique o motivo ao hóspede. Não informe nenhum total. Isto não é caso de passar para humano.'
    }
  }
  ```

---

#### Achado 2 — [MÉDIO] Discordância entre Produto e Juiz: `cotar()` e `diasEntre()` aceitam datas ISO inexistentes no calendário (`"2027-02-29"`, `"2027-04-31"`) por transbordo do `Date.parse`, enquanto o Juiz recusa
- **Local:** [datas.ts:26-28](../../src/nucleo/datas.ts#L26-L28), [datas.ts:40-42](../../src/nucleo/datas.ts#L40-L42) e [preco.ts:43-46](../../src/nucleo/preco.ts#L43-L46) vs. [juiz-preco.mjs:123-154](../../evals/lib/juiz-preco.mjs#L123-L154)
- **Entrada exata:**
  Imóvel `GRM-301`, `checkin: "2027-02-29"` (2027 não é bissexto), `checkout: "2027-03-05"`, `hospedes: 2`, passados diretamente a `cotar()` e a `calcularEstadia()`. *(Nota: no fluxo completo da ferramenta do agente, `prepararPedido` chama `resolverData` antes de `cotar`, que filtra `"2027-02-29"` via `montar()`; porém a função `cotar()` do núcleo puro não valida se a `DataISO` existe no calendário).*
- **O que saiu:**
  - **Produto (`cotar`):** `emMs("2027-02-29")` chama `Date.parse("2027-02-29T00:00:00Z")` no V8, que transborda silenciosamente para `2027-03-01` (4 noites até `2027-03-05`), devolvendo `{ ok: true, noites: 4, noitesComAcrescimo: 0, totalCentavos: 251000 }` (`R$ 2.510,00`). E para `2027-02-29` a `2027-03-02`, devolve `{ ok: false, motivo: "minimo_noites" }` (calcula 1 noite) em vez de `"datas_invalidas"`.
  - **Juiz (`calcularEstadia`):** `parseDataCivilUtc` confere `getUTCFullYear/Month/Date` contra os componentes e devolve `{ ok: false, motivo: "Data civil inválida (2027-02-29 -> 2027-03-05)" }`.
- **Qual segue o contrato:**
  O **Juiz** segue o contrato (e o próprio `interpretarData` de `datas.ts:9-14`), pois `2027-02-29` não é uma data civil válida.
- **Como foi provado:**
  ```text
  Comando: node ... /tmp/prova-transbordo.mjs
  Saída:
  cotar(GRM301, '2027-02-29', '2027-03-05', 2) -> {
    ok: true, noites: 4, noitesComAcrescimo: 0, diariaCentavos: 59000,
    diariaComAcrescimoCentavos: 70800, taxaLimpezaCentavos: 15000, totalCentavos: 251000
  }
  calcularEstadia(GRM-301, '2027-02-29', '2027-03-05', 2) -> {
    ok: false, motivo: 'Data civil inválida (2027-02-29 -> 2027-03-05)'
  }
  ```

---

#### Achado 3 — [BAIXO] Discordância entre Produto e Juiz: `calcularEstadia` no juiz não valida `hospedes` zero, negativo, fracionário ou `NaN` (L13)
- **Local:** [juiz-preco.mjs:225-230](../../evals/lib/juiz-preco.mjs#L225-L230) vs. [preco.ts:63-70](../../src/nucleo/preco.ts#L63-L70)
- **Entrada exata:**
  Imóvel `GRM-301`, `checkin: "2027-01-15"`, `checkout: "2027-01-18"`, com `hospedes: 0` (ou `-2`, `2.5`, `NaN`).
- **O que saiu:**
  - **Produto (`cotar`):** `{ ok: false, motivo: "hospedes_invalido", explicacao: "O número de hóspedes precisa ser um número inteiro maior que zero." }`
  - **Juiz (`calcularEstadia`):** `{ ok: true, noites: 3, ..., totalCentavos: 215600, totalFormatado: "R$ 2.156,00" }`, porque a linha 225 só testa `hospedes > tarifa.capacidade`.
- **Qual segue o contrato:**
  O **Produto** segue o contrato (**L13**, [CONTRATO.md:298](../../docs/CONTRATO.md#L298): *"Zero, negativo ou fracionário: pede correção, sem handoff"*).
- **Como foi provado:**
  ```text
  Comando: node ... /tmp/prova-preco.mjs
  Saída:
  hospedes=0 -> Produto: { ok: false, motivo: 'hospedes_invalido', ... } | Juiz: { ok: true, ..., totalCentavos: 215600 }
  hospedes=-2 -> Produto: { ok: false, motivo: 'hospedes_invalido', ... } | Juiz: { ok: true, ..., totalCentavos: 215600 }
  hospedes=2.5 -> Produto: { ok: false, motivo: 'hospedes_invalido', ... } | Juiz: { ok: true, ..., totalCentavos: 215600 }
  ```

---

#### Achado 4 — [BAIXO] Argumento `hospedes` enviado pelo modelo como texto não numérico (ex.: `"dois"`, `"abc"`) vira `undefined` silenciosamente em `prepararPedido`, cotando como se `hospedes` não tivesse sido informado em vez de recusar por L13
- **Local:** [tipos.ts:64-70](../../src/agente/ferramentas/tipos.ts#L64-L70) e [pedido.ts:47](../../src/agente/ferramentas/pedido.ts#L47)
- **Entrada exata:**
  `prepararPedido({ imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: "abc" }, contexto)` (sem resumo pendente).
- **O que saiu:**
  `numero(argumentos, "hospedes")` retorna `undefined` quando `argumentos.hospedes` está presente mas não casa com `/^-?\d+([.,]\d+)?$/`. Com isso, `prepararPedido` chama `cotar(..., undefined)` e devolve `{ ok: true, hospedes: undefined, cotacao: { ok: true, totalCentavos: 215600 } }` (tratando como L8, "hóspedes ausente"). (Em `montar_resumo`, [lead.ts:262](../../src/agente/ferramentas/lead.ts#L262) barra porque checa `if (pedido.hospedes === undefined)`, mas em `cotar` passa como ausente; e se houver resumo pendente, cai no `?? hospedesPadrao` do resumo antigo).
- **O que deveria sair pela regra do contrato:**
  Se o argumento `hospedes` foi fornecido (`argumentos.hospedes !== undefined`), mas não é um inteiro positivo válido, deveria ser tratado como `hospedes_invalido` (L13) e nunca acionar o fallback `?? hospedesPadrao`.
- **Como foi provado:**
  ```text
  Comando: node --experimental-transform-types ... /tmp/prova-detalhes.mjs
  Saída:
  hospedes="abc" -> numero(): undefined | cotacao.ok: true hospedes=undefined
  ```

---

#### Achado 5 — [BAIXO] Discordância de formato aceito entre `cotar()` / `interpretarData()` do Produto e `calcularEstadia()` / `parseDataCivilUtc()` do Juiz
- **Local:** [preco.ts:42-46](../../src/nucleo/preco.ts#L42-L46) e [datas.ts:17-24](../../src/nucleo/datas.ts#L17-L24) vs. [juiz-preco.mjs:123-143](../../evals/lib/juiz-preco.mjs#L123-L143) e [juiz-preco.mjs:203-214](../../evals/lib/juiz-preco.mjs#L203-L214)
- **Entrada exata:**
  1. `checkin: "15/01/2027"`, `checkout: "18/01/2027"` em `cotar()` vs. `calcularEstadia()`.
  2. `"5/1/2027"` (dia/mês com 1 dígito) e `"15/01/27"` (ano com 2 dígitos, P7) em `interpretarData()` vs. `parseDataCivilUtc()`.
- **O que saiu:**
  - Em (1), `cotar()` recusa `"15/01/2027"` (`datas_invalidas`, pois exige `AAAA-MM-DD` previamente resolvido por `resolverData`), enquanto `calcularEstadia()` do juiz aceita `DD/MM/AAAA` diretamente e retorna `215600`.
  - Em (2), `interpretarData()` do produto aceita `"5/1/2027"` (`-> "2027-01-05"`) e `"15/01/27"` (`-> "2027-01-15"`), enquanto `parseDataCivilUtc()` do juiz exige `^\d{2}/\d{2}/\d{4}$` e retorna `null` para ambos.
- **Qual segue o contrato:**
  No pipeline completo do agente (`prepararPedido` -> `resolverData` -> `cotar`), o **Produto** atende à decisão provisória **P7** ([DECISOES.md:161](../../DECISOES.md#L161), ano com 2 dígitos lido como `20AA`), enquanto `parseDataCivilUtc` do juiz não implementa P7 nem dia/mês de 1 dígito (embora baste aos arquivos de casos dos evals se estes só usarem `AAAA-MM-DD` ou `DD/MM/AAAA`).
- **Como foi provado:**
  ```text
  Comando: node ... /tmp/prova-preco.mjs
  Saída:
  Produto cotar(GRM-301, '15/01/2027', '18/01/2027', 2): { ok: false, motivo: 'datas_invalidas', ... }
  Juiz calcularEstadia(GRM-301, '15/01/2027', '18/01/2027', 2): { ok: true, ..., totalCentavos: 215600 }
  texto="5/1/2027" -> Produto interpretarData: 2027-01-05 | Juiz parseDataCivilUtc: null
  texto="15/01/27" -> Produto interpretarData: 2027-01-15 | Juiz parseDataCivilUtc: null
  ```

---

#### Achado 6 — [BAIXO] `ehDataInexistente("2027-1-15")` classifica data ISO com mês/dia de 1 dígito como "data inexistente no calendário"
- **Local:** [datas.ts:19](../../src/nucleo/datas.ts#L19), [datas.ts:258](../../src/nucleo/datas.ts#L258) e [datas.ts:270-275](../../src/nucleo/datas.ts#L270-L275)
- **Entrada exata:**
  `checkin: "2027-1-15"`, `checkout: "2027-1-18"` (formato ISO sem zero à esquerda no mês).
- **O que saiu:**
  `interpretarData` exige dois dígitos no mês e no dia (`/^\d{4}-(\d{2})-(\d{2})$/`) e retorna `null`. Porém `temFormaDeCalendario` ([datas.ts:258](../../src/nucleo/datas.ts#L258)) usa `/^\d{4}-\d{1,2}-\d{1,2}$/` (aceita 1 ou 2 dígitos). Como `resolverData("2027-1-15", ...)` devolve `null`, `ehDataInexistente("2027-1-15")` retorna `true`, e `prepararPedido` responde ao modelo que `2027-1-15` é uma *"Data de entrada ou de saída inexistente no calendário"*, quando 15 de janeiro de 2027 existe.
- **O que deveria sair:**
  `interpretarData` e `temFormaDeCalendario` deveriam usar o mesmo critério para ISO (ambos aceitando `\d{1,2}` como já é feito no formato BR `5/1/2027`, ou ambos exigindo `\d{2}`).
- **Como foi provado:**
  ```text
  Comando: node --experimental-transform-types ... /tmp/prova-detalhes.mjs
  Saída:
  texto="2027-1-15" -> resolverData: null | ehDataInexistente: true
  ```

---

### Respostas diretas às perguntas 3, 4 e 5

#### 3. Ponto flutuante e valores reais de `evals/lib/tarifas.json`
- **No cálculo do produto ([preco.ts](../../src/nucleo/preco.ts)) e do juiz ([juiz-preco.mjs](../../evals/lib/juiz-preco.mjs)):** **Não há risco de erro de 1 centavo.**
  - Na entrada do catálogo, `reaisParaCentavos(reais)` ([dinheiro.ts:5-12](../../src/nucleo/dinheiro.ts#L5-L12)) faz `Math.round(reais * 100)` e valida `Math.abs(reais * 100 - centavos) <= 1e-6`. Nos dois imóveis com centavos no catálogo:
    - `RIO-402`: `diaria = 245.5` -> `reaisParaCentavos(245.5) = 24550`. Enquanto em ponto flutuante `245.5 * 1.2 = 294.59999999999997`, a fórmula inteira `Math.floor((120 * 24550 + 50) / 100)` calcula `Math.floor(2946050 / 100) = 29460` (`R$ 294,60`) de forma exata.
    - `NAT-601`: `diaria = 365.9` -> `reaisParaCentavos(365.9) = 36590`. A fórmula inteira calcula `Math.floor((120 * 36590 + 50) / 100) = Math.floor(4390850 / 100) = 43908` (`R$ 439,08`) de forma exata.
    - Todos os outros 13 imóveis têm diária em reais inteiros (múltiplos de `100` centavos), que multiplicados por `1,2` dão múltiplos exatos de `20` centavos.
  - Nota sobre `Math.floor` vs `Math.trunc` para a regra L14: para qualquer inteiro positivo `diariaCentavos <= 7.5e13` (até 750 bilhões de reais, dentro de `Number.MAX_SAFE_INTEGER`), `Math.floor((120 * diariaCentavos + 50) / 100)` no produto e `Math.trunc((120 * diaria + 50) / 100)` no juiz são matematicamente idênticos à divisão inteira `(120 * diariaCentavos + 50) ÷ 100`.
  - Na saída para o webhook, `centavosParaReais(centavos)` ([dinheiro.ts:23-26](../../src/nucleo/dinheiro.ts#L23-L26)) faz `centavos / 100`. Em IEEE-754 (double precision), `JSON.stringify(centavos / 100)` usa o algoritmo *Grisu3/Dragonbox* do V8, que garante a representação decimal mais curta que reconverte exatamente para o mesmo float; para qualquer inteiro `centavos`, `centavos / 100` serializa sem dízima espúria (ex.: `97316 / 100 -> 973.16`).

#### 4. Formatação do valor para o hóspede (`formatarReais`)
- A função `formatarReais(centavos)` ([dinheiro.ts:15-20](../../src/nucleo/dinheiro.ts#L15-L20)) **não erra para nenhum inteiro não-negativo seguro** (`0 <= centavos <= Number.MAX_SAFE_INTEGER`):
  - Valida `Number.isInteger(centavos) && centavos >= 0` (recusa negativos, `NaN`, `Infinity` e frações).
  - Calcula `Math.trunc(centavos / 100)` e aplica `.replace(/\B(?=(\d{3})+(?!\d))/g, ".")`, inserindo ponto de milhar em `1.000`, `10.000`, `1.000.000`, etc., e não inserindo ponto abaixo de `1000` (`0` a `999`).
  - Calcula `(centavos % 100).toString().padStart(2, "0")`, garantindo sempre duas casas após a vírgula (`00`, `05`, `60`, `16`).
- **Observação sobre pós-processamento no loop ([loop.ts:90-112](../../src/agente/loop.ts#L90-L112)):** `corrigirValores` indexa os valores permitidos pelos dígitos (`porDigitos.set(digitos, valor)` e, quando termina em `"00"`, `porDigitos.set(digitos.slice(0, -2), valor)`). Se um valor com centavos não nulos (ex.: `R$ 369,60`, dígitos `"36960"`) for escrito pelo modelo como `"R$ 369,6"` (1 casa decimal, dígitos `"3696"`), não haverá match em `porDigitos` e a frase será removida (mas a função `comTotais` em seguida garante que `Total da estadia: R$ 369,60` seja anexado ao final da resposta).

#### 5. O que os testes de `test/nucleo/` NÃO cobrem e deveria estar coberto
1. **Imóveis reais do catálogo em `preco.test.ts`:** [preco.test.ts](../../test/nucleo/preco.test.ts) testa apenas 5 combinações de tarifas (`GRM-301`, `RIO-402`, `NAT-601`, `BMB-202`, `SAO-501`). Não há um teste parametrizado sobre os 15 imóveis reais do catálogo (`tarifas.json` / `fichas.json`), como o `IMB-801` (`diaria: 475`, cujo acréscimo de 20% é `570,00`).
2. **Estadia atravessando 29/02 de ano bissexto em `preco.test.ts`:** `datas.test.ts` testa `somarDias("2028-02-28", 1)`, mas `preco.test.ts` não tem caso explícito de `cotar()` atravessando `2028-02-28` a `2028-03-02` conferindo o dia da semana e o acréscimo antes e depois de `29/02`.
3. **Datas ISO com dia inexistente no calendário passadas a `cotar()` / `diasEntre()`:** `preco.test.ts` (linha 108) testa `"abc"`, `""` e `"15/01/2027"`, mas **não testa** `"2027-02-29"`, `"2027-02-30"` ou `"2027-04-31"` em `cotar()`, motivo pelo qual o Achado 2 passou despercebido.
4. **`Number.NaN` e `Infinity` em `hospedes` de `cotar()` e em `dinheiro.test.ts`:** `preco.test.ts` (linha 122) testa `[0, -2, 2.5]`, mas não testa `NaN` nem `Infinity`. `dinheiro.test.ts` não testa `Infinity`, `-0`, nem centavos negativos/NaN em `formatarReais` e `centavosParaReais` (`formatarReais(0)` -> `"R$ 0,00"` e `formatarReais(100000)` -> `"R$ 1.000,00"` no limiar exato de milhar também não estão em `dinheiro.test.ts`).
5. **Preposições e formatos em Inglês/Abreviados em `datas.test.ts`:** `datas.ts` implementa meses em inglês (`"January 15, 2027"`, `"Jan 15"`), formato com barra e mês (`"15/jan/2027"`), `"depois de amanha"`, `"anteontem"`, `"day after tomorrow"`, e `ehDataInexistente` com dia da semana conflitante (`"segunda-feira, 15/01/2027"`), mas esses ramos não têm asserções em `datas.test.ts`.

---

### Tabela de 15 estadias calculadas à mão vs. Produto vs. Juiz

| # | Imóvel | Entrada | Saída | Hósp. | Cálculo à mão (centavos e R$) | Produto (`cotar`) | Juiz (`calcularEstadia`) | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `GRM-301` (diária 59000, limp 15000, mín 2, cap 4) | `2027-01-15` (sex) | `2027-01-18` (seg) | 2 | 3 noites (sex, sáb, dom): $2 \times 70800 + 1 \times 59000 + 15000 = 215600$ (`R$ 2.156,00`) | `215600` (`R$ 2.156,00`) | `215600` (`R$ 2.156,00`) | Igual |
| 2 | `RIO-402` (diária 24550, limp 7500, mín 1, cap 2) | `2027-01-15` (sex) | `2027-01-16` (sáb) | 2 | 1 noite (sex): $\lfloor(120 \times 24550 + 50)/100\rfloor + 7500 = 29460 + 7500 = 36960$ (`R$ 369,60`) | `36960` (`R$ 369,60`) | `36960` (`R$ 369,60`) | Igual |
| 3 | `NAT-601` (diária 36590, limp 9500, mín 2, cap 3) | `2027-01-15` (sex) | `2027-01-18` (seg) | 3 | 3 noites (sex, sáb, dom): $2 \times 43908 + 1 \times 36590 + 9500 = 133906$ (`R$ 1.339,06`) | `133906` (`R$ 1.339,06`) | `133906` (`R$ 1.339,06`) | Igual |
| 4 | `IMB-801` (diária 47500, limp 14000, mín 2, cap 4) | `2027-01-16` (sáb) | `2027-01-18` (seg) | 4 | 2 noites (sáb, dom): $1 \times 57000 + 1 \times 47500 + 14000 = 118500$ (`R$ 1.185,00`) | `118500` (`R$ 1.185,00`) | `118500` (`R$ 1.185,00`) | Igual |
| 5 | `SAO-501` (diária 31000, limp 10000, mín 1, cap 2) | `2026-12-31` (qui) | `2027-01-03` (dom) | 2 | Virada de ano, 3 noites (qui, sex, sáb): $1 \times 31000 + 2 \times 37200 + 10000 = 115400$ (`R$ 1.154,00`) | `115400` (`R$ 1.154,00`) | `115400` (`R$ 1.154,00`) | Igual |
| 6 | `FLN-101` (diária 28000, limp 9000, mín 2, cap 2) | `2028-02-28` (seg) | `2028-03-02` (qui) | 2 | Bissexto (28/02 seg, 29/02 ter, 01/03 qua): $3 \times 28000 + 9000 = 93000$ (`R$ 930,00`) | `93000` (`R$ 930,00`) | `93000` (`R$ 930,00`) | Igual |
| 7 | `BMB-202` (diária 115000, limp 32000, mín 4, cap 10) | `2027-01-10` (dom) | `2027-01-25` (seg) | 10 | 15 noites (2 sem + dom): 4 fds e 11 comuns: $11 \times 115000 + 4 \times 138000 + 32000 = 1849000$ (`R$ 18.490,00`) | `1849000` (`R$ 18.490,00`) | `1849000` (`R$ 18.490,00`) | Igual |
| 8 | `RIO-401` (diária 98000, limp 26000, mín 3, cap 4) | `2027-01-15` (sex) | `2027-01-30` (sáb) | 4 | 15 noites (2 sem + sex): 5 fds e 10 comuns: $10 \times 98000 + 5 \times 117600 + 26000 = 1594000$ (`R$ 15.940,00`) | `1594000` (`R$ 15.940,00`) | `1594000` (`R$ 15.940,00`) | Igual |
| 9 | `FLN-102` (diária 89000, limp 25000, mín 3, cap 7) | `2027-01-15` (sex) | `2027-01-17` (dom) | 4 | 2 noites < mínimo de 3 noites -> **Recusa** (`minimo_noites`) | Recusa (`minimo_noites`) | Recusa (`Mínimo de 3 noites...`) | Igual |
| 10 | `GRM-302` (diária 43000, limp 12000, mín 3, cap 2) | `2027-01-15` (sex) | `2027-01-18` (seg) | 3 | 3 hóspedes > capacidade 2 -> **Recusa** (`capacidade`) | Recusa (`capacidade`) | Recusa (`Capacidade de 2 excedida`) | Igual |
| 11 | `CGT-901` (diária 54000, limp 17000, mín 2, cap 8) | `2027-01-18` (seg) | `2027-01-18` (seg) | 4 | 0 noites (mesmo dia) -> **Recusa** (`datas_invalidas`) | Recusa (`datas_invalidas`) | Recusa (`Saída deve ser posterior...`) | Igual |
| 12 | `FOZ-701` (diária 42000, limp 13000, mín 2, cap 5) | `2027-01-18` (seg) | `2027-01-15` (sex) | 2 | -3 noites (saída antes da entrada) -> **Recusa** (`datas_invalidas`) | Recusa (`datas_invalidas`) | Recusa (`Saída deve ser posterior...`) | Igual |
| 13 | `GRM-301` (diária 59000, limp 15000, mín 2, cap 4) | `2027-01-15` (sex) | `2027-01-18` (seg) | 0 | 0 hóspedes -> **Recusa** pela L13 (`hospedes_invalido`) | Recusa (`hospedes_invalido`) | `215600` (`R$ 2.156,00`) | **Diverge** (Achado 3) |
| 14 | `GRM-301` (diária 59000, limp 15000, mín 2, cap 4) | `2027-02-29` (inex.) | `2027-03-05` (sex) | 2 | 2027 não é bissexto -> **Recusa** (`datas_invalidas`) | `251000` (`R$ 2.510,00`) | Recusa (`Data civil inválida...`) | **Diverge** (Achado 2) |
| 15 | `GRM-301` (diária 59000, limp 15000, mín 2, cap 4) | `15/01/2027` (BR) | `18/01/2027` (BR) | 2 | Formato BR direto na função pura (3 noites -> `215600` após `resolverData`) | Recusa (`datas_invalidas`) | `215600` (`R$ 2.156,00`) | **Diverge** (Achado 5) |

---

### O que foi conferido e está certo
- **Suíte de testes `test/nucleo`:** rodada com `~/.cache/agente-concierge/com-trava.sh npx vitest run test/nucleo --maxWorkers=3` (3 arquivos, 111 testes passando, `node_modules` removido ao final e worktree limpa).
- **Contagem de noites e dias de acréscimo (seção 3):** número de noites é `checkout - checkin` em datas civis; apenas a noite que **começa** na sexta (`5`) ou no sábado (`6`) recebe `+20%` (noite de domingo não tem acréscimo; saída no sábado de manhã não cobra sábado).
- **Otimização $O(1)$ de semanas (`Math.floor(noites / 7) * 2 + resto`):** conferida contra laço noite a noite de 1 a 35 noites começando nos 7 dias da semana e para 10 anos (3.653 noites).
- **Arredondamento por noite (L14):** `Math.floor((120 * diariaCentavos + 50) / 100)` arredonda meio centavo para cima antes de multiplicar pela quantidade de noites com acréscimo.
- **Taxa de limpeza e hóspedes:** taxa de limpeza somada uma única vez; número de hóspedes dentro da capacidade (ou omitido) não altera o preço.
- **Fuso horário de São Paulo (L1, L2):** `dataCivilEmSaoPaulo` usa `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", ... })`, tratando corretamente a janela entre 00:00 UTC e 03:00 UTC como o dia anterior em São Paulo, e `prepararPedido` recusa `checkin < contexto.hoje` aceitando `checkin === contexto.hoje`.

### O que não consegui verificar
- **Leitura direta de `a cópia local das fichas do catálogo, fora do repositório`:** bloqueada pelo sandbox da ferramenta por estar fora das pastas de workspace permitidas; a conferência das tarifas dos 15 imóveis foi feita com `evals/lib/tarifas.json` e `test/apoio.ts`.
- **Comportamento ao vivo do modelo (LLM) e do endpoint HTTP em `dev`/`producao`:** não verificado, conforme a instrução de não subir servidor e não fazer chamadas de rede.
