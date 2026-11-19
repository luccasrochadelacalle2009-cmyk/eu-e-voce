import { THEMES } from "./constants.js";
import { getState, commit } from "./store.js";
import { $, $$ } from "./utils.js";

const darkQuery = matchMedia("(prefers-color-scheme: dark)");

export function themeMeta(theme) {
  if (theme === "dark") return { icon: "☾", label: "Escuro" };
  if (theme === "system") return { icon: "◐", label: "Automático" };
  return { icon: "☀", label: "Claro" };
}

function prefersDark() {
  return getState().theme === "dark" ||
    (getState().theme === "system" && darkQuery.matches);
}

function updateMetaTheme() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", prefersDark() ? "#0b111a" : "#1769AA");
}

export function syncThemeUI() {
  $$("[data-theme-option]").forEach(button => {
    const active = button.dataset.themeOption === getState().theme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  const button = $("themeToggle");
  if (!button) return;
  const meta = themeMeta(getState().theme);
  const icon = button.querySelector("span");
  if (icon) icon.textContent = meta.icon;
  button.setAttribute("aria-label", "Tema: " + meta.label + ". Toque para alternar.");
  button.title = "Tema: " + meta.label;
}

export function applyTheme(theme) {
  const value = THEMES.includes(theme) ? theme : "light";
  const root = document.documentElement;
  root.classList.add("theme-switching");
  if (value === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", value);
  void root.offsetWidth;
  root.classList.remove("theme-switching");
  updateMetaTheme();
  syncThemeUI();
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  const changed = commit(state => {
    if (state.theme === theme) return false;
    state.theme = theme;
  }, "Tema " + themeMeta(theme).label.toLowerCase() + " ativado.");
  if (changed) applyTheme(theme);
}

export function cycleTheme() {
  const index = THEMES.indexOf(getState().theme);
  setTheme(THEMES[(index + 1) % THEMES.length]);
}

export function initTheme() {
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", updateMetaTheme);
  else if (darkQuery.addListener) darkQuery.addListener(updateMetaTheme);
  applyTheme(getState().theme);
}
