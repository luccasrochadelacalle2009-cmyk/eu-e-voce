import { getClient } from "./supabase.js";
import {
  AUTH_CALLBACK,
  AUTH_REDIRECT_URL,
  isConfigured
} from "./config.js";

let client = null;
let session = null;
let user = null;
let ready = false;
let screen = "loading";
let notice = "";
let configError = "";
const listeners = new Set();

function emit() {
  listeners.forEach(listener => listener());
}

/** Traduz mensagens do Supabase para texto amigável, sem expor detalhes internos. */
export function authMessage(error) {
  const raw = String(error?.message || error || "");
  if (/invalid login credentials/i.test(raw)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(raw)) return "Confirme seu e-mail antes de entrar.";
  if (/user already registered/i.test(raw)) return "Já existe uma conta com este e-mail.";
  if (/password should be at least/i.test(raw)) return "A senha é muito curta.";
  if (/unable to validate email|email address.*invalid|invalid.*email/i.test(raw)) return "Este e-mail não parece válido.";
  if (/rate limit|too many requests|email rate/i.test(raw)) return "Muitas tentativas: o Supabase limita e-mails por hora. Desative 'Confirm email' ou configure um SMTP próprio.";
  if (/expired|invalid.*(token|link|code)/i.test(raw)) return "Este link expirou. Solicite um novo e tente novamente.";
  if (/network|fetch|failed to fetch/i.test(raw)) return "Sem conexão com o serviço de contas. Tente novamente.";
  return raw || "Não foi possível concluir. Tente novamente.";
}

export async function initAuth() {
  screen = "loading";
  notice = "";
  configError = "";
  emit();

  if (!isConfigured()) {
    configError = "Configure a URL do projeto e a anon key em src/core/config.js.";
    screen = "error";
    ready = true;
    emit();
    return;
  }

  try {
    client = getClient();
    if (!client) {
      configError = "Configure a URL do projeto e a anon key em src/core/config.js.";
      screen = "error";
      ready = true;
      emit();
      return;
    }

    try {
      const { data } = await client.auth.getSession();
      session = data?.session || null;
      user = session?.user || null;
    } catch {
      session = null;
      user = null;
    }

    if (AUTH_CALLBACK.error) {
      screen = "error";
      notice = authMessage({ message: AUTH_CALLBACK.error });
    } else if (AUTH_CALLBACK.hasTokens) {
      screen = AUTH_CALLBACK.type === "recovery" ? "reset" : "confirm";
      notice = AUTH_CALLBACK.type === "recovery"
        ? "Escolha uma nova senha para voltar a entrar."
        : "E-mail confirmado. Sua conta está pronta.";
      history.replaceState(null, "", location.pathname + location.search + "#" + screen);
    } else if (session) {
      screen = null;
    } else {
      screen = "login";
    }

    client.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession || null;
      user = session?.user || null;

      const callbackFlow = AUTH_CALLBACK.hasTokens && (screen === "confirm" || screen === "reset");
      if (callbackFlow && event !== "SIGNED_OUT") {
        emit();
        return;
      }

      if (event === "SIGNED_OUT") {
        screen = "login";
        notice = "";
      } else if (event === "SIGNED_IN" && session) {
        screen = null;
        notice = "";
      }
      emit();
    });
  } catch (error) {
    configError = authMessage(error);
    screen = "error";
  }

  ready = true;
  emit();
}

export function subscribeAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthState() {
  return { ready, screen, notice, configError, configured: isConfigured(), user };
}

export function getAuthUser() {
  return user;
}

export function isAuthenticated() {
  return Boolean(session);
}

export function goAuthScreen(next, message = "") {
  screen = next;
  notice = message;
  emit();
}

export async function signUp({ name, email, password }) {
  if (!client) return { error: { message: "Serviço de contas indisponível." } };
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: AUTH_REDIRECT_URL }
  });
  if (error) return { error: { message: authMessage(error) } };

  if (data.session) {
    session = data.session;
    user = data.session.user;
    screen = null;
    notice = "";
    emit();
    return { ok: true, confirmed: true };
  }

  screen = "confirm";
  notice = "Enviamos um link de confirmação para " + email + ".";
  emit();
  return { ok: true, confirmed: false };
}

export async function signIn({ email, password }) {
  if (!client) return { error: { message: "Serviço de contas indisponível." } };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: { message: authMessage(error) } };

  session = data.session;
  user = data.session.user;
  screen = null;
  notice = "";
  emit();
  return { ok: true };
}

export async function signOut() {
  if (client) {
    const { error } = await client.auth.signOut();
    if (error) return { error: { message: authMessage(error) } };
  }
  session = null;
  user = null;
  screen = "login";
  notice = "Sessão encerrada.";
  emit();
  return { ok: true };
}

export async function recoverPassword(email) {
  if (!client) return { error: { message: "Serviço de contas indisponível." } };
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: AUTH_REDIRECT_URL
  });
  if (error) return { error: { message: authMessage(error) } };

  screen = "confirm";
  notice = "Se existir uma conta com este e-mail, você receberá o link de recuperação.";
  emit();
  return { ok: true };
}

export async function resetPassword(password) {
  if (!client) return { error: { message: "Serviço de contas indisponível." } };
  const { error } = await client.auth.updateUser({ password });
  if (error) return { error: { message: authMessage(error) } };

  await client.auth.signOut();
  session = null;
  user = null;
  screen = "login";
  notice = "Senha atualizada. Entre com a nova senha.";
  emit();
  return { ok: true };
}

export async function resendConfirmation(email) {
  if (!client) return { error: { message: "Serviço de contas indisponível." } };
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: AUTH_REDIRECT_URL }
  });
  if (error) return { error: { message: authMessage(error) } };
  emit();
  return { ok: true };
}
