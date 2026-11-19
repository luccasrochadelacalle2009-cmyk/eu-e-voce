import { $, esc } from "../core/utils.js";

let previousFocus = null;
let confirmCallback = null;
let closeTimer = null;

export function isModalOpen() {
  const host = $("modalHost");
  return !!host && host.classList.contains("open");
}

export function closeModal(immediate = false) {
  const host = $("modalHost");
  if (!host || !host.classList.contains("open")) return;
  host.classList.remove("open");
  document.body.classList.remove("modal-open");
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => { host.innerHTML = ""; }, immediate ? 0 : 190);
  if (previousFocus && document.contains(previousFocus)) {
    previousFocus.focus({ preventScroll: true });
  }
  previousFocus = null;
  confirmCallback = null;
}

export function openModal(options) {
  const host = $("modalHost");
  if (!host) return;
  clearTimeout(closeTimer);
  host.innerHTML = "";
  previousFocus = document.activeElement;
  confirmCallback = options.onConfirm;
  const danger = !!options.danger;
  host.innerHTML =
    '<div class="modal-backdrop" data-modal-action="cancel"></div>' +
    '<section class="modal' + (danger ? " danger" : "") + '" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalDesc">' +
      '<div class="modal-icon" aria-hidden="true">' + (danger ? "!" : "✦") + "</div>" +
      '<h2 id="modalTitle">' + esc(options.title) + "</h2>" +
      '<p id="modalDesc">' + esc(options.description) + "</p>" +
      '<div class="modal-actions">' +
        '<button type="button" class="btn ghost" data-modal-action="cancel">' + esc(options.cancelLabel || "Cancelar") + "</button>" +
        '<button type="button" class="btn ' + (danger ? "danger" : "") + '" data-modal-action="confirm">' + esc(options.confirmLabel || "Confirmar") + "</button>" +
      "</div>" +
    "</section>";
  host.classList.add("open");
  document.body.classList.add("modal-open");
  const target = host.querySelector(".modal-actions [data-modal-action='cancel']") ||
    host.querySelector("[data-modal-action='confirm']");
  if (target) target.focus({ preventScroll: true });
}

export function initModal() {
  document.addEventListener("click", event => {
    if (!isModalOpen()) return;
    const trigger = event.target.closest("[data-modal-action]");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    const action = trigger.dataset.modalAction;
    if (action === "confirm") {
      const callback = confirmCallback;
      closeModal();
      if (typeof callback === "function") callback();
    } else {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (!isModalOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const host = $("modalHost");
    const focusable = Array.from(host.querySelectorAll("button:not([disabled])"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
