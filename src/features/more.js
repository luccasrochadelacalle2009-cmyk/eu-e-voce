import { header } from "../ui/layout.js";

const COLLECTION_TILES = [
  ["plans", "✦", "Nossos planos", "Ideias para viver juntos"],
  ["letters", "✉", "Cartinhas", "Mensagens especiais"],
  ["journal", "📖", "Diário", "Registros do cotidiano"],
  ["music", "♫", "Nossas músicas", "A trilha sonora de vocês"],
  ["places", "⌖", "Mapa de memórias", "Lugares especiais"]
];

export function render() {
  let html = header(
    "NOSSO UNIVERSO, EM CADA DETALHE",
    "Mais espaços",
    "Outras formas de guardar, planejar e celebrar a história de vocês.",
    '<span class="pill">✦ 6 espaços</span>'
  );

  html += '<div class="section-head"><h2>Coleções</h2></div><div class="grid">';
  COLLECTION_TILES.forEach(([target, icon, title, note]) => {
    html += '<button type="button" class="tile" data-action="go" data-arg="' + target + '">' +
      '<span class="emoji" aria-hidden="true">' + icon + "</span><b>" + title + "</b><small>" + note + "</small></button>";
  });
  html += "</div>";

  html += '<div class="section-head"><h2>Preferências</h2></div><div class="grid">' +
    '<button type="button" class="tile" data-action="go" data-arg="settings">' +
    '<span class="emoji" aria-hidden="true">⚙</span><b>Configurações</b><small>Perfil, tema e backup</small></button></div>';
  return html;
}

export const actions = {};
