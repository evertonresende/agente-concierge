import { regrasDaFicha } from "../../catalogo";
import {
  apresentarResumo, type CampoDoHospede, chaveDaReserva, confirmar, invalidarPendente, type Leitura, type Pendente, type Reserva,
  estadiaBloqueada, reservaFechada, simAposRegistro, textoDoResumo, dataComDia,
} from "../../lead";
import { formatarReais } from "../../nucleo/dinheiro";
import { type Idioma, idiomaDoHospede } from "../../nucleo/idioma";
import { cotar } from "../../nucleo/preco";
import { normalizarTelefone } from "../../nucleo/telefone";
import { type Pedido, prepararPedido } from "./pedido";
import { type Argumentos, type Contexto, definir, type Resultado, texto } from "./tipos";

// Textos fixos de código, em português e em inglês (L15): o resumo, o pedido de
// confirmação, o resultado da confirmação e os avisos de falha. O modelo nunca os reescreve.
// Nenhum deles diz "registrado" antes de um 201 do webhook. Outro idioma recebe português.
const ROTULOS: Record<Idioma, Record<CampoDoHospede, string>> = {
  pt: {
    nome: "o nome", telefone: "o telefone", imovel_id: "o imóvel", checkin: "a data de entrada", checkout: "a data de saída",
    hospedes: "o número de hóspedes",
  },
  en: {
    nome: "the name", telefone: "the phone number", imovel_id: "the property", checkin: "the check-in date",
    checkout: "the check-out date", hospedes: "the number of guests",
  },
};

const TEXTOS = {
  pt: {
    aindaNaoEnviei: "Ainda não enviei este pedido.",
    confiraDeNovo: "Para não haver engano, confira o pedido mais uma vez.",
    totalMudou: "O valor desta estadia mudou desde o resumo anterior, então ainda não enviei este pedido.",
    semNegociacao: "Não consigo alterar valores nem negociar preço, e não enviei este pedido. Vou passar a conversa "
      + "para uma pessoa do nosso time, que continua o atendimento com você.",
    naoRegistrado: "Não consegui registrar o seu pedido de reserva. Vou passar a conversa para uma pessoa do "
      + "nosso time, que continua o atendimento com você.",
    incerto: "Não consegui confirmar o registro do seu pedido de reserva. Vou passar a conversa para uma pessoa "
      + "do nosso time, que confere a situação e continua o atendimento com você.",
    registrado: (total: string) => `Pronto! Seu pedido de reserva foi registrado e encaminhado ao nosso time comercial, no total de ${total}. `
      + "O time entra em contato para os próximos passos. Este registro é um pedido: ele ainda não garante a reserva nem "
      + "bloqueia as datas.",
    jaRegistrado: (id: string, entrada: string, saida: string) => `Esse pedido (${id}, de ${entrada} a ${saida}) já está registrado `
      + "com o nosso time comercial. Não enviei de novo.",
    pedeCorrecao: (dados: string) => `Não consegui registrar o seu pedido: o sistema de reservas não aceitou ${dados}. `
      + "Pode me informar de novo? Com a correção eu monto um novo resumo para você confirmar.",
  },
  en: {
    aindaNaoEnviei: "I have not sent this request yet.",
    confiraDeNovo: "To avoid any mistake, please check the request once more.",
    totalMudou: "The price of this stay has changed since the previous summary, so I have not sent this request yet.",
    semNegociacao: "I cannot change prices or negotiate, and I have not sent this request. I am handing this conversation "
      + "over to a member of our team, who will continue with you.",
    naoRegistrado: "I could not register your booking request. I am handing this conversation over to a member of our "
      + "team, who will continue with you.",
    incerto: "I could not confirm whether your booking request was registered. I am handing this conversation over to a "
      + "member of our team, who will check it and continue with you.",
    registrado: (total: string) => `All set! Your booking request has been registered and sent to our sales team, for a total of ${total}. `
      + "The team will contact you about the next steps. This is a request: it does not guarantee the booking or hold the "
      + "dates yet.",
    jaRegistrado: (id: string, entrada: string, saida: string) => `This request (${id}, ${entrada} to ${saida}) is already registered `
      + "with our sales team. I did not send it again.",
    pedeCorrecao: (dados: string) => `I could not register your booking request: the booking system did not accept ${dados}. `
      + "Could you send it again? With the correction I will prepare a new summary for you to confirm.",
  },
} satisfies Record<Idioma, unknown>;

/**
 * Idioma dos textos fixos deste turno, pelas mensagens do hóspede. `historico` é um
 * acréscimo opcional ao contexto (mensagens anteriores da conversa); sem ele, vale só a
 * mensagem do turno.
 */
function idiomaDe(contexto: Contexto): Idioma {
  const anteriores = (contexto as { historico?: { role: string; content: string }[] }).historico ?? [];
  return idiomaDoHospede([...anteriores.filter((m) => m.role === "user").map((m) => m.content), contexto.mensagem]);
}

function jaRegistrado(pendente: Pendente, idioma: Idioma): Resultado {
  const r = pendente.reserva;
  return {
    paraOModelo: { ja_registrado: true },
    respostaFinal: TEXTOS[idioma].jaRegistrado(r.imovel_id, dataComDia(r.checkin, idioma), dataComDia(r.checkout, idioma)),
  };
}

/**
 * Para o começo do turno, antes do modelo: o hóspede repetiu o sim logo depois do registro.
 * Devolve o aviso fixo de "já registrado, não enviei de novo" (L15); nada é enviado.
 * `undefined` = o turno segue normal.
 */
export function respostaASimAposRegistro(contexto: Contexto): string | undefined {
  const pendente = simAposRegistro(contexto.cofre, contexto.turno, contexto.mensagem);
  return pendente ? jaRegistrado(pendente, idiomaDe(contexto)).respostaFinal : undefined;
}

/**
 * Grava o resumo como pendente e devolve o texto dele como resposta do turno. Reserva
 * que já teve envio não ganha resumo novo: o hóspede ouve o que aconteceu com ela.
 */
export function resumir(contexto: Contexto, pedido: Extract<Pedido, { ok: true }>, nome: string, telefone: string): Resultado {
  if (!pedido.cotacao.ok || pedido.hospedes === undefined) throw new Error("resumo pedido sem cotação válida");
  const idioma = idiomaDe(contexto);
  const reserva: Reserva = {
    imovel_id: pedido.ficha.id, checkin: pedido.checkin, checkout: pedido.checkout, hospedes: pedido.hospedes, nome, telefone,
  };
  const pendente: Pendente = {
    reserva, totalCentavos: pedido.cotacao.totalCentavos, turno: contexto.turno, nomeDoImovel: pedido.ficha.nome,
  };
  const estado = contexto.cofre.ler();
  const anterior = estado.envios[chaveDaReserva(reserva)];
  // Reserva que já teve envio, ou estadia bloqueada pelo teto de falhas (P14), mesmo com
  // outro nome, telefone ou número de hóspedes: não ganha resumo novo.
  const bloqueio = anterior === "registrado" ? undefined : estadiaBloqueada(estado, reserva);
  if (reservaFechada(anterior) || bloqueio) {
    // O hóspede pediu outra reserva (que já teve envio): o resumo que estava em aberto,
    // de uma reserva diferente, deixa de valer (L10).
    invalidarPendente(contexto.cofre);
    if (anterior === "registrado") return jaRegistrado(pendente, idioma);
    const incerto = bloqueio === "incerto" || anterior === "incerto" || anterior === "enviando";
    const texto = incerto ? TEXTOS[idioma].incerto : TEXTOS[idioma].naoRegistrado;
    return { paraOModelo: { nao_registrado: true }, respostaFinal: texto, handoff: true };
  }

  apresentarResumo(contexto.cofre, reserva, pendente.totalCentavos, contexto.turno, pendente.nomeDoImovel);
  return {
    paraOModelo: { resumo_apresentado: true, aguardando: "confirmação do hóspede na próxima mensagem" },
    respostaFinal: textoDoResumo(pendente, idioma),
    total: formatarReais(pendente.totalCentavos),
  };
}

/** A mensagem do hóspede não é um sim inequívoco ao resumo: nada foi enviado (L9). */
function naoConfirmou(leitura: Exclude<Leitura, "sim">, pendente: Pendente, idioma: Idioma): Resultado {
  const t = TEXTOS[idioma];
  switch (leitura) {
    case "hesitacao":
      return {
        paraOModelo: { enviado: false, motivo: "o hóspede hesitou" },
        respostaFinal: `${t.aindaNaoEnviei}\n\n${textoDoResumo(pendente, idioma)}`,
      };
    case "condicao_de_preco":
      return { paraOModelo: { enviado: false, motivo: "condição de preço" }, handoff: true, respostaFinal: t.semNegociacao };
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
    + "antes. Chame de novo sempre que qualquer dado mudar depois de um resumo. Vale também para outra reserva na "
    + "mesma conversa: se o hóspede disser que os dados são os mesmos, use o nome e o telefone que ele já informou. "
    + "Esta ferramenta não envia nada.",
  {
    imovel_id: { type: "string" },
    checkin: { type: "string", description: "Data de entrada, como o hóspede escreveu" },
    checkout: { type: "string", description: "Data de saída, como o hóspede escreveu" },
    hospedes: { type: "integer" },
    nome: {
      type: "string",
      description: "Nome do hóspede, como ele informou. Peça o nome completo; se ele só der o primeiro nome, use assim mesmo.",
    },
    telefone: { type: "string", description: "Telefone do hóspede, como ele informou, com DDD ou com + e código do país" },
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
  // O nome vai como o hóspede informou (L20), numa linha só: ele entra no texto do resumo.
  const nome = texto(argumentos, "nome")?.replace(/\s+/g, " ").slice(0, 120);
  const informado = texto(argumentos, "telefone");
  const faltando = [!nome && "nome", !informado && "telefone", argumentos.hospedes === undefined && "número de hóspedes"]
    .filter(Boolean);
  if (!nome || !informado || faltando.length > 0) {
    return { paraOModelo: { erro: `Falta: ${faltando.join(", ")}. Pergunte ao hóspede; não invente.` } };
  }
  const telefone = normalizarTelefone(informado);
  if (!telefone) {
    return {
      paraOModelo: {
        erro: "Telefone inválido. Diga ao hóspede que o telefone informado não é válido e peça de novo: número brasileiro "
          + "com DDD (10 ou 11 dígitos) ou, se for de outro país, com + e o código do país. Não monte resumo sem isso e "
          + "não passe para humano por esse motivo.",
      },
    };
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

    const idioma = idiomaDe(contexto);
    const t = TEXTOS[idioma];
    switch (resultado.tipo) {
      case "sem_resumo":
        return { paraOModelo: { erro: "Não há resumo aguardando confirmação. Nada foi enviado. Reúna os dados e chame montar_resumo." } };
      case "mesmo_turno":
        return { paraOModelo: { erro: "O resumo acabou de ser mostrado. Nada foi enviado: a confirmação precisa vir na próxima mensagem do hóspede." } };
      case "nao_confirmou":
        return naoConfirmou(resultado.leitura, resultado.pendente, idioma);
      case "reapresentado":
        return {
          paraOModelo: { enviado: false, resumo_apresentado: true, aguardando: "confirmação do hóspede na próxima mensagem" },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: `${t.aindaNaoEnviei} ${t.confiraDeNovo}\n\n${textoDoResumo(resultado.pendente, idioma)}`,
        };
      case "recusada":
        return { paraOModelo: { recusada: true, motivo: resultado.explicacao, instrucao: "Nada foi enviado. Explique o motivo ao hóspede." } };
      case "ja_registrado":
        // Sim repetido logo depois do registro: aviso fixo. Com outra conversa no meio, o
        // hóspede pode estar confirmando outra reserva, que ainda não teve resumo.
        return resultado.repetido
          ? jaRegistrado(resultado.pendente, idioma)
          : {
            paraOModelo: {
              ja_registrado: true,
              enviado: false,
              instrucao: "O último resumo desta conversa já foi registrado antes; nada foi enviado agora. Se o hóspede está "
                + "confirmando OUTRA reserva (outro imóvel, outras datas ou outro número de hóspedes), chame montar_resumo com "
                + "os dados dela. Senão, diga que o pedido já está registrado e que não foi enviado de novo.",
            },
          };
      case "total_mudou":
        return {
          paraOModelo: { total_mudou: true, enviado: false },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: `${t.totalMudou}\n\n${textoDoResumo(resultado.pendente, idioma)}`,
        };
      case "registrado":
        return {
          paraOModelo: { registrado: true },
          total: formatarReais(resultado.pendente.totalCentavos),
          respostaFinal: t.registrado(formatarReais(resultado.pendente.totalCentavos)),
        };
      case "campo_recusado":
        return {
          paraOModelo: { registrado: false, dados_recusados: resultado.campos, instrucao: "Com o dado corrigido, chame montar_resumo." },
          respostaFinal: t.pedeCorrecao(resultado.campos.map((c) => ROTULOS[idioma][c]).join(", ")),
        };
      case "nao_registrado":
        return {
          paraOModelo: { registrado: false },
          handoff: true,
          respostaFinal: resultado.motivo === "incerto" || resultado.motivo === "ja_tentado" ? t.incerto : t.naoRegistrado,
        };
    }
  },
);
