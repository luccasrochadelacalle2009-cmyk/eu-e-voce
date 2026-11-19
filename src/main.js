import { initStore, subscribe, getState } from "./core/store.js";
import { initTheme, applyTheme } from "./core/theme.js";
import { initRouter, currentTab } from "./core/router.js";
import { initActions } from "./core/actions.js";
import { initAuth, subscribeAuth, isAuthenticated, getAuthState } from "./core/auth.js";
import { initSync } from "./core/sync.js";
import { initModal } from "./ui/modal.js";
import { renderPage, renderAuthPage } from "./ui/layout.js";
import * as home from "./features/home.js";
import * as calendar from "./features/calendar.js";
import * as memories from "./features/memories.js";
import * as plans from "./features/plans.js";
import * as letters from "./features/letters.js";
import * as connect from "./features/connect.js";
import * as journal from "./features/journal.js";
import * as music from "./features/music.js";
import * as places from "./features/places.js";
import * as more from "./features/more.js";
import * as settings from "./features/settings.js";
import * as auth from "./features/auth.js";

const PAGE_MODULES = {
  home,
  calendar,
  memories,
  connect,
  more,
  plans,
  letters,
  journal,
  music,
  places,
  settings
};

function renderApp() {
  const authState = getAuthState();
  if (!authState.ready || !isAuthenticated() || authState.screen) {
    renderAuthPage(auth.render());
    return;
  }
  const page = PAGE_MODULES[currentTab()] || home;
  renderPage(page.render());
}

initStore();
initTheme();
initAuth();
initSync();
initModal();
initActions();
subscribe(renderApp);
subscribeAuth(renderApp);
subscribe(() => applyTheme(getState().theme));
initRouter(renderApp);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
