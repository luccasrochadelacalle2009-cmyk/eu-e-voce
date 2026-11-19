import { PAGES, PAGE_TITLES } from "./constants.js";
import { $, scrollTop } from "./utils.js";
import { closeModal } from "../ui/modal.js";

let current = "home";
let previous = "home";
let onChange = () => {};
let internalNavigation = false;

function tabFromHash() {
  const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
  return PAGES.includes(raw) ? raw : "home";
}

export function currentTab() {
  return current;
}

export function backTarget() {
  return previous && previous !== current && PAGES.includes(previous) ? previous : "home";
}

function apply(tab, fromHistory = false) {
  if (!fromHistory && tab !== current) previous = current;
  current = tab;
  document.title = "US · " + (PAGE_TITLES[tab] || "Our Universe");
  closeModal(true);
  onChange(tab);
  scrollTop();
  const heading = $("app")?.querySelector(".page-title");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

export function go(tab) {
  const target = PAGES.includes(tab) ? tab : "home";
  if (target === current) return;
  if (location.hash !== "#" + target) {
    internalNavigation = true;
    location.hash = target;
  } else {
    apply(target);
  }
}

export function initRouter(callback) {
  onChange = callback;
  window.addEventListener("hashchange", () => {
    const fromHistory = !internalNavigation;
    internalNavigation = false;
    apply(tabFromHash(), fromHistory);
  });
  if (!location.hash || !PAGES.includes(location.hash.replace(/^#\/?/, ""))) {
    history.replaceState(null, "", location.pathname + location.search + "#home");
  }
  apply(tabFromHash(), true);
}
