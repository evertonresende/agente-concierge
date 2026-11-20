// Uma sessão de conversa = um Durable Object. Guarda o histórico e o estado do lead
// em SQLite e garante uma mensagem por vez.
import { DurableObject } from "cloudflare:workers";
import { FERRAMENTAS } from "./agente/ferramentas";
import { CONTINGENCIA, rodarTurno } from "./agente/loop";
import { criarCatalogo } from "./catalogo";
import type { Env } from "./env";
import {
  type Cofre, destinoDosLeads, destinoPermitido, ESTADO_INICIAL, type EstadoLead,
  lerConfirmacao, pedidoDeConfirmacaoPendente, pendenteAberto, postarLead,
  textoDoPedidoDeConfirmacao,
} from "./lead";
import { criarModelo, type Mensagem, type Modelo } from "./modelo";
import { dataCivilEmSaoPaulo } from "./nucleo/datas";
import { idiomaDoHospede } from "./nucleo/idioma";

export interface RespostaDoChat {
  reply: string;
  handoff: boolean;
  uso: { entrada: number; saida: number; chamadas: number };
}

/** O que a sessão usa do mundo externo. Os testes trocam por falsos. */
export interface Dependencias {
  modelo: Modelo;
  buscar: typeof fetch;
  /** Relógio (ms desde a época) de onde sai o "hoje" das ferramentas. Sem ele, vale `Date.now`. */
  agora?: () => number;
  /** Limites de tempo para testes; em produção valem os padrões do contrato. */
  orcamentoMs?: number;
  tetoMs?: number;
}

/** Teto próprio do Worker (abaixo de 60 s, contrato seção 2 e L18). */
export const TETO_WORKER_MS = 55_000;
/** Orçamento do trabalho externo de cada turno (contrato seção 2). */
const ORCAMENTO_MS = 45_000;
/** Teto total desde a chegada ao Worker, 5 s abaixo do teto do Worker para devolver contingência limpa (A3). */
export const TETO_SESSAO_MS = 50_000;
const FOLGA_WORKER_MS = TETO_WORKER_MS - TETO_SESSAO_MS;
const SEM_USO = { entrada: 0, saida: 0, chamadas: 0 };
// ponytail: o modelo recebe só as últimas mensagens; conversa mais longa que isso
// esquece o começo. Trocar por resumo do histórico se as conversas reais passarem disso.
const JANELA_DO_HISTORICO = 80;
const LIMITE_PEDIDOS = 20;

type OrigemContingencia = "modelo" | "catalogo" | "lead" | "prazo" | "interno";
interface CausaContingencia {
  origem: OrigemContingencia;
  erro: string;
}

/**
 * Fatos do envio ao webhook: marcador por reserva, POSTs sem 201 e bloqueio por estadia (L11,
 * P14). Valem na hora em que a F os grava, mesmo que o turno termine em contingência ou o
 * objeto reinicie antes do fim do turno; o resto de `EstadoLead` segue o turno.
 */
function fatosDoEnvio(estado: EstadoLead): Pick<EstadoLead, "envios" | "postsSemRegistro" | "estadiasBloqueadas"> {
  const { envios, postsSemRegistro, estadiasBloqueadas } = estado;
  return { envios, ...(postsSemRegistro && { postsSemRegistro }), ...(estadiasBloqueadas && { estadiasBloqueadas }) };
}

export function nomeDoErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.name && erro.name !== "Error" ? erro.name : (erro.constructor?.name || erro.name || "Error");
  }
  if (erro && typeof erro === "object" && "name" in erro && typeof (erro as { name: unknown }).name === "string") {
    return (erro as { name: string }).name;
  }
  return typeof erro === "object" && erro !== null ? (erro.constructor?.name ?? "Error") : typeof erro;
}

function respostaVaziaDoCatalogo(entrada: RequestInfo | URL): Response {
  const texto = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const caminho = texto.split("?")[0] ?? "";
  if (caminho.endsWith("/cidades")) return Response.json({ cidades: [] });
  if (caminho.endsWith("/imoveis")) return Response.json({ imoveis: [], total: 0 });
  return Response.json({ erro: "imovel nao encontrado" }, { status: 404 });
}

export class Sessao extends DurableObject<Env> {
  /** Trocado pelos testes; em produção sai do ambiente na primeira mensagem. */
  dependencias: Dependencias | null = null;

  // O Durable Object intercala pedidos enquanto espera o modelo ou o catálogo. Esta
  // corrente de promises é o que garante uma mensagem por vez, na ordem de chegada.
  private fila: Promise<unknown> = Promise.resolve();
  private idEmCurso: string | null = null;
  /** Mensagens na fila ou em processamento; com alguma, quem chega não viu o fim delas (B1). */
  private naFila = 0;
  private readonly desistidos = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, mensagem TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS estado (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, resposta TEXT NOT NULL)");
  }

  /**
   * Entra na fila e processa a mensagem quando todas as anteriores terminarem. Nunca
   * rejeita: processamento que lança vira a resposta de contingência (contrato L18), e
   * por isso uma mensagem que falha não trava as seguintes.
   */
  conversar(mensagem: string, chegada: number = Date.now(), idPedido?: string, prazoWorker?: number): Promise<RespostaDoChat> {
    const entradaNaFila = Date.now();
    // Com a sessão ocupada, o turno em curso já gravou o seu número: ele e os que vierem
    // antes desta mensagem terminam depois de ela chegar, e o hóspede não viu o que mostram.
    const turnoNaoVisto = this.naFila > 0 ? this.ler("turno", 0) : undefined;
    this.naFila++;
    const vez = this.fila.then(() => this.processar(mensagem, chegada, entradaNaFila, idPedido, prazoWorker, turnoNaoVisto)).catch((erro: unknown): RespostaDoChat => {
      try {
        this.gravar("handoff", true);
        if (pendenteAberto(this.ler<EstadoLead>("lead", ESTADO_INICIAL))) {
          this.gravar("reapresentar", true);
        }
      } catch {
        // Melhor esforço: erro de armazenamento não impede resposta limpa de contingência.
      }
      console.log(JSON.stringify({
        evento: "falha_no_turno",
        sessao: this.ctx.id.toString().slice(0, 12),
        contingencia: true,
        origem: "interno",
        erro: nomeDoErro(erro),
      }));
      return { reply: CONTINGENCIA, handoff: true, uso: SEM_USO };
    });
    this.fila = vez;
    void vez.finally(() => { this.naFila--; });
    return vez;
  }

  /**
   * O Worker respondeu sem o turno (mensagem vazia ou acima de 8.000 caracteres, P24): o
   * "sim" seguinte pode responder à pergunta dele, então, com resumo em aberto, só
   * reapresenta. Entra na fila para valer na ordem das mensagens; não conta como handoff.
   */
  registrarRespostaDoWorker(): Promise<void> {
    const vez = this.fila.then(() => {
      if (pendenteAberto(this.ler<EstadoLead>("lead", ESTADO_INICIAL))) this.gravar("reapresentar", true);
    }).catch(() => {});
    this.fila = vez;
    return vez;
  }

  /** Chamada curta de melhor esforço quando o Worker desiste e devolve contingência (A0, A3, A5b). */
  async registrarContingenciaNoWorker(idPedido?: string): Promise<void> {
    const emCurso = idPedido !== undefined && this.idEmCurso === idPedido;
    // Marca sempre: o pedido pode estar em curso ou ainda esperando na fila (B2). Só os
    // últimos ficam, porque um id que nunca chegou ao objeto não sai do conjunto sozinho.
    if (idPedido !== undefined) {
      this.desistidos.add(idPedido);
      for (const antigo of this.desistidos) {
        if (this.desistidos.size <= LIMITE_PEDIDOS) break;
        this.desistidos.delete(antigo);
      }
    }
    this.ctx.storage.transactionSync(() => {
      this.gravar("handoff", true);
      if (idPedido && (emCurso || pendenteAberto(this.ler<EstadoLead>("lead", ESTADO_INICIAL)))) {
        this.gravar("reapresentar", true);
      }
    });
  }

  private gravarPedido(idPedido: string, resposta: RespostaDoChat): void {
    this.ctx.storage.sql.exec("INSERT OR IGNORE INTO pedidos (id, resposta) VALUES (?, ?)", idPedido, JSON.stringify(resposta));
    this.ctx.storage.sql.exec(
      "DELETE FROM pedidos WHERE rowid NOT IN (SELECT rowid FROM pedidos ORDER BY rowid DESC LIMIT ?)",
      LIMITE_PEDIDOS,
    );
  }

  private respostaDoPedido(idPedido: string): RespostaDoChat | null {
    const linha = this.ctx.storage.sql
      .exec<{ resposta: string }>("SELECT resposta FROM pedidos WHERE id = ?", idPedido)
      .toArray()[0];
    return linha ? (JSON.parse(linha.resposta) as RespostaDoChat) : null;
  }

  private ler<T>(chave: string, padrao: T): T {
    const linha = this.ctx.storage.sql.exec<{ valor: string }>("SELECT valor FROM estado WHERE chave = ?", chave).toArray()[0];
    return linha ? (JSON.parse(linha.valor) as T) : padrao;
  }

  private gravar(chave: string, valor: unknown): void {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO estado (chave, valor) VALUES (?, ?)", chave, JSON.stringify(valor));
  }

  private historico(): Mensagem[] {
    const linhas = this.ctx.storage.sql
      .exec<{ mensagem: string }>("SELECT mensagem FROM (SELECT id, mensagem FROM historico ORDER BY id DESC LIMIT ?) ORDER BY id", JANELA_DO_HISTORICO)
      .toArray()
      .map((l) => JSON.parse(l.mensagem) as Mensagem);
    // A janela começa numa mensagem do hóspede, para nunca abrir com resultado de ferramenta órfão.
    const inicio = linhas.findIndex((m) => m.role === "user");
    return inicio < 0 ? [] : linhas.slice(inicio);
  }

  private async processar(
    mensagem: string,
    chegada: number,
    entradaNaFila: number,
    idPedido?: string,
    prazoWorker?: number,
    turnoNaoVisto?: number,
  ): Promise<RespostaDoChat> {
    if (idPedido) {
      const gravada = this.respostaDoPedido(idPedido);
      if (gravada) {
        // Pedido repetido significa que a entrega anterior falhou: se há resumo em aberto,
        // ele precisa ser reapresentado antes de valer um "sim" (A0).
        if (pendenteAberto(this.ler<EstadoLead>("lead", ESTADO_INICIAL))) {
          this.gravar("reapresentar", true);
        }
        return gravada;
      }
    }

    const deps = this.dependencias ??= { modelo: criarModelo(this.env.AI, this.env.MODELO), buscar: fetch };
    const orcamentoMs = deps.orcamentoMs ?? ORCAMENTO_MS;
    const tetoMs = deps.tetoMs ?? TETO_SESSAO_MS;
    const inicio = Date.now();
    const esperaNaFila = Math.max(0, inicio - entradaNaFila);
    const tetoWorkerMs = prazoWorker !== undefined ? Math.max(0, prazoWorker - chegada) : undefined;
    const folgaWorker = tetoWorkerMs !== undefined ? Math.min(FOLGA_WORKER_MS, Math.ceil(tetoWorkerMs * 0.1)) : 0;
    const limiteWorker = prazoWorker !== undefined ? prazoWorker - folgaWorker : Infinity;
    const prazo = Math.min(chegada + orcamentoMs + esperaNaFila, chegada + tetoMs, limiteWorker);

    // O Worker já devolveu a contingência deste pedido enquanto ele esperava na fila (B2):
    // o turno não roda, como quando o prazo vence na fila.
    const desistidoNaFila = idPedido !== undefined && this.desistidos.delete(idPedido);
    if (inicio >= prazo || desistidoNaFila) {
      const contingencia: RespostaDoChat = { reply: CONTINGENCIA, handoff: true, uso: SEM_USO };
      this.ctx.storage.transactionSync(() => {
        this.gravar("handoff", true);
        if (pendenteAberto(this.ler<EstadoLead>("lead", ESTADO_INICIAL))) {
          this.gravar("reapresentar", true);
        }
        // A outra tentativa do Worker com o mesmo id pode estar na fila: ela acha o pedido
        // gravado e devolve a mesma contingência, sem rodar o turno (B6).
        if (idPedido) this.gravarPedido(idPedido, contingencia);
      });
      console.log(JSON.stringify({
        evento: "prazo_esgotado_na_fila",
        sessao: this.ctx.id.toString().slice(0, 12),
        contingencia: true,
        origem: "prazo",
        erro: "TempoEsgotado",
      }));
      return contingencia;
    }

    if (idPedido) this.idEmCurso = idPedido;
    try {
      const modeloReal = deps.modelo;
      const buscar = deps.buscar;
      const turno = this.ler("turno", 0) + 1;
      this.gravar("turno", turno);

      // Resumo criado, alterado ou repetido por turno que terminou depois de esta mensagem
      // chegar: ela não pode confirmá-lo; o "sim" reapresenta, sem POST (B1).
      const pendenteNaChegada = turnoNaoVisto === undefined ? null : pendenteAberto(this.ler<EstadoLead>("lead", ESTADO_INICIAL));
      if (pendenteNaChegada && pendenteNaChegada.turno >= turnoNaoVisto!) this.gravar("reapresentar", true);

      const deveReapresentar = this.ler("reapresentar", false);
      const estadoInicial = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
      const pendenteAbertoInicial = pendenteAberto(estadoInicial);

      if (deveReapresentar && pendenteAbertoInicial && lerConfirmacao(mensagem, pendenteAbertoInicial, turno) === "sim") {
        let estadoEmCurso: EstadoLead = estadoInicial;
        const cofreLocal: Cofre = {
          ler: () => estadoEmCurso,
          salvar: (estado) => { estadoEmCurso = estado; },
        };
        const historicoAtual = this.historico();
        const idioma = idiomaDoHospede([
          ...historicoAtual.filter((m) => m.role === "user").map((m) => m.content),
          mensagem,
        ]);
        const pedido = pedidoDeConfirmacaoPendente(cofreLocal, turno, idioma);
        let corpo: string;
        if (pedido !== undefined) {
          corpo = pedido;
        } else {
          const pendenteAtualizado = { ...pendenteAbertoInicial, turno };
          estadoEmCurso = { ...estadoEmCurso, pendente: pendenteAtualizado };
          corpo = textoDoPedidoDeConfirmacao(pendenteAtualizado, idioma);
        }
        const aviso = idioma === "en"
          ? "I have not sent this request yet. To avoid any mistake, please check the request once more."
          : "Ainda não enviei este pedido. Para não haver engano, confira o pedido mais uma vez.";
        const reply = `${aviso}\n\n${corpo}`;
        const resposta: RespostaDoChat = { reply, handoff: false, uso: SEM_USO };

        const estourouWorker = prazoWorker !== undefined && Date.now() >= limiteWorker;
        const desistido = idPedido !== undefined && this.desistidos.has(idPedido);
        if (estourouWorker || desistido) {
          const respostaContingencia: RespostaDoChat = { reply: CONTINGENCIA, handoff: true, uso: SEM_USO };
          this.ctx.storage.transactionSync(() => {
            this.gravar("handoff", true);
            this.gravar("reapresentar", true);
            if (idPedido) this.gravarPedido(idPedido, respostaContingencia);
          });
          console.log(JSON.stringify({
            evento: "turno",
            sessao: this.ctx.id.toString().slice(0, 12),
            turno,
            ms: Date.now() - chegada,
            chamadas_modelo: 0,
            tokens_entrada: 0,
            tokens_saida: 0,
            ferramentas: [],
            handoff: true,
            contingencia: true,
            origem: "prazo",
            erro: "TempoEsgotado",
            envios: Object.values(estadoInicial.envios),
          }));
          return respostaContingencia;
        }

        this.ctx.storage.transactionSync(() => {
          this.ctx.storage.sql.exec("INSERT INTO historico (mensagem) VALUES (?)", JSON.stringify({ role: "user", content: mensagem }));
          this.ctx.storage.sql.exec("INSERT INTO historico (mensagem) VALUES (?)", JSON.stringify({ role: "assistant", content: reply }));
          const atual = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
          this.gravar("lead", { ...estadoEmCurso, ...fatosDoEnvio(atual) });
          this.ctx.storage.sql.exec("DELETE FROM estado WHERE chave = 'reapresentar'");
          if (idPedido) this.gravarPedido(idPedido, resposta);
        });

        console.log(JSON.stringify({
          evento: "turno",
          sessao: this.ctx.id.toString().slice(0, 12),
          turno,
          ms: Date.now() - chegada,
          chamadas_modelo: 0,
          tokens_entrada: 0,
          tokens_saida: 0,
          ferramentas: [],
          handoff: false,
          contingencia: false,
          envios: Object.values(estadoInicial.envios),
        }));
        return resposta;
      }

      // Os fatos do envio (`fatosDoEnvio`: marcador "enviando", contagem e bloqueio da P14) são
      // gravados na hora para sobreviver a reinício e a contingência; o restante de `EstadoLead`
      // só é gravado junto com o histórico na transação do fim do turno, por inteiro.
      let estadoEmCurso: EstadoLead = estadoInicial;
      let turnoAberto = true;
      let falhaExterna: CausaContingencia | null = null;
      let ultimaEtapa: "modelo" | "catalogo" | "lead" | null = null;

      const cofre: Cofre = {
        ler: () => {
          const atual = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
          return { ...estadoEmCurso, ...fatosDoEnvio(atual) };
        },
        salvar: (estado) => {
          if (!turnoAberto) return;
          estadoEmCurso = estado;
          const atual = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
          if (JSON.stringify(fatosDoEnvio(estado)) !== JSON.stringify(fatosDoEnvio(atual))) {
            this.gravar("lead", { ...atual, ...fatosDoEnvio(estado) });
          }
        },
      };

      const modeloSeguro: Modelo = async (mensagens, ferramentas) => {
        ultimaEtapa = "modelo";
        try {
          const retorno = await modeloReal(mensagens, ferramentas);
          falhaExterna = null;
          if (retorno.chamadas.length > 0) ultimaEtapa = null;
          return retorno;
        } catch (erro) {
          if (!turnoAberto) return { texto: "", chamadas: [], uso: { entrada: 0, saida: 0 } };
          falhaExterna = { origem: Date.now() >= prazo ? "prazo" : "modelo", erro: nomeDoErro(erro) };
          throw erro;
        }
      };

      const buscarCatalogo: typeof fetch = async (entrada, init) => {
        ultimaEtapa = "catalogo";
        try {
          const resposta = await buscar(entrada, init);
          if (!turnoAberto) {
            await resposta.body?.cancel();
            return respostaVaziaDoCatalogo(entrada);
          }
          falhaExterna = null;
          return resposta;
        } catch (erro) {
          if (!turnoAberto) return respostaVaziaDoCatalogo(entrada);
          falhaExterna = { origem: Date.now() >= prazo ? "prazo" : "catalogo", erro: nomeDoErro(erro) };
          throw erro;
        }
      };

      const catalogoBruto = criarCatalogo(this.env.CATALOGO_URL, buscarCatalogo);
      const envolverCatalogo = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
        ultimaEtapa = "catalogo";
        try {
          const resultado = await fn(...args);
          falhaExterna = null;
          return resultado;
        } catch (erro) {
          if (turnoAberto) falhaExterna ??= { origem: Date.now() >= prazo ? "prazo" : "catalogo", erro: nomeDoErro(erro) };
          throw erro;
        }
      };

      const destino = destinoDosLeads(this.env.LEADS_URL, this.env.CATALOGO_URL, this.env.LEADS_HOST_FALSO);

      const saida = await rodarTurno({
        mensagem,
        historico: this.historico(),
        houveHandoff: this.ler("handoff", false),
        modelo: modeloSeguro,
        prazo,
        contexto: {
          catalogo: {
            cidades: envolverCatalogo(() => catalogoBruto.cidades()),
            buscar: envolverCatalogo((filtro) => catalogoBruto.buscar(filtro)),
            ficha: envolverCatalogo((id) => catalogoBruto.ficha(id)),
          },
          cofre,
          turno,
          mensagem,
          hoje: dataCivilEmSaoPaulo(deps.agora ? deps.agora() : Date.now()),
          envio: {
            ligado: this.env.ENVIO_LEADS === "ligado",
            destinoPermitido: destinoPermitido(this.env.AMBIENTE, destino),
            postar: async (corpo) => {
              if (!turnoAberto) {
                falhaExterna ??= { origem: "prazo", erro: "TempoEsgotado" };
                return Promise.reject(new Error("turno encerrado"));
              }
              ultimaEtapa = "lead";
              try {
                const status = await postarLead(buscar, this.env.LEADS_URL ?? "", corpo);
                falhaExterna = null;
                return status;
              } catch (erro) {
                falhaExterna = { origem: Date.now() >= prazo ? "prazo" : "lead", erro: nomeDoErro(erro) };
                throw erro;
              }
            },
          },
        },
      });

      turnoAberto = false;
      const estourouWorker = prazoWorker !== undefined && Date.now() >= limiteWorker;
      const desistido = idPedido !== undefined && this.desistidos.has(idPedido);
      const contingenciaFinal = saida.contingencia || estourouWorker || desistido;

      const replyFinal = contingenciaFinal ? CONTINGENCIA : saida.reply;
      const handoffFinal = contingenciaFinal ? true : saida.handoff;
      const novasFinais = !saida.contingencia && contingenciaFinal
        ? [...saida.novas.slice(0, -1), { role: "assistant" as const, content: CONTINGENCIA }]
        : saida.novas;

      const resposta: RespostaDoChat = { reply: replyFinal, handoff: handoffFinal, uso: saida.uso };

      // Tudo ou nada: o histórico, o estado inteiro do lead e o registro do pedido valem juntos ou não valem.
      this.ctx.storage.transactionSync(() => {
        for (const nova of novasFinais) {
          this.ctx.storage.sql.exec("INSERT INTO historico (mensagem) VALUES (?)", JSON.stringify(nova));
        }
        if (handoffFinal) this.gravar("handoff", true);
        const atual = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
        const estadoFinal: EstadoLead = contingenciaFinal
          ? {
              ...estadoInicial,
              ...fatosDoEnvio(atual),
              pendente: estadoEmCurso.pendente === estadoInicial.pendente ? estadoInicial.pendente : null,
            }
          : { ...estadoEmCurso, ...fatosDoEnvio(atual) };
        if (JSON.stringify(estadoFinal) !== JSON.stringify(atual)) {
          this.gravar("lead", estadoFinal);
        }
        if (deveReapresentar && !contingenciaFinal) {
          this.ctx.storage.sql.exec("DELETE FROM estado WHERE chave = 'reapresentar'");
        }
        if (contingenciaFinal && pendenteAberto(estadoFinal)) {
          this.gravar("reapresentar", true);
        }
        if (idPedido) this.gravarPedido(idPedido, resposta);
      });

      const causa: CausaContingencia | null = contingenciaFinal
        ? (estourouWorker || desistido
          ? { origem: "prazo", erro: "TempoEsgotado" }
          : (falhaExterna ?? (Date.now() >= prazo
            ? { origem: "prazo", erro: "TempoEsgotado" }
            : ultimaEtapa === "modelo"
              ? { origem: "modelo", erro: "Error" }
              : { origem: "interno", erro: "Error" })))
        : null;

      // Um log por turno, sem texto de mensagem nem dado pessoal (contrato L22).
      console.log(JSON.stringify({
        evento: "turno",
        sessao: this.ctx.id.toString().slice(0, 12),
        turno,
        ms: Date.now() - chegada,
        chamadas_modelo: saida.uso.chamadas,
        tokens_entrada: saida.uso.entrada,
        tokens_saida: saida.uso.saida,
        // Nome fora da lista fechada vem do modelo: no log sai só um rótulo fixo.
        ferramentas: saida.ferramentas.map((nome) => (FERRAMENTAS.some((f) => f.definicao.function.name === nome) ? nome : "desconhecida")),
        handoff: handoffFinal,
        contingencia: contingenciaFinal,
        ...(causa ?? {}),
        envios: Object.values(cofre.ler().envios),
      }));

      return resposta;
    } finally {
      if (idPedido) {
        if (this.idEmCurso === idPedido) this.idEmCurso = null;
        this.desistidos.delete(idPedido);
      }
    }
  }
}
