import { header } from "../ui/layout.js";
import { getState } from "../core/store.js";
import {
  daysTogether,
  dayIndex,
  esc,
  fmtDate,
  formatToday,
  iso
} from "../core/utils.js";
import { QUESTIONS } from "../core/constants.js";

export function dailyQuestion() {
  return QUESTIONS[dayIndex() % QUESTIONS.length];
}

function recentActivity() {
  const state = getState();
  const pool = [];
  const add = (list, label, target, title) => {
    const item = list[list.length - 1];
    if (item) {
      pool.push({
        label,
        target,
        title: title(item),
        date: fmtDate(item.d || ""),
        sort: String(item.updatedAt || item.createdAt || "")
      });
    }
  };
  add(state.journal, "Diário", "journal", item => item.t || "Registro");
  add(state.wall, "Memória", "memories", item => item.t || "Uma lembrança");
  add(state.letters, "Cartinha", "letters", item => item.t || "Uma cartinha");
  add(state.music, "Música", "music", item => item.name || "Uma música");

  pool.sort((a, b) => b.sort.localeCompare(a.sort));
  const items = pool.slice(0, 2);
  let html = '<div class="section-head"><h2>Atividade recente</h2></div>';
  if (!items.length) {
    return html + '<section class="card soft empty compact"><div class="big">✧</div><b>Nada por aqui ainda</b><p class="muted">O que vocês registrarem aparece neste espaço.</p></section>';
  }
  html += '<div class="activity-list">';
  items.forEach(item => {
    html += '<button type="button" class="activity" data-action="go" data-arg="' + item.target + '">' +
      '<span class="activity-kind">' + esc(item.label) + "</span>" +
      '<span class="list-main"><b>' + esc(item.title) + "</b>" +
      (item.date ? "<small>" + esc(item.date) + "</small>" : "") + "</span>" +
      '<span aria-hidden="true">→</span></button>';
  });
  return html + "</div>";
}

export function render() {
  const state = getState();
  const days = daysTogether(state.since);
  const today = iso(new Date());
  const next = state.events
    .filter(event => event.d && event.d >= today)
    .sort((a, b) => a.d.localeCompare(b.d))[0];

  let html = header(
    formatToday(),
    "Um lugar só nosso.",
    "Pequenos momentos também constroem grandes histórias.",
    '<span class="pill">✦ Nosso espaço</span>'
  );

  html += '<section class="hero" aria-label="Resumo do casal">' +
    '<div class="hero-top"><span class="hero-mark" aria-hidden="true">✧</span><span class="eyebrow">FEITO DE VOCÊ + EU</span></div>' +
    "<h1>" + esc(state.n1 || "Você") + ' <span class="hero-sep" aria-hidden="true">✦</span> ' + esc(state.n2 || "Sua pessoa") + "</h1>" +
    (days !== null
      ? '<div class="hero-count"><strong>' + days + "</strong><span>dias juntos</span></div>"
      : '<p class="hero-note">Configurem a data de vocês para começar a contar.</p>') +
    '<div class="hero-foot">' + (state.since ? "Desde " + fmtDate(state.since) : "Nosso universo começa aqui.") + "</div>" +
    "</section>";

  html += '<div class="section-head"><div><div class="eyebrow">EM DESTAQUE</div><h2>Próximo encontro</h2></div>' +
    '<button type="button" class="link-btn" data-action="go" data-arg="calendar">Ver agenda →</button></div>';
  html += '<section class="card"><div class="spotlight-body"><div class="spotlight-icon" aria-hidden="true">♡</div><div class="list-main">' +
    (next
      ? "<b>" + esc(next.t) + "</b><small>" + fmtDate(next.d) +
        (next.time ? " · " + esc(next.time) : "") +
        (next.by ? " · " + esc(next.by) : "") + "</small>"
      : "<b>Ainda sem planos na agenda</b><small>Quando agendarem algo, aparece aqui.</small>") +
    '</div><button type="button" class="btn secondary small" data-action="go" data-arg="calendar">' +
    (next ? "Abrir" : "Agendar") + "</button></div></section>";

  html += '<div class="section-head"><h2>Nosso resumo</h2></div><div class="stats">' +
    '<div class="stat"><strong>' + state.wall.length + "</strong><span>memórias</span></div>" +
    '<div class="stat"><strong>' + state.plans.filter(plan => plan && plan.done).length + "</strong><span>planos feitos</span></div>" +
    '<div class="stat"><strong>' + state.letters.length + "</strong><span>cartinhas</span></div>" +
    '<div class="stat"><strong>' + state.journal.length + "</strong><span>registros</span></div></div>";

  html += '<div class="section-head"><h2>Acessos rápidos</h2></div><div class="grid quick">' +
    '<button type="button" class="tile" data-action="go" data-arg="memories"><span class="emoji" aria-hidden="true">📷</span><b>Guardar memória</b><small>Registrar um momento</small></button>' +
    '<button type="button" class="tile" data-action="go" data-arg="plans"><span class="emoji" aria-hidden="true">✦</span><b>Fazer planos</b><small>O que queremos viver</small></button>' +
    '<button type="button" class="tile" data-action="go" data-arg="letters"><span class="emoji" aria-hidden="true">✉</span><b>Escrever carta</b><small>Uma mensagem especial</small></button>' +
    '<button type="button" class="tile" data-action="go" data-arg="journal"><span class="emoji" aria-hidden="true">📖</span><b>Nosso diário</b><small>Como foi o dia?</small></button></div>';

  html += recentActivity();
  html += '<div class="section-head"><h2>Uma pergunta para hoje</h2></div>' +
    '<section class="card question-card"><p>' + esc(dailyQuestion()) + '</p>' +
    '<button type="button" class="btn secondary small" data-action="go" data-arg="connect">Responder juntos</button></section>';
  return html;
}

export const actions = {};
