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
import { type DataISO, diasEntre, interpretarData } from "./nucleo/datas";
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
 * de novo; "enviando" que sobrou de um reinício vale como incerto.
 */
export type SituacaoEnvio = "enviando" | "registrado" | "nao_registrado" | "incerto";

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
export function apresentarResumo(cofre: Cofre, reserva: Reserva, totalCentavos: number, turno: number, nomeDoImovel?: string): void {
  cofre.salvar({ ...cofre.ler(), pendente: { reserva, totalCentavos, turno, nomeDoImovel } });
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

/** Pedido de confirmação, texto fixo de código nos dois idiomas (L15). */
export function textoDoPedidoDeConfirmacao(pendente: Pendente, idioma: "pt" | "en"): string {
  const id = pendente.reserva.imovel_id;
  return idioma === "en"
    ? `Your booking request for ${id} is still waiting for your confirmation. May I send it to our sales team? To confirm, reply "yes".`
    : `O seu pedido de reserva do ${id} ainda aguarda a sua confirmação. Posso enviar ao time comercial? Para confirmar, responda "sim".`;
}

/**
 * Para o fim de um turno cuja resposta foi escrita pelo modelo: se há resumo em aberto e
 * neste turno o código não mostrou resumo nem pedido de confirmação, devolve o pedido
 * para acrescentar à resposta e registra que ele foi repetido agora (L9). O sim só vale
 * no turno seguinte a esse registro.
 */
export function pedidoDeConfirmacaoPendente(cofre: Cofre, turno: number, idioma: "pt" | "en"): string | undefined {
  const estado = cofre.ler();
  const pendente = pendenteAberto(estado);
  if (!pendente || pendente.turno >= turno) return undefined;
  cofre.salvar({ ...estado, pendente: { ...pendente, turno } });
  return textoDoPedidoDeConfirmacao(pendente, idioma);
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
    + "|\\b(por|for)\\s+\\d[\\d.,]{2,}"
    + "|\\b(se|desde que|contanto que|caso|if|unless|provided|as long as)\\b.*\\b(valor|preco|total|price|\\d{3,})",
);
const HESITA = /\b(acho|achando|talvez|pode ser|nao sei|sei la|quase|provavel|provavelmente|depende|vou pensar|vou ver|pensando|maybe|i think|i guess|probably|perhaps|not sure|might|kind of|sort of)\b/;
// Só um "ok", "perfeito" ou "certo", mesmo com um "obrigado": o hóspede pode estar apenas
// acusando o recebimento. Vale como hesitação.
const FRACA = new RegExp("^(?:(?:ok|okay|ta bom|ta|beleza|blz|bom|legal|show|joia|fine|alright|good|great|k"
  + "|certo|certinho|perfeito|claro|obrigad[oa]|obg|valeu|thanks|thank you)(?: |$))+$");

// O sim é uma gramática fechada de frases, não uma lista de palavras soltas: palavras
// que valem numa frase ("pode enviar", "confirmo o resumo") não podem ser recombinadas em
// outro pedido ("pode enviar o resumo de novo"). Tudo já sem acento e sem pontuação.
// 1. Afirmações completas por si.
const AFIRMA = "s+i+m+|s|ss|si|yes|yep|yeah|yup|isso(?: mesmo)?|exato|exatamente|corret[oa]|certo|certinho|perfeito|claro|com certeza"
  + "|positivo|fechado|combinado|(?:esta |ta )?tudo (?:certo|correto)|esta (?:certo|correto)|correct|thats? (?:s )?(?:right|correct)"
  + "|sure|absolutely|definitely|(?:it )?(?:looks|sounds) good|all good|go ahead|proceed|please do";
// 2. "Confirmo", que pode dizer o que confirma: o resumo, a reserva, os dados.
const CONFIRMA = "(?:(?:eu )?confirm(?:o|ado|ada|ar)|i confirm|confirm(?:ed)?)"
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
const MARCA = "oimovel|ototal|asdatas|oshospedes|asnoites|onome|otelefone";
const LIGA = "de|do|da|no|na|em|para|pra|pro|com|por|pelo|e|o|a|os|as|sou|of|for|at|in|with|on|and|the"
  + "|imovel|property|valor|total|nome|telefone|name|phone|datas|dates";
const DADOS = `(?: (?:(?:${LIGA}) ){0,3}(?:${MARCA}))*`;
const CORTESIA = "por favor|pfv|obrigad[oa]|obg|valeu|please|thanks|thank you|tambem|definitivamente|agora|ja|mesmo|entao|too|also|now|ok|okay";
const AFIRMA_OU_CONFIRMA = `(?:${AFIRMA}|${CONFIRMA})`;
const FRASE = `(?:${AFIRMA_OU_CONFIRMA}|${PODE})${DADOS}`;
const INICIO = "(?:(?:ok|okay|entao|bom|ah) )*";
const SIM = new RegExp(`^${INICIO}${FRASE}(?: (?:${FRASE}|${CORTESIA}))*$`);
const COMECA_AFIRMANDO = new RegExp(`^${INICIO}${AFIRMA_OU_CONFIRMA}(?: |$)`);
// Frase com "?" que é só um pedido educado de envio ("pode fechar a reserva, por favor?").
const PEDIDO_DE_ENVIO = new RegExp(`^(?:${AFIRMA_OU_CONFIRMA}${DADOS} )*${PODE}${DADOS}(?: (?:${CORTESIA}))*$`);

const MAXIMO_DO_SIM = 120;

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
    .replace(/(\d+)\s*(?:hospedes?|pessoas?|adultos?|guests?|people|persons?)\b/g, (trecho, n: string) =>
      (Number(n) === r.hospedes ? " oshospedes " : trecho))
    .replace(/(\d+)\s*(?:noites?|nights?|diarias?)\b/g, (trecho, n: string) =>
      (Number(n) === diasEntre(r.checkin, r.checkout) ? " asnoites " : trecho));
}

/**
 * Lê a mensagem do hóspede diante do resumo pendente. Recusa por padrão: só é "sim" a
 * mensagem feita inteira de frases de afirmação conhecidas, que podem repetir dados
 * iguais aos do resumo. Dado diferente, dígito que sobrou, palavra ou combinação fora da
 * gramática, pergunta, hesitação ou condição: não é sim. Lead enviado não se desfaz,
 * então na dúvida a resposta é "não confirmou".
 */
export function lerConfirmacao(mensagem: string, pendente: Pendente): Leitura {
  // Ponto de interrogação de largura cheia (？) e árabe (؟) também fazem pergunta.
  const texto = marcarDadosIguais(semAcento(mensagem).replace(/[？؟]/g, "?"), pendente);
  if (PRECO.test(texto)) return "condicao_de_preco";
  const limpo = semPontuacao(texto);
  // A gramática do sim tem frases que se sobrepõem ("pode sim" = "pode" + "sim"), e o
  // tempo do regex dobra a cada repetição. Nenhum sim de verdade passa deste tamanho.
  if (limpo.length > MAXIMO_DO_SIM) return texto.includes("?") && !/\d/.test(texto) ? "pergunta" : "outra";
  if (texto.includes("?")) {
    // "Sim, confirmo! Pode fechar a reserva, por favor?" é um sim com pedido educado;
    // qualquer outra pergunta ("sim, e tem wifi?", "pode fechar?", "sim?") não confirma.
    const perguntas = (texto.match(/[^.!?]*\?/g) ?? []).map(semPontuacao);
    const pedidoEducado = COMECA_AFIRMANDO.test(limpo) && perguntas.every((p) => PEDIDO_DE_ENVIO.test(p));
    if (!pedidoEducado) return /\d/.test(texto) ? "outra" : "pergunta";
  }
  if (HESITA.test(limpo) || FRACA.test(limpo)) return "hesitacao";
  return SIM.test(limpo) ? "sim" : "outra";
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
  | "ja_tentado"; // esta reserva já teve um envio de resultado incerto

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

  const leitura = lerConfirmacao(mensagem, pendente);
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
    const novo = { ...pendente, totalCentavos: cotacao.totalCentavos, turno: turnoAtual };
    cofre.salvar({ ...cofre.ler(), pendente: novo });
    return { tipo: "total_mudou", pendente: novo };
  }

  // Daqui até o `marcar` não há `await`: conferir e gravar o marcador é um passo só,
  // então duas confirmações que chegaram juntas não passam as duas.
  const agora = cofre.ler();
  const corrida = agora.envios[chave];
  if (reservaFechada(corrida)) return jaMarcada(cofre, corrida!, pendente, turnoAtual);
  if (!agora.pendente || chaveDaReserva(agora.pendente.reserva) !== chave) return { tipo: "sem_resumo" };
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
  // Com certeza não registrou: a confirmação foi gasta, mas a reserva não fica bloqueada.
  // Um novo resumo (com o dado corrigido, ou mais tarde) pode ser confirmado e enviado.
  const estado = cofre.ler();
  // Já houve recusa nesta sessão (mesma reserva ou a de antes da correção): pedir a
  // correção de novo vira laço; a conversa passa para humano.
  const jaRecusado = Object.values(estado.envios).includes("nao_registrado");
  cofre.salvar({ ...estado, pendente: null, envios: { ...estado.envios, [chave]: "nao_registrado" } });
  return resposta.campos.length > 0 && !jaRecusado
    ? { tipo: "campo_recusado", campos: resposta.campos }
    : { tipo: "nao_registrado", motivo: "resposta" };
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
