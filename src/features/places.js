import { header } from "../ui/layout.js";
import { backTarget } from "../core/router.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cleanText, esc, fmtDate, isISODate } from "../core/utils.js";
import { notify } from "../ui/toast.js";

export function render() {
  const state = getState();
  let html = header(
    "LUGARES QUE FAZEM PARTE DA HISTÓRIA",
    "Mapa de memórias",
    "Guardem os lugares especiais e abram a localização no mapa.",
    '<span class="pill">' + state.places.length + " " +
      (state.places.length === 1 ? "lugar" : "lugares") + "</span>",
    backTarget()
  );

  html += '<section class="card"><h2>Novo lugar</h2>' +
    '<div class="form-row"><div><label for="placeName">Nome do lugar</label><input id="placeName" placeholder="Ex.: praia, café, praça"></div>' +
    '<div><label for="placeDate">Data (opcional)</label><input id="placeDate" type="date"></div></div>' +
    '<label for="placeAddress">Endereço ou cidade</label><input id="placeAddress" placeholder="Endereço ou cidade">' +
    '<label for="placeNote">O que aconteceu aqui?</label><textarea id="placeNote" class="small-textarea" placeholder="Conte a memória desse lugar..."></textarea>' +
    '<button type="button" class="btn full" data-action="add-place">Guardar lugar</button></section>';

  if (!state.places.length) {
    return html + '<div class="empty"><div class="big">⌖</div><b>Um mapa feito de lembranças</b><p class="muted">Adicione o primeiro lugar especial.</p></div>';
  }

  state.places.forEach((place, index) => {
    const mapUrl = "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(place.address || "");
    html += '<section class="card"><div class="row"><h3 class="mb-0">' + esc(place.name) + "</h3>" +
      '<button type="button" class="btn ghost small" data-action="remove" data-key="places" data-index="' + index +
      '" aria-label="Excluir lugar ' + esc(place.name) + '">Excluir</button></div>' +
      '<p class="muted mb-0 mt-xs">' + esc(place.address) +
      (place.date ? " · " + esc(fmtDate(place.date)) : "") + "</p>" +
      (place.note ? "<p>" + esc(place.note) + "</p>" : "") +
      '<a target="_blank" rel="noopener noreferrer" href="' + esc(mapUrl) + '">Ver localização ↗</a></section>';
  });
  return html;
}

function addPlace() {
  const name = ($("placeName")?.value || "").trim();
  const address = ($("placeAddress")?.value || "").trim();
  if (!name || !address) return notify("Informe o nome e a localização.");
  const date = ($("placeDate")?.value || "").trim();
  return commit(state => {
    state.places.push(touch({
      name: cleanText(name, 200),
      address: cleanText(address, 300),
      date: isISODate(date) ? date : "",
      note: cleanText($("placeNote")?.value)
    }));
  }, "Lugar guardado.");
}

export const actions = {
  "add-place": addPlace
};
