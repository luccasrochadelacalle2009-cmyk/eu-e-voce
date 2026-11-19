import { NAV_ITEMS } from "../core/constants.js";
import { $, esc } from "../core/utils.js";
import { currentTab } from "../core/router.js";
import { getState } from "../core/store.js";
import { syncThemeUI, themeMeta } from "../core/theme.js";

export function topbar() {
  const meta = themeMeta(getState().theme);
  return '<header class="topbar"><div class="topbar-inner">' +
    '<div class="brand" aria-label="US, Our Universe"><div class="brand-mark" aria-hidden="true">✧</div><div>US<small>OUR UNIVERSE</small></div></div>' +
    '<div class="top-actions">' +
      '<button type="button" id="themeToggle" class="icon-btn theme-toggle" data-action="cycle-theme" aria-label="Tema: ' + esc(meta.label) + '. Toque para alternar." title="Tema: ' + esc(meta.label) + '"><span aria-hidden="true">' + meta.icon + '</span></button>' +
      '<button type="button" class="icon-btn" data-action="go" data-arg="settings" aria-label="Abrir configurações" title="Configurações">⚙</button>' +
    "</div></div></header>";
}

export function header(eyebrow, title, subtitle, meta, back, action) {
  const backButton = back
    ? '<button type="button" class="back-btn" data-action="go" data-arg="' + esc(back) + '" aria-label="Voltar">←</button>'
    : "";
  return topbar() + '<div class="page-head">' + backButton + '<div class="head-copy">' +
    '<div class="eyebrow">' + esc(eyebrow) + "</div>" +
    '<h1 class="page-title">' + esc(title) + "</h1>" +
    (subtitle ? '<p class="page-sub">' + esc(subtitle) + "</p>" : "") +
    (meta ? '<div class="head-meta">' + meta + "</div>" : "") +
    "</div>" + (action ? '<div class="head-action">' + action + "</div>" : "") + "</div>";
}

export function renderNav() {
  const nav = $("nav");
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map(([id, icon, label]) => {
    const active = currentTab() === id;
    return '<button type="button" class="' + (active ? "active" : "") + '" data-action="go" data-arg="' + id + '"' +
      (active ? ' aria-current="page"' : "") + ">" +
      '<span class="nav-icon" aria-hidden="true">' + icon + '</span><span class="nav-label">' + label + "</span></button>";
  }).join("");
}

export function renderPage(html) {
  const app = $("app");
  if (!app) return;
  app.innerHTML = html;
  app.classList.remove("page-enter");
  void app.offsetWidth;
  app.classList.add("page-enter");
  renderNav();
  syncThemeUI();
}
