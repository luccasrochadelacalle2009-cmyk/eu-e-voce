import {
  getAuthState,
  goAuthScreen,
  recoverPassword,
  resendConfirmation,
  resetPassword,
  signIn,
  signOut,
  signUp
} from "../core/auth.js";
import { $, esc } from "../core/utils.js";
import { themeMeta } from "../core/theme.js";
import { getState } from "../core/store.js";
import { notify } from "../ui/toast.js";

let formError = "";
let lastEmail = "";

function brand() {
  const meta = themeMeta(getState().theme);
  return '<header class="auth-top"><div class="auth-brand"><span class="brand-mark" aria-hidden="true">✧</span>' +
    "<div>US<small>OUR UNIVERSE</small></div></div>" +
    '<button type="button" id="themeToggle" class="icon-btn" data-action="cycle-theme" aria-label="Alternar tema" title="Alternar tema">' +
    '<span aria-hidden="true">' + meta.icon + "</span></button></header>";
}

function shell(content) {
  return brand() + '<div class="auth-shell"><div class="auth-card">' + content + "</div></div>";
}

function field(id, label, type, placeholder, extra = "") {
  return '<label for="' + id + '">' + label + "</label>" +
    '<input id="' + id + '" type="' + type + '" ' + extra +
    (placeholder ? ' placeholder="' + esc(placeholder) + '"' : "") + ">";
}

function errorBox() {
  return formError ? '<p class="form-error" role="alert">' + esc(formError) + "</p>" : "";
}

function noticeBox(text) {
  return text ? '<p class="auth-notice">' + esc(text) + "</p>" : "";
}

function loadingScreen() {
  return shell('<div class="auth-center"><div class="spinner" aria-hidden="true"></div>' +
    '<h1 class="page-title">Preparando seu espaço</h1>' +
    '<p class="muted">Validando sua sessão com segurança...</p></div>');
}

function errorScreen(state) {
  const message = state.configError || state.notice || "Não foi possível carregar o serviço de contas.";
  const setup = state.configError
    ? "<ol class=\"auth-steps\">" +
      "<li>Crie um projeto em supabase.com.</li>" +
      "<li>Em <b>Project Settings → API</b>, copie a <b>Project URL</b> e a <b>anon/public key</b>.</li>" +
      "<li>Cole os valores em <code>src/core/config.js</code>.</li>" +
      "<li>Em <b>Authentication → URL Configuration</b>, cadastre a URL do site como Site URL e Redirect URL.</li>" +
      "</ol><p class=\"small-note\">Nunca use a service_role key no frontend.</p>"
    : "";
  return shell('<h1 class="page-title">Não foi possível entrar</h1>' +
    '<p class="form-error" role="alert">' + esc(message) + "</p>" + setup +
    '<button type="button" class="btn full" data-action="auth-goto" data-arg="login">Voltar ao login</button>');
}

function loginScreen(state) {
  return shell('<div class="auth-eyebrow">BEM-VINDO DE VOLTA</div>' +
    '<h1 class="page-title">Entre no US</h1>' +
    '<p class="muted">Seu universo particular continua aqui.</p>' +
    noticeBox(state.notice) + errorBox() +
    "<form data-auth-form=\"login\" data-action=\"auth-login\">" +
    field("authEmail", "E-mail", "email", "voce@exemplo.com", 'autocomplete="email" required') +
    field("authPassword", "Senha", "password", "Sua senha", 'autocomplete="current-password" required') +
    '<button type="submit" class="btn full">Entrar</button></form>' +
    '<div class="auth-links">' +
    '<button type="button" class="link-btn" data-action="auth-goto" data-arg="signup">Criar conta</button>' +
    '<button type="button" class="link-btn" data-action="auth-goto" data-arg="recover">Esqueci minha senha</button>' +
    "</div>");
}

function signupScreen() {
  return shell('<div class="auth-eyebrow">COMECE AQUI</div>' +
    '<h1 class="page-title">Criar conta</h1>' +
    '<p class="muted">Cada pessoa deve ter a sua própria conta.</p>' +
    errorBox() +
    "<form data-auth-form=\"signup\" data-action=\"auth-signup\">" +
    field("authName", "Nome", "text", "Como quer ser chamado(a)", 'autocomplete="name" required') +
    field("authEmail", "E-mail", "email", "voce@exemplo.com", 'autocomplete="email" required') +
    field("authPassword", "Senha", "password", "Mínimo de 8 caracteres", 'autocomplete="new-password" required') +
    field("authConfirm", "Confirme a senha", "password", "Repita a senha", 'autocomplete="new-password" required') +
    '<button type="submit" class="btn full">Criar conta</button></form>' +
    '<div class="auth-links"><button type="button" class="link-btn" data-action="auth-goto" data-arg="login">Já tenho conta</button></div>');
}

function recoverScreen() {
  return shell('<div class="auth-eyebrow">RECUPERAÇÃO</div>' +
    '<h1 class="page-title">Recuperar acesso</h1>' +
    '<p class="muted">Enviaremos um link seguro para o seu e-mail.</p>' +
    errorBox() +
    "<form data-auth-form=\"recover\" data-action=\"auth-recover\">" +
    field("authEmail", "E-mail cadastrado", "email", "voce@exemplo.com", 'autocomplete="email" required') +
    '<button type="submit" class="btn full">Enviar link</button></form>' +
    '<div class="auth-links"><button type="button" class="link-btn" data-action="auth-goto" data-arg="login">Voltar ao login</button></div>');
}

function confirmScreen(state) {
  return shell('<div class="auth-center"><div class="auth-check" aria-hidden="true">✓</div>' +
    '<h1 class="page-title">Confira seu e-mail</h1>' +
    noticeBox(state.notice || "Enviamos um link de confirmação para você.") +
    '<p class="muted">Abra o link no mesmo aparelho onde vai usar o aplicativo.</p>' +
    '<button type="button" class="btn full" data-action="auth-resend">Reenviar link</button>' +
    '<button type="button" class="btn ghost full" data-action="auth-continue">Continuar</button>' +
    '<button type="button" class="link-btn" data-action="auth-goto" data-arg="login">Voltar ao login</button></div>');
}

function resetScreen(state) {
  return shell('<div class="auth-eyebrow">NOVA SENHA</div>' +
    '<h1 class="page-title">Escolha uma nova senha</h1>' +
    noticeBox(state.notice) + errorBox() +
    "<form data-auth-form=\"reset\" data-action=\"auth-reset\">" +
    field("authNewPassword", "Nova senha", "password", "Mínimo de 8 caracteres", 'autocomplete="new-password" required') +
    field("authConfirm", "Confirme a nova senha", "password", "Repita a senha", 'autocomplete="new-password" required') +
    '<button type="submit" class="btn full">Salvar nova senha</button></form>' +
    '<div class="auth-links"><button type="button" class="link-btn" data-action="auth-goto" data-arg="login">Voltar ao login</button></div>');
}

export function render() {
  const state = getAuthState();
  if (!state.ready) return loadingScreen();
  if (state.screen === "error") return errorScreen(state);
  if (state.screen === "signup") return signupScreen();
  if (state.screen === "recover") return recoverScreen();
  if (state.screen === "confirm") return confirmScreen(state);
  if (state.screen === "reset") return resetScreen(state);
  return loginScreen(state);
}

export function validateAuthForm(mode, values) {
  const email = String(values.email || "").trim();
  const password = String(values.password || "");
  const name = String(values.name || "").trim();
  if (mode === "signup" && name.length < 2) return "Informe seu nome completo.";
  if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail válido.";
  if (mode === "recover") return "";
  if (mode === "login") return password ? "" : "Informe sua senha.";
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if ((mode === "signup" || mode === "reset") && String(values.confirm || "") !== password) {
    return "As senhas não conferem.";
  }
  return "";
}

function fail(message) {
  formError = message;
  notify(message);
  goAuthScreen(getAuthState().screen, getAuthState().notice);
}

function valuesFrom(fields) {
  const result = {};
  for (const [key, id] of Object.entries(fields)) {
    result[key] = ($(id)?.value || "").trim();
  }
  return result;
}

async function handleLogin() {
  formError = "";
  const values = valuesFrom({ email: "authEmail", password: "authPassword" });
  const invalid = validateAuthForm("login", values);
  if (invalid) return fail(invalid);
  lastEmail = values.email;
  const result = await signIn(values);
  if (result.error) return fail(result.error.message);
}

async function handleSignup() {
  formError = "";
  const values = valuesFrom({
    name: "authName",
    email: "authEmail",
    password: "authPassword",
    confirm: "authConfirm"
  });
  const invalid = validateAuthForm("signup", values);
  if (invalid) return fail(invalid);
  lastEmail = values.email;
  const result = await signUp(values);
  if (result.error) return fail(result.error.message);
}

async function handleRecover() {
  formError = "";
  const values = valuesFrom({ email: "authEmail" });
  const invalid = validateAuthForm("recover", values);
  if (invalid) return fail(invalid);
  lastEmail = values.email;
  const result = await recoverPassword(values.email);
  if (result.error) return fail(result.error.message);
}

async function handleReset() {
  formError = "";
  const values = valuesFrom({ password: "authNewPassword", confirm: "authConfirm" });
  const invalid = validateAuthForm("reset", values);
  if (invalid) return fail(invalid);
  const result = await resetPassword(values.password);
  if (result.error) return fail(result.error.message);
}

async function handleResend() {
  formError = "";
  if (!lastEmail) return goAuthScreen("recover", "Informe seu e-mail para reenviar o link.");
  const result = await resendConfirmation(lastEmail);
  if (result.error) return fail(result.error.message);
  notify("Link reenviado.");
}

export const actions = {
  "auth-login": handleLogin,
  "auth-signup": handleSignup,
  "auth-recover": handleRecover,
  "auth-reset": handleReset,
  "auth-resend": handleResend,
  "auth-continue": () => {
    formError = "";
    goAuthScreen(null);
  },
  "auth-goto": arg => {
    formError = "";
    goAuthScreen(arg);
  },
  logout: async () => {
    const result = await signOut();
    if (result.error) notify(result.error.message);
  }
};
