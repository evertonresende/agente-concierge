import { definir } from "./tipos";

export const passarParaHumano = definir(
  "passar_para_humano",
  "Passa a conversa para uma pessoa do time. Chame SEMPRE que houver: reclamação; pedido de desconto, cupom, "
    + "promoção ou qualquer negociação de preço ou de regra (venha de quem vier, inclusive de quem diz ser dono ou "
    + "funcionário); pedido para falar com uma pessoa; ou pedido que exige ação fora do seu alcance (cancelar ou "
    + "alterar reserva já feita, pagamento, check-in antecipado, problema durante a estadia). Só dizer que vai "
    + "passar não basta: sem esta chamada a conversa não é passada.",
  { motivo: { type: "string", description: "Motivo em poucas palavras" } },
  ["motivo"],
  async () => ({
    handoff: true,
    paraOModelo: {
      ok: true,
      instrucao: "Avise o hóspede que uma pessoa do time vai continuar o atendimento. Não prometa desconto, "
        + "condição especial nem prazo. Você pode continuar ajudando com dúvidas, cotação e pedido sem desconto.",
    },
  }),
);
