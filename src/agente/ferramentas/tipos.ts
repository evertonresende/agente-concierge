// Contrato comum das ferramentas. Cada uma devolve dados para o modelo e, quando é o
// caso, efeitos decididos por código: encerrar o turno com um texto pronto, ligar o
// handoff ou exigir que um total apareça na resposta.
import type { Catalogo } from "../../catalogo";
import type { Cofre, CorpoDoLead } from "../../lead";
import type { DefinicaoDeFerramenta, Mensagem } from "../../modelo";
import type { DataISO } from "../../nucleo/datas";

export interface Contexto {
  catalogo: Catalogo;
  cofre: Cofre;
  /** Número do turno atual na sessão (cada mensagem do hóspede é um turno). */
  turno: number;
  /** Texto da mensagem do hóspede neste turno, como chegou. */
  mensagem: string;
  /** Data civil de hoje em America/Sao_Paulo, em AAAA-MM-DD. */
  hoje: DataISO;
  /** Mensagens dos turnos anteriores da conversa. Preenchido pelo loop; ausente em contexto montado à mão. */
  historico?: Mensagem[];
  /** Idioma do hóspede no turno (L15), decidido pelo loop; ausente vale português. */
  idioma?: "pt" | "en";
  envio: {
    ligado: boolean;
    destinoPermitido: boolean;
    postar(corpo: CorpoDoLead): Promise<number>;
  };
}

export interface Resultado {
  /** Vai para o modelo como resultado da ferramenta (JSON). */
  paraOModelo: unknown;
  /** Texto de código que vira a resposta do turno, sem nova chamada ao modelo. */
  respostaFinal?: string;
  handoff?: boolean;
  /** Total (texto em reais) que a resposta do turno precisa trazer. */
  total?: string;
  /** A estadia foi recusada: a resposta do turno não pode ganhar total nenhum. */
  recusa?: boolean;
}

export type Argumentos = Record<string, unknown>;

export interface Ferramenta {
  definicao: DefinicaoDeFerramenta;
  executar(argumentos: Argumentos, contexto: Contexto): Promise<Resultado>;
}

export function definir(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  executar: Ferramenta["executar"],
): Ferramenta {
  return {
    definicao: { type: "function", function: { name, description, parameters: { type: "object", properties, required } } },
    executar,
  };
}

/** Texto não vazio, ou `undefined`. Os argumentos vêm do modelo e não são confiáveis. */
export function texto(argumentos: Argumentos, nome: string): string | undefined {
  const v = argumentos[nome];
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** Número como veio (inteiro ou não), ou `undefined`. Aceita "2" porque modelos mandam número como texto. */
export function numero(argumentos: Argumentos, nome: string): number | undefined {
  const v = argumentos[nome];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(",", "."));
  return undefined;
}
