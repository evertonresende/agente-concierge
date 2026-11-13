# Pergunta ao conselho — revisão do Marco 1 (13/11/2026)

Consulta às cegas a dois modelos de outros provedores, feita de uma pasta vazia, fora do
repositório. Nenhum dos dois vê a opinião da coordenação nem a resposta do outro. As
respostas inteiras estão em `m1-resposta-gemini.md` e `m1-resposta-gpt.md`. O código é o
da branch `frente-a` no commit aca6c7a.

## Pedido

Você é revisor externo de código. Abaixo estão as regras de um agente de chat que cota
estadias em imóveis de temporada e registra pedidos de reserva (lead), e o código do
primeiro marco: um Worker da Cloudflare em TypeScript, com um Durable Object por sessão
de conversa e um loop de ferramentas próprio. O modelo conversa; o código decide preço,
recusas, texto em reais e o envio do lead. Um lead enviado por engano não pode ser
desfeito.

Revise só estes quatro pontos:

1. **Cálculo de preço.** Centavos inteiros do começo ao fim, arredondamento por noite,
   noite que começa em sexta ou sábado, dia da semana por data civil, número de noites,
   as três recusas e os limites exatos, e a conversão para o número enviado ao webhook.
2. **Trava de confirmação.** Existe algum caminho em que o POST sai sem um resumo
   mostrado num turno anterior e um sim num turno seguinte? A confirmação pode ser usada
   duas vezes? Uma mudança de dado deixa uma confirmação antiga valendo?
3. **POST do lead e idempotência.** Marcador gravado antes do POST, resposta diferente
   de 201, tempo esgotado, reinício do objeto no meio do envio, envio desligado por
   configuração.
4. **Fila por sessão.** Duas mensagens simultâneas na mesma sessão são processadas uma
   por vez, na ordem de chegada? Um erro numa mensagem trava ou fura a fila? Duas
   confirmações simultâneas podem gerar dois leads?

Para cada defeito: arquivo e trecho, o cenário concreto que quebra (entrada e resultado
errado), severidade (crítica, alta, média ou baixa) e a correção em uma frase. Sem
elogio e sem resumo do código. Se não achar defeito num ponto, diga o que conferiu.
Responda em português.

## Regras (trechos do contrato do projeto)

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

### Regras de decisão que tocam estes pontos

| ID | Tema | Regra |
|---|---|---|
| L7 | Segunda reserva e repetição na mesma sessão | Outra reserva é permitida, com novo resumo e nova confirmação. A mesma reserva (imóvel, datas, hóspedes e telefone) já registrada não é reenviada: o agente diz que já está registrada. |
| L9 | O que conta como confirmação | Só um sim inequívoco ao resumo pendente, no turno seguinte ("sim", "confirmo", "pode fechar"). Hesitação ("acho que sim"): pergunta de novo. Condição de preço: nenhum lead e `handoff: true`. Outra pergunta: responde e repete o pedido de confirmação; nada é enviado. |
| L10 | Mudança de dado ou de preço depois do resumo | Qualquer dado mudou, ou o total recalculado é diferente do mostrado: a confirmação pendente é invalidada, com novo resumo e nova confirmação. |
| L11 | Falha do webhook | `422`: não registrado; se o erro aponta um campo, pede a correção e refaz o resumo, senão `handoff: true`. `5xx`: uma nova tentativa; se persistir, diz que não conseguiu registrar, com `handoff: true`. **Tempo esgotado ou resposta que não chegou (resultado incerto): sem nova tentativa e sem GET.** O agente diz que não conseguiu confirmar o registro, com `handoff: true`, e essa reserva não é reenviada na sessão. |
| L14 | Arredondamento de fração de centavo | Meio centavo arredonda para cima, por noite: `(120 × diária em centavos + 50) ÷ 100`, em divisão inteira. Hoje nenhum dos 15 imóveis gera fração. |
| L24 | Trava do POST real até a entrega | `producao` nasce com `ENVIO_LEADS=desligado`: uma confirmação lá não gera POST e segue o caminho de falha do L11 (diz que não conseguiu registrar, `handoff: true`). Ligar o envio é só com ordem do Éverton, na entrega; `scripts/validar-producao.sh --entrega` reprova se estiver desligado. |

- Duas mensagens simultâneas na mesma sessão são processadas uma por vez, na ordem de
  chegada. Nenhuma se perde e nenhuma causa lead duplicado.

## Código

### `src/nucleo/dinheiro.ts`

```ts
// Dinheiro é sempre um número inteiro de centavos. Reais com casas decimais só existem
// em duas fronteiras: a entrada do catálogo e a saída para o webhook.

/** Valor em reais vindo do catálogo (ex.: 245.5) para centavos inteiros (24550). */
export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais) || reais < 0) throw new Error("valor em reais inválido");
  return Math.round(reais * 100);
}

/** 215600 -> "R$ 2.156,00". É o único lugar que escreve um valor para o hóspede. */
export function formatarReais(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0) throw new Error("centavos inválidos");
  const reais = Math.trunc(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = (centavos % 100).toString().padStart(2, "0");
  return `R$ ${reais},${resto}`;
}

/** 215600 -> 2156 (número em reais do campo valor_total do webhook). */
export function centavosParaReais(centavos: number): number {
  if (!Number.isInteger(centavos) || centavos < 0) throw new Error("centavos inválidos");
  return centavos / 100;
}
```

### `src/nucleo/preco.ts`

```ts
// Regra de preço do contrato (seção 3). Função pura, tudo em centavos inteiros.
import { type DataISO, diasEntre, indiceDiaDaSemana, somarDias } from "./datas";

export interface RegrasDoImovel {
  diariaCentavos: number;
  taxaLimpezaCentavos: number;
  minimoNoites: number;
  capacidade: number;
}

export type MotivoRecusa = "datas_invalidas" | "minimo_noites" | "capacidade" | "hospedes_invalido";

export type Cotacao =
  | {
    ok: true;
    noites: number;
    /** Quantas das noites começam numa sexta ou num sábado. */
    noitesComAcrescimo: number;
    diariaCentavos: number;
    diariaComAcrescimoCentavos: number;
    taxaLimpezaCentavos: number;
    totalCentavos: number;
  }
  | { ok: false; motivo: MotivoRecusa; explicacao: string };

/** Diária com 20% a mais; meio centavo arredonda para cima (contrato L14). */
export function diariaComAcrescimo(diariaCentavos: number): number {
  return Math.floor((120 * diariaCentavos + 50) / 100);
}

/** A noite que começa numa sexta (5) ou num sábado (6) tem acréscimo. */
function temAcrescimo(data: DataISO): boolean {
  const dia = indiceDiaDaSemana(data);
  return dia === 5 || dia === 6;
}

/**
 * Cota a estadia ou recusa com o motivo. `hospedes` é opcional: o preço não depende
 * dele (contrato L8), mas, quando vem, precisa ser inteiro positivo (L13) e caber
 * na capacidade.
 */
export function cotar(regras: RegrasDoImovel, checkin: DataISO, checkout: DataISO, hospedes?: number): Cotacao {
  const noites = diasEntre(checkin, checkout);
  if (noites <= 0) {
    return {
      ok: false,
      motivo: "datas_invalidas",
      explicacao: noites === 0
        ? "A saída está no mesmo dia da entrada; a estadia precisa ter pelo menos uma noite."
        : "A data de saída é anterior à data de entrada.",
    };
  }
  if (noites < regras.minimoNoites) {
    return {
      ok: false,
      motivo: "minimo_noites",
      explicacao: `Este imóvel exige no mínimo ${regras.minimoNoites} noites, e o período pedido tem ${noites}.`,
    };
  }
  if (hospedes !== undefined) {
    if (!Number.isInteger(hospedes) || hospedes < 1) {
      return {
        ok: false,
        motivo: "hospedes_invalido",
        explicacao: "O número de hóspedes precisa ser um número inteiro maior que zero.",
      };
    }
    if (hospedes > regras.capacidade) {
      return {
        ok: false,
        motivo: "capacidade",
        explicacao: `Este imóvel acomoda no máximo ${regras.capacidade} pessoas, e o pedido é para ${hospedes}.`,
      };
    }
  }

  // O padrão se repete a cada 7 noites: 2 com acréscimo por semana cheia, mais as do
  // resto. Sem lista de noites, uma estadia de anos custa o mesmo que uma de dias.
  const resto = Array.from({ length: noites % 7 }, (_, i) => somarDias(checkin, i)).filter(temAcrescimo).length;
  const noitesComAcrescimo = Math.floor(noites / 7) * 2 + resto;
  const diariaComAcrescimoCentavos = diariaComAcrescimo(regras.diariaCentavos);
  // Cada noite já está arredondada para centavos antes de entrar na soma (L14).
  const totalCentavos = (noites - noitesComAcrescimo) * regras.diariaCentavos
    + noitesComAcrescimo * diariaComAcrescimoCentavos
    + regras.taxaLimpezaCentavos;
  return {
    ok: true,
    noites,
    noitesComAcrescimo,
    diariaCentavos: regras.diariaCentavos,
    diariaComAcrescimoCentavos,
    taxaLimpezaCentavos: regras.taxaLimpezaCentavos,
    totalCentavos,
  };
}
```

### `src/nucleo/datas.ts`

```ts
// Datas civis, sem hora nem fuso: uma data é o texto ISO "AAAA-MM-DD". As contas usam
// UTC só como calendário, então horário de verão e fuso não entram.

export type DataISO = string;

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;
const MS_POR_DIA = 86_400_000;

function montar(ano: number, mes: number, dia: number): DataISO | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // 30/02 vira 02/03 no Date: se o que voltou não é o que entrou, a data não existe.
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
}

/** Aceita "AAAA-MM-DD" e "DD/MM/AAAA" explícitas. Qualquer outra coisa, ou data que não existe, devolve null. */
export function interpretarData(texto: string): DataISO | null {
  const t = texto.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) return montar(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (br) return montar(Number(br[3]), Number(br[2]), Number(br[1]));
  return null;
}

function emMs(data: DataISO): number {
  return Date.parse(`${data}T00:00:00Z`);
}

/** 0 = domingo ... 6 = sábado. */
export function indiceDiaDaSemana(data: DataISO): number {
  return new Date(emMs(data)).getUTCDay();
}

export function diaDaSemana(data: DataISO): string {
  return DIAS[indiceDiaDaSemana(data)]!;
}

/** Dias civis de `inicio` até `fim` (negativo se `fim` vem antes). */
export function diasEntre(inicio: DataISO, fim: DataISO): number {
  return Math.round((emMs(fim) - emMs(inicio)) / MS_POR_DIA);
}

export function somarDias(data: DataISO, dias: number): DataISO {
  return new Date(emMs(data) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** "2027-01-15" -> "15/01/2027". */
export function formatarData(data: DataISO): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "2027-01-15" -> "sexta-feira, 15/01/2027". */
export function formatarDataComDia(data: DataISO): string {
  return `${diaDaSemana(data)}, ${formatarData(data)}`;
}
```

### `src/lead.ts`

```ts
// Trava de confirmação do lead (contrato seção 5). Regras que este arquivo garante,
// sem depender do modelo:
//   1. só é enviado o que foi resumido, e o resumo é de um turno anterior;
//   2. o total enviado sai de uma nova leitura da ficha; se mudou, não envia;
//   3. o marcador da reserva é gravado antes do POST, e reserva marcada nunca é
//      enviada de novo (nem depois de reinício, nem com duas confirmações juntas);
//   4. só um 201 vira "registrado".
import type { DataISO } from "./nucleo/datas";
import { centavosParaReais } from "./nucleo/dinheiro";
import type { Cotacao } from "./nucleo/preco";

export interface Reserva {
  imovel_id: string;
  checkin: DataISO;
  checkout: DataISO;
  hospedes: number;
  nome: string;
  telefone: string;
}

export type SituacaoEnvio = "enviando" | "registrado" | "falhou";

export interface Pendente {
  reserva: Reserva;
  totalCentavos: number;
  /** Turno em que o resumo foi mostrado ao hóspede. */
  turno: number;
}

export interface EstadoLead {
  pendente: Pendente | null;
  /** Marcador de idempotência por reserva (ver `chaveDaReserva`). */
  envios: Record<string, SituacaoEnvio>;
}

export const ESTADO_INICIAL: EstadoLead = { pendente: null, envios: {} };

/** Onde o estado mora. No Durable Object as duas operações são síncronas (SQLite). */
export interface Cofre {
  ler(): EstadoLead;
  salvar(estado: EstadoLead): void;
}

/** A mesma reserva = mesmo imóvel, datas, hóspedes e telefone (contrato L7). */
export function chaveDaReserva(r: Reserva): string {
  return [r.imovel_id.toUpperCase(), r.checkin, r.checkout, r.hospedes, r.telefone.replace(/\D/g, "")].join("|");
}

/** Registra que o resumo foi mostrado neste turno. Substitui qualquer resumo anterior (L10). */
export function apresentarResumo(cofre: Cofre, reserva: Reserva, totalCentavos: number, turno: number): void {
  cofre.salvar({ ...cofre.ler(), pendente: { reserva, totalCentavos, turno } });
}

/** O resumo que ainda espera o sim do hóspede: existe e a reserva dele nunca foi enviada. */
export function pendenteAberto(estado: EstadoLead): Pendente | null {
  const { pendente, envios } = estado;
  return pendente && !envios[chaveDaReserva(pendente.reserva)] ? pendente : null;
}

/** Algum dado mudou depois do resumo: a confirmação que estava em aberto deixa de valer (L10). */
export function invalidarPendente(cofre: Cofre): void {
  const estado = cofre.ler();
  if (pendenteAberto(estado)) cofre.salvar({ ...estado, pendente: null });
}

/** Corpo do POST: os 7 campos do contrato, com o total convertido de centavos na fronteira. */
export function corpoDoLead(reserva: Reserva, totalCentavos: number) {
  return {
    nome: reserva.nome,
    telefone: reserva.telefone,
    imovel_id: reserva.imovel_id,
    checkin: reserva.checkin,
    checkout: reserva.checkout,
    hospedes: reserva.hospedes,
    valor_total: centavosParaReais(totalCentavos),
  };
}

export type CorpoDoLead = ReturnType<typeof corpoDoLead>;

export type MotivoNaoRegistrado =
  | "envio_desligado" // ENVIO_LEADS diferente de "ligado" (L24)
  | "destino_proibido" // fora de producao apontando para o webhook real
  | "catalogo" // não deu para reler a ficha
  | "resposta" // o webhook respondeu algo diferente de 201
  | "incerto" // tempo esgotado ou sem resposta: pode ter chegado ou não (L11)
  | "ja_tentado"; // esta reserva já teve um envio que não terminou em 201

export type ResultadoConfirmacao =
  | { tipo: "sem_resumo" }
  | { tipo: "mesmo_turno" }
  | { tipo: "ja_registrado"; pendente: Pendente }
  | { tipo: "total_mudou"; pendente: Pendente }
  | { tipo: "recusada"; explicacao: string }
  | { tipo: "registrado"; pendente: Pendente }
  | { tipo: "nao_registrado"; motivo: MotivoNaoRegistrado };

export interface DependenciasDoEnvio {
  /** Lê a ficha de novo e recalcula. `null` = imóvel não encontrado. Lança se o catálogo falhar. */
  recotar(reserva: Reserva): Promise<Cotacao | null>;
  /** Faz o POST e devolve o status HTTP. Lança em erro de rede ou tempo esgotado. */
  postar(corpo: CorpoDoLead): Promise<number>;
  envioLigado: boolean;
  destinoPermitido: boolean;
}

function marcar(cofre: Cofre, chave: string, situacao: SituacaoEnvio): void {
  const estado = cofre.ler();
  cofre.salvar({ ...estado, envios: { ...estado.envios, [chave]: situacao } });
}

function jaMarcada(situacao: SituacaoEnvio, pendente: Pendente): ResultadoConfirmacao {
  return situacao === "registrado"
    ? { tipo: "ja_registrado", pendente }
    : { tipo: "nao_registrado", motivo: "ja_tentado" };
}

/** O hóspede confirmou. Decide se o POST sai e relata o que aconteceu de fato. */
export async function confirmar(cofre: Cofre, turnoAtual: number, deps: DependenciasDoEnvio): Promise<ResultadoConfirmacao> {
  const { pendente, envios } = cofre.ler();
  if (!pendente) return { tipo: "sem_resumo" };
  const chave = chaveDaReserva(pendente.reserva);
  const anterior = envios[chave];
  if (anterior) return jaMarcada(anterior, pendente);
  if (turnoAtual <= pendente.turno) return { tipo: "mesmo_turno" };
  if (!deps.envioLigado) return { tipo: "nao_registrado", motivo: "envio_desligado" };
  if (!deps.destinoPermitido) return { tipo: "nao_registrado", motivo: "destino_proibido" };

  let cotacao: Cotacao | null;
  try {
    cotacao = await deps.recotar(pendente.reserva);
  } catch {
    return { tipo: "nao_registrado", motivo: "catalogo" };
  }
  if (!cotacao || !cotacao.ok) {
    invalidarPendente(cofre);
    return { tipo: "recusada", explicacao: cotacao ? cotacao.explicacao : "O imóvel não está mais no catálogo." };
  }
  if (cotacao.totalCentavos !== pendente.totalCentavos) {
    const novo = { ...pendente, totalCentavos: cotacao.totalCentavos, turno: turnoAtual };
    cofre.salvar({ ...cofre.ler(), pendente: novo });
    return { tipo: "total_mudou", pendente: novo };
  }

  // Daqui até o `marcar` não há `await`: conferir e gravar o marcador é um passo só,
  // então duas confirmações que chegaram juntas não passam as duas.
  const agora = cofre.ler();
  const corrida = agora.envios[chave];
  if (corrida) return jaMarcada(corrida, pendente);
  if (!agora.pendente || chaveDaReserva(agora.pendente.reserva) !== chave) return { tipo: "sem_resumo" };
  marcar(cofre, chave, "enviando");

  let status: number;
  try {
    status = await deps.postar(corpoDoLead(pendente.reserva, cotacao.totalCentavos));
  } catch {
    marcar(cofre, chave, "falhou");
    return { tipo: "nao_registrado", motivo: "incerto" };
  }
  if (status !== 201) {
    marcar(cofre, chave, "falhou");
    return { tipo: "nao_registrado", motivo: "resposta" };
  }
  marcar(cofre, chave, "registrado");
  return { tipo: "registrado", pendente };
}

/** "real" quando o webhook mora no mesmo host do catálogo (contrato seção 8); senão "falso". */
export function destinoDosLeads(leadsUrl: string | undefined, catalogoUrl: string | undefined): "falso" | "real" {
  try {
    return new URL(leadsUrl ?? "").host === new URL(catalogoUrl ?? "").host ? "real" : "falso";
  } catch {
    // Sem conseguir comparar, vale o lado seguro: tratar como real.
    return "real";
  }
}

/** Fora de `producao` o destino tem de ser o webhook falso. */
export function destinoPermitido(ambiente: string | undefined, destino: "falso" | "real"): boolean {
  return ambiente === "producao" || destino === "falso";
}

const TEMPO_DO_WEBHOOK_MS = 10_000;

/** POST do lead. Devolve só o status; o erro lançado nunca carrega a URL (ela tem token). */
export async function postarLead(buscar: typeof fetch, url: string, corpo: CorpoDoLead): Promise<number> {
  try {
    const resposta = await buscar(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_DO_WEBHOOK_MS),
    });
    await resposta.body?.cancel();
    return resposta.status;
  } catch {
    throw new Error("webhook de leads sem resposta");
  }
}
```

### `src/agente/ferramentas/pedido.ts`

```ts
// Leitura comum do pedido de estadia que o modelo manda para cotar e para resumir.
import { type Ficha, regrasDaFicha } from "../../catalogo";
import { type DataISO, interpretarData } from "../../nucleo/datas";
import { cotar, type Cotacao } from "../../nucleo/preco";
import { type Argumentos, type Contexto, numero, texto } from "./tipos";

export type Pedido =
  | { ok: true; ficha: Ficha; checkin: DataISO; checkout: DataISO; hospedes: number | undefined; cotacao: Cotacao }
  | { ok: false; erro: string };

/**
 * Lê imóvel, datas e hóspedes dos argumentos, busca a ficha e aplica a regra de preço.
 * `hospedesPadrao` vale quando os argumentos não trazem o número de hóspedes.
 */
export async function prepararPedido(argumentos: Argumentos, contexto: Contexto, hospedesPadrao?: number): Promise<Pedido> {
  const id = texto(argumentos, "imovel_id");
  if (!id) return { ok: false, erro: "Falta o imóvel. Pergunte ao hóspede qual imóvel ele quer." };
  const entrada = texto(argumentos, "checkin");
  const saida = texto(argumentos, "checkout");
  const checkin = entrada ? interpretarData(entrada) : null;
  const checkout = saida ? interpretarData(saida) : null;
  if (!checkin || !checkout) {
    return {
      ok: false,
      erro: "Data de entrada ou de saída ausente, inexistente ou incompleta. Peça ao hóspede as duas datas com dia, "
        + "mês e ano (DD/MM/AAAA). Não informe nenhum total.",
    };
  }
  const ficha = await contexto.catalogo.ficha(id);
  if (!ficha) return { ok: false, erro: "Imóvel não encontrado no catálogo. Não informe nenhum valor." };
  const hospedes = numero(argumentos, "hospedes") ?? hospedesPadrao;
  return { ok: true, ficha, checkin, checkout, hospedes, cotacao: cotar(regrasDaFicha(ficha), checkin, checkout, hospedes) };
}
```

### `src/agente/ferramentas/tipos.ts`

```ts
// Contrato comum das ferramentas. Cada uma devolve dados para o modelo e, quando é o
// caso, efeitos decididos por código: encerrar o turno com um texto pronto, ligar o
// handoff ou exigir que um total apareça na resposta.
import type { Catalogo } from "../../catalogo";
import type { Cofre, CorpoDoLead } from "../../lead";
import type { DefinicaoDeFerramenta } from "../../modelo";

export interface Contexto {
  catalogo: Catalogo;
  cofre: Cofre;
  /** Número do turno atual na sessão (cada mensagem do hóspede é um turno). */
  turno: number;
  envio: {
    ligado: boolean;
    destinoPermitido: boolean;
    postar(corpo: CorpoDoLead): Promise<number>;
  };
}

export interface Resultado {
  /** Vai para o modelo como resultado da ferramenta (JSON). */
  paraOModelo: unknown;
  /** Texto de código que vira a resposta do turno, sem nova chamada ao modelo. */
  respostaFinal?: string;
  handoff?: boolean;
  /** Total (texto em reais) que a resposta do turno precisa trazer. */
  total?: string;
  /** A estadia foi recusada: a resposta do turno não pode ganhar total nenhum. */
  recusa?: boolean;
}

export type Argumentos = Record<string, unknown>;

export interface Ferramenta {
  definicao: DefinicaoDeFerramenta;
  executar(argumentos: Argumentos, contexto: Contexto): Promise<Resultado>;
}

export function definir(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  executar: Ferramenta["executar"],
): Ferramenta {
  return {
    definicao: { type: "function", function: { name, description, parameters: { type: "object", properties, required } } },
    executar,
  };
}

/** Texto não vazio, ou `undefined`. Os argumentos vêm do modelo e não são confiáveis. */
export function texto(argumentos: Argumentos, nome: string): string | undefined {
  const v = argumentos[nome];
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** Número como veio (inteiro ou não), ou `undefined`. Aceita "2" porque modelos mandam número como texto. */
export function numero(argumentos: Argumentos, nome: string): number | undefined {
  const v = argumentos[nome];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(",", "."));
  return undefined;
}
```

### `src/agente/ferramentas/lead.ts`

```ts
import { regrasDaFicha } from "../../catalogo";
import { apresentarResumo, chaveDaReserva, confirmar, invalidarPendente, type Pendente, type Reserva } from "../../lead";
import { diasEntre, formatarDataComDia } from "../../nucleo/datas";
import { formatarReais } from "../../nucleo/dinheiro";
import { cotar } from "../../nucleo/preco";
import { type Pedido, prepararPedido } from "./pedido";
import { type Argumentos, type Contexto, definir, type Resultado, texto } from "./tipos";

// Textos de código. Nenhum deles diz "registrado" antes de um 201 do webhook.
const PEDE_CONFIRMACAO = "Está tudo certo? Se estiver, responda \"sim\" e eu envio o seu pedido ao time comercial.";
const NAO_REGISTRADO = "Não consegui registrar o seu pedido de reserva. Vou passar a conversa para uma pessoa do "
  + "nosso time, que continua o atendimento com você.";
const INCERTO = "Não consegui confirmar o registro do seu pedido de reserva. Vou passar a conversa para uma pessoa "
  + "do nosso time, que confere a situação e continua o atendimento com você.";

/** Resumo mostrado ao hóspede antes da confirmação (contrato seção 5). */
export function textoDoResumo(pendente: Pendente, nomeDoImovel: string | undefined): string {
  const r = pendente.reserva;
  const noites = diasEntre(r.checkin, r.checkout);
  return [
    "Resumo do seu pedido de reserva:",
    `- Imóvel: ${nomeDoImovel ? `${nomeDoImovel} (${r.imovel_id})` : r.imovel_id}`,
    `- Entrada: ${formatarDataComDia(r.checkin)}`,
    `- Saída: ${formatarDataComDia(r.checkout)} (${noites} ${noites === 1 ? "noite" : "noites"})`,
    `- Hóspedes: ${r.hospedes}`,
    `- Nome: ${r.nome}`,
    `- Telefone: ${r.telefone}`,
    `- Total: ${formatarReais(pendente.totalCentavos)}`,
    "",
    PEDE_CONFIRMACAO,
  ].join("\n");
}

function jaRegistrado(pendente: Pendente): Resultado {
  const r = pendente.reserva;
  return {
    paraOModelo: { ja_registrado: true },
    respostaFinal: `Esse pedido (${r.imovel_id}, de ${formatarDataComDia(r.checkin)} a ${formatarDataComDia(r.checkout)}) `
      + "já está registrado com o nosso time comercial. Não enviei de novo.",
  };
}

/**
 * Grava o resumo como pendente e devolve o texto dele como resposta do turno. Reserva
 * que já teve envio não ganha resumo novo: o hóspede ouve o que aconteceu com ela.
 */
export function resumir(contexto: Contexto, pedido: Extract<Pedido, { ok: true }>, nome: string, telefone: string): Resultado {
  if (!pedido.cotacao.ok || pedido.hospedes === undefined) throw new Error("resumo pedido sem cotação válida");
  const reserva: Reserva = {
    imovel_id: pedido.ficha.id, checkin: pedido.checkin, checkout: pedido.checkout, hospedes: pedido.hospedes, nome, telefone,
  };
  const pendente: Pendente = { reserva, totalCentavos: pedido.cotacao.totalCentavos, turno: contexto.turno };
  const anterior = contexto.cofre.ler().envios[chaveDaReserva(reserva)];
  if (anterior === "registrado") return jaRegistrado(pendente);
  if (anterior) return { paraOModelo: { nao_registrado: true }, respostaFinal: INCERTO, handoff: true };

  apresentarResumo(contexto.cofre, reserva, pendente.totalCentavos, contexto.turno);
  return {
    paraOModelo: { resumo_apresentado: true, aguardando: "confirmação do hóspede na próxima mensagem" },
    respostaFinal: textoDoResumo(pendente, pedido.ficha.nome),
    total: formatarReais(pendente.totalCentavos),
  };
}

export const montarResumo = definir(
  "montar_resumo",
  "Monta o resumo do pedido de reserva e mostra ao hóspede para confirmação. Chame quando o hóspede quer fechar e "
    + "você tem TODOS os dados: imóvel, entrada, saída, número de hóspedes, nome e telefone. Faltou algum, pergunte "
    + "antes. Chame de novo sempre que qualquer dado mudar depois de um resumo. Esta ferramenta não envia nada.",
  {
    imovel_id: { type: "string" },
    checkin: { type: "string", description: "DD/MM/AAAA ou AAAA-MM-DD" },
    checkout: { type: "string", description: "DD/MM/AAAA ou AAAA-MM-DD" },
    hospedes: { type: "integer" },
    nome: { type: "string", description: "Nome do hóspede, como ele informou" },
    telefone: { type: "string", description: "Telefone do hóspede, como ele informou" },
  },
  ["imovel_id", "checkin", "checkout", "hospedes", "nome", "telefone"],
  async (argumentos, contexto) => {
    const resultado = await tentarResumir(argumentos, contexto);
    // Pedido de resumo que não virou resumo (dado faltando, estadia recusada): o resumo
    // anterior também não vale mais, porque o hóspede já não quer aquela reserva (L10).
    if (resultado.respostaFinal === undefined) invalidarPendente(contexto.cofre);
    return resultado;
  },
);

async function tentarResumir(argumentos: Argumentos, contexto: Contexto): Promise<Resultado> {
  const nome = texto(argumentos, "nome");
  const telefone = texto(argumentos, "telefone");
  const faltando = [!nome && "nome", !telefone && "telefone", argumentos.hospedes === undefined && "número de hóspedes"]
    .filter(Boolean);
  if (!nome || !telefone || faltando.length > 0) {
    return { paraOModelo: { erro: `Falta: ${faltando.join(", ")}. Pergunte ao hóspede; não invente.` } };
  }
  const pedido = await prepararPedido(argumentos, contexto);
  if (!pedido.ok) return { paraOModelo: { erro: pedido.erro } };
  if (pedido.hospedes === undefined) {
    return { paraOModelo: { erro: "Número de hóspedes inválido. Pergunte quantas pessoas são." } };
  }
  if (!pedido.cotacao.ok) {
    return {
      recusa: true,
      paraOModelo: {
        recusada: true,
        motivo: pedido.cotacao.explicacao,
        instrucao: "Explique o motivo ao hóspede. Não informe total e não monte resumo enquanto isso não for corrigido.",
      },
    };
  }

  return resumir(contexto, pedido, nome, telefone);
}

export const confirmarReserva = definir(
  "confirmar_reserva",
  "Envia o pedido ao time comercial. Chame SOMENTE quando a última mensagem do hóspede for um sim inequívoco "
    + "(\"sim\", \"confirmo\", \"pode fechar\") ao resumo que está aguardando confirmação. Não chame se o hóspede "
    + "hesitou (\"acho que sim\"), fez outra pergunta, mudou algum dado ou condicionou a um preço. Não recebe "
    + "dados: envia exatamente o que está no resumo.",
  {},
  [],
  async (_argumentos, contexto) => {
    let nomeDoImovel: string | undefined;
    const resultado = await confirmar(contexto.cofre, contexto.turno, {
      envioLigado: contexto.envio.ligado,
      destinoPermitido: contexto.envio.destinoPermitido,
      postar: contexto.envio.postar,
      recotar: async (reserva) => {
        const ficha = await contexto.catalogo.ficha(reserva.imovel_id);
        if (!ficha) return null;
        nomeDoImovel = ficha.nome;
        return cotar(regrasDaFicha(ficha), reserva.checkin, reserva.checkout, reserva.hospedes);
      },
    });

    switch (resultado.tipo) {
      case "sem_resumo":
        return { paraOModelo: { erro: "Não há resumo aguardando confirmação. Nada foi enviado. Reúna os dados e chame montar_resumo." } };
      case "mesmo_turno":
        return { paraOModelo: { erro: "O resumo acabou de ser mostrado. Nada foi enviado: a confirmação precisa vir na próxima mensagem do hóspede." } };
      case "recusada":
        return { paraOModelo: { recusada: true, motivo: resultado.explicacao, instrucao: "Nada foi enviado. Explique o motivo ao hóspede." } };
      case "ja_registrado":
        return jaRegistrado(resultado.pendente);
      case "total_mudou":
        return {
          paraOModelo: { total_mudou: true, enviado: false },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: "O valor desta estadia mudou desde o resumo anterior, então ainda não enviei nada.\n\n"
            + textoDoResumo(resultado.pendente, nomeDoImovel),
        };
      case "registrado":
        return {
          paraOModelo: { registrado: true },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: "Pronto! Seu pedido de reserva foi registrado e encaminhado ao nosso time comercial, no total de "
            + `${formatarReais(resultado.pendente.totalCentavos)}. O time entra em contato para os próximos passos. `
            + "Este registro é um pedido: ele ainda não garante a reserva nem bloqueia as datas.",
        };
      case "nao_registrado":
        return {
          paraOModelo: { registrado: false },
          handoff: true,
          respostaFinal: resultado.motivo === "incerto" || resultado.motivo === "ja_tentado" ? INCERTO : NAO_REGISTRADO,
        };
    }
  },
);
```

### `src/agente/ferramentas/cotacao.ts`

```ts
import { chaveDaReserva, invalidarPendente, pendenteAberto, type Reserva } from "../../lead";
import { formatarDataComDia } from "../../nucleo/datas";
import { formatarReais } from "../../nucleo/dinheiro";
import { resumir } from "./lead";
import { prepararPedido } from "./pedido";
import { definir } from "./tipos";

export const cotarEstadia = definir(
  "cotar",
  "Calcula o total de uma estadia pela regra de preço. É a ÚNICA fonte de valores: nunca calcule nem altere um "
    + "total por conta própria. Passe as datas como o hóspede escreveu, em DD/MM/AAAA ou AAAA-MM-DD. `hospedes` é "
    + "opcional: sem ele a cotação sai do mesmo jeito. Pode devolver uma recusa com o motivo, sem total.",
  {
    imovel_id: { type: "string", description: "Id do imóvel, ex.: GRM-301" },
    checkin: { type: "string", description: "Data de entrada, DD/MM/AAAA ou AAAA-MM-DD" },
    checkout: { type: "string", description: "Data de saída, DD/MM/AAAA ou AAAA-MM-DD" },
    hospedes: { type: "integer", description: "Número de pessoas (adultos, crianças e bebês contam; pet não)" },
  },
  ["imovel_id", "checkin", "checkout"],
  async (argumentos, contexto) => {
    // Resumo aguardando o sim: o que esta cotação não disser (hóspedes) vale o do resumo.
    const aberto = pendenteAberto(contexto.cofre.ler())?.reserva ?? null;
    const pedido = await prepararPedido(argumentos, contexto, aberto?.hospedes);
    if (!pedido.ok) return { paraOModelo: { erro: pedido.erro } };

    // O hóspede pediu outra estadia depois do resumo: a confirmação pendente deixa de
    // valer (contrato L10). Se a estadia nova é válida, o novo resumo sai daqui mesmo,
    // em texto de código; o modelo não redige resumo.
    if (aberto) {
      const nova: Reserva = {
        ...aberto, imovel_id: pedido.ficha.id, checkin: pedido.checkin, checkout: pedido.checkout, hospedes: pedido.hospedes ?? aberto.hospedes,
      };
      if (chaveDaReserva(nova) !== chaveDaReserva(aberto)) {
        invalidarPendente(contexto.cofre);
        if (pedido.cotacao.ok) return resumir(contexto, pedido, aberto.nome, aberto.telefone);
      }
    }

    const { ficha, cotacao, checkin, checkout, hospedes } = pedido;
    const estadia = {
      imovel: { id: ficha.id, nome: ficha.nome, capacidade: ficha.capacidade, minimo_noites: ficha.minimo_noites },
      entrada: formatarDataComDia(checkin),
      saida: formatarDataComDia(checkout),
    };
    if (!cotacao.ok) {
      return {
        recusa: true,
        paraOModelo: {
          ...estadia,
          recusada: true,
          motivo: cotacao.explicacao,
          instrucao: "Explique o motivo ao hóspede. Não informe nenhum total. Isto não é caso de passar para humano.",
        },
      };
    }
    const total = formatarReais(cotacao.totalCentavos);
    return {
      total,
      paraOModelo: {
        ...estadia,
        noites: cotacao.noites,
        noites_comuns: { quantidade: cotacao.noites - cotacao.noitesComAcrescimo, valor_de_cada: formatarReais(cotacao.diariaCentavos) },
        noites_de_sexta_e_sabado: { quantidade: cotacao.noitesComAcrescimo, valor_de_cada: formatarReais(cotacao.diariaComAcrescimoCentavos) },
        taxa_de_limpeza: formatarReais(cotacao.taxaLimpezaCentavos),
        total,
        hospedes: hospedes ?? "não informado: informe a capacidade e pergunte quantas pessoas são",
        instrucao: "Informe o total exatamente como está em `total` e as datas com o dia da semana. O valor é uma "
          + "cotação: não afirme que as datas estão disponíveis.",
      },
    };
  },
);
```

### `src/agente/loop.ts`

```ts
// Loop de ferramentas de um turno: o modelo pede ferramentas, o código executa e
// devolve o resultado, até sair uma resposta. O loop tem limite de voltas e de tempo, e
// nunca lança: em qualquer falha devolve a resposta de contingência (contrato L18).
import type { ChamadaDeFerramenta, Mensagem, Modelo, RespostaDoModelo } from "../modelo";
import { type Argumentos, type Contexto, FERRAMENTAS, type Resultado } from "./ferramentas";
import { montarPrompt } from "./prompt";

export interface EntradaDoTurno {
  mensagem: string;
  historico: Mensagem[];
  houveHandoff: boolean;
  contexto: Contexto;
  modelo: Modelo;
  /** Instante (ms) em que o trabalho externo precisa ter terminado. */
  prazo: number;
  agora?: () => number;
}

export interface SaidaDoTurno {
  reply: string;
  handoff: boolean;
  /** Mensagens a acrescentar ao histórico, sempre com cada chamada de ferramenta respondida. */
  novas: Mensagem[];
  uso: { entrada: number; saida: number; chamadas: number };
  ferramentas: string[];
  contingencia: boolean;
}

const MAX_VOLTAS = 6;
const CONFIRMAR = "confirmar_reserva";
const TENTATIVAS_DO_MODELO = 2;
const CONTINGENCIA = "Tive um problema técnico e não consegui concluir o seu atendimento agora. Vou passar a conversa "
  + "para uma pessoa do nosso time, que continua com você.";

class TempoEsgotado extends Error {}

/** Espera `promessa` no máximo `ms`. A promessa abandonada segue sozinha; o resultado dela é ignorado. */
function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(new TempoEsgotado());
  let relogio: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => { relogio = setTimeout(() => rejeitar(new TempoEsgotado()), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

function lerArgumentos(chamada: ChamadaDeFerramenta): Argumentos | null {
  try {
    const dado: unknown = JSON.parse(chamada.function.arguments || "{}");
    return dado && typeof dado === "object" && !Array.isArray(dado) ? (dado as Argumentos) : null;
  } catch {
    return null;
  }
}

async function executar(chamada: ChamadaDeFerramenta, contexto: Contexto): Promise<Resultado> {
  const ferramenta = FERRAMENTAS.find((f) => f.definicao.function.name === chamada.function.name);
  if (!ferramenta) return { paraOModelo: { erro: "Ferramenta inexistente." } };
  const argumentos = lerArgumentos(chamada);
  if (!argumentos) return { paraOModelo: { erro: "Argumentos inválidos: envie um objeto JSON." } };
  return ferramenta.executar(argumentos, contexto);
}

/**
 * Acerta o que o modelo escreve e que quebraria a leitura literal da resposta: hífen e
 * espaço especiais (um "GRM‑301" com hífen não separável não casa com "GRM-301") e
 * marcação de negrito, que a página mostra como asteriscos.
 */
export function limpar(texto: string): string {
  return texto.replace(/[\u2010\u2011]/g, "-").replace(/[\u00a0\u202f]/g, " ").replace(/\*\*/g, "");
}

/** Texto com um caractere repetido dezenas de vezes: o modelo degenerou, não é resposta. */
const DEGENERADA = /(.)\1{24,}/s;

/** Garante na resposta todo total calculado no turno, no texto que saiu do código. */
function comTotais(texto: string, totais: string[]): string {
  const faltando = [...new Set(totais)].filter((t) => !texto.includes(t));
  if (faltando.length === 0) return texto;
  return `${texto}\n\n${faltando.map((t) => `Total da estadia: ${t}`).join("\n")}`;
}

export async function rodarTurno(entrada: EntradaDoTurno): Promise<SaidaDoTurno> {
  const agora = entrada.agora ?? Date.now;
  const definicoes = FERRAMENTAS.map((f) => f.definicao);
  const sistema: Mensagem = { role: "system", content: montarPrompt(entrada.contexto.cofre.ler(), entrada.houveHandoff) };
  const novas: Mensagem[] = [{ role: "user", content: entrada.mensagem }];
  const uso = { entrada: 0, saida: 0, chamadas: 0 };
  const usadas: string[] = [];
  const totais: string[] = [];
  let handoff = false;

  const terminar = (reply: string, contingencia = false): SaidaDoTurno => {
    novas.push({ role: "assistant", content: reply });
    return { reply, handoff: handoff || contingencia, novas, uso, ferramentas: usadas, contingencia };
  };

  async function chamarModelo(): Promise<RespostaDoModelo> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        uso.chamadas++;
        const resposta = await comPrazo(entrada.modelo([sistema, ...entrada.historico, ...novas], definicoes), entrada.prazo - agora());
        uso.entrada += resposta.uso.entrada;
        uso.saida += resposta.uso.saida;
        const texto = limpar(resposta.texto);
        if (texto === "" && resposta.chamadas.length === 0) throw new Error("resposta vazia do modelo");
        if (DEGENERADA.test(texto)) throw new Error("resposta degenerada do modelo");
        return { ...resposta, texto };
      } catch (erro) {
        if (erro instanceof TempoEsgotado || tentativa >= TENTATIVAS_DO_MODELO) throw erro;
      }
    }
  }

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const resposta = await chamarModelo();
      if (resposta.chamadas.length === 0) return terminar(comTotais(resposta.texto, totais));

      // A confirmação roda por último no lote: se o modelo pediu junto uma cotação ou um
      // resumo com dado novo, eles invalidam a confirmação pendente antes (contrato L10).
      const chamadas = [...resposta.chamadas].sort((a, b) => Number(a.function.name === CONFIRMAR) - Number(b.function.name === CONFIRMAR));
      novas.push({ role: "assistant", content: resposta.texto, tool_calls: chamadas });
      let respostaFinal: string | undefined;
      let falhou = false;
      for (const chamada of chamadas) {
        // Toda chamada recebe um resultado no histórico, mesmo depois que o turno já foi
        // decidido: histórico com chamada sem resposta quebra o turno seguinte.
        let resultado: Resultado;
        if (respostaFinal !== undefined || falhou) {
          resultado = { paraOModelo: { ignorada: "o turno já tinha sido encerrado por outra ferramenta" } };
        } else {
          usadas.push(chamada.function.name);
          try {
            resultado = await comPrazo(executar(chamada, entrada.contexto), entrada.prazo - agora());
          } catch {
            falhou = true;
            resultado = { paraOModelo: { erro: "Falha interna ao executar a ferramenta." } };
          }
        }
        novas.push({ role: "tool", tool_call_id: chamada.id, content: JSON.stringify(resultado.paraOModelo) });
        if (resultado.handoff) handoff = true;
        if (resultado.total) totais.push(resultado.total);
        // Recusa não leva total (CA-06), nem o de uma cotação anterior do mesmo turno.
        if (resultado.recusa) totais.length = 0;
        respostaFinal ??= resultado.respostaFinal;
      }
      if (falhou) return terminar(CONTINGENCIA, true);
      if (respostaFinal !== undefined) return terminar(respostaFinal);
    }
  } catch {
    // modelo fora do ar, resposta vazia duas vezes ou tempo esgotado
  }
  return terminar(CONTINGENCIA, true);
}
```

### `src/sessao.ts`

```ts
// Uma sessão de conversa = um Durable Object. Guarda o histórico e o estado do lead
// em SQLite e garante uma mensagem por vez.
import { DurableObject } from "cloudflare:workers";
import { rodarTurno } from "./agente/loop";
import { criarCatalogo } from "./catalogo";
import type { Env } from "./env";
import { type Cofre, destinoDosLeads, destinoPermitido, ESTADO_INICIAL, type EstadoLead, postarLead } from "./lead";
import { criarModelo, type Mensagem, type Modelo } from "./modelo";

export interface RespostaDoChat {
  reply: string;
  handoff: boolean;
  uso: { entrada: number; saida: number; chamadas: number };
}

/** O que a sessão usa do mundo externo. Os testes trocam por falsos. */
export interface Dependencias {
  modelo: Modelo;
  buscar: typeof fetch;
}

/** Orçamento do trabalho externo, contado da chegada do pedido; sobra tempo para a contingência (contrato seção 2). */
const ORCAMENTO_MS = 45_000;
// ponytail: o modelo recebe só as últimas mensagens; conversa mais longa que isso
// esquece o começo. Trocar por resumo do histórico se as conversas reais passarem disso.
const JANELA_DO_HISTORICO = 80;

export class Sessao extends DurableObject<Env> {
  /** Trocado pelos testes; em produção sai do ambiente na primeira mensagem. */
  dependencias: Dependencias | null = null;

  // O Durable Object intercala pedidos enquanto espera o modelo ou o catálogo. Esta
  // corrente de promises é o que garante uma mensagem por vez, na ordem de chegada.
  private fila: Promise<unknown> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, mensagem TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS estado (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)");
  }

  /** Entra na fila e processa a mensagem quando todas as anteriores terminarem. */
  conversar(mensagem: string, chegada: number = Date.now()): Promise<RespostaDoChat> {
    const vez = this.fila.then(() => this.processar(mensagem, chegada));
    // Uma mensagem que falha não pode travar as seguintes.
    this.fila = vez.catch(() => undefined);
    return vez;
  }

  private ler<T>(chave: string, padrao: T): T {
    const linha = this.ctx.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = ?", chave).toArray()[0];
    return linha ? (JSON.parse(linha.valor) as T) : padrao;
  }

  private gravar(chave: string, valor: unknown): void {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO estado (chave, valor) VALUES (?, ?)", chave, JSON.stringify(valor));
  }

  private historico(): Mensagem[] {
    const linhas = this.ctx.storage.sql
      .exec<{ mensagem: string }>("SELECT mensagem FROM (SELECT id, mensagem FROM historico ORDER BY id DESC LIMIT ?) ORDER BY id", JANELA_DO_HISTORICO)
      .toArray()
      .map((l) => JSON.parse(l.mensagem) as Mensagem);
    // A janela começa numa mensagem do hóspede, para nunca abrir com resultado de ferramenta órfão.
    const inicio = linhas.findIndex((m) => m.role === "user");
    return inicio < 0 ? [] : linhas.slice(inicio);
  }

  private async processar(mensagem: string, chegada: number): Promise<RespostaDoChat> {
    const deps = this.dependencias ??= { modelo: criarModelo(this.env.AI, this.env.MODELO), buscar: fetch };
    const turno = this.ler("turno", 0) + 1;
    this.gravar("turno", turno);
    // O cofre só aceita gravação durante o turno. Uma ferramenta que o loop abandonou
    // por tempo e termina depois não muda o estado do lead pelas costas do hóspede: sem
    // conseguir gravar o marcador, ela também não chega a fazer o POST.
    let turnoAberto = true;
    const cofre: Cofre = {
      ler: () => this.ler<EstadoLead>("lead", ESTADO_INICIAL),
      salvar: (estado) => {
        if (!turnoAberto) throw new Error("turno encerrado");
        this.gravar("lead", estado);
      },
    };
    const destino = destinoDosLeads(this.env.LEADS_URL, this.env.CATALOGO_URL);

    const saida = await rodarTurno({
      mensagem,
      historico: this.historico(),
      houveHandoff: this.ler("handoff", false),
      modelo: deps.modelo,
      prazo: chegada + ORCAMENTO_MS,
      contexto: {
        catalogo: criarCatalogo(this.env.CATALOGO_URL, deps.buscar),
        cofre,
        turno,
        envio: {
          ligado: this.env.ENVIO_LEADS === "ligado",
          destinoPermitido: destinoPermitido(this.env.AMBIENTE, destino),
          postar: (corpo) => postarLead(deps.buscar, this.env.LEADS_URL ?? "", corpo),
        },
      },
    });

    turnoAberto = false;

    // Tudo ou nada: o histórico nunca fica com pedido de ferramenta sem o resultado.
    this.ctx.storage.transactionSync(() => {
      for (const nova of saida.novas) {
        this.ctx.storage.sql.exec("INSERT INTO historico (mensagem) VALUES (?)", JSON.stringify(nova));
      }
      if (saida.handoff) this.gravar("handoff", true);
    });

    // Um log por turno, sem texto de mensagem nem dado pessoal (contrato L22).
    console.log(JSON.stringify({
      evento: "turno",
      sessao: this.ctx.id.toString().slice(0, 12),
      turno,
      ms: Date.now() - chegada,
      chamadas_modelo: saida.uso.chamadas,
      tokens_entrada: saida.uso.entrada,
      tokens_saida: saida.uso.saida,
      ferramentas: saida.ferramentas,
      handoff: saida.handoff,
      contingencia: saida.contingencia,
      envios: Object.values(cofre.ler().envios),
    }));

    return { reply: saida.reply, handoff: saida.handoff, uso: saida.uso };
  }
}
```

### `src/index.ts`

```ts
// Rotas do Worker: POST /chat (contrato seção 2), GET / (página) e GET /saude.
import type { Env } from "./env";
import { destinoDosLeads } from "./lead";
import { PAGINA } from "./pagina";
import type { RespostaDoChat } from "./sessao";

export { Sessao } from "./sessao";

const LIMITE_DA_MENSAGEM = 8_000;
const SEM_USO = { entrada: 0, saida: 0, chamadas: 0 };
const FALHA_INTERNA = "Tive um problema técnico e não consegui concluir o seu atendimento agora. Vou passar a conversa "
  + "para uma pessoa do nosso time, que continua com você.";

function responder(status: number, reply: string, handoff: boolean, uso: RespostaDoChat["uso"] = SEM_USO): Response {
  return Response.json({ reply, handoff }, {
    status,
    headers: {
      "x-uso-entrada": String(uso.entrada),
      "x-uso-saida": String(uso.saida),
      "x-chamadas-modelo": String(uso.chamadas),
    },
  });
}

async function chat(pedido: Request, env: Env): Promise<Response> {
  const chegada = Date.now();
  let corpo: unknown;
  try {
    corpo = await pedido.json();
  } catch {
    return responder(400, "Corpo inválido: envie um JSON com session_id e message.", false);
  }
  const { session_id, message } = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  if (typeof session_id !== "string" || typeof message !== "string") {
    return responder(400, "Corpo inválido: session_id e message são obrigatórios e precisam ser texto.", false);
  }
  if (message.trim() === "") {
    return responder(200, "Não recebi nenhum texto. Pode escrever a sua mensagem?", false);
  }
  if (message.length > LIMITE_DA_MENSAGEM) {
    return responder(200, "Sua mensagem ficou longa demais para eu ler de uma vez. Pode resumir em poucas linhas?", false);
  }
  try {
    // O prefixo deixa o session_id vazio valer como uma sessão qualquer (contrato L17a).
    const resposta = await env.SESSAO.getByName(`sessao:${session_id}`).conversar(message, chegada);
    return responder(200, resposta.reply, resposta.handoff, resposta.uso);
  } catch {
    console.log(JSON.stringify({ evento: "falha_no_chat" }));
    return responder(200, FALHA_INTERNA, true);
  }
}

function saude(env: Env): Response {
  const variaveis = {
    CATALOGO_URL: Boolean(env.CATALOGO_URL),
    LEADS_URL: Boolean(env.LEADS_URL),
    AMBIENTE: Boolean(env.AMBIENTE),
    MODELO: Boolean(env.MODELO),
    ENVIO_LEADS: Boolean(env.ENVIO_LEADS),
  };
  return Response.json({
    ok: Object.values(variaveis).every(Boolean),
    ambiente: env.AMBIENTE ?? null,
    leads_destino: destinoDosLeads(env.LEADS_URL, env.CATALOGO_URL),
    envio_leads: env.ENVIO_LEADS === "ligado" ? "ligado" : "desligado",
    variaveis,
  });
}

export default {
  async fetch(pedido: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(pedido.url);
    if (pathname === "/chat") {
      return pedido.method === "POST" ? chat(pedido, env) : Response.json({ erro: "use POST" }, { status: 405, headers: { allow: "POST" } });
    }
    if (pedido.method === "GET" && pathname === "/saude") return saude(env);
    if (pedido.method === "GET" && pathname === "/") {
      return new Response(PAGINA, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return Response.json({ erro: "rota não encontrada" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```
