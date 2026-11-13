// Uma sessão de conversa = um Durable Object. Guarda o histórico e o estado do lead
// em SQLite e garante uma mensagem por vez.
import { DurableObject } from "cloudflare:workers";
import { CONTINGENCIA, rodarTurno } from "./agente/loop";
import { criarCatalogo } from "./catalogo";
import type { Env } from "./env";
import { type Cofre, destinoDosLeads, destinoPermitido, ESTADO_INICIAL, type EstadoLead, postarLead } from "./lead";
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
}

/** Orçamento do trabalho externo, contado da chegada do pedido; sobra tempo para a contingência (contrato seção 2). */
const ORCAMENTO_MS = 45_000;
// ponytail: o modelo recebe só as últimas mensagens; conversa mais longa que isso
// esquece o começo. Trocar por resumo do histórico se as conversas reais passarem disso.
const JANELA_DO_HISTORICO = 80;

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
  }

  /**
   * Entra na fila e processa a mensagem quando todas as anteriores terminarem. Nunca
   * rejeita: processamento que lança vira a resposta de contingência (contrato L18), e
   * por isso uma mensagem que falha não trava as seguintes.
   */
  conversar(mensagem: string, chegada: number = Date.now()): Promise<RespostaDoChat> {
    const vez = this.fila.then(() => this.processar(mensagem, chegada)).catch((): RespostaDoChat => {
      console.log(JSON.stringify({ evento: "falha_no_turno", sessao: this.ctx.id.toString().slice(0, 12) }));
      return { reply: CONTINGENCIA, handoff: true, uso: { entrada: 0, saida: 0, chamadas: 0 } };
    });
    this.fila = vez;
    return vez;
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

  private async processar(mensagem: string, chegada: number): Promise<RespostaDoChat> {
    const deps = this.dependencias ??= { modelo: criarModelo(this.env.AI, this.env.MODELO), buscar: fetch };
    const turno = this.ler("turno", 0) + 1;
    this.gravar("turno", turno);
    // O cofre só aceita gravação durante o turno. Uma ferramenta que o loop abandonou
    // por tempo e termina depois não muda o estado do lead pelas costas do hóspede: sem
    // conseguir gravar o marcador, ela também não chega a fazer o POST.
    let turnoAberto = true;
    const cofre: Cofre = {
      ler: () => this.ler<EstadoLead>("lead", ESTADO_INICIAL),
      salvar: (estado) => {
        if (!turnoAberto) throw new Error("turno encerrado");
        this.gravar("lead", estado);
      },
    };
    const destino = destinoDosLeads(this.env.LEADS_URL, this.env.CATALOGO_URL);

    const saida = await rodarTurno({
      mensagem,
      historico: this.historico(),
      houveHandoff: this.ler("handoff", false),
      modelo: deps.modelo,
      prazo: chegada + ORCAMENTO_MS,
      contexto: {
        catalogo: criarCatalogo(this.env.CATALOGO_URL, deps.buscar),
        cofre,
        turno,
        mensagem,
        hoje: dataCivilEmSaoPaulo((deps.agora ?? Date.now)()),
        envio: {
          ligado: this.env.ENVIO_LEADS === "ligado",
          destinoPermitido: destinoPermitido(this.env.AMBIENTE, destino),
          postar: (corpo) => postarLead(deps.buscar, this.env.LEADS_URL ?? "", corpo),
        },
      },
    });

    turnoAberto = false;

    // Tudo ou nada: o histórico nunca fica com pedido de ferramenta sem o resultado.
    this.ctx.storage.transactionSync(() => {
      for (const nova of saida.novas) {
        this.ctx.storage.sql.exec("INSERT INTO historico (mensagem) VALUES (?)", JSON.stringify(nova));
      }
      if (saida.handoff) this.gravar("handoff", true);
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

    return { reply: saida.reply, handoff: saida.handoff, uso: saida.uso };
  }
}
