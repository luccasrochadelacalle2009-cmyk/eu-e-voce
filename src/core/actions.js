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
import * as auth from "../features/auth.js";
import * as cloud from "../features/cloud.js";

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
  ...settings.actions,
  ...auth.actions,
  ...cloud.actions
};

function dispatch(event) {
  const element = event.target.closest("[data-action]");
  if (!element || element.closest(".modal-host")) return;
  // Um `change` dentro de um formulário não deve disparar a ação do formulário.
  // Apenas o elemento que possui a ação (ex.: input de arquivo) responde a `change`.
  if (event.type === "change" && element !== event.target) return;
  // Cliques em campos dentro de um formulário não devem enviá-lo.
  // A ação do formulário só responde ao evento `submit`.
  if (element.tagName === "FORM" && event.type !== "submit") return;
  const handler = registry[element.dataset.action];
  if (!handler) return;
  event.preventDefault();
  handler(element.dataset.arg, element, event);
}

export function initActions() {
  document.addEventListener("click", dispatch);
  document.addEventListener("change", dispatch);
  document.addEventListener("submit", dispatch);

  // Mantém o foco no campo mesmo se algo tentar desfocá-lo ao terminar o clique.
  const keepFocus = event => {
    const field = event.target.closest?.(".auth-card input, .auth-card textarea");
    if (!field) return;
    queueMicrotask(() => {
      if (document.contains(field)) field.focus({ preventScroll: true });
    });
  };
  document.addEventListener("pointerup", keepFocus);
  document.addEventListener("mouseup", keepFocus);
  document.addEventListener("touchend", keepFocus);
}
