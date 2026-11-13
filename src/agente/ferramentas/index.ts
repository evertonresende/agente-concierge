// Registro das ferramentas que o modelo pode chamar.
import { buscarImoveis, listarCidades, verImovel } from "./catalogo";
import { cotarEstadia } from "./cotacao";
import { passarParaHumano } from "./handoff";
import { confirmarReserva, montarResumo } from "./lead";
import type { Ferramenta } from "./tipos";

export type { Argumentos, Contexto, Ferramenta, Resultado } from "./tipos";

export const FERRAMENTAS: Ferramenta[] = [
  listarCidades, buscarImoveis, verImovel, cotarEstadia, montarResumo, confirmarReserva, passarParaHumano,
];
