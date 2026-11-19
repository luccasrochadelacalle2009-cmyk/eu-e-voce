import { LIMITS } from "./constants.js";

export function $(id) {
  return document.getElementById(id);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

export function iso(date) {
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

export function nowISO() {
  return new Date().toISOString();
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function cap(value) {
  const s = String(value ?? "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function fmtDate(value) {
  if (!value) return "";
  const normalized = normalizeDate(value);
  const parts = normalized.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value);
}

export function formatToday() {
  return cap(new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }));
}

/** Aceita ISO (yyyy-mm-dd) ou localizado (dd/mm/yyyy) e devolve ISO. */
export function normalizeDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return "";
}

export function isISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) &&
    !Number.isNaN(new Date(String(value) + "T00:00:00").getTime());
}

export function daysTogether(since) {
  if (!isISODate(since)) return null;
  const parts = since.split("-").map(Number);
  const start = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const todayDate = new Date();
  const today = Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  return Math.max(0, Math.round((today - start) / 86400000));
}

export function dayIndex() {
  return Math.floor(Date.now() / 86400000);
}

/** Texto seguro e limitado, usado ao importar backups. */
export function cleanText(value, max = LIMITS.textChars) {
  return String(value ?? "").slice(0, max);
}

/** Só aceita http(s), eliminando payloads como javascript: em backups. */
export function safeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

/** Só aceita data URLs de imagem conhecidas e dentro de um limite. */
export function safeImage(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.length > LIMITS.imageDataUrlChars) return "";
  const match = raw.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return "";
  const base64 = match[2].replace(/\s/g, "");
  if (!base64 || base64.length % 4 !== 0) return "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return "";
  return `data:image/${match[1].toLowerCase()};base64,${base64}`;
}

export function safeDate(value) {
  const normalized = normalizeDate(value);
  return isISODate(normalized) ? normalized : "";
}

export function scrollTop() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}
