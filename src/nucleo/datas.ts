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

const FUSO_DO_NEGOCIO = "America/Sao_Paulo";
const CALENDARIO_DE_SAO_PAULO = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DO_NEGOCIO, year: "numeric", month: "2-digit", day: "2-digit",
});

/**
 * Data civil em São Paulo de um instante (milissegundos desde a época). É o "hoje" do
 * agente: às 02h de UTC ainda é o dia anterior em São Paulo.
 */
export function dataCivilEmSaoPaulo(instanteMs: number): DataISO {
  const partes = Object.fromEntries(CALENDARIO_DE_SAO_PAULO.formatToParts(new Date(instanteMs)).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}
