import { header } from "../ui/layout.js";
import { backTarget } from "../core/router.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cleanText, esc } from "../core/utils.js";
import { notify } from "../ui/toast.js";
import { PLAN_CATEGORIES, PLAN_PRIORITIES } from "../core/constants.js";

function options(values) {
  return values.map(value => "<option>" + esc(value) + "</option>").join("");
}

export function render() {
  const state = getState();
  const done = state.plans.filter(plan => plan && plan.done).length;
  const percent = state.plans.length ? Math.round(done / state.plans.length * 100) : 0;

  let html = header(
    "COISAS QUE QUEREMOS VIVER",
    "Nossos planos",
    "Uma lista de ideias, desejos e experiências para fazer a dois.",
    '<span class="pill">' + done + "/" + state.plans.length + " feitos</span>",
    backTarget()
  );

  html += '<section class="card"><h2>Novo plano</h2>' +
    '<label for="planTitle">O que queremos fazer?</label><input id="planTitle" placeholder="Ex.: viagem, jantar, passeio">' +
    '<div class="form-row"><div><label for="planCategory">Categoria</label><select id="planCategory">' +
    options(PLAN_CATEGORIES) + '</select></div>' +
    '<div><label for="planPriority">Prioridade</label><select id="planPriority">' +
    options(PLAN_PRIORITIES) + '</select></div></div>' +
    '<label for="planNote">Detalhes (opcional)</label><textarea id="planNote" class="small-textarea" placeholder="Alguma ideia sobre esse plano?"></textarea>' +
    '<button type="button" class="btn full" data-action="add-plan">Adicionar à lista</button></section>';

  if (!state.plans.length) {
    return html + '<div class="empty"><div class="big">✦</div><b>O que vocês querem viver juntos?</b><p class="muted">Comecem adicionando uma ideia.</p></div>';
  }

  html += '<section class="card"><div class="row"><b>Progresso dos planos</b><span class="pill">' + percent +
    '%</span></div><div class="progress" role="progressbar" aria-valuenow="' + done +
    '" aria-valuemin="0" aria-valuemax="' + state.plans.length + '"><span style="width:' + percent + '%"></span></div></section>';

  state.plans.forEach((plan, index) => {
    html += '<section class="card"><div class="row"><div class="list-main">' +
      '<b class="plan-title ' + (plan.done ? "done" : "") + '">' + esc(plan.t) + "</b>" +
      "<small>" + esc(plan.cat) + " · " + esc(plan.priority) + "</small>" +
      (plan.note ? "<small>" + esc(plan.note) + "</small>" : "") + "</div>" +
      '<button type="button" class="btn ' + (plan.done ? "secondary" : "ghost") + ' small" data-action="toggle-plan" data-index="' + index + '">' +
      (plan.done ? "Feito ✓" : "Concluir") + "</button></div>" +
      '<div class="text-right mt-xs"><button type="button" class="btn ghost small" data-action="remove" data-key="plans" data-index="' + index +
      '" aria-label="Excluir plano ' + esc(plan.t) + '">Excluir</button></div></section>';
  });
  return html;
}

function addPlan() {
  const title = ($("planTitle")?.value || "").trim();
  if (!title) return notify("Dê um nome para o plano.");
  return commit(state => {
    state.plans.push(touch({
      t: cleanText(title, 200),
      cat: cleanText($("planCategory")?.value, 60),
      priority: cleanText($("planPriority")?.value, 60),
      note: cleanText($("planNote")?.value),
      done: false
    }));
  }, "Plano adicionado.");
}

function togglePlan(index) {
  const position = Number(index);
  return commit(state => {
    const plan = state.plans[position];
    if (!plan) return false;
    plan.done = !plan.done;
    touch(plan);
  });
}

export const actions = {
  "add-plan": addPlan,
  "toggle-plan": togglePlan
};
