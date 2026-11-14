// Trava de confirmação do lead (contrato seção 5). Regras que este arquivo garante,
// sem depender do modelo:
//   1. só é enviado o que foi resumido, e o resumo é de um turno anterior;
//   2. o total enviado sai de uma nova leitura da ficha; se mudou, não envia;
//   3. o marcador da reserva é gravado antes do POST, e reserva marcada nunca é
//      enviada de novo (nem depois de reinício, nem com duas confirmações juntas);
//   4. só um 201 vira "registrado"; resposta diferente é "não registrado" e libera a
//      reserva para um novo resumo; resposta que não chegou é "incerto" e a bloqueia (L11);
//   5. quem reconhece o sim é o código, lendo a mensagem do hóspede (L9): o modelo só
//      pede a confirmação, e ela vale no turno seguinte a um resumo ou a um pedido de
//      confirmação que saíram do código.
import { type DataISO, diasEntre, formatarDataComDia, indiceDiaDaSemana, interpretarData } from "./nucleo/datas";
import { centavosParaReais, formatarReais } from "./nucleo/dinheiro";
import type { Cotacao } from "./nucleo/preco";
import { normalizarTelefone } from "./nucleo/telefone";

export interface Reserva {
  imovel_id: string;
  checkin: DataISO;
  checkout: DataISO;
  hospedes: number;
  nome: string;
  telefone: string;
}

/**
 * Marcador de uma reserva: "enviando" (gravado antes do POST), "registrado" (201),
 * "nao_registrado" (o webhook respondeu outra coisa: com certeza não entrou) e "incerto"
 * (tempo esgotado ou sem resposta: pode ter entrado). Só "nao_registrado" permite tentar
 * de novo; "enviando" que sobrou de um reinício vale como incerto. "recusado" = o webhook
 * recusou a mesma reserva duas vezes: ela não é enviada de novo na sessão.
 */
export type SituacaoEnvio = "enviando" | "registrado" | "nao_registrado" | "incerto" | "recusado";

/** A reserva já teve um envio que entrou ou pode ter entrado: não ganha outro POST na sessão (L7, L11). */
export function reservaFechada(situacao: SituacaoEnvio | undefined): boolean {
  return situacao !== undefined && situacao !== "nao_registrado";
}

export interface Pendente {
  reserva: Reserva;
  totalCentavos: number;
  /** Último turno em que o resumo ou o pedido de confirmação saíram do código para o hóspede. */
  turno: number;
  /** Nome do imóvel no catálogo, para mostrar o resumo de novo sem reler a ficha. */
  nomeDoImovel?: string;
  /** Turno em que o resumo foi criado ou teve um dado alterado (não muda quando só é repetido). */
  criadoEm?: number;
  /** Quantos resumos a sessão já tinha mostrado, contando este (1 = o primeiro). */
  ordem?: number;
}

export interface EstadoLead {
  pendente: Pendente | null;
  /** Marcador de idempotência por reserva (ver `chaveDaReserva`). */
  envios: Record<string, SituacaoEnvio>;
  /** Resumos mostrados na sessão, para saber se um resumo substituiu outro (P13). */
  resumosMostrados?: number;
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
export function apresentarResumo(cofre: Cofre, reserva: Reserva, totalCentavos: number, turno: number, nomeDoImovel?: string): void {
  const estado = cofre.ler();
  const ordem = (estado.resumosMostrados ?? 0) + 1;
  cofre.salvar({ ...estado, resumosMostrados: ordem, pendente: { reserva, totalCentavos, turno, nomeDoImovel, criadoEm: turno, ordem } });
}

/** O resumo que ainda espera o sim do hóspede: existe e a reserva dele ainda pode ser enviada. */
export function pendenteAberto(estado: EstadoLead): Pendente | null {
  const { pendente, envios } = estado;
  return pendente && !reservaFechada(envios[chaveDaReserva(pendente.reserva)]) ? pendente : null;
}

/** Algum dado mudou depois do resumo: a confirmação que estava em aberto deixa de valer (L10). */
export function invalidarPendente(cofre: Cofre): void {
  const estado = cofre.ler();
  if (pendenteAberto(estado)) cofre.salvar({ ...estado, pendente: null });
}

// Textos fixos de código do resumo, em português e em inglês (L15). Todo pedido de
// confirmação gerado por código traz o resumo inteiro: o sim seguinte vale sempre para um
// resumo mostrado no turno imediatamente anterior (L10). Outro idioma recebe português.
export type IdiomaDoResumo = "pt" | "en";
const DIAS_EM_INGLES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MESES_EM_INGLES = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];

/** "2027-01-15" -> "sexta-feira, 15/01/2027" ou "Friday, January 15, 2027". */
export function dataComDia(data: DataISO, idioma: IdiomaDoResumo): string {
  if (idioma === "pt") return formatarDataComDia(data);
  const [ano, mes, dia] = data.split("-").map(Number);
  return `${DIAS_EM_INGLES[indiceDiaDaSemana(data)]}, ${MESES_EM_INGLES[mes! - 1]} ${dia}, ${ano}`;
}

interface DadosDoResumo {
  imovel: string; entrada: string; saida: string; noites: number; hospedes: number; nome: string; soPrimeiroNome: boolean;
  telefone: string; total: string;
}

const TEXTOS_DO_RESUMO = {
  pt: {
    pedeConfirmacao: "Está tudo certo? Para confirmar, responda \"sim\" e eu envio o seu pedido ao time comercial.",
    aguarda: "O seu pedido de reserva ainda aguarda a sua confirmação.",
    linhas: (d: DadosDoResumo) => [
      "Resumo do seu pedido de reserva:",
      `- Imóvel: ${d.imovel}`,
      `- Entrada: ${d.entrada}`,
      `- Saída: ${d.saida} (${d.noites} ${d.noites === 1 ? "noite" : "noites"})`,
      `- Hóspedes: ${d.hospedes}`,
      `- Nome: ${d.nome}${d.soPrimeiroNome ? " (se puder, me diga também o sobrenome)" : ""}`,
      `- Telefone: ${d.telefone}`,
      `- Total: ${d.total}`,
    ],
  },
  en: {
    pedeConfirmacao: "Is everything correct? To confirm, reply \"yes\" and I will send your request to our sales team.",
    aguarda: "Your booking request is still waiting for your confirmation.",
    linhas: (d: DadosDoResumo) => [
      "Summary of your booking request:",
      `- Property: ${d.imovel}`,
      `- Check-in: ${d.entrada}`,
      `- Check-out: ${d.saida} (${d.noites} ${d.noites === 1 ? "night" : "nights"})`,
      `- Guests: ${d.hospedes}`,
      `- Name: ${d.nome}${d.soPrimeiroNome ? " (if you can, please tell me your last name too)" : ""}`,
      `- Phone: ${d.telefone}`,
      `- Total: ${d.total}`,
    ],
  },
} satisfies Record<IdiomaDoResumo, unknown>;

/** Resumo mostrado ao hóspede antes da confirmação (contrato seção 5), com o pedido de confirmação no fim. */
export function textoDoResumo(pendente: Pendente, idioma: IdiomaDoResumo = "pt"): string {
  const r = pendente.reserva;
  const t = TEXTOS_DO_RESUMO[idioma];
  const linhas = t.linhas({
    imovel: pendente.nomeDoImovel ? `${pendente.nomeDoImovel} (${r.imovel_id})` : r.imovel_id,
    entrada: dataComDia(r.checkin, idioma),
    saida: dataComDia(r.checkout, idioma),
    noites: diasEntre(r.checkin, r.checkout),
    hospedes: r.hospedes,
    nome: r.nome,
    soPrimeiroNome: !r.nome.includes(" "),
    telefone: r.telefone,
    total: formatarReais(pendente.totalCentavos),
  });
  return [...linhas, "", t.pedeConfirmacao].join("\n");
}

/** Pedido de confirmação repetido por código: o resumo inteiro de novo, nunca só a pergunta (L10, L15). */
export function textoDoPedidoDeConfirmacao(pendente: Pendente, idioma: IdiomaDoResumo): string {
  return `${TEXTOS_DO_RESUMO[idioma].aguarda}\n\n${textoDoResumo(pendente, idioma)}`;
}

/**
 * Para o fim de um turno cuja resposta foi escrita pelo modelo: se há resumo em aberto e
 * neste turno o código não mostrou resumo nem pedido de confirmação, devolve o pedido
 * para acrescentar à resposta e registra que ele foi repetido agora (L9). O sim só vale
 * no turno seguinte a esse registro.
 */
export function pedidoDeConfirmacaoPendente(cofre: Cofre, turno: number, idioma: "pt" | "en", mensagem?: string): string | undefined {
  const estado = cofre.ler();
  const pendente = pendenteAberto(estado);
  if (!pendente || pendente.turno >= turno) return undefined;
  if (mensagem !== undefined && mudaDadoDoResumo(mensagem, pendente)) {
    // O hóspede mudou (ou pode ter mudado) um dado: o sim seguinte não pode enviar a estadia antiga (L10).
    cofre.salvar({ ...estado, pendente: null });
    return undefined;
  }
  cofre.salvar({ ...estado, pendente: { ...pendente, turno } });
  return textoDoPedidoDeConfirmacao(pendente, idioma);
}

/**
 * Sim repetido logo depois do registro (ou de outro aviso de "já registrado"), sem resumo
 * em aberto: devolve a reserva registrada e anota o turno, para o código responder com o
 * texto fixo sem chamar o modelo e sem POST (L7, L15). Só no turno seguinte: com outra
 * conversa no meio, o sim pode ser resposta a outra coisa e fica com o modelo.
 */
export function simAposRegistro(cofre: Cofre, turno: number, mensagem: string): Pendente | undefined {
  const estado = cofre.ler();
  const { pendente } = estado;
  if (!pendente || estado.envios[chaveDaReserva(pendente.reserva)] !== "registrado") return undefined;
  if (turno !== pendente.turno + 1 || lerConfirmacao(mensagem, pendente, turno) !== "sim") return undefined;
  cofre.salvar({ ...estado, pendente: { ...pendente, turno } });
  return pendente;
}

/** O que a mensagem do hóspede é, diante do resumo que espera confirmação. */
export type Leitura =
  | "sim" // sim inequívoco e nada além dele
  | "hesitacao" // "acho que sim", "pode ser", ou só um "ok"
  | "condicao_de_preco" // "sim, se fizer por R$ 2.000", pedido de desconto
  | "pergunta" // outra pergunta, sem dado novo
  | "outra"; // qualquer outra coisa, inclusive sim acompanhado de dado: não confirma o resumo

const PRECO = new RegExp(
  "r\\$|\\$\\s*\\d|\\d\\s*%|\\breais\\b|\\bdescont|\\bcupo(m|ns)\\b|\\bpromoc|\\babat|\\bbarat|\\bdiscount|\\bcheaper|\\bcoupon"
    + "|\\b(por|for)\\s+\\d[\\d.,]{2,}|\\b(por|for)\\s+(\\d+|um|dois|tres|quatro|cinco|one|two|three|four|five)\\s*(mil|k)\\b"
    + "|\\bpagar menos\\b|\\bpay less\\b|\\bem conta\\b|\\bmetade do (valor|preco)\\b|\\bhalf price\\b"
    // Condição com qualquer coisa com cara de valor ou de preço (B3): "sim, se fizer 2 mil".
    + "|\\b(se|desde que|contanto que|caso|if|unless|provided|as long as)\\b.*(\\b(valor|preco|total|price|mil|metade|half|desconto\\w*"
    + "|barat\\w*|cheap\\w*|baixar|baixe|baixa o|orcamento|budget|cost|costs)\\b|\\d+\\s*k\\b|\\d{3,})",
);
const HESITA = /\b(acho|achando|talvez|pode ser|nao sei|sei la|quase|provavel|provavelmente|depende|vou pensar|vou ver|pensando|maybe|i think|i guess|probably|perhaps|not sure|might|kind of|sort of)\b/;
// As palavras de hesitação e o que só as acompanha ("acho que", "i think so", "ainda"). O que
// sobrar depois de tirá-las precisa ser nada ou um sim: qualquer outro resto pode ser mudança.
const HESITA_E_NEUTRAS = new RegExp("\\b(?:(?:acho|achando)(?: que)?|talvez|pode ser|nao sei|sei la|quase|provavel(?:mente)?|depende"
  + "|vou pensar|vou ver|pensando|maybe|i think(?: so)?|i guess(?: so)?|probably|perhaps|not sure|might|kind of|sort of"
  + "|ainda|hum+|hm+|ne|eh|ah|well|yet|so)\\b", "g");
// Só um "ok", "perfeito", "certo" ou "s", mesmo com um "obrigado": o hóspede pode estar
// apenas acusando o recebimento, ou ter digitado sem querer. Vale como hesitação (P11).
const FRACA = new RegExp("^(?:(?:ok|okay|ta bom|ta|beleza|blz|bom|legal|show|joia|fine|alright|good|great|k"
  + "|certo|certinho|perfeito|claro|obrigad[oa]|obg|valeu|thanks|thank you|s|otimo|ta otimo|perfect|top|massa)(?: |$))+$");

// O sim é uma gramática fechada de frases, não uma lista de palavras soltas: palavras
// que valem numa frase ("pode enviar", "confirmo o resumo") não podem ser recombinadas em
// outro pedido ("pode enviar o resumo de novo"). Tudo já sem acento e sem pontuação.
// 1. Afirmações completas por si.
const AFIRMA = "s+i+m+|s|ss|si|yes|yep|yeah|yup|isso(?: mesmo)?|exato|exatamente|corret[oa]|certo|certinho|perfeito|claro|com certeza"
  + "|positivo|fechado|combinado|(?:esta |ta )?tudo (?:certo|correto)|esta (?:certo|correto)|correct|thats? (?:s )?(?:right|correct)"
  + "|sure|absolutely|definitely|(?:it )?(?:looks|sounds) good|all good|go ahead|proceed|please do"
  // Formas da P15.
  + "|isso ai|manda ver|bora|sim quero|quero sim|please confirm|all correct";
// 2. "Confirmo", que pode dizer o que confirma: o resumo, a reserva, os dados.
const CONFIRMA = "(?:(?:eu )?confirm(?:o|a|e|ado|ada|ar)|i confirm|confirm(?:ed)?)"
  + "(?: (?:o |esse |este |the |this |that |my )?(?:resumo|pedido|summary|request|booking|reservation)"
  // "Segunda", "nova" ou "outra" reserva só com demonstrativo: "confirmo a outra reserva"
  // pode ser uma reserva que ainda não teve resumo; "essa segunda reserva" é a do resumo.
  + "| (?:a |essa |esta )?reserva| (?:essa |esta )(?:segunda |nova |outra )reserva| (?:this |that )second (?:booking|reservation|request)"
  + "| (?:os |esses |the )?(?:dados|details)| tudo| it| everything"
  + "| com (?:as |os )?(?:novas |novos )?(?:datas|dados)| with the new (?:dates|details))?"
  + "(?: de novo| novamente| again)?";
// 3. "Pode", sozinho ou com o verbo de enviar. O objeto só pode ser o pedido.
const PODE = "(?:pode(?: sim)?(?: (?:fechar|enviar|mandar|confirmar|registrar|reservar|prosseguir|seguir))?|send it|book it)"
  + "(?: (?:o|esse|este) pedido| (?:a|essa|esta) reserva| the (?:request|booking))?";
// 4. Dados do próprio resumo repetidos pelo hóspede. Só chegam aqui como marca os que o
//    código conferiu e são iguais aos do resumo (ver `marcarDadosIguais`).
const MARCA = "oimovel|ototal|asdatas|oshospedes|asnoites|onome|otelefone|odia|omes";
const LIGA = "de|do|da|no|na|em|para|pra|pro|com|por|pelo|e|o|a|os|as|sou|of|for|at|in|with|on|and|the"
  + "|imovel|property|valor|total|nome|telefone|name|phone|datas|dates";
const DADOS = `(?: (?:(?:${LIGA}) ){0,3}(?:${MARCA}))*`;
const CORTESIA = "por favor|pfv|obrigad[oa]|obg|valeu|please|thanks|thank you|tambem|definitivamente|agora|ja|mesmo|entao|too|also|now|ok|okay"
  // Referência ao resumo mostrado, que não muda nada (P13).
  + "|com (?:esses|estes|os) dados|with (?:these|those|the) details|(?:esse|este) (?:pedido|resumo)|(?:essa|esta) reserva"
  + "|(?:esses|estes) dados|(?:this|that) (?:request|booking|summary)";
const AFIRMA_OU_CONFIRMA = `(?:${AFIRMA}|${CONFIRMA})`;
const FRASE = `(?:${AFIRMA_OU_CONFIRMA}|${PODE})${DADOS}`;
// Interjeição positiva na frente do sim (P15): "tá ótimo, confirma", "show, pode mandar".
const INICIO = "(?:(?:ok|okay|entao|bom|ah|perfeito|otimo|ta otimo|beleza|blz|show|perfect|great|top|massa) )*";
const SIM = new RegExp(`^${INICIO}${FRASE}(?: (?:${FRASE}|${CORTESIA}))*$`);
const COMECA_AFIRMANDO = new RegExp(`^${INICIO}${AFIRMA_OU_CONFIRMA}(?: |$)`);
// Frase com "?" que é só um pedido educado de envio ("pode fechar a reserva, por favor?"):
// exige o verbo de envio; "sim, pode?" é pergunta.
const PODE_ENVIAR = "(?:pode(?: sim)? (?:fechar|enviar|mandar|confirmar|registrar)|send it)"
  + "(?: (?:o|esse|este) pedido| (?:a|essa|esta) reserva| the (?:request|booking))?";
const PEDIDO_DE_ENVIO = new RegExp(`^(?:${AFIRMA_OU_CONFIRMA}${DADOS} )*${PODE_ENVIAR}${DADOS}(?: (?:${CORTESIA}))*$`);
// O que pode aparecer numa confirmação limpa: letra latina (com acento), dígito, espaço,
// pontuação básica e os símbolos dos dados do resumo (telefone, data, valor). Emoji,
// símbolo e pontuação de outra escrita (❓, ‽, ¿, o ";" grego) fazem a mensagem não ser um sim.
// Emoji positivo no fim de um sim não o torna estranho (P15): "Sim! 😊", "sim 👍".
const EMOJI_POSITIVO_NO_FIM = /(?:\s*(?:😊|🙂|😀|😃|😄|😁|☺|👍|👌|✅|✔|🙏|🥰|😍|💯|🤝|👏)[\u{1F3FB}-\u{1F3FF}\uFE0F]*)+\s*$/u;
const SO_CARACTERES_COMUNS = /^[A-Za-zÀ-ÖØ-öø-ÿ\u0300-\u036f0-9\s.,!;:?'’"()\-+/$]*$/;

const MAXIMO_DO_SIM = 120;
// Mensagem maior que isto não é confirmação nem resposta neutra a um resumo, e não é lida:
// marcar os dados e passar pelos regex custaria CPU à toa (8.000 dígitos: ~330 ms).
const MAXIMO_DA_MENSAGEM = 300;

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const semPontuacao = (texto: string) => texto.replace(/[^a-z0-9]+/g, " ").trim();
const DATA = "(\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?|\\d{4}-\\d{2}-\\d{2})";
const PAR_DE_DATAS = new RegExp(
  `(?:\\b(?:de|do dia|dia|from|entre|between)\\s+)?${DATA}\\s*(?:ate o dia|ao dia|ate|ao|a|to|until|through|and|e|-)\\s*(?:o dia\\s+|dia\\s+)?${DATA}`,
  "g",
);

/**
 * Troca por marcas os dados que o hóspede repete na mensagem e que o código conferiu
 * serem iguais aos do resumo: imóvel, total, par de datas, hóspedes, noites, nome e
 * telefone. Dado diferente, ou que não dá para comparar com certeza (data sozinha, sem
 * ano ou por extenso; número sem unidade), fica como está, e a gramática do sim não
 * aceita o que sobrou. Repetir o resumo confirma; mudar um dado, não (L9, L10).
 */
function marcarDadosIguais(texto: string, pendente: Pendente): string {
  const r = pendente.reserva;
  const nome = semAcento(r.nome).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return texto
    .replaceAll(semAcento(r.imovel_id), " oimovel ")
    .replaceAll(semAcento(formatarReais(pendente.totalCentavos)), " ototal ")
    .replace(PAR_DE_DATAS, (trecho, entrada: string, saida: string) =>
      (interpretarData(entrada) === r.checkin && interpretarData(saida) === r.checkout ? " asdatas " : trecho))
    .replace(new RegExp(`(?<![a-z0-9])${nome}(?![a-z0-9])`, "g"), " onome ")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, (trecho) => (normalizarTelefone(trecho) === normalizarTelefone(r.telefone) ? " otelefone " : trecho))
    .replace(new RegExp(`(?<![a-z0-9])(\\d+|${NUMEROS})\\s*(?:hospedes?|pessoas?|adultos?|guests?|people|persons?)\\b`, "g"), (trecho, n: string) =>
      (numero(n) === r.hospedes ? " oshospedes " : trecho))
    .replace(new RegExp(`(?<![a-z0-9])(\\d+|${NUMEROS})\\s*(?:noites?|nights?|diarias?)\\b`, "g"), (trecho, n: string) =>
      (numero(n) === diasEntre(r.checkin, r.checkout) ? " asnoites " : trecho))
    // Dia da semana e mês da entrada ou da saída, por extenso ("sim, sexta", "sim, janeiro").
    .replace(DIA_DA_SEMANA, (trecho, dia: string) =>
      ([indiceDiaDaSemana(r.checkin), indiceDiaDaSemana(r.checkout)].includes(indiceDoDia(dia)) ? " odia " : trecho))
    .replace(MES, (trecho, mes: string) =>
      ([Number(r.checkin.slice(5, 7)), Number(r.checkout.slice(5, 7))].includes(indiceDoMes(mes)) ? " omes " : trecho));
}

const NUMEROS_POR_EXTENSO: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const NUMEROS = Object.keys(NUMEROS_POR_EXTENSO).join("|");
const numero = (n: string) => NUMEROS_POR_EXTENSO[n] ?? Number(n);
const DIAS = [["domingo", "sunday"], ["segunda", "monday"], ["terca", "tuesday"], ["quarta", "wednesday"], ["quinta", "thursday"],
  ["sexta", "friday"], ["sabado", "saturday"]];
// "Segunda reserva" é ordinal, não dia (P13): fica de fora.
const DIA_DA_SEMANA = new RegExp(`(?<![a-z0-9])(${DIAS.flat().join("|")})(?:\\s*-?\\s*feira)?(?![a-z0-9])`
  + "(?!\\s+(?:reserva|estadia|hospedagem|opcao|pedido|cotacao|resumo|vez)(?![a-z0-9]))", "g");
const indiceDoDia = (dia: string) => DIAS.findIndex((nomes) => nomes.includes(dia));
const MESES = ["janeiro|january", "fevereiro|february", "marco|march", "abril|april", "maio|may", "junho|june", "julho|july",
  "agosto|august", "setembro|september", "outubro|october", "novembro|november", "dezembro|december"];
const MES = new RegExp(`(?<![a-z0-9])(${MESES.join("|")})(?![a-z0-9])`, "g");
const indiceDoMes = (mes: string) => MESES.findIndex((nomes) => nomes.split("|").includes(mes)) + 1;

// Pedido explícito de mudança, ou dado novo dito em palavras (nome, número de pessoas).
// Sinais de que a mensagem pode mudar um dado do resumo. A regra é negar por padrão: a
// mensagem só mantém o resumo pendente se não tiver nenhum destes sinais, porque lista de
// formas de mudança perde sempre ("vamos ser três", "minha esposa também vai").
const SINAIS_DE_MUDANCA = [
  // Número por extenso, casal, dupla.
  "um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete"
    + "|dezoito|dezenove|vinte|casal|dupla|trio|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|pair",
  // Dia da semana, mês, hoje e amanhã.
  // "Segunda" seguida de substantivo de pedido é ordinal ("segunda reserva"), não data (P13).
  "segunda(?!\\s+(?:reserva|estadia|hospedagem|opcao|pedido|cotacao|resumo|vez)(?![a-z0-9]))"
    + "|terca|quarta|quinta|sexta|sabado|domingo|feriado|fim de semana|monday|tuesday|wednesday|thursday|friday|saturday"
    + "|sunday|weekend|holiday",
  "janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april"
    + "|may|june|july|august|september|october|november|december",
  "hoje|amanha|ontem|today|tomorrow|tonight|yesterday",
  // Pessoa ou hóspede.
  "esposa|esposo|marido|mulher|namorad[oa]s?|filh[oa]s?|criancas?|bebes?|pessoas?|hospedes?|adultos?|amig[oa]s?|mae|pai"
    + "|familia|irmaos?|irmas?|wife|husband|kids?|child|children|baby|babies|person|people|guests?|adults?|friends?|son"
    + "|daughter|partner|family",
  // Imóvel ou troca. "Esse" e "essa" só apontam para o resumo (P13); "outro" e "novo" são
  // palavras de novidade (ver NOVIDADE).
  "apartamento|apto|casa|chale|studio|estudio|cobertura|aquel[ea]s?|apartment|house|cabin|chalet",
  // Nome ou telefone.
  "meu nome|o nome|nome e|me chamo|telefone|celular|whats\\w*|zap|fone|contato|e-?mail|my name|name is|phone|mobile|cell"
    + "|contact",
  // Buracos achados pelo verificador: sobrenome, período relativo, sozinho, mais/menos,
  // adiar ou antecipar, abreviações de dia e de mês.
  "sobrenome|surname|last name|que vem|seguinte|proxim\\w*|next|sozinh\\w*|so eu|only me|just me|mais|menos|more|less"
    + "|tarde|cedo|later|earlier|longer|shorter|posterg\\w*|antecip\\w*|adi[ae]\\w*|fim do mes|end of the month|gente"
    + "|seg|ter|qua|qui|sex|sab|dom|jan|fev|mar|abr|mai|jun|jul|ago|set|nov|dez|feb|apr|aug|sep|sept|oct|dec",
  // Verbo de mudança.
  "mud\\w*|troc\\w*|alter\\w*|corrig\\w*|corrij\\w*|correca\\w*|substitu\\w*|ajust\\w*|na verdade|melhor|vai ser|vamos ser|somos|seremos"
    + "|em vez|ao inves|chang\\w*|switch\\w*|instead|actually|rather|better|updat\\w*|we are|we'?re|make it",
].join("|");
const SINAL_DE_MUDANCA = new RegExp(`(?<![a-z0-9])(?:${SINAIS_DE_MUDANCA})(?![a-z0-9])`);

/** Já sem acento e com os dados iguais ao resumo marcados: sobrou dígito ou sinal de mudança. */
function temSinalDeMudanca(textoMarcado: string): boolean {
  return /\d/.test(textoMarcado) || SINAL_DE_MUDANCA.test(textoMarcado);
}

// Palavra de novidade: só confirma se o resumo é novo, do turno imediatamente anterior (P13).
// "De novo" é "outra vez". "Segunda" que sobrou da leitura de data é ordinal.
const NOVIDADE = /(?<![a-z0-9])(?:nova|novas|novos|(?<!de )novo|outr[oa]s?|segunda|tambem|another|other|new|second|too|also)(?![a-z0-9])/;

// Dado igual ao do resumo, com o rótulo que o precede ("o telefone", "nome", "para"): vira
// um valor só. Sim com valor junto, mesmo igual, repete o pedido com o resumo (P13).
const VALOR_DO_RESUMO = new RegExp(`(?<![a-z0-9])(?:(?:${LIGA})[^a-z0-9]+){0,3}(?:${MARCA})(?![a-z0-9])`, "g");
const comValoresDoResumo = (textoMarcado: string) => textoMarcado.replace(VALOR_DO_RESUMO, " ovalor ");

/**
 * A mensagem pode mudar algum dado do resumo pendente? Sobrou dígito depois de marcar os
 * dados iguais aos do resumo (data, imóvel, telefone ou número diferente, ou que não dá
 * para comparar), ou há sinal de mudança. Na dúvida, muda: o resumo cai e é refeito (L10).
 */
export function mudaDadoDoResumo(mensagem: string, pendente: Pendente): boolean {
  if (mensagem.length > MAXIMO_DA_MENSAGEM) return true;
  // Fora de um sim também derrubam: palavra de novidade ("quero outra reserva"), valor do
  // resumo repetido ("não são 2 pessoas": a marca engole a palavra "pessoas") e negação.
  const texto = marcarDadosIguais(semAcento(mensagem), pendente);
  // Afirmação (sem "?") só mantém o resumo se for um sim ou uma hesitação: a lista de
  // sinais nunca fica completa ("quero cancelar", "vou com o João"). Pergunta segue pela lista.
  if (!/[?？؟]/.test(mensagem) && !["sim", "hesitacao"].includes(lerConfirmacao(mensagem, pendente))) return true;
  return temSinalDeMudanca(texto) || NOVIDADE.test(texto) || new RegExp(`(?<![a-z0-9])(?:${MARCA})(?![a-z0-9])`).test(texto)
    || NEGACAO.test(texto);
}

const NEGACAO = /(?<![a-z0-9])(?:nao|not|no|nope|errad\w*|wrong|incorret\w*|sem|without|tira\w*|remov\w*|exceto|except)(?![a-z0-9])/;

/**
 * Lê a mensagem do hóspede diante do resumo pendente. Recusa por padrão: só é "sim" a
 * mensagem feita inteira de frases de afirmação conhecidas, que podem repetir dados
 * iguais aos do resumo. Dado diferente, dígito que sobrou, palavra ou combinação fora da
 * gramática, pergunta, hesitação ou condição: não é sim. Lead enviado não se desfaz,
 * então na dúvida a resposta é "não confirmou".
 */
export function lerConfirmacao(mensagem: string, pendente: Pendente, turno?: number): Leitura {
  if (mensagem.length > MAXIMO_DA_MENSAGEM) return "outra";
  // Ponto de interrogação de largura cheia (？) e árabe (؟) também fazem pergunta.
  const bruto = mensagem.replace(/[？؟]/g, "?");
  const texto = marcarDadosIguais(semAcento(bruto), pendente);
  if (PRECO.test(texto)) return "condicao_de_preco";
  const limpo = semPontuacao(texto);
  const comValores = comValoresDoResumo(texto);
  // A gramática do sim tem frases que se sobrepõem ("pode sim" = "pode" + "sim"), e o
  // tempo do regex dobra a cada repetição. Nenhum sim de verdade passa deste tamanho.
  // Sinal de mudança, inclusive junto de hesitação, pergunta ou sim: não confirma, e o resumo cai (L10).
  if (temSinalDeMudanca(comValores)) return "outra";
  if (limpo.length > MAXIMO_DO_SIM) return texto.includes("?") ? "pergunta" : "outra";
  if (texto.includes("?")) {
    // "Sim, confirmo! Pode fechar a reserva, por favor?" é um sim com pedido educado;
    // qualquer outra pergunta ("sim, e tem wifi?", "pode fechar?", "sim?") não confirma.
    const perguntas = (texto.match(/[^.!?]*\?/g) ?? []).map(semPontuacao);
    const pedidoEducado = COMECA_AFIRMANDO.test(limpo) && perguntas.every((p) => PEDIDO_DE_ENVIO.test(p));
    if (!pedidoEducado) return /\d/.test(texto) ? "outra" : "pergunta";
  }
  if (HESITA.test(limpo)) {
    // "acho que sim, mas no mês que vem": a hesitação não pode engolir o resto (L10).
    const resto = limpo.replace(HESITA_E_NEUTRAS, " ").replace(/\s+/g, " ").trim();
    return resto === "" || FRACA.test(resto) || SIM.test(resto) ? "hesitacao" : "outra";
  }
  if (FRACA.test(limpo)) return "hesitacao";
  // Só emoji ou símbolo: não confirma nem derruba; repete o pedido com o resumo (P15).
  if (limpo === "") return bruto.trim() === "" || /\p{L}/u.test(bruto) ? "outra" : "hesitacao";
  if (!SIM.test(limpo)) return "outra";
  // Sim com caractere fora da lista permitida (emoji, ❓, ‽, o ";" grego): não é sim limpo, repete o pedido.
  if (!SO_CARACTERES_COMUNS.test(bruto.replace(EMOJI_POSITIVO_NO_FIM, ""))) return "hesitacao";
  // Sim com valor junto, mesmo igual ao do resumo: repete o pedido com o resumo (P13).
  if (comValores.includes("ovalor")) return "hesitacao";
  // Palavra de novidade só confirma o resumo criado ou alterado no turno anterior, e que
  // substituiu outro (P13): "com as novas datas" logo depois do primeiro resumo não é novidade
  // nenhuma, e repete o pedido (A5).
  const resumoNovo = turno !== undefined && pendente.criadoEm === turno - 1 && (pendente.ordem ?? 1) > 1;
  return NOVIDADE.test(texto) && !resumoNovo ? "hesitacao" : "sim";
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
  | "resposta" // o webhook respondeu algo diferente de 201, sem apontar um dado do hóspede
  | "incerto" // tempo esgotado ou sem resposta: pode ter chegado ou não (L11)
  | "ja_tentado" // esta reserva já teve um envio de resultado incerto
  | "ja_recusado"; // o webhook já recusou esta reserva duas vezes

/** Campos do lead que o hóspede informa e pode corrigir. `valor_total` sai do código. */
export const CAMPOS_DO_HOSPEDE = ["nome", "telefone", "imovel_id", "checkin", "checkout", "hospedes"] as const;
export type CampoDoHospede = (typeof CAMPOS_DO_HOSPEDE)[number];

/**
 * Quais dados do hóspede o corpo de um 422 aponta. O formato real do corpo é
 * desconhecido, então a leitura é pelo texto: vale o nome de campo que aparecer nele, em
 * qualquer estrutura. Corpo que não cita campo, que cita `valor_total` (o hóspede não o
 * corrige) ou que cita todos (eco do lead) não aponta nada.
 */
export function camposApontados(corpo: string): CampoDoHospede[] {
  const texto = semAcento(corpo.slice(0, 4000));
  if (/\bvalor_total\b/.test(texto)) return [];
  const campos = CAMPOS_DO_HOSPEDE.filter((campo) => new RegExp(`\\b${campo === "imovel_id" ? "imovel(_id)?" : campo}\\b`).test(texto));
  return campos.length === CAMPOS_DO_HOSPEDE.length ? [] : campos;
}

/** O webhook respondeu 422: com certeza não registrou. Leva os dados que o corpo apontou. */
export class LeadRecusado extends Error {
  constructor(readonly campos: CampoDoHospede[]) {
    super("webhook de leads recusou o lead");
  }
}

export type ResultadoConfirmacao =
  | { tipo: "sem_resumo" }
  | { tipo: "mesmo_turno" }
  /** A mensagem não é um sim inequívoco ao resumo: nada foi enviado. */
  | { tipo: "nao_confirmou"; leitura: Exclude<Leitura, "sim">; pendente: Pendente }
  /** O sim não veio logo depois de um resumo ou pedido de confirmação do código: o resumo é mostrado de novo. */
  | { tipo: "reapresentado"; pendente: Pendente }
  /** `repetido`: o sim veio logo depois do registro ou de outro aviso de "já registrado" (o hóspede repetiu o sim). */
  | { tipo: "ja_registrado"; pendente: Pendente; repetido: boolean }
  | { tipo: "total_mudou"; pendente: Pendente }
  | { tipo: "recusada"; explicacao: string }
  | { tipo: "registrado"; pendente: Pendente }
  /** O webhook recusou (422) apontando dados do hóspede: pedir a correção e refazer o resumo. */
  | { tipo: "campo_recusado"; campos: CampoDoHospede[] }
  | { tipo: "nao_registrado"; motivo: MotivoNaoRegistrado };

export interface DependenciasDoEnvio {
  /** Lê a ficha de novo e recalcula. `null` = imóvel não encontrado. Lança se o catálogo falhar. */
  recotar(reserva: Reserva): Promise<Cotacao | null>;
  /** Faz o POST e devolve o status HTTP. Lança `LeadRecusado` no 422 e outro erro quando a resposta não chega. */
  postar(corpo: CorpoDoLead): Promise<number>;
  envioLigado: boolean;
  destinoPermitido: boolean;
}

function marcar(cofre: Cofre, chave: string, situacao: SituacaoEnvio): void {
  const estado = cofre.ler();
  cofre.salvar({ ...estado, envios: { ...estado.envios, [chave]: situacao } });
}

/** Confirmação de uma reserva que já teve envio: nada é enviado de novo (L7, L11). */
function jaMarcada(cofre: Cofre, situacao: SituacaoEnvio, pendente: Pendente, turnoAtual: number): ResultadoConfirmacao {
  if (situacao === "recusado") return { tipo: "nao_registrado", motivo: "ja_recusado" };
  if (situacao !== "registrado") return { tipo: "nao_registrado", motivo: "ja_tentado" };
  // No resumo já registrado, `turno` guarda o turno do registro ou do último aviso de "já registrado".
  const repetido = turnoAtual <= pendente.turno + 1;
  if (repetido && turnoAtual > pendente.turno) cofre.salvar({ ...cofre.ler(), pendente: { ...pendente, turno: turnoAtual } });
  return { tipo: "ja_registrado", pendente, repetido };
}

/** Uma tentativa de POST: o status e os dados apontados num 422, ou "incerto" se a resposta não chegou. */
async function tentarEnvio(deps: DependenciasDoEnvio, corpo: CorpoDoLead): Promise<{ status: number; campos: CampoDoHospede[] } | "incerto"> {
  try {
    return { status: await deps.postar(corpo), campos: [] };
  } catch (erro) {
    return erro instanceof LeadRecusado ? { status: 422, campos: erro.campos } : "incerto";
  }
}

/**
 * O modelo pediu a confirmação. Decide, pela mensagem do hóspede e pelo estado, se o POST
 * sai, e relata o que aconteceu de fato.
 */
export async function confirmar(cofre: Cofre, turnoAtual: number, mensagem: string, deps: DependenciasDoEnvio): Promise<ResultadoConfirmacao> {
  const { pendente, envios } = cofre.ler();
  if (!pendente) return { tipo: "sem_resumo" };
  const chave = chaveDaReserva(pendente.reserva);
  const anterior = envios[chave];
  if (reservaFechada(anterior)) return jaMarcada(cofre, anterior!, pendente, turnoAtual);
  if (turnoAtual <= pendente.turno) return { tipo: "mesmo_turno" };

  const leitura = lerConfirmacao(mensagem, pendente, turnoAtual);
  if (leitura === "outra") {
    // Pode ser troca de dado em texto livre: o resumo antigo deixa de valer (L10).
    invalidarPendente(cofre);
    return { tipo: "nao_confirmou", leitura, pendente };
  }
  if (leitura === "hesitacao") {
    // A resposta deste turno é o pedido de confirmação repetido por código.
    cofre.salvar({ ...cofre.ler(), pendente: { ...pendente, turno: turnoAtual } });
    return { tipo: "nao_confirmou", leitura, pendente };
  }
  if (leitura !== "sim") return { tipo: "nao_confirmou", leitura, pendente };
  if (turnoAtual !== pendente.turno + 1) {
    // Houve outra conversa entre o resumo e este sim: ele pode ser resposta a outra coisa.
    const reapresentado = { ...pendente, turno: turnoAtual };
    cofre.salvar({ ...cofre.ler(), pendente: reapresentado });
    return { tipo: "reapresentado", pendente: reapresentado };
  }
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
    const novo = { ...pendente, totalCentavos: cotacao.totalCentavos, turno: turnoAtual, criadoEm: turnoAtual, ordem: (pendente.ordem ?? 1) + 1 };
    cofre.salvar({ ...cofre.ler(), pendente: novo });
    return { tipo: "total_mudou", pendente: novo };
  }

  // Daqui até o `marcar` não há `await`: conferir e gravar o marcador é um passo só,
  // então duas confirmações que chegaram juntas não passam as duas.
  const agora = cofre.ler();
  const corrida = agora.envios[chave];
  if (reservaFechada(corrida)) return jaMarcada(cofre, corrida!, pendente, turnoAtual);
  if (!agora.pendente || chaveDaReserva(agora.pendente.reserva) !== chave) return { tipo: "sem_resumo" };
  // Lido antes do marcador "enviando", que sobrescreve a recusa anterior desta reserva.
  const recusadaAntes = corrida === "nao_registrado";
  const recusaNaSessao = recusadaAntes || Object.values(agora.envios).some((e) => e === "nao_registrado" || e === "recusado");
  marcar(cofre, chave, "enviando");

  const corpo = corpoDoLead(pendente.reserva, cotacao.totalCentavos);
  let resposta = await tentarEnvio(deps, corpo);
  // 5xx: exatamente uma nova tentativa (L11). Resposta que não chegou nunca é repetida.
  if (resposta !== "incerto" && resposta.status >= 500) resposta = await tentarEnvio(deps, corpo);
  if (resposta === "incerto") {
    marcar(cofre, chave, "incerto");
    return { tipo: "nao_registrado", motivo: "incerto" };
  }
  if (resposta.status === 201) {
    const estado = cofre.ler();
    cofre.salvar({ ...estado, pendente: { ...pendente, turno: turnoAtual }, envios: { ...estado.envios, [chave]: "registrado" } });
    return { tipo: "registrado", pendente };
  }
  // 2xx diferente de 201 (200, 204): pode ter entrado. Incerto, sem novo envio (P14).
  if (resposta.status >= 200 && resposta.status < 300) {
    marcar(cofre, chave, "incerto");
    return { tipo: "nao_registrado", motivo: "incerto" };
  }
  // Com certeza não registrou. Só o 422 que aponta dado do hóspede, e na primeira recusa
  // da sessão, pede a correção e deixa a reserva ser enviada de novo com novo resumo.
  // Qualquer outra resposta (5xx depois da nova tentativa, 3xx, 400, 401, 404, 422 sem
  // campo ou repetido) bloqueia a reserva na sessão e passa para humano (P14).
  const corrigivel = resposta.status === 422 && resposta.campos.length > 0 && !recusaNaSessao;
  const estado = cofre.ler();
  cofre.salvar({ ...estado, pendente: null, envios: { ...estado.envios, [chave]: corrigivel ? "nao_registrado" : "recusado" } });
  return corrigivel ? { tipo: "campo_recusado", campos: resposta.campos } : { tipo: "nao_registrado", motivo: "resposta" };
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
 * a outro host). Devolve o status; no 422 lança `LeadRecusado` com os dados que o corpo
 * apontou. Sem resposta, lança um erro que nunca carrega a URL (ela tem token).
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
    }).catch(() => {
      throw new Error("webhook de leads sem resposta");
    });
    // Daqui em diante o status já chegou: falha ao ler ou descartar o corpo não muda o resultado.
    if (resposta.status === 422) throw new LeadRecusado(camposApontados(await resposta.text().catch(() => "")));
    await resposta.body?.cancel().catch(() => {});
    return resposta.status;
  } finally {
    // Relógio pendente segura o Durable Object acordado depois da resposta.
    clearTimeout(relogio);
  }
}
