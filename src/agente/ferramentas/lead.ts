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
