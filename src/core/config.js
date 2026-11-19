/**
 * Configuração do Supabase Auth.
 *
 * SUBSTITUA pelos dados do SEU projeto (Project Settings > API).
 * A anon/public key é pública e pode ficar no frontend.
 * NUNCA coloque aqui a service_role key.
 */
export const SUPABASE_URL = "https://tkgdeklhkhutvgskrbgd.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_28gLwnc9CpZ0EzbZY1-5UQ_MKskUNkl";

/** URL cadastrada em Authentication > URL Configuration > Redirect URLs. */
export const AUTH_REDIRECT_URL = "https://luccasrochadelacalle2009-cmyk.github.io/eu-e-voce/";

export const AUTH_STORAGE_KEY = "us.auth";

export function isConfigured() {
  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim());
  const key = SUPABASE_ANON_KEY.trim();
  const keyOk = key.length > 40 && !key.includes("COLOQUE_AQUI") && !key.includes("service_role");
  return urlOk && keyOk;
}

/** Parâmetros trazidos pelo e-mail de confirmação ou recuperação. */
const rawParams = location.hash.startsWith("#")
  ? location.hash.slice(1)
  : location.search.replace(/^\?/, "");

const params = new URLSearchParams(rawParams);

export const AUTH_CALLBACK = {
  hasTokens: params.has("access_token") || params.has("code"),
  type: (params.get("type") || "").toLowerCase(),
  error: params.get("error_description") || params.get("error") || ""
};
