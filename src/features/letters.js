import { header } from "../ui/layout.js";
import { backTarget } from "../core/router.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cleanText, esc, fmtDate, iso } from "../core/utils.js";
import { notify } from "../ui/toast.js";
import { authorNote } from "../ui/author.js";

export function render() {
  const state = getState();
  let html = header(
    "PALAVRAS QUE FICAM",
    "Cartinhas",
    "Mensagens para guardar, reler e abrir no momento certo.",
    '<span class="pill">' + state.letters.length + " " +
      (state.letters.length === 1 ? "cartinha" : "cartinhas") + "</span>",
    backTarget()
  );

  html += '<section class="card"><h2>Escrever uma cartinha</h2>' +
    '<label for="letterTitle">Título</label><input id="letterTitle" placeholder="Título da cartinha">' +
    '<div class="form-row"><div><label for="letterFrom">De quem?</label><input id="letterFrom" value="' +
    esc(state.n1 || "") + '" placeholder="Seu nome"></div>' +
    '<div><label for="letterDate">Abrir em (opcional)</label><input id="letterDate" type="date" min="' + iso(new Date()) + '"></div></div>' +
    '<label for="letterBody">Mensagem</label><textarea id="letterBody" placeholder="Escreva com carinho..."></textarea>' +
    '<button type="button" class="btn full" data-action="add-letter">Guardar cartinha</button></section>';

  if (!state.letters.length) {
    return html + '<div class="empty"><div class="big">✉</div><b>Nenhuma cartinha por enquanto</b><p class="muted">Escreva a primeira mensagem especial.</p></div>';
  }

  state.letters.slice().reverse().forEach((letter, reverseIndex) => {
    const index = state.letters.length - 1 - reverseIndex;
    const locked = letter.unlock && letter.unlock > iso(new Date());
    html += '<section class="card"><div class="row"><div><span class="pill">' +
      (locked ? "🔒 Guardada para o futuro" : "💌 Disponível") + '</span>' +
      '<h3 class="mt-sm mb-0">' + esc(letter.t) + "</h3></div>" +
      '<button type="button" class="btn ghost small" data-action="remove" data-key="letters" data-index="' + index +
      '" aria-label="Excluir cartinha ' + esc(letter.t) + '">Excluir</button></div>' +
      (locked
        ? '<p class="muted mt-sm">Poderá ser aberta em ' + fmtDate(letter.unlock) + ".</p>"
        : '<div class="letter"><p>' + esc(letter.b) + "</p><small>— " + esc(letter.f) + " · " + esc(fmtDate(letter.d)) + "</small></div>") +
      authorNote(letter) +
      "</section>";
  });
  return html;
}

function addLetter() {
  const body = ($("letterBody")?.value || "").trim();
  if (!body) return notify("Escreva a mensagem da cartinha.");
  const unlock = ($("letterDate")?.value || "").trim();
  if (unlock && unlock < iso(new Date())) return notify("Escolha uma data futura.");
  return commit(state => {
    state.letters.push(touch({
      t: cleanText($("letterTitle")?.value, 200) || "Uma cartinha",
      f: cleanText($("letterFrom")?.value, 120) || "Com carinho",
      b: cleanText(body),
      d: iso(new Date()),
      unlock: /^\d{4}-\d{2}-\d{2}$/.test(unlock) ? unlock : ""
    }));
  }, "Cartinha guardada.");
}

export const actions = {
  "add-letter": addLetter
};
