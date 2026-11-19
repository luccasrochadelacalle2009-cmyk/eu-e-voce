import { header } from "../ui/layout.js";
import { commit, getState, touch } from "../core/store.js";
import { $, cleanText, dayIndex, esc, iso } from "../core/utils.js";
import { notify } from "../ui/toast.js";
import { DAILY_CHALLENGES, QUIZ_QUESTIONS } from "../core/constants.js";
import { dailyQuestion } from "./home.js";

function challengeOfDay() {
  return DAILY_CHALLENGES[dayIndex() % DAILY_CHALLENGES.length];
}

export function render() {
  const state = getState();
  const today = iso(new Date());
  const answers = state.answers.filter(answer => answer.day === today);

  let html = header(
    "UM JEITO DE SE CONHECER SEMPRE MAIS",
    "Nossa conexão",
    "Perguntas, descobertas e pequenos desafios para fazer juntos.",
    '<span class="pill">♡ a dois</span>'
  );

  html += '<section class="card"><span class="pill">PERGUNTA DO DIA</span>' +
    '<h2 class="mt-sm mb-0">' + esc(dailyQuestion()) + "</h2>" +
    '<label for="answerText">Sua resposta</label><textarea id="answerText" placeholder="Escreva sua resposta..."></textarea>' +
    '<label for="answerBy">Seu nome</label><input id="answerBy" value="' + esc(state.n1 || "") + '" placeholder="Seu nome">' +
    '<button type="button" class="btn full" data-action="add-answer">Salvar minha resposta</button></section>';

  if (answers.length) {
    html += '<div class="section-head"><h2>Respostas de hoje</h2></div><section class="card">';
    answers.forEach(answer => {
      html += '<div class="letter"><p>' + esc(answer.text) + "</p><small>— " + esc(answer.by) + "</small></div>";
    });
    html += "</section>";
  }

  const done = state.challenges.includes(today);
  html += '<section class="card"><div class="card-head"><h2>Desafio a dois</h2><span aria-hidden="true">✦</span></div>' +
    "<p>" + esc(challengeOfDay()) + "</p>" +
    '<button type="button" class="btn secondary small" data-action="complete-challenge">Marcar como realizado</button>' +
    '<p class="muted mt-sm">' + (done ? "Desafio de hoje concluído! ✓" : "Um pequeno convite para hoje.") + "</p></section>";

  html += '<section class="card"><h2>Quiz do casal</h2>' +
    '<p class="muted">Uma pergunta para cada um responder e comparar depois, pessoalmente.</p>' +
    "<p><b>Qual seria o passeio perfeito para vocês?</b></p>" +
    '<div class="actions"><button type="button" class="btn secondary small" data-action="quiz-hint">Pensar na resposta</button>' +
    '<button type="button" class="btn ghost small" data-action="new-quiz">Outra pergunta</button></div>' +
    '<p id="quizQuestion" class="muted mt-sm">Toque para revelar outra pergunta.</p></section>';
  return html;
}

function addAnswer() {
  const text = ($("answerText")?.value || "").trim();
  if (!text) return notify("Escreva sua resposta.");
  return commit(state => {
    state.answers.push(touch({
      day: iso(new Date()),
      text: cleanText(text),
      by: cleanText($("answerBy")?.value, 120) || "Um de nós"
    }));
  }, "Resposta guardada.");
}

function completeChallenge() {
  const today = iso(new Date());
  if (getState().challenges.includes(today)) return notify("Vocês já registraram o desafio de hoje.");
  return commit(state => {
    state.challenges.push(today);
  }, "Desafio registrado!");
}

function newQuiz() {
  const target = $("quizQuestion");
  if (target) target.textContent = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
}

export const actions = {
  "add-answer": addAnswer,
  "complete-challenge": completeChallenge,
  "new-quiz": newQuiz,
  "quiz-hint": () => notify("Boa ideia! Guardem as respostas e comparem juntos.")
};
