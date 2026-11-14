// Mudanças depois do resumo, das duas rodadas do verificador independente (achados A1, A2,
// B1 e B2). Em qualquer caminho, o "sim" seguinte não pode enviar o resumo antigo (L10).
import { describe, expect, it } from "vitest";
import { confirmarReserva, montarResumo } from "../src/agente/ferramentas/lead";
import { type Cofre, ESTADO_INICIAL, type EstadoLead, lerConfirmacao, mudaDadoDoResumo, type Pendente, pedidoDeConfirmacaoPendente } from "../src/lead";
import { criarContexto, criarMundo } from "./apoio";

const DADOS = { imovel_id: "GRM-301", checkin: "15/01/2027", checkout: "18/01/2027", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" };
const GRM301: Pendente = {
  reserva: { imovel_id: "GRM-301", checkin: "2027-01-15", checkout: "2027-01-18", hospedes: 2, nome: "Ana Lima", telefone: "(11) 98888-0000" },
  totalCentavos: 215600,
  turno: 2,
};

const MUDANCAS_R1 = [
  "acho que sim, mas somos 3", "pode ser no outro apartamento", "talvez, mas muda a saída para 19/01", "acho que sim, com o telefone (11) 97777-0000",
  "pode ser, mas na verdade somos 3", "acho que sim, mas somos três", "vamos ser três", "vamos em três", "minha esposa também vai", "a saída é no domingo",
  "fico uma noite a mais", "quero sair um dia depois", "tira uma pessoa", "prefiro o chalé da praia", "o nome é Ana Souza", "o sobrenome é Souza",
  "o telefone está errado", "2 adultos e duas crianças", "we'll be three", "can we make it four people?", "e se fosse em março?", "add one more guest",
];
const MUDANCAS_NOVAS = [
  "tira o bebê", "só eu e minha esposa", "um dia a menos", "o mesmo período do mês que vem", "no mês que vem", "na semana que vem", "next week instead",
  "same dates next month", "only me", "just me and my wife", "one less night", "sim. ah, e somos 3", "sim, mas sem o pet", "sim, chego mais tarde, dia 16",
  "não são 2 pessoas", "nao sao dois", "not two guests", "sim, mas é Ana Lima Souza", "sobrenome Souza", "meu sobrenome é Souza",
  "sim, mas pro sab seguinte", "sim, mas chego seg", "sim, mas é em fev", "sim mas antecipa um dia", "sim, mas posterga", "sim, mas fico até o fim do mês",
  "simm, mas somo 3", "sim, mas o fone é outro", "sim mas o zap é 11977770000", "esse aí não, o outro", "essa outra", "esses dados menos o telefone",
  "sim, mas com mais gente", "sim, só que mais uma noite", "sim, mas sem a minha filha", "can we stay longer?", "sim, mas é pra 3", "yes, but we are 3 now",
  "yes but for 3", "sim, mas troca pro RIO-402", "sim, mas no rio-402", "sim, mas sozinho",
];
const NEGACOES = [
  "não são 2 pessoas", "não é de 15/01/2027 a 18/01/2027", "não é GRM-301", "não são 3 noites", "o certo não é Ana Lima", "not 2 guests",
  "sim, mas não 2 hóspedes", "errado: 2 hóspedes", "2 hóspedes não", "isso não, 15/01/2027 a 18/01/2027 está errado", "sem 2 pessoas",
];

function sessao() {
  const mundo = criarMundo();
  let estado: EstadoLead = ESTADO_INICIAL;
  const cofre: Cofre = { ler: () => estado, salvar: (e) => { estado = e; } };
  const ctx = (turno: number, mensagem: string) => criarContexto(mundo, cofre, turno, mensagem);
  return {
    mundo, cofre, estado: () => estado,
    resumo: (turno: number) => montarResumo.executar(DADOS, ctx(turno, "quero fechar")),
    confirma: (turno: number, mensagem: string) => confirmarReserva.executar({}, ctx(turno, mensagem)),
  };
}

describe("mudança depois do resumo: o sim seguinte não envia o resumo antigo", () => {
  for (const mensagem of [...new Set([...MUDANCAS_R1, ...MUDANCAS_NOVAS, ...NEGACOES])]) {
    it(`rearme e confirmação: "${mensagem}"`, async () => {
      expect(mudaDadoDoResumo(mensagem, GRM301)).toBe(true);
      // Caminho do rearme no fim de um turno escrito pelo modelo.
      const a = sessao();
      await a.resumo(2);
      expect(pedidoDeConfirmacaoPendente(a.cofre, 3, "pt", mensagem)).toBeUndefined();
      await a.confirma(4, "sim");
      expect(a.mundo.leads).toEqual([]);
      // Caminho do confirmar_reserva chamado no turno da mudança.
      const b = sessao();
      await b.resumo(2);
      expect(lerConfirmacao(mensagem, GRM301, 3)).not.toBe("sim");
      await b.confirma(3, mensagem);
      await b.confirma(4, "sim");
      expect(b.mundo.leads).toEqual([]);
    });
  }

  it("\"somos\" sozinho é sinal de mudança (B6)", () => {
    expect(lerConfirmacao("sim, somos", GRM301, 3)).toBe("outra");
    expect(mudaDadoDoResumo("somos", GRM301)).toBe(true);
  });
});
