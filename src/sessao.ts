// Uma sessão de conversa = um Durable Object. Guarda o histórico e o estado do lead
// em SQLite e garante uma mensagem por vez.
import { DurableObject } from "cloudflare:workers";
import { CONTINGENCIA, rodarTurno } from "./agente/loop";
import { criarCatalogo } from "./catalogo";
import type { Env } from "./env";
import { type Cofre, destinoDosLeads, destinoPermitido, ESTADO_INICIAL, type EstadoLead, type Pendente, postarLead } from "./lead";
import { criarModelo, type Mensagem, type Modelo } from "./modelo";
import { dataCivilEmSaoPaulo } from "./nucleo/datas";

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
/** Teto total desde a chegada ao Worker, abaixo do teto do Worker para devolver contingência limpa. */
export const TETO_SESSAO_MS = 53_000;
const SEM_USO = { entrada: 0, saida: 0, chamadas: 0 };
// ponytail: o modelo recebe só as últimas mensagens; conversa mais longa que isso
// esquece o começo. Trocar por resumo do histórico se as conversas reais passarem disso.
const JANELA_DO_HISTORICO = 80;

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
  conversar(mensagem: string, chegada: number = Date.now(), idPedido?: string): Promise<RespostaDoChat> {
    const entradaNaFila = Date.now();
    const vez = this.fila.then(() => this.processar(mensagem, chegada, entradaNaFila, idPedido)).catch((): RespostaDoChat => {
      console.log(JSON.stringify({ evento: "falha_no_turno", sessao: this.ctx.id.toString().slice(0, 12) }));
      return { reply: CONTINGENCIA, handoff: true, uso: SEM_USO };
    });
    this.fila = vez;
    return vez;
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

  private async processar(mensagem: string, chegada: number, entradaNaFila: number, idPedido?: string): Promise<RespostaDoChat> {
    if (idPedido) {
      const gravada = this.respostaDoPedido(idPedido);
      if (gravada) return gravada;
    }

    const deps = this.dependencias ??= { modelo: criarModelo(this.env.AI, this.env.MODELO), buscar: fetch };
    const orcamentoMs = deps.orcamentoMs ?? ORCAMENTO_MS;
    const tetoMs = deps.tetoMs ?? TETO_SESSAO_MS;
    const inicio = Date.now();
    const esperaNaFila = Math.max(0, inicio - entradaNaFila);
    const prazo = Math.min(chegada + orcamentoMs + esperaNaFila, chegada + tetoMs);

    if (inicio >= prazo) {
      console.log(JSON.stringify({ evento: "prazo_esgotado_na_fila", sessao: this.ctx.id.toString().slice(0, 12) }));
      return { reply: CONTINGENCIA, handoff: true, uso: SEM_USO };
    }

    const modeloReal = deps.modelo;
    const turno = this.ler("turno", 0) + 1;
    this.gravar("turno", turno);

    // `envios` (marcador "enviando" etc.) é gravado na hora antes do POST para sobreviver a
    // reinício do objeto; `pendente` só é gravado junto com o histórico na transação do fim
    // do turno, para um resumo não entregue nunca ficar confirmável.
    const estadoInicial = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
    const pendentePersistido = estadoInicial.pendente;
    let pendenteEmCurso: Pendente | null = pendentePersistido;
    let turnoAberto = true;

    const cofre: Cofre = {
      ler: () => {
        const atual = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
        return { pendente: pendenteEmCurso, envios: atual.envios };
      },
      salvar: (estado) => {
        if (!turnoAberto) return;
        pendenteEmCurso = estado.pendente;
        const atual = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
        if (JSON.stringify(estado.envios) !== JSON.stringify(atual.envios)) {
          this.gravar("lead", { pendente: atual.pendente, envios: estado.envios });
        }
      },
    };

    const modeloSeguro: Modelo = async (mensagens, ferramentas) => {
      try {
        return await modeloReal(mensagens, ferramentas);
      } catch (erro) {
        if (!turnoAberto) return { texto: "", chamadas: [], uso: { entrada: 0, saida: 0 } };
        throw erro;
      }
    };

    const buscarCatalogo: typeof fetch = async (entrada, init) => {
      try {
        const resposta = await deps.buscar(entrada, init);
        if (!turnoAberto) {
          await resposta.body?.cancel();
          return respostaVaziaDoCatalogo(entrada);
        }
        return resposta;
      } catch (erro) {
        if (!turnoAberto) return respostaVaziaDoCatalogo(entrada);
        throw erro;
      }
    };

    const destino = destinoDosLeads(this.env.LEADS_URL, this.env.CATALOGO_URL);

    const saida = await rodarTurno({
      mensagem,
      historico: this.historico(),
      houveHandoff: this.ler("handoff", false),
      modelo: modeloSeguro,
      prazo,
      contexto: {
        catalogo: criarCatalogo(this.env.CATALOGO_URL, buscarCatalogo),
        cofre,
        turno,
        mensagem,
        hoje: dataCivilEmSaoPaulo((deps.agora ?? Date.now)()),
        envio: {
          ligado: this.env.ENVIO_LEADS === "ligado",
          destinoPermitido: destinoPermitido(this.env.AMBIENTE, destino),
          postar: (corpo) => {
            if (!turnoAberto) return Promise.reject(new Error("turno encerrado"));
            return postarLead(deps.buscar, this.env.LEADS_URL ?? "", corpo);
          },
        },
      },
    });

    turnoAberto = false;
    const pendenteFinal = saida.contingencia
      ? (pendenteEmCurso === pendentePersistido ? pendentePersistido : null)
      : pendenteEmCurso;

    const resposta: RespostaDoChat = { reply: saida.reply, handoff: saida.handoff, uso: saida.uso };

    // Tudo ou nada: o histórico, o resumo pendente e o registro do pedido valem juntos ou não valem.
    this.ctx.storage.transactionSync(() => {
      for (const nova of saida.novas) {
        this.ctx.storage.sql.exec("INSERT INTO historico (mensagem) VALUES (?)", JSON.stringify(nova));
      }
      if (saida.handoff) this.gravar("handoff", true);
      const atual = this.ler<EstadoLead>("lead", ESTADO_INICIAL);
      if (JSON.stringify(pendenteFinal) !== JSON.stringify(atual.pendente)) {
        this.gravar("lead", { ...atual, pendente: pendenteFinal });
      }
      if (idPedido) {
        this.ctx.storage.sql.exec("INSERT OR IGNORE INTO pedidos (id, resposta) VALUES (?, ?)", idPedido, JSON.stringify(resposta));
      }
    });

    // Um log por turno, sem texto de mensagem nem dado pessoal (contrato L22).
    console.log(JSON.stringify({
      evento: "turno",
      sessao: this.ctx.id.toString().slice(0, 12),
      turno,
      ms: Date.now() - chegada,
      chamadas_modelo: saida.uso.chamadas,
      tokens_entrada: saida.uso.entrada,
      tokens_saida: saida.uso.saida,
      ferramentas: saida.ferramentas,
      handoff: saida.handoff,
      contingencia: saida.contingencia,
      envios: Object.values(cofre.ler().envios),
    }));

    return resposta;
  }
}
