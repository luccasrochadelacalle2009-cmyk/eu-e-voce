import { createClient } from "../../vendor/supabase-js.js";
import {
  AUTH_STORAGE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isConfigured
} from "./config.js";

let client = null;

/** Cliente único, compartilhado por Auth, banco e Realtime. */
export function getClient() {
  if (client) return client;
  if (!isConfigured()) return null;

  client = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim(), {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  });
  return client;
}

export function resetClient() {
  client = null;
}
