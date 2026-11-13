// Loop de ferramentas de um turno: o modelo pede ferramentas, o código executa e
// devolve o resultado, até sair uma resposta. O loop tem limite de voltas e de tempo, e
// nunca lança: em qualquer falha devolve a resposta de contingência (contrato L18).
import type { ChamadaDeFerramenta, Mensagem, Modelo, RespostaDoModelo } from "../modelo";
import { type Argumentos, type Contexto, FERRAMENTAS, type Resultado } from "./ferramentas";
import { montarPrompt } from "./prompt";

export interface EntradaDoTurno {
  mensagem: string;
  historico: Mensagem[];
  houveHandoff: boolean;
  contexto: Contexto;
  modelo: Modelo;
  /** Instante (ms) em que o trabalho externo precisa ter terminado. */
  prazo: number;
  agora?: () => number;
}

export interface SaidaDoTurno {
  reply: string;
  handoff: boolean;
  /** Mensagens a acrescentar ao histórico, sempre com cada chamada de ferramenta respondida. */
  novas: Mensagem[];
  uso: { entrada: number; saida: number; chamadas: number };
  ferramentas: string[];
  contingencia: boolean;
}

const MAX_VOLTAS = 6;
const CONFIRMAR = "confirmar_reserva";
const TENTATIVAS_DO_MODELO = 2;
const CONTINGENCIA = "Tive um problema técnico e não consegui concluir o seu atendimento agora. Vou passar a conversa "
  + "para uma pessoa do nosso time, que continua com você.";

class TempoEsgotado extends Error {}

/** Espera `promessa` no máximo `ms`. A promessa abandonada segue sozinha; o resultado dela é ignorado. */
function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(new TempoEsgotado());
  let relogio: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => { relogio = setTimeout(() => rejeitar(new TempoEsgotado()), ms); });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

function lerArgumentos(chamada: ChamadaDeFerramenta): Argumentos | null {
  try {
    const dado: unknown = JSON.parse(chamada.function.arguments || "{}");
    return dado && typeof dado === "object" && !Array.isArray(dado) ? (dado as Argumentos) : null;
  } catch {
    return null;
  }
}

async function executar(chamada: ChamadaDeFerramenta, contexto: Contexto): Promise<Resultado> {
  const ferramenta = FERRAMENTAS.find((f) => f.definicao.function.name === chamada.function.name);
  if (!ferramenta) return { paraOModelo: { erro: "Ferramenta inexistente." } };
  const argumentos = lerArgumentos(chamada);
  if (!argumentos) return { paraOModelo: { erro: "Argumentos inválidos: envie um objeto JSON." } };
  return ferramenta.executar(argumentos, contexto);
}

/**
 * Acerta o que o modelo escreve e que quebraria a leitura literal da resposta: hífen e
 * espaço especiais (um "GRM‑301" com hífen não separável não casa com "GRM-301") e
 * marcação de negrito, que a página mostra como asteriscos.
 */
export function limpar(texto: string): string {
  return texto.replace(/[\u2010\u2011]/g, "-").replace(/[\u00a0\u202f]/g, " ").replace(/\*\*/g, "");
}

/** Texto com um caractere repetido dezenas de vezes: o modelo degenerou, não é resposta. */
const DEGENERADA = /(.)\1{24,}/s;

/** Garante na resposta todo total calculado no turno, no texto que saiu do código. */
function comTotais(texto: string, totais: string[]): string {
  const faltando = [...new Set(totais)].filter((t) => !texto.includes(t));
  if (faltando.length === 0) return texto;
  return `${texto}\n\n${faltando.map((t) => `Total da estadia: ${t}`).join("\n")}`;
}

export async function rodarTurno(entrada: EntradaDoTurno): Promise<SaidaDoTurno> {
  const agora = entrada.agora ?? Date.now;
  const definicoes = FERRAMENTAS.map((f) => f.definicao);
  const sistema: Mensagem = { role: "system", content: montarPrompt(entrada.contexto.cofre.ler(), entrada.houveHandoff) };
  const novas: Mensagem[] = [{ role: "user", content: entrada.mensagem }];
  const uso = { entrada: 0, saida: 0, chamadas: 0 };
  const usadas: string[] = [];
  const totais: string[] = [];
  let handoff = false;

  const terminar = (reply: string, contingencia = false): SaidaDoTurno => {
    novas.push({ role: "assistant", content: reply });
    return { reply, handoff: handoff || contingencia, novas, uso, ferramentas: usadas, contingencia };
  };

  async function chamarModelo(): Promise<RespostaDoModelo> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        uso.chamadas++;
        const resposta = await comPrazo(entrada.modelo([sistema, ...entrada.historico, ...novas], definicoes), entrada.prazo - agora());
        uso.entrada += resposta.uso.entrada;
        uso.saida += resposta.uso.saida;
        const texto = limpar(resposta.texto);
        if (texto === "" && resposta.chamadas.length === 0) throw new Error("resposta vazia do modelo");
        if (DEGENERADA.test(texto)) throw new Error("resposta degenerada do modelo");
        return { ...resposta, texto };
      } catch (erro) {
        if (erro instanceof TempoEsgotado || tentativa >= TENTATIVAS_DO_MODELO) throw erro;
      }
    }
  }

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const resposta = await chamarModelo();
      if (resposta.chamadas.length === 0) return terminar(comTotais(resposta.texto, totais));

      // A confirmação roda por último no lote: se o modelo pediu junto uma cotação ou um
      // resumo com dado novo, eles invalidam a confirmação pendente antes (contrato L10).
      const chamadas = [...resposta.chamadas].sort((a, b) => Number(a.function.name === CONFIRMAR) - Number(b.function.name === CONFIRMAR));
      novas.push({ role: "assistant", content: resposta.texto, tool_calls: chamadas });
      let respostaFinal: string | undefined;
      let falhou = false;
      for (const chamada of chamadas) {
        // Toda chamada recebe um resultado no histórico, mesmo depois que o turno já foi
        // decidido: histórico com chamada sem resposta quebra o turno seguinte.
        let resultado: Resultado;
        if (respostaFinal !== undefined || falhou) {
          resultado = { paraOModelo: { ignorada: "o turno já tinha sido encerrado por outra ferramenta" } };
        } else {
          usadas.push(chamada.function.name);
          try {
            resultado = await comPrazo(executar(chamada, entrada.contexto), entrada.prazo - agora());
          } catch {
            falhou = true;
            resultado = { paraOModelo: { erro: "Falha interna ao executar a ferramenta." } };
          }
        }
        novas.push({ role: "tool", tool_call_id: chamada.id, content: JSON.stringify(resultado.paraOModelo) });
        if (resultado.handoff) handoff = true;
        if (resultado.total) totais.push(resultado.total);
        // Recusa não leva total (CA-06), nem o de uma cotação anterior do mesmo turno.
        if (resultado.recusa) totais.length = 0;
        respostaFinal ??= resultado.respostaFinal;
      }
      if (falhou) return terminar(CONTINGENCIA, true);
      if (respostaFinal !== undefined) return terminar(respostaFinal);
    }
  } catch {
    // modelo fora do ar, resposta vazia duas vezes ou tempo esgotado
  }
  return terminar(CONTINGENCIA, true);
}
