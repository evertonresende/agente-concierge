import { regrasDaFicha } from "../../catalogo";
import {
  apresentarResumo, type CampoDoHospede, chaveDaReserva, confirmar, invalidarPendente, type Leitura, type Pendente, type Reserva,
  reservaFechada,
} from "../../lead";
import { diasEntre, formatarDataComDia } from "../../nucleo/datas";
import { formatarReais } from "../../nucleo/dinheiro";
import { cotar } from "../../nucleo/preco";
import { type Pedido, prepararPedido } from "./pedido";
import { type Argumentos, type Contexto, definir, type Resultado, texto } from "./tipos";

// Textos de código. Nenhum deles diz "registrado" antes de um 201 do webhook.
const PEDE_CONFIRMACAO = "Está tudo certo? Para confirmar, responda \"sim\" e eu envio o seu pedido ao time comercial.";
const AINDA_NAO_ENVIEI = "Ainda não enviei nada.";
const SEM_NEGOCIACAO = "Não consigo alterar valores nem negociar preço, e não enviei nenhum pedido. Vou passar a conversa "
  + "para uma pessoa do nosso time, que continua o atendimento com você.";
const NAO_REGISTRADO = "Não consegui registrar o seu pedido de reserva. Vou passar a conversa para uma pessoa do "
  + "nosso time, que continua o atendimento com você.";
const INCERTO = "Não consegui confirmar o registro do seu pedido de reserva. Vou passar a conversa para uma pessoa "
  + "do nosso time, que confere a situação e continua o atendimento com você.";

/** Resumo mostrado ao hóspede antes da confirmação (contrato seção 5). */
export function textoDoResumo(pendente: Pendente): string {
  const r = pendente.reserva;
  const nomeDoImovel = pendente.nomeDoImovel;
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
  const pendente: Pendente = {
    reserva, totalCentavos: pedido.cotacao.totalCentavos, turno: contexto.turno, nomeDoImovel: pedido.ficha.nome,
  };
  const anterior = contexto.cofre.ler().envios[chaveDaReserva(reserva)];
  if (reservaFechada(anterior)) {
    // O hóspede pediu outra reserva (que já teve envio): o resumo que estava em aberto,
    // de uma reserva diferente, deixa de valer (L10).
    invalidarPendente(contexto.cofre);
    return anterior === "registrado"
      ? jaRegistrado(pendente)
      : { paraOModelo: { nao_registrado: true }, respostaFinal: INCERTO, handoff: true };
  }

  apresentarResumo(contexto.cofre, reserva, pendente.totalCentavos, contexto.turno, pendente.nomeDoImovel);
  return {
    paraOModelo: { resumo_apresentado: true, aguardando: "confirmação do hóspede na próxima mensagem" },
    respostaFinal: textoDoResumo(pendente),
    total: formatarReais(pendente.totalCentavos),
  };
}

const ROTULOS: Record<CampoDoHospede, string> = {
  nome: "o nome", telefone: "o telefone", imovel_id: "o imóvel", checkin: "a data de entrada", checkout: "a data de saída",
  hospedes: "o número de hóspedes",
};

/** O webhook recusou o lead apontando dados do hóspede: pede a correção, sem handoff (L11). */
function pedeCorrecao(campos: CampoDoHospede[]): string {
  return `Não consegui registrar o seu pedido: o sistema de reservas não aceitou ${campos.map((c) => ROTULOS[c]).join(", ")}. `
    + "Pode me informar de novo? Com a correção eu monto um novo resumo para você confirmar.";
}

/** A mensagem do hóspede não é um sim inequívoco ao resumo: nada foi enviado (L9). */
function naoConfirmou(leitura: Exclude<Leitura, "sim">): Resultado {
  switch (leitura) {
    case "hesitacao":
      return { paraOModelo: { enviado: false, motivo: "o hóspede hesitou" }, respostaFinal: `${AINDA_NAO_ENVIEI} ${PEDE_CONFIRMACAO}` };
    case "condicao_de_preco":
      return { paraOModelo: { enviado: false, motivo: "condição de preço" }, handoff: true, respostaFinal: SEM_NEGOCIACAO };
    case "pergunta":
      return {
        paraOModelo: {
          erro: "A mensagem do hóspede é uma pergunta, não uma confirmação. Nada foi enviado e o resumo continua "
            + "aguardando. Responda à pergunta e peça a confirmação de novo.",
        },
      };
    case "outra":
      return {
        paraOModelo: {
          erro: "A mensagem do hóspede não é um sim claro ao resumo. Nada foi enviado e o resumo anterior deixou de valer. "
            + "Se ele mudou ou acrescentou algum dado, chame montar_resumo com os dados atuais. Se ele ainda quer fechar, "
            + "chame montar_resumo de novo para mostrar o resumo. Senão, responda ao que ele disse.",
        },
      };
  }
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
    // Pedido de resumo que não virou resumo (dado faltando, estadia recusada, catálogo
    // fora do ar): o resumo anterior também não vale mais, porque o hóspede já não quer
    // aquela reserva (L10).
    const resultado = await tentarResumir(argumentos, contexto).catch((erro: unknown) => {
      invalidarPendente(contexto.cofre);
      throw erro;
    });
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
    + "dados: envia exatamente o que está no resumo. A própria ferramenta confere a mensagem do hóspede e não envia "
    + "se ela não for um sim claro.",
  {},
  [],
  async (_argumentos, contexto) => {
    const resultado = await confirmar(contexto.cofre, contexto.turno, contexto.mensagem, {
      envioLigado: contexto.envio.ligado,
      destinoPermitido: contexto.envio.destinoPermitido,
      postar: contexto.envio.postar,
      recotar: async (reserva) => {
        const ficha = await contexto.catalogo.ficha(reserva.imovel_id);
        if (!ficha) return null;
        return cotar(regrasDaFicha(ficha), reserva.checkin, reserva.checkout, reserva.hospedes);
      },
    });

    switch (resultado.tipo) {
      case "sem_resumo":
        return { paraOModelo: { erro: "Não há resumo aguardando confirmação. Nada foi enviado. Reúna os dados e chame montar_resumo." } };
      case "mesmo_turno":
        return { paraOModelo: { erro: "O resumo acabou de ser mostrado. Nada foi enviado: a confirmação precisa vir na próxima mensagem do hóspede." } };
      case "nao_confirmou":
        return naoConfirmou(resultado.leitura);
      case "reapresentado":
        return {
          paraOModelo: { enviado: false, resumo_apresentado: true, aguardando: "confirmação do hóspede na próxima mensagem" },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: `${AINDA_NAO_ENVIEI} Para não haver engano, confira o pedido mais uma vez.\n\n${textoDoResumo(resultado.pendente)}`,
        };
      case "recusada":
        return { paraOModelo: { recusada: true, motivo: resultado.explicacao, instrucao: "Nada foi enviado. Explique o motivo ao hóspede." } };
      case "ja_registrado":
        return jaRegistrado(resultado.pendente);
      case "total_mudou":
        return {
          paraOModelo: { total_mudou: true, enviado: false },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: "O valor desta estadia mudou desde o resumo anterior, então ainda não enviei nada.\n\n"
            + textoDoResumo(resultado.pendente),
        };
      case "registrado":
        return {
          paraOModelo: { registrado: true },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: "Pronto! Seu pedido de reserva foi registrado e encaminhado ao nosso time comercial, no total de "
            + `${formatarReais(resultado.pendente.totalCentavos)}. O time entra em contato para os próximos passos. `
            + "Este registro é um pedido: ele ainda não garante a reserva nem bloqueia as datas.",
        };
      case "campo_recusado":
        return {
          paraOModelo: { registrado: false, dados_recusados: resultado.campos, instrucao: "Com o dado corrigido, chame montar_resumo." },
          respostaFinal: pedeCorrecao(resultado.campos),
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
