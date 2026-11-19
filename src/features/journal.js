import { header } from "../ui/layout.js";
import { backTarget } from "../core/router.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cleanText, esc, fmtDate, iso } from "../core/utils.js";
import { notify } from "../ui/toast.js";

export function render() {
  const state = getState();
  let html = header(
    "UM REGISTRO DOS NOSSOS DIAS",
    "Diário compartilhado",
    "Um espaço para registrar como foi o dia e o que vale lembrar.",
    '<span class="pill">' + state.journal.length + " " +
      (state.journal.length === 1 ? "registro" : "registros") + "</span>",
    backTarget()
  );

  html += '<section class="card"><h2>Novo registro</h2>' +
    '<label for="journalTitle">Título do dia</label><input id="journalTitle" placeholder="Ex.: um dia simples e bom">' +
    '<label for="journalBy">Quem está escrevendo?</label><input id="journalBy" value="' +
    esc(state.n1 || "") + '" placeholder="Seu nome">' +
    '<label for="journalText">O que aconteceu?</label><textarea id="journalText" placeholder="O que vale lembrar deste dia?"></textarea>' +
    '<button type="button" class="btn full" data-action="add-journal">Salvar no diário</button></section>';

  if (!state.journal.length) {
    return html + '<div class="empty"><div class="big">📖</div><b>Uma página em branco</b><p class="muted">Registrem aqui os detalhes do cotidiano.</p></div>';
  }

  state.journal.slice().reverse().forEach((entry, reverseIndex) => {
    const index = state.journal.length - 1 - reverseIndex;
    html += '<section class="card"><div class="row"><h3 class="mb-0">' + esc(entry.t) + "</h3>" +
      '<button type="button" class="btn ghost small" data-action="remove" data-key="journal" data-index="' + index +
      '" aria-label="Excluir registro ' + esc(entry.t) + '">Excluir</button></div>' +
      '<p class="muted mt-xs mb-0">' + esc(fmtDate(entry.d)) + " · " + esc(entry.by) + "</p>" +
      '<p class="pre-wrap mt-sm mb-0">' + esc(entry.text) + "</p></section>";
  });
  return html;
}

function addJournal() {
  const text = ($("journalText")?.value || "").trim();
  if (!text) return notify("Escreva alguma coisa antes de salvar.");
  return commit(state => {
    state.journal.push(touch({
      t: cleanText($("journalTitle")?.value, 200) || "Um dia nosso",
      by: cleanText($("journalBy")?.value, 120) || "Nós",
      text: cleanText(text),
      d: iso(new Date())
    }));
  }, "Registro salvo.");
}

export const actions = {
  "add-journal": addJournal
};
