/**
 * Migração dos dados locais (chave `us`) para o Supabase.
 *
 * Nunca apaga nem altera a chave `us`. Cada registro é enviado com um
 * legacy_id estável; o banco tem UNIQUE (couple_id, legacy_id), então
 * repetir a migração não duplica dados.
 */
import { COLLECTIONS } from "./constants.js";
import { getState } from "./store.js";
import { getAuthUser } from "./auth.js";
import { getCoupleId, patchCloud, pushOp, pushSettings, upsertProfile } from "./cloud.js";
import { nowISO } from "./utils.js";
import { syncNow } from "./sync.js";

const SETTINGS_FIELDS = ["theme", "n1", "n2", "since", "profile1", "profile2"];

export function buildMigrationPayload() {
  const user = getAuthUser();
  if (!user) return { error: "Entre na sua conta antes de migrar." };
  if (!getCoupleId()) return { error: "Crie ou entre em um casal antes de migrar." };

  const state = getState();
  const records = [];
  const errors = [];
  const now = nowISO();

  for (const collection of COLLECTIONS) {
    const list = Array.isArray(state[collection]) ? state[collection] : [];
    list.forEach(item => {
      if (!item || typeof item !== "object" || !item.id) {
        errors.push("Registro sem ID em " + collection + " foi ignorado.");
        return;
      }
      records.push({
        collection,
        legacyId: String(item.id),
        op: "upsert",
        data: item,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now
      });
    });
  }

  const challenges = Array.isArray(state.challenges) ? state.challenges : [];
  for (const date of challenges) {
    if (typeof date !== "string") {
      errors.push("Desafio inválido foi ignorado.");
      continue;
    }
    records.push({
      collection: "challenges",
      legacyId: date,
      op: "upsert",
      data: { date },
      createdAt: now,
      updatedAt: now
    });
  }

  const settings = {};
  for (const field of SETTINGS_FIELDS) settings[field] = state[field] ?? "";
  settings.updatedAt = now;

  return {
    user,
    profile: { displayName: String(state.n1 || user.email || "").slice(0, 120) },
    records,
    settings,
    errors,
    summary: {
      records: records.length,
      challenges: challenges.length,
      settings: 1,
      errors: errors.length
    }
  };
}

export function validateMigration() {
  const payload = buildMigrationPayload();
  return payload;
}

export async function runMigration() {
  const payload = buildMigrationPayload();
  if (payload.error) return { ok: false, message: payload.error };

  const profileResult = await upsertProfile(payload.profile.displayName);
  if (profileResult.error) return { ok: false, message: profileResult.error.message };

  let sent = 0;
  let failed = 0;
  const failures = [];

  for (const op of payload.records) {
    const result = await pushOp(op);
    if (result.ok) sent += 1;
    else {
      failed += 1;
      if (failures.length < 5) failures.push(result.error?.message || "Erro desconhecido.");
    }
  }

  const settingsResult = await pushSettings(payload.settings);
  if (settingsResult.ok) sent += 1;
  else failed += 1;

  if (failed) {
    return {
      ok: false,
      sent,
      failed,
      message: "Alguns registros não foram enviados. Nada foi apagado do aparelho. " + failures.join(" ")
    };
  }

  patchCloud({ migrated: true });
  await syncNow({ force: true, full: true });
  return {
    ok: true,
    sent,
    failed: 0,
    message: sent + " itens enviados com segurança. Seus dados locais foram mantidos."
  };
}
