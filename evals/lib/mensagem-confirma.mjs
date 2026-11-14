/**
 * Diz se uma mensagem do hóspede pode ser lida como "sim" pela leitura de confirmação do
 * produto (`lerConfirmacao` em `src/lead.ts`). A trava de `producao` do runner usa isto para
 * recusar um caso que confirma pelas mensagens mesmo declarando `"confirma": false`.
 *
 * É mais largo que o produto, de propósito: basta a mensagem COMEÇAR com uma frase de
 * afirmação, confirmação ou envio da gramática do sim (com as interjeições da P15 na frente).
 * Só fica de fora o que o produto também nunca lê como sim: mensagem com pergunta que não seja
 * um pedido de envio ("Certo, deixando isso de lado: quanto fica…?").
 */

// Frases de `AFIRMA`, `CONFIRMA`, `PODE`, `PODE_ENVIAR` e `INICIO` de src/lead.ts, sem acento.
const AFIRMA =
  's+i+m+|s|ss|si|yes|yep|yeah|yup|isso(?: mesmo)?|exato|exatamente|corret[oa]|certo|certinho|perfeito|claro|com certeza' +
  '|positivo|fechado|combinado|(?:esta |ta )?tudo (?:certo|correto)|esta (?:certo|correto)|correct|thats? (?:s )?(?:right|correct)' +
  '|sure|absolutely|definitely|(?:it )?(?:looks|sounds) good|all good|go ahead|proceed|please do' +
  '|isso ai|manda ver|bora|sim quero|quero sim|please confirm|all correct';
const CONFIRMA = '(?:eu )?confirm(?:o|a|e|ado|ada|ar)|i confirm|confirm(?:ed)?';
const PODE = 'pode(?: sim)?(?: (?:fechar|enviar|mandar|confirmar|registrar|reservar|prosseguir|seguir))?|send it|book it';
const PODE_ENVIAR = 'pode(?: sim)? (?:fechar|enviar|mandar|confirmar|registrar)|send it';
const INICIO = '(?:(?:ok|okay|entao|bom|ah|perfeito|otimo|ta otimo|beleza|blz|show|perfect|great|top|massa) )*';

const COMECA_COM_SIM = new RegExp(`^${INICIO}(?:${AFIRMA}|${CONFIRMA}|${PODE})(?: |$)`);
const PEDIDO_DE_ENVIO = new RegExp(`^(?:.* )?(?:${PODE_ENVIAR})(?: |$)`);

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mensagemPodeConfirmar(mensagem) {
  if (typeof mensagem !== 'string') return false;
  const bruto = mensagem.replace(/[？؟]/g, '?');
  if (!COMECA_COM_SIM.test(normalizar(bruto))) return false;
  if (!bruto.includes('?')) return true;
  // Como no produto: com pergunta, só é sim se toda pergunta for um pedido de envio.
  const perguntas = bruto.match(/[^.!?]*\?/g) ?? [];
  return perguntas.every((p) => PEDIDO_DE_ENVIO.test(normalizar(p)));
}

/** Algum turno (ou subturno paralelo) do caso manda uma mensagem que pode confirmar. */
export function casoMandaSim(caso) {
  return (caso.turnos || []).some(
    (t) => mensagemPodeConfirmar(t?.mensagem) || (t?.paralelo || []).some((s) => mensagemPodeConfirmar(s?.mensagem))
  );
}
