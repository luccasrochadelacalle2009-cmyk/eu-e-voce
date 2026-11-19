import { header } from "../ui/layout.js";
import { backTarget } from "../core/router.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cleanText, esc, safeUrl } from "../core/utils.js";
import { notify } from "../ui/toast.js";

export function render() {
  const state = getState();
  let html = header(
    "A TRILHA SONORA DE VOCÊS",
    "Nossas músicas",
    "Músicas que lembram pessoas, lugares e momentos.",
    '<span class="pill">' + state.music.length + " " +
      (state.music.length === 1 ? "música" : "músicas") + "</span>",
    backTarget()
  );

  html += '<section class="card"><h2>Adicionar música</h2>' +
    '<div class="form-row"><div><label for="musicName">Nome da música</label><input id="musicName" placeholder="Nome da música"></div>' +
    '<div><label for="musicArtist">Artista</label><input id="musicArtist" placeholder="Artista"></div></div>' +
    '<label for="musicLink">Link (opcional)</label><input id="musicLink" type="url" placeholder="Spotify, YouTube etc.">' +
    '<label for="musicMeaning">Por que é especial?</label><textarea id="musicMeaning" placeholder="Conte a história dessa música..."></textarea>' +
    '<button type="button" class="btn full" data-action="add-music">Adicionar à coleção</button></section>';

  if (!state.music.length) {
    return html + '<div class="empty"><div class="big">♫</div><b>Qual é a música de vocês?</b><p class="muted">Guardem aqui as que têm significado.</p></div>';
  }

  state.music.forEach((music, index) => {
    const link = safeUrl(music.link);
    html += '<section class="card"><div class="row"><div><h3 class="mb-0">' + esc(music.name) + "</h3>" +
      '<p class="muted mb-0">' + esc(music.artist) + "</p></div>" +
      '<button type="button" class="btn ghost small" data-action="remove" data-key="music" data-index="' + index +
      '" aria-label="Excluir música ' + esc(music.name) + '">Excluir</button></div>' +
      (music.meaning ? '<p class="mt-sm">' + esc(music.meaning) + "</p>" : "") +
      (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Abrir música ↗</a>' : "") +
      "</section>";
  });
  return html;
}

function addMusic() {
  const name = ($("musicName")?.value || "").trim();
  if (!name) return notify("Informe o nome da música.");
  const rawLink = ($("musicLink")?.value || "").trim();
  const link = safeUrl(rawLink);
  if (rawLink && !link) return notify("Informe um link iniciado por http:// ou https://.");
  return commit(state => {
    state.music.push(touch({
      name: cleanText(name, 200),
      artist: cleanText($("musicArtist")?.value, 120),
      link,
      meaning: cleanText($("musicMeaning")?.value)
    }));
  }, "Música adicionada.");
}

export const actions = {
  "add-music": addMusic
};
