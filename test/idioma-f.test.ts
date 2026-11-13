import { describe, expect, it } from "vitest";
import { idiomaDoHospede } from "../src/nucleo/idioma";

describe("idioma do hóspede", () => {
  const casos: [string, string[], "pt" | "en"][] = [
    ["nenhuma mensagem", [], "pt"],
    ["mensagem vazia", [""], "pt"],
    ["português", ["Quero o GRM-301 de 15/01/2027 a 18/01/2027 para 2 pessoas."], "pt"],
    ["português sem acento", ["quero fechar, sou Ana Lima, telefone 11 98888-0000"], "pt"],
    ["inglês", ["Hi! How much is GRM-301 from January 15, 2027 to January 18, 2027 for 2 guests?"], "en"],
    ["inglês com dados pessoais", ["Great, I want to book it. My name is Ana Lima and my phone is +14155550123."], "en"],
    ["confirmação em inglês", ["Yes, I confirm."], "en"],
    ["confirmação em português", ["Sim, confirmo."], "pt"],
    // Curtas e ambíguas, sozinhas.
    ["ok sozinho", ["ok"], "pt"],
    ["sim sozinho", ["sim"], "pt"],
    ["yes sozinho", ["yes"], "en"],
    ["hello sozinho", ["Hello"], "en"],
    ["número solto", ["2"], "pt"],
    ["data solta", ["15/01/2027"], "pt"],
    ["telefone solto", ["+55 11 98888-0000"], "pt"],
    ["só o id do imóvel", ["GRM-301"], "pt"],
    ["só um nome", ["Ana Lima"], "pt"],
    // Curtas e ambíguas, depois de uma mensagem clara: vale a clara.
    ["ok depois de inglês", ["How much is GRM-301 for 2 guests?", "ok"], "en"],
    ["número depois de inglês", ["How much is GRM-301 for the weekend?", "2"], "en"],
    ["nome e telefone depois de inglês", ["I want to book GRM-301 for 2 guests", "John Smith, +14155550123"], "en"],
    ["yes depois de português", ["Quero fechar o GRM-301 para 2 pessoas.", "yes"], "pt"],
    ["sim depois de inglês", ["I want to book GRM-301 for 2 guests", "sim"], "en"],
    ["ok depois de português", ["Quanto fica o GRM-301 para 2 pessoas?", "ok"], "pt"],
    // Troca de idioma no meio da conversa: vale a mensagem clara mais recente.
    ["português e depois inglês", ["Olá, quero cotar o GRM-301 para 2 pessoas.", "Actually, can we continue in English? I want to book it."], "en"],
    ["inglês e depois português", ["Hi, how much is GRM-301 for 2 guests?", "Pode responder em português? Quero fechar para 2 pessoas."], "pt"],
    // Outro idioma e mistura sem vantagem clara recebem português.
    ["espanhol", ["Hola, ¿cuánto cuesta el GRM-301 para 2 personas?"], "pt"],
    ["francês", ["Bonjour, je voudrais réserver pour deux personnes"], "pt"],
    ["nome de imóvel em inglês dentro de frase em português", ["Quero o Beach House para a minha família"], "pt"],
    ["mistura sem vantagem", ["Quero o Studio Copacabana for my family"], "pt"],
  ];
  for (const [nome, textos, esperado] of casos) {
    it(`${nome}: ${esperado}`, () => expect(idiomaDoHospede(textos)).toBe(esperado));
  }
});
