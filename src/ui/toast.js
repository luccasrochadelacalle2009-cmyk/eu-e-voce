import { $ } from "../core/utils.js";

let toastTimer;

export function notify(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = String(message ?? "");
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
