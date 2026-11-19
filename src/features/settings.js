import { header } from "../ui/layout.js";
import { backTarget, go } from "../core/router.js";
import { commit, getState, importState, resetState } from "../core/store.js";
import { $, cleanText, esc, isISODate } from "../core/utils.js";
import { notify } from "../ui/toast.js";
import { openModal } from "../ui/modal.js";

export function render() {
  const state = getState();
  let html = header(
    "PREFERÊNCIAS",
    "Configurações",
    "Personalizem o espaço de vocês.",
    '<span class="pill">✦ US</span>',
    backTarget()
  );

  html += '<section class="card"><h2>Perfil do casal</h2>' +
    '<label for="cfgN1">Seu nome</label><input id="cfgN1" value="' + esc(state.n1) + '" placeholder="Seu nome">' +
    '<label for="cfgN2">Nome da outra pessoa</label><input id="cfgN2" value="' + esc(state.n2) + '" placeholder="Nome da pessoa">' +
    '<label for="cfgSince">Data de início do relacionamento</label><input id="cfgSince" type="date" value="' + esc(state.since) + '">' +
    '<button type="button" class="btn full" data-action="save-profile">Salvar perfil</button></section>';

  html += '<section class="card"><h2>Aparência</h2><p class="muted">Escolha como prefere visualizar o US. O modo automático acompanha o aparelho.</p>' +
    '<div class="segmented" role="group" aria-label="Tema do aplicativo">' +
    '<button type="button" class="btn secondary theme-option" data-theme-option="light" data-action="set-theme" data-arg="light" aria-pressed="false">☀ Claro</button>' +
    '<button type="button" class="btn secondary theme-option" data-theme-option="dark" data-action="set-theme" data-arg="dark" aria-pressed="false">☾ Escuro</button>' +
    '<button type="button" class="btn secondary theme-option" data-theme-option="system" data-action="set-theme" data-arg="system" aria-pressed="false">◐ Automático</button>' +
    "</div></section>";

  html += '<section class="card"><h2>Seus dados</h2><p class="muted">As informações ficam armazenadas localmente neste navegador. Exporte uma cópia de segurança antes de trocar de aparelho ou limpar os dados do navegador.</p>' +
    '<div class="actions"><button type="button" class="btn secondary" data-action="export-data">Exportar backup</button>' +
    '<label class="btn ghost" for="backupFile">Importar backup</label>' +
    '<input id="backupFile" class="file-sr" type="file" accept="application/json" data-action="import-data"></div>' +
    "<hr><button type=\"button\" class=\"btn danger small\" data-action=\"clear-data\">Apagar dados deste aparelho</button></section>";

  html += '<p class="small-note text-right mt-sm">US · Our Universe · Feito para guardar o que importa.</p>';
  return html;
}

function saveProfile() {
  const since = ($("cfgSince")?.value || "").trim();
  if (since && !isISODate(since)) return notify("Escolha uma data válida.");
  return commit(state => {
    state.n1 = cleanText($("cfgN1")?.value, 120);
    state.n2 = cleanText($("cfgN2")?.value, 120);
    state.since = isISODate(since) ? since : "";
  }, "Perfil atualizado.");
}

function exportData() {
  try {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "us-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    notify("Backup preparado.");
  } catch {
    notify("Não foi possível preparar o backup.");
  }
}

function importData(arg, element) {
  const input = element;
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => notify("Não foi possível ler o arquivo.");
  reader.onload = () => importState(reader.result);
  reader.readAsText(file);
  input.value = "";
}

function clearData() {
  openModal({
    title: "Apagar dados deste aparelho?",
    description: "Todas as memórias, cartinhas, planos e preferências salvas neste navegador serão removidas. Esta ação não pode ser desfeita.",
    confirmLabel: "Apagar dados",
    danger: true,
    onConfirm: () => {
      resetState();
      go("home");
      notify("Dados locais apagados.");
    }
  });
}

export const actions = {
  "save-profile": saveProfile,
  "export-data": exportData,
  "import-data": importData,
  "clear-data": clearData
};
