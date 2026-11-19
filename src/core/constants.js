export const STORAGE_KEY = "us";
export const SCHEMA_VERSION = 1;

export const THEMES = ["light", "dark", "system"];

export const COLLECTIONS = [
  "letters",
  "events",
  "wall",
  "plans",
  "journal",
  "music",
  "places",
  "answers"
];

export const LEGACY_KEYS = ["profile1", "profile2"];

export function makeDefaults() {
  return {
    schemaVersion: SCHEMA_VERSION,
    letters: [],
    events: [],
    wall: [],
    plans: [],
    journal: [],
    music: [],
    places: [],
    answers: [],
    challenges: [],
    theme: "light",
    n1: "",
    n2: "",
    since: "",
    profile1: "",
    profile2: ""
  };
}

export const NAV_ITEMS = [
  ["home", "⌂", "Início"],
  ["calendar", "▦", "Agenda"],
  ["memories", "▧", "Memórias"],
  ["connect", "♡", "Conexão"],
  ["more", "•••", "Mais"]
];

export const PAGE_TITLES = {
  home: "Início",
  calendar: "Agenda",
  memories: "Memórias",
  connect: "Conexão",
  more: "Mais",
  plans: "Nossos planos",
  letters: "Cartinhas",
  journal: "Diário",
  music: "Nossas músicas",
  places: "Mapa de memórias",
  settings: "Configurações"
};

export const PAGES = Object.keys(PAGE_TITLES);

export const AUTH_TITLES = {
  login: "Entrar",
  signup: "Criar conta",
  recover: "Recuperar acesso",
  confirm: "Confirme seu e-mail",
  reset: "Nova senha",
  loading: "Carregando",
  error: "Erro"
};

export const AUTH_ROUTES = Object.keys(AUTH_TITLES);

export const QUESTIONS = [
  "Qual lugar você gostaria de conhecer comigo?",
  "Que lembrança nossa sempre faz você sorrir?",
  "Qual seria um dia perfeito para nós dois?",
  "O que você gostaria que fizéssemos mais vezes?",
  "Qual música combina com a nossa história?",
  "Que coisa nova você gostaria de aprender comigo?",
  "Qual pequeno gesto faz você se sentir amado(a)?"
];

export const DAILY_CHALLENGES = [
  "Escolham uma música que lembre vocês e contem o motivo.",
  "Separem alguns minutos para relembrar um momento feliz.",
  "Planejem juntos um passeio simples para os próximos dias.",
  "Cada um diga uma coisa que admira no outro.",
  "Escolham uma foto antiga e contem a história por trás dela."
];

export const QUIZ_QUESTIONS = [
  "Qual viagem combina com vocês neste momento?",
  "Qual comida vocês escolheriam para um jantar especial?",
  "Que habilidade gostariam de aprender juntos?",
  "Qual lembrança merece virar tradição?",
  "Como seria um domingo perfeito a dois?"
];

export const PLAN_CATEGORIES = [
  "Lugares",
  "Filmes e séries",
  "Comidas",
  "Viagens",
  "Experiências",
  "Outros"
];

export const PLAN_PRIORITIES = ["Quando der", "Prioridade", "Em breve"];

export const LIMITS = {
  imageSourceBytes: 12 * 1024 * 1024,
  imageDataUrlChars: 2_000_000,
  importBytes: 8 * 1024 * 1024,
  textChars: 20_000
};
