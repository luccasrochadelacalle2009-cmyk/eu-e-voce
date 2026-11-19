import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  COLLECTIONS,
  LEGACY_KEYS,
  THEMES,
  LIMITS,
  makeDefaults
} from "./constants.js";
import {
  cleanText,
  isISODate,
  normalizeDate,
  nowISO,
  safeDate,
  safeImage,
  safeUrl,
  uid
} from "./utils.js";
import { notify } from "../ui/toast.js";

const MAX_RECORDS = 5000;

const FIELDS = {
  letters: ["t", "f", "b", "d", "unlock"],
  events: ["d", "t", "time", "by"],
  wall: ["t", "text", "img", "d"],
  plans: ["t", "cat", "priority", "note", "done"],
  journal: ["t", "by", "text", "d"],
  music: ["name", "artist", "link", "meaning"],
  places: ["name", "address", "date", "note"],
  answers: ["day", "text", "by"]
};

const DATE_FIELDS = {
  letters: ["d", "unlock"],
  events: ["d"],
  wall: ["d"],
  journal: ["d"],
  places: ["date"],
  answers: ["day"]
};

function validTimestamp(value) {
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text) &&
    !Number.isNaN(new Date(text).getTime())
    ? text
    : nowISO();
}

function normalizeRecord(record, type) {
  const source = record && typeof record === "object" && !Array.isArray(record) ? record : {};
  const result = {
    id: typeof source.id === "string" && source.id.length <= 120 ? source.id : uid(),
    createdAt: validTimestamp(source.createdAt),
    updatedAt: validTimestamp(source.updatedAt)
  };

  for (const field of FIELDS[type]) {
    const value = source[field];
    if (field === "img") {
      result.img = safeImage(value);
    } else if (field === "link") {
      result.link = safeUrl(value);
    } else if (field === "done") {
      result.done = value === true;
    } else if (field === "time") {
      result.time = /^\d{2}:\d{2}$/.test(String(value ?? "")) ? String(value) : "";
    } else if (DATE_FIELDS[type]?.includes(field)) {
      const isoValue = safeDate(value);
      result[field] = isoValue;
      if (!isoValue && String(value ?? "").trim()) {
        result.legacy = cleanText(value, 40);
      }
    } else {
      result[field] = cleanText(value);
    }
  }
  return result;
}

/** Constrói um estado íntegro a partir de qualquer objeto recebido. */
export function sanitizeState(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const clean = makeDefaults();

  clean.theme = THEMES.includes(source.theme) ? source.theme : "light";
  clean.n1 = cleanText(source.n1, 120);
  clean.n2 = cleanText(source.n2, 120);
  clean.since = safeDate(source.since);
  for (const key of LEGACY_KEYS) clean[key] = cleanText(source[key], 500);

  clean.schemaVersion = SCHEMA_VERSION;

  for (const key of COLLECTIONS) {
    const list = Array.isArray(source[key]) ? source[key].slice(0, MAX_RECORDS) : [];
    clean[key] = list.map(item => normalizeRecord(item, key));
  }

  clean.challenges = Array.isArray(source.challenges)
    ? Array.from(new Set(source.challenges.filter(isISODate).slice(0, MAX_RECORDS)))
    : [];

  return clean;
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return sanitizeState(stored ? JSON.parse(stored) : {});
  } catch {
    return makeDefaults();
  }
}

/** Retorna false quando o navegador recusa a escrita (quota, modo privado etc.). */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    notify("Não foi possível salvar. O armazenamento pode estar cheio.");
    return false;
  }
}

/** Grava a normalização feita na carga sem exibir avisos ao usuário. */
export function persistMigration(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* mantém o estado em memória mesmo se a escrita falhar */ }
}

export function parseBackup(text) {
  if (String(text ?? "").length > LIMITS.importBytes) {
    throw new Error("Arquivo de backup muito grande.");
  }
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Formato de backup inválido.");
  }
  return sanitizeState(data);
}

export function removeStored() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignora */ }
}
