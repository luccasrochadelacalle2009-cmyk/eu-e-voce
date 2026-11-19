import { loadState, saveState, persistMigration, parseBackup, removeStored, sanitizeState } from "./storage.js";
import { STORAGE_KEY } from "./constants.js";
import { nowISO, uid } from "./utils.js";
import { notify } from "../ui/toast.js";

let current = null;
const listeners = new Set();

export function initStore() {
  current = loadState();
  persistMigration(current);
  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY) return;
    try {
      current = event.newValue ? sanitizeState(JSON.parse(event.newValue)) : loadState();
      emit();
    } catch { /* ignora alterações inválidas vindas de outras abas */ }
  });
}

export function getState() {
  return current;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit() {
  listeners.forEach(listener => listener());
}

export function touch(record) {
  if (!record.id) record.id = uid();
  if (!record.createdAt) record.createdAt = nowISO();
  record.updatedAt = nowISO();
  return record;
}

/** Aplica uma mutação, persiste e notifica. O mutador pode retornar false para abortar. */
export function commit(mutator, successMessage) {
  const snapshot = JSON.stringify(current);
  if (mutator(current) === false) return false;
  if (!saveState(current)) {
    const restored = JSON.parse(snapshot);
    Object.keys(current).forEach(key => delete current[key]);
    Object.assign(current, restored);
    emit();
    return false;
  }
  emit();
  if (successMessage) notify(successMessage);
  return true;
}

export function replaceState(nextState, successMessage) {
  if (!saveState(nextState)) return false;
  current = nextState;
  emit();
  if (successMessage) notify(successMessage);
  return true;
}

export function importState(text) {
  let next;
  try {
    next = parseBackup(text);
  } catch {
    notify("Não foi possível importar esse arquivo.");
    return false;
  }
  return replaceState(next, "Backup importado.");
}

export function resetState() {
  removeStored();
  current = loadState();
  saveState(current);
  emit();
}
