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

/**
 * POST do lead: uma tentativa só, sem seguir redirecionamento (um 307 reenviaria o corpo
 * a outro host). Devolve só o status; o erro lançado nunca carrega a URL (ela tem token).
 */
export async function postarLead(buscar: typeof fetch, url: string, corpo: CorpoDoLead, tempoMs = TEMPO_DO_WEBHOOK_MS): Promise<number> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), tempoMs);
  try {
    const resposta = await buscar(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      redirect: "manual",
      signal: controle.signal,
    });
    await resposta.body?.cancel();
    return resposta.status;
  } catch {
    throw new Error("webhook de leads sem resposta");
  } finally {
    // Relógio pendente segura o Durable Object acordado depois da resposta.
    clearTimeout(relogio);
  }
}
