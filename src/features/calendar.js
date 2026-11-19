import { header } from "../ui/layout.js";
import { authorNote } from "../ui/author.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cap, cleanText, esc, fmtDate, isISODate, iso } from "../core/utils.js";
import { notify } from "../ui/toast.js";

let ym = new Date();
let selectedDate = iso(new Date());

const WEEKDAYS = [
  ["D", "Domingo"], ["S", "Segunda"], ["T", "Terça"], ["Q", "Quarta"],
  ["Q", "Quinta"], ["S", "Sexta"], ["S", "Sábado"]
];

export function render() {
  const state = getState();
  const year = ym.getFullYear();
  const month = ym.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = iso(new Date());
  const label = cap(ym.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));

  let html = header(
    "TEMPO DE QUALIDADE",
    "Nossa agenda",
    "Datas especiais, encontros e planos.",
    '<span class="pill">' + state.events.length + " " +
      (state.events.length === 1 ? "compromisso" : "compromissos") + "</span>"
  );

  html += '<section class="card"><div class="calendar-head">' +
    '<button type="button" class="icon-btn small" data-action="month" data-arg="-1" aria-label="Mês anterior">‹</button>' +
    '<div class="month-label"><div class="eyebrow">MÊS</div><b>' + label + "</b></div>" +
    '<button type="button" class="icon-btn small" data-action="month" data-arg="1" aria-label="Próximo mês">›</button></div><div class="calendar">';

  WEEKDAYS.forEach(([short, full]) => {
    html += '<div class="weekday" aria-label="' + full + '">' + short + "</div>";
  });
  for (let index = 0; index < firstDay; index++) html += '<div class="blank" aria-hidden="true"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const key = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const hasEvent = state.events.some(event => event.d === key);
    html += '<button type="button" class="day ' + (key === today ? "today" : "") +
      " " + (key === selectedDate ? "selected" : "") + " " + (hasEvent ? "has-event" : "") +
      '" data-action="select-date" data-arg="' + key + '" aria-label="Dia ' + day +
      (hasEvent ? " com compromisso" : "") + '" aria-pressed="' +
      (key === selectedDate ? "true" : "false") + '">' + day + "</button>";
  }
  html += "</div></section>";

  html += '<section class="card"><div class="eyebrow">DIA SELECIONADO</div><h2>' + fmtDate(selectedDate) + "</h2>";
  const events = state.events
    .map((event, index) => ({ event, index }))
    .filter(entry => entry.event.d === selectedDate);
  if (events.length) {
    events.forEach(({ event, index }) => {
      html += '<div class="list-item"><div class="list-main"><b>' + esc(event.t) + "</b><small>" +
        esc(event.time || "Sem horário") + " · " + esc(event.by || "Nosso evento") + "</small>" +
        authorNote(event) + "</div>" +
        '<button type="button" class="btn ghost small" data-action="remove" data-key="events" data-index="' + index +
        '" aria-label="Excluir compromisso ' + esc(event.t) + '">Excluir</button></div>';
    });
  } else {
    html += '<p class="muted">Nenhum compromisso neste dia.</p>';
  }
  html += "<hr><h3>Adicionar compromisso</h3>" +
    '<label for="eventTitle">Nome do compromisso</label><input id="eventTitle" placeholder="Ex.: jantar, cinema, aniversário">' +
    '<div class="form-row"><div><label for="eventTime">Horário</label><input id="eventTime" type="time"></div>' +
    '<div><label for="eventBy">Responsável</label><input id="eventBy" placeholder="Opcional"></div></div>' +
    '<button type="button" class="btn full" data-action="add-event">Salvar na agenda</button></section>';
  return html;
}

function changeMonth(delta) {
  const amount = Number(delta);
  if (!Number.isFinite(amount)) return;
  ym = new Date(ym.getFullYear(), ym.getMonth() + amount, 1);
}

function selectDate(key) {
  if (!isISODate(key)) return;
  selectedDate = key;
  const date = new Date(key + "T00:00:00");
  ym = new Date(date.getFullYear(), date.getMonth(), 1);
}

function addEvent() {
  const title = ($("eventTitle")?.value || "").trim();
  if (!title) return notify("Escreva o nome do compromisso.");
  const date = isISODate(selectedDate) ? selectedDate : iso(new Date());
  const time = /^\d{2}:\d{2}$/.test($("eventTime")?.value || "") ? $("eventTime").value : "";
  return commit(state => {
    state.events.push(touch({
      d: date,
      t: cleanText(title, 200),
      time,
      by: cleanText($("eventBy")?.value, 120)
    }));
  }, "Compromisso adicionado.");
}

export const actions = {
  month: changeMonth,
  "select-date": selectDate,
  "add-event": addEvent
};
