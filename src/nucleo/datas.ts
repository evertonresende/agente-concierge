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

/** Aceita "AAAA-MM-DD", "DD/MM/AAAA" e "DD/MM/AA" (20AA) explícitas. Qualquer outra coisa, ou data que não existe, devolve null. */
export function interpretarData(texto: string): DataISO | null {
  const t = texto.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) return montar(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (br) return montar(interpretarAno(br[3]!), Number(br[2]), Number(br[1]));
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

const DIAS_DA_SEMANA: Record<string, number> = {
  "domingo": 0,
  "sunday": 0,
  "segunda": 1,
  "segunda-feira": 1,
  "segunda feira": 1,
  "monday": 1,
  "terca": 2,
  "terca-feira": 2,
  "terca feira": 2,
  "tuesday": 2,
  "quarta": 3,
  "quarta-feira": 3,
  "quarta feira": 3,
  "wednesday": 3,
  "quinta": 4,
  "quinta-feira": 4,
  "quinta feira": 4,
  "thursday": 4,
  "sexta": 5,
  "sexta-feira": 5,
  "sexta feira": 5,
  "friday": 5,
  "sabado": 6,
  "saturday": 6,
};

const RELATIVOS: Record<string, number> = {
  "hoje": 0,
  "today": 0,
  "amanha": 1,
  "tomorrow": 1,
  "depois de amanha": 2,
  "day after tomorrow": 2,
  "the day after tomorrow": 2,
  "ontem": -1,
  "yesterday": -1,
  "anteontem": -2,
};

const MESES: Record<string, number> = {
  janeiro: 1, jan: 1, january: 1,
  fevereiro: 2, fev: 2, february: 2, feb: 2,
  marco: 3, mar: 3, march: 3,
  abril: 4, abr: 4, april: 4, apr: 4,
  maio: 5, mai: 5, may: 5,
  junho: 6, jun: 6, june: 6,
  julho: 7, jul: 7, july: 7,
  agosto: 8, ago: 8, august: 8, aug: 8,
  setembro: 9, set: 9, september: 9, sep: 9, sept: 9,
  outubro: 10, out: 10, october: 10, oct: 10,
  novembro: 11, nov: 11, november: 11,
  dezembro: 12, dez: 12, december: 12, dec: 12,
};

function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°ª]/g, "")
    .replace(/\s+/g, " ");
}

function resolverSemAno(dia: number, mes: number, hoje: DataISO): DataISO | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const anoAtual = Number(hoje.slice(0, 4));
  if (mes === 2 && dia === 29) {
    // 2100 não é bissexto, então o próximo 29/02 pode ficar até 8 anos à frente.
    for (let ano = anoAtual; ano <= anoAtual + 8; ano++) {
      const candidata = montar(ano, 2, 29);
      if (candidata && candidata >= hoje) return candidata;
    }
    return null;
  }
  const nesteAno = montar(anoAtual, mes, dia);
  if (!nesteAno) return null;
  return nesteAno >= hoje ? nesteAno : montar(anoAtual + 1, mes, dia);
}

function extrairNucleoDeData(norm: string): { diaEsperado?: number; resto: string } {
  let s = norm.replace(/^(?:(?:para|pra|no|na|do|da|de|a|o|ate|desde)\s+)*/, "");
  let diaEsperado: number | undefined;
  const comDia = /^([a-z]+(?:[- ][a-z]+)?)\s*,?\s+(.+)$/.exec(s);
  if (comDia && Object.hasOwn(DIAS_DA_SEMANA, comDia[1]!)) {
    diaEsperado = DIAS_DA_SEMANA[comDia[1]!]!;
    s = comDia[2]!.replace(/^(?:(?:para|pra|no|na|do|da|de|a|o|ate|desde)\s+)*/, "");
  }
  const resto = s.replace(/^dia\s+/, "");
  return { diaEsperado, resto };
}

function interpretarAno(texto: string): number {
  const n = Number(texto);
  return texto.length === 2 ? 2000 + n : n;
}

function resolverComReferencias(texto: string, refSemAno: DataISO, refDiaSemana: DataISO, refRelativo: DataISO): DataISO | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refSemAno) || !interpretarData(refSemAno)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refDiaSemana) || !interpretarData(refDiaSemana)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refRelativo) || !interpretarData(refRelativo)) return null;

  const explicita = interpretarData(texto);
  if (explicita) return explicita;

  const norm = normalizarTexto(texto);
  if (!norm) return null;

  const rel = /^(?:(?:para|pra|a partir de|desde|de|ate)\s+)?(.+)$/.exec(norm);
  if (rel && Object.hasOwn(RELATIVOS, rel[1]!)) {
    return somarDias(refRelativo, RELATIVOS[rel[1]!]!);
  }

  const sem = /^(?:(?:para|pra|na|no|nesta|neste|nessa|nesse|esta|este|essa|esse|proxima|proximo|de|da|do|ate|desde|a|o)\s+)*([a-z]+(?:[- ][a-z]+)?)(?:\s+(?:que vem|proxima|proximo|agora))?$/.exec(norm);
  if (sem && Object.hasOwn(DIAS_DA_SEMANA, sem[1]!)) {
    const alvo = DIAS_DA_SEMANA[sem[1]!]!;
    const delta = ((alvo - indiceDiaDaSemana(refDiaSemana) + 7) % 7) || 7;
    return somarDias(refDiaSemana, delta);
  }

  const { diaEsperado, resto } = extrairNucleoDeData(norm);
  let resolvida: DataISO | null = interpretarData(resto);

  if (!resolvida) {
    const brSemAno = /^(\d{1,2})\/(\d{1,2})$/.exec(resto);
    if (brSemAno) {
      resolvida = resolverSemAno(Number(brSemAno[1]), Number(brSemAno[2]), refSemAno);
    }
  }

  if (!resolvida) {
    const ext = /^(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{2}|\d{4}))?$/.exec(resto);
    if (ext && Object.hasOwn(MESES, ext[2]!)) {
      const dia = Number(ext[1]);
      const mes = MESES[ext[2]!]!;
      resolvida = ext[3] ? montar(interpretarAno(ext[3]), mes, dia) : resolverSemAno(dia, mes, refSemAno);
    }
  }

  if (!resolvida) {
    const barraMes = /^(\d{1,2})\/([a-z]+)(?:\/(\d{2}|\d{4}))?$/.exec(resto);
    if (barraMes && Object.hasOwn(MESES, barraMes[2]!)) {
      const dia = Number(barraMes[1]);
      const mes = MESES[barraMes[2]!]!;
      resolvida = barraMes[3] ? montar(interpretarAno(barraMes[3]), mes, dia) : resolverSemAno(dia, mes, refSemAno);
    }
  }

  if (!resolvida) {
    const en = /^([a-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{2}|\d{4}))?$/.exec(resto);
    if (en && Object.hasOwn(MESES, en[1]!)) {
      const mes = MESES[en[1]!]!;
      const dia = Number(en[2]);
      resolvida = en[3] ? montar(interpretarAno(en[3]), mes, dia) : resolverSemAno(dia, mes, refSemAno);
    }
  }

  if (!resolvida) return null;
  if (diaEsperado !== undefined && indiceDiaDaSemana(resolvida) !== diaEsperado) return null;
  return resolvida;
}

/**
 * Resolve datas escritas pelo hóspede a partir da data civil de `hoje` (em São Paulo):
 * - explícitas (`AAAA-MM-DD`, `DD/MM/AAAA`, `DD/MM/AA` como 20AA, `15 de janeiro de 2027`);
 * - sem ano (`15/01`, `15 de janeiro`, `29/02`): próxima ocorrência (>= hoje);
 * - relativas (`hoje`, `amanhã`, `depois de amanhã`, `ontem`);
 * - dia da semana sem data (`sexta`, `sexta que vem`): próxima ocorrência estritamente futura.
 * Expressões vagas (`fim de semana`, `Natal`, `feriado`, `dia 15`) ou datas inexistentes devolvem null.
 */
export function resolverData(texto: string, hoje: DataISO): DataISO | null {
  return resolverComReferencias(texto, hoje, hoje, hoje);
}

/**
 * Resolve a data de saída (P5): com ano escrito ou ISO mantém a data literal;
 * relativas (`hoje`, `amanhã`, ...) continuam relativas a `hoje`;
 * dia da semana ou data sem ano resolvem a partir de `checkin`.
 */
export function resolverSaida(texto: string, checkin: DataISO, hoje: DataISO): DataISO | null {
  return resolverComReferencias(texto, checkin, checkin, hoje);
}

function temFormaDeCalendario(resto: string): boolean {
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(resto)) return true;
  if (/^\d{1,2}\/\d{1,2}(?:\/(?:\d{2}|\d{4}))?$/.test(resto)) return true;
  const ext = /^\d{1,2}\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(?:\d{2}|\d{4}))?$/.exec(resto);
  if (ext && Object.hasOwn(MESES, ext[1]!)) return true;
  const barraMes = /^\d{1,2}\/([a-z]+)(?:\/(?:\d{2}|\d{4}))?$/.exec(resto);
  if (barraMes && Object.hasOwn(MESES, barraMes[1]!)) return true;
  const en = /^([a-z]+)\s+\d{1,2}(?:\s*,?\s*(?:\d{2}|\d{4}))?$/.exec(resto);
  if (en && Object.hasOwn(MESES, en[1]!)) return true;
  return false;
}

/** Indica se o texto tem forma de data de calendário mas não existe no calendário (ex.: `30/02`, `29/02/2027`). */
export function ehDataInexistente(texto: string): boolean {
  const norm = normalizarTexto(texto);
  if (!norm) return false;
  const { resto } = extrairNucleoDeData(norm);
  return temFormaDeCalendario(resto) && resolverData(resto, "2026-01-01") === null;
}
