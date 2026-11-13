// Idioma dos textos fixos de código (contrato L15): português ou inglês. Função pura,
// sem modelo. Outro idioma, ou dúvida, recebe português.

export type Idioma = "pt" | "en";

const palavras = (lista: string) => new Set(lista.split(" "));
// Palavras comuns que só existem num dos dois idiomas. Ficam de fora as que existem nos
// dois com sentidos diferentes ("a", "do", "no", "as", "me", "e") e "ok".
const INGLES = palavras(
  "the is are am im my i you we it this that these those to for and of from with at on in or but if "
    + "yes please thanks thank hi hello hey great good want would like can could have has need looking "
    + "how much many what when where which who does did will there any some "
    + "book booking name phone guests guest people person nights night stay price rate confirm",
);
const PORTUGUES = palavras(
  "o os um uma uns umas de da dos das em na nos nas ao para pra por com sem que se mas ou "
    + "sim nao favor obrigado obrigada oi ola bom boa quero queria gostaria pode posso tem tenho preciso "
    + "quanto quantos quantas qual quais quando onde quem meu minha voce esta estou sou somos fica "
    + "reserva reservar fechar nome telefone hospedes hospede pessoas pessoa noites noite diaria valor confirmo imovel",
);

/** Palavras só do inglês menos palavras só do português, numa mensagem. */
function saldo(texto: string): number {
  const termos = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/);
  return termos.reduce((s, t) => s + Number(INGLES.has(t)) - Number(PORTUGUES.has(t)), 0);
}

/**
 * Idioma do hóspede a partir das mensagens dele na conversa, da mais antiga para a mais
 * nova. Vale a mensagem mais recente em que um idioma é claro (duas palavras ou mais de
 * vantagem), então a conversa que troca de idioma no meio segue a troca. Sem nenhuma
 * mensagem clara, é inglês só se o conjunto pender para o inglês; empate ou nada é
 * português.
 */
export function idiomaDoHospede(textos: readonly string[]): Idioma {
  const saldos = textos.map(saldo);
  const claro = saldos.findLast((s) => Math.abs(s) >= 2);
  return (claro ?? saldos.reduce((a, b) => a + b, 0)) > 0 ? "en" : "pt";
}
