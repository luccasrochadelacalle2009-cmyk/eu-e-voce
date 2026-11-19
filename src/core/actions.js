import { go } from "./router.js";
import { cycleTheme, setTheme } from "./theme.js";
import { commit } from "./store.js";
import { openModal } from "../ui/modal.js";
import * as home from "../features/home.js";
import * as calendar from "../features/calendar.js";
import * as memories from "../features/memories.js";
import * as plans from "../features/plans.js";
import * as letters from "../features/letters.js";
import * as connect from "../features/connect.js";
import * as journal from "../features/journal.js";
import * as music from "../features/music.js";
import * as places from "../features/places.js";
import * as more from "../features/more.js";
import * as settings from "../features/settings.js";

function removeRecord(arg, element) {
  const key = element?.dataset?.key;
  const index = Number(element?.dataset?.index);
  openModal({
    title: "Excluir este registro?",
    description: "O registro será removido deste aparelho. Você pode exportar um backup antes, se quiser.",
    confirmLabel: "Excluir",
    danger: true,
    onConfirm: () => commit(state => {
      if (!Array.isArray(state[key]) || !state[key][index]) return false;
      state[key].splice(index, 1);
    }, "Registro excluído.")
  });
}

const registry = {
  go: arg => go(arg),
  "cycle-theme": cycleTheme,
  "set-theme": arg => setTheme(arg),
  remove: removeRecord,
  ...home.actions,
  ...calendar.actions,
  ...memories.actions,
  ...plans.actions,
  ...letters.actions,
  ...connect.actions,
  ...journal.actions,
  ...music.actions,
  ...places.actions,
  ...more.actions,
  ...settings.actions
};

function dispatch(event) {
  const element = event.target.closest("[data-action]");
  if (!element || element.closest(".modal-host")) return;
  const handler = registry[element.dataset.action];
  if (!handler) return;
  event.preventDefault();
  handler(element.dataset.arg, element, event);
}

export function initActions() {
  document.addEventListener("click", dispatch);
  document.addEventListener("change", dispatch);
}
