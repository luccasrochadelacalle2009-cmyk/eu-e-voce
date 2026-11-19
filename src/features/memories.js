import { header } from "../ui/layout.js";
import { authorNote } from "../ui/author.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cleanText, esc, fmtDate, iso, safeImage } from "../core/utils.js";
import { notify } from "../ui/toast.js";
import { LIMITS } from "../core/constants.js";

export function render() {
  const state = getState();
  let html = header(
    "PEQUENOS INSTANTES, GRANDES HISTÓRIAS",
    "Nossas memórias",
    "Um álbum dos momentos que queremos guardar.",
    '<span class="pill">' + state.wall.length + " " +
      (state.wall.length === 1 ? "memória" : "memórias") + "</span>"
  );

  html += '<section class="card"><h2>Adicionar memória</h2>' +
    '<label for="memoryTitle">Nome do momento</label><input id="memoryTitle" placeholder="Dê um nome para esse momento">' +
    '<label for="memoryText">História</label><textarea id="memoryText" placeholder="Conte um pouquinho sobre ele..."></textarea>' +
    '<label for="memoryFile">Fotografia (opcional)</label><input id="memoryFile" type="file" accept="image/*">' +
    '<button type="button" class="btn full" data-action="add-memory">Guardar memória</button>' +
    '<p class="small-note mt-xs">As imagens são reduzidas antes de serem salvas para economizar espaço.</p></section>';

  if (!state.wall.length) {
    html += '<div class="empty"><div class="big">✧</div><b>O álbum de vocês começa aqui</b><p class="muted">Adicione a primeira lembrança.</p></div>';
    return html;
  }

  html += '<div class="section-head"><h2>Álbum</h2><span class="muted">mais recentes primeiro</span></div><div class="photo-grid">';
  state.wall.slice().reverse().forEach((memory, reverseIndex) => {
    const index = state.wall.length - 1 - reverseIndex;
    const image = safeImage(memory.img);
    html += '<article class="memory">' +
      (image
        ? '<img src="' + image + '" alt="' + esc(memory.t) + '">'
        : '<div class="memory-placeholder" aria-hidden="true">✧</div>') +
      '<div class="memory-body"><b>' + esc(memory.t) + "</b>" +
      (memory.text ? "<p>" + esc(memory.text) + "</p>" : "") +
      "<small>" + esc(fmtDate(memory.d)) + "</small>" + authorNote(memory) + "<div>" +
      '<button type="button" class="btn ghost small" data-action="remove" data-key="wall" data-index="' + index +
      '" aria-label="Excluir memória ' + esc(memory.t) + '">Excluir</button></div></div></article>';
  });
  return html + "</div>";
}

function addMemory() {
  const title = ($("memoryTitle")?.value || "").trim();
  const text = ($("memoryText")?.value || "").trim();
  const file = $("memoryFile")?.files?.[0];
  if (!title && !text && !file) return notify("Adicione um título, texto ou fotografia.");

  const finish = image => commit(state => {
    state.wall.push(touch({
      t: cleanText(title || "Uma lembrança", 200),
      text: cleanText(text),
      img: safeImage(image),
      d: iso(new Date())
    }));
  }, "Memória guardada.");

  if (!file) return finish("");
  if (file.size > LIMITS.imageSourceBytes) return notify("Escolha uma imagem menor que 12 MB.");
  notify("Processando imagem…");

  const reader = new FileReader();
  reader.onerror = () => notify("Não foi possível ler a imagem.");
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => notify("Não foi possível abrir a imagem.");
    image.onload = () => {
      try {
        const scale = Math.min(1, 1000 / image.width, 1000 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.78));
      } catch {
        notify("Não foi possível processar a imagem.");
      }
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

export const actions = {
  "add-memory": addMemory
};
