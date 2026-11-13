import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CAMINHO_PADRAO_FICHAS = path.join(
  os.homedir(),
  '.local',
  'share',
  'agente-concierge',
  'catalogo',
  'fichas.json',
);

const FICHAS_FALLBACK = [
  {
    id: 'BMB-201',
    nome: 'Loft Bombinhas Centro',
    cidade: 'Bombinhas',
    uf: 'SC',
    bairro: 'Centro',
    tipo: 'loft',
    quartos: 1,
    banheiros: 1,
    capacidade: 3,
    diaria: 320,
    taxa_limpeza: 110,
    minimo_noites: 2,
    checkin_hora: '14:00',
    checkout_hora: '11:00',
    distancia_praia_m: 400,
    comodidades: ['wifi', 'ar-condicionado', 'cozinha completa'],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'BMB-202',
    nome: 'Casa Mariscal Familia',
    cidade: 'Bombinhas',
    uf: 'SC',
    bairro: 'Mariscal',
    tipo: 'casa',
    quartos: 4,
    banheiros: 3,
    capacidade: 10,
    diaria: 1150,
    taxa_limpeza: 320,
    minimo_noites: 4,
    checkin_hora: '16:00',
    checkout_hora: '10:00',
    distancia_praia_m: 80,
    comodidades: ['wifi', 'piscina', 'churrasqueira', 'garagem para 3 carros', 'playground'],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'CGT-901',
    nome: 'Apartamento Caragua Familia',
    cidade: 'Caraguatatuba',
    uf: 'SP',
    bairro: 'Martim de Sa',
    tipo: 'apartamento',
    quartos: 3,
    banheiros: 2,
    capacidade: 8,
    diaria: 540,
    taxa_limpeza: 170,
    minimo_noites: 2,
    checkin_hora: '15:00',
    checkout_hora: '11:00',
    distancia_praia_m: 100,
    comodidades: ['wifi', 'piscina do condominio', '2 vagas de garagem', 'ar-condicionado na sala'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'FLN-101',
    nome: 'Studio Lagoa Azul',
    cidade: 'Florianopolis',
    uf: 'SC',
    bairro: 'Lagoa da Conceicao',
    tipo: 'studio',
    quartos: 0,
    banheiros: 1,
    capacidade: 2,
    diaria: 280,
    taxa_limpeza: 90,
    minimo_noites: 2,
    checkin_hora: '15:00',
    checkout_hora: '11:00',
    distancia_praia_m: 1800,
    comodidades: ['wifi', 'ar-condicionado', 'cozinha compacta', 'smart tv'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'FLN-102',
    nome: 'Casa Mole Vista Mar',
    cidade: 'Florianopolis',
    uf: 'SC',
    bairro: 'Praia Mole',
    tipo: 'casa',
    quartos: 3,
    banheiros: 2,
    capacidade: 7,
    diaria: 890,
    taxa_limpeza: 250,
    minimo_noites: 3,
    checkin_hora: '16:00',
    checkout_hora: '10:00',
    distancia_praia_m: 300,
    comodidades: ['wifi', 'piscina', 'churrasqueira', 'garagem para 2 carros', 'ar-condicionado nos quartos'],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'FLN-103',
    nome: 'Apartamento Jurere Sol',
    cidade: 'Florianopolis',
    uf: 'SC',
    bairro: 'Jurere Internacional',
    tipo: 'apartamento',
    quartos: 2,
    banheiros: 2,
    capacidade: 5,
    diaria: 640,
    taxa_limpeza: 180,
    minimo_noites: 2,
    checkin_hora: '15:00',
    checkout_hora: '11:00',
    distancia_praia_m: 150,
    comodidades: ['wifi', 'piscina do condominio', 'academia', '1 vaga de garagem', 'ar-condicionado'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'FOZ-701',
    nome: 'Casa Cataratas',
    cidade: 'Foz do Iguacu',
    uf: 'PR',
    bairro: 'Vila Yolanda',
    tipo: 'casa',
    quartos: 2,
    banheiros: 2,
    capacidade: 5,
    diaria: 420,
    taxa_limpeza: 130,
    minimo_noites: 2,
    checkin_hora: '14:00',
    checkout_hora: '11:00',
    distancia_praia_m: null,
    comodidades: ['wifi', 'ar-condicionado', 'piscina', '2 vagas de garagem'],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'GRM-301',
    nome: 'Chale Serra Gramado',
    cidade: 'Gramado',
    uf: 'RS',
    bairro: 'Planalto',
    tipo: 'chale',
    quartos: 2,
    banheiros: 1,
    capacidade: 4,
    diaria: 590,
    taxa_limpeza: 150,
    minimo_noites: 2,
    checkin_hora: '15:00',
    checkout_hora: '12:00',
    distancia_praia_m: null,
    comodidades: ['wifi', 'lareira', 'hidromassagem', '1 vaga de garagem', 'aquecedor'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'GRM-302',
    nome: 'Apartamento Rua Coberta',
    cidade: 'Gramado',
    uf: 'RS',
    bairro: 'Centro',
    tipo: 'apartamento',
    quartos: 1,
    banheiros: 1,
    capacidade: 2,
    diaria: 430,
    taxa_limpeza: 120,
    minimo_noites: 3,
    checkin_hora: '14:00',
    checkout_hora: '11:00',
    distancia_praia_m: null,
    comodidades: ['wifi', 'aquecedor', 'cozinha completa'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'IMB-801',
    nome: 'Apartamento Imbituba Surf',
    cidade: 'Imbituba',
    uf: 'SC',
    bairro: 'Praia do Rosa',
    tipo: 'apartamento',
    quartos: 2,
    banheiros: 1,
    capacidade: 4,
    diaria: 475,
    taxa_limpeza: 140,
    minimo_noites: 2,
    checkin_hora: '15:00',
    checkout_hora: '11:00',
    distancia_praia_m: 500,
    comodidades: ['wifi', 'suporte para pranchas', 'churrasqueira', '1 vaga de garagem'],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'NAT-601',
    nome: 'Flat Ponta Negra',
    cidade: 'Natal',
    uf: 'RN',
    bairro: 'Ponta Negra',
    tipo: 'flat',
    quartos: 1,
    banheiros: 1,
    capacidade: 3,
    diaria: 365.9,
    taxa_limpeza: 95,
    minimo_noites: 2,
    checkin_hora: '14:00',
    checkout_hora: '12:00',
    distancia_praia_m: 200,
    comodidades: ['wifi', 'ar-condicionado', 'piscina do condominio', 'cafe da manha opcional pago a parte'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'NAT-602',
    nome: 'Casa Pipa Natureza',
    cidade: 'Tibau do Sul',
    uf: 'RN',
    bairro: 'Praia da Pipa',
    tipo: 'casa',
    quartos: 3,
    banheiros: 3,
    capacidade: 6,
    diaria: 760,
    taxa_limpeza: 210,
    minimo_noites: 3,
    checkin_hora: '15:00',
    checkout_hora: '10:00',
    distancia_praia_m: 600,
    comodidades: ['wifi', 'piscina', 'rede na varanda', 'churrasqueira'],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'RIO-401',
    nome: 'Apartamento Leblon Charme',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
    bairro: 'Leblon',
    tipo: 'apartamento',
    quartos: 2,
    banheiros: 2,
    capacidade: 4,
    diaria: 980,
    taxa_limpeza: 260,
    minimo_noites: 3,
    checkin_hora: '15:00',
    checkout_hora: '11:00',
    distancia_praia_m: 250,
    comodidades: ['wifi', 'ar-condicionado', 'portaria 24h', 'elevador'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'RIO-402',
    nome: 'Studio Santa Teresa',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
    bairro: 'Santa Teresa',
    tipo: 'studio',
    quartos: 0,
    banheiros: 1,
    capacidade: 2,
    diaria: 245.5,
    taxa_limpeza: 75,
    minimo_noites: 1,
    checkin_hora: '14:00',
    checkout_hora: '11:00',
    distancia_praia_m: null,
    comodidades: ['wifi', 'ventilador de teto', 'varanda'],
    regras: { aceita_pet: true, permite_fumar: false, permite_festas: false },
  },
  {
    id: 'SAO-501',
    nome: 'Apartamento Pinheiros Work',
    cidade: 'Sao Paulo',
    uf: 'SP',
    bairro: 'Pinheiros',
    tipo: 'apartamento',
    quartos: 1,
    banheiros: 1,
    capacidade: 2,
    diaria: 310,
    taxa_limpeza: 100,
    minimo_noites: 1,
    checkin_hora: '15:00',
    checkout_hora: '11:00',
    distancia_praia_m: null,
    comodidades: ['wifi 500 mega', 'mesa de trabalho', 'ar-condicionado', 'lavanderia no predio'],
    regras: { aceita_pet: false, permite_fumar: false, permite_festas: false },
  },
];

let cacheCatalogo = null;

export function carregarCatalogo(caminhoArquivo = process.env.SIMULADOR_FICHAS_PATH || CAMINHO_PADRAO_FICHAS) {
  if (cacheCatalogo && caminhoArquivo === CAMINHO_PADRAO_FICHAS) {
    return cacheCatalogo;
  }

  let imoveis = FICHAS_FALLBACK;
  let origem = 'fallback';

  if (caminhoArquivo && fs.existsSync(caminhoArquivo)) {
    const raw = JSON.parse(fs.readFileSync(caminhoArquivo, 'utf8'));
    if (Array.isArray(raw.imoveis) && raw.imoveis.length > 0) {
      imoveis = raw.imoveis;
      origem = 'fichas.json';
    }
  }

  const porId = new Map();
  for (const item of imoveis) {
    porId.set(String(item.id).toUpperCase(), item);
  }

  const resultado = { imoveis, porId, origem };
  if (caminhoArquivo === CAMINHO_PADRAO_FICHAS) {
    cacheCatalogo = resultado;
  }
  return resultado;
}

export function buscarImovelPorId(id, catalogo = carregarCatalogo()) {
  if (!id) return null;
  return catalogo.porId.get(String(id).trim().toUpperCase()) || null;
}

export function detectarImovelNoTexto(texto, catalogo = carregarCatalogo()) {
  if (!texto) return null;
  const matchId = texto.match(/\b([A-Za-z]{3}-\d{3})\b/);
  if (matchId) {
    const porId = buscarImovelPorId(matchId[1], catalogo);
    if (porId) return porId;
  }
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  for (const imovel of catalogo.imoveis) {
    const nomeNorm = imovel.nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (normalizado.includes(nomeNorm)) {
      return imovel;
    }
  }
  return null;
}
