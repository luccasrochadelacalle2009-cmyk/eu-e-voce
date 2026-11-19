import { getClient } from "./supabase.js";
import { getAuthUser } from "./auth.js";
import { nowISO } from "./utils.js";

export const CLOUD_KEY = "us.cloud";

/** Coleção local -> tabela compartilhada no Supabase. */
export const TABLES = {
  wall: "memories",
  events: "calendar_events",
  plans: "plans",
  letters: "letters",
  journal: "journal",
  music: "music",
  places: "places",
  answers: "answers",
  challenges: "challenges"
};

const DEFAULT_CLOUD = {
  coupleId: "",
  coupleName: "",
  inviteCode: "",
  partnerEmail: "",
  partnerId: "",
  partnerName: "",
  role: "",
  connectionStatus: "none",
  profiles: {},
  lastSyncAt: "",
  lastSettingsAt: "",
  lastUserSettingsAt: "",
  migrated: false,
  ops: [],
  conflicts: []
};

export function readCloud() {
  try {
    const raw = localStorage.getItem(CLOUD_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_CLOUD, ...parsed };
  } catch {
    return { ...DEFAULT_CLOUD };
  }
}

export function writeCloud(cloud) {
  try {
    localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud));
    return true;
  } catch {
    return false;
  }
}

export function patchCloud(patch) {
  const next = { ...readCloud(), ...patch };
  writeCloud(next);
  return next;
}

export function getCoupleId() {
  return readCloud().coupleId || "";
}

export function setCoupleId(coupleId) {
  return patchCloud({ coupleId });
}

/** Nome legível de uma conta, usado para indicar autoria. */
export function profileName(userId) {
  if (!userId) return "Alguém";
  return readCloud().profiles?.[userId] || "Um de nós";
}

/** Link de convite: ao abrir, o código já vem preenchido no app. */
export function inviteLink(code) {
  if (!code) return "";
  const here = new URL(location.href);
  here.search = "?invite=" + encodeURIComponent(code);
  here.hash = "#settings";
  return here.href;
}

export function message(error) {
  const raw = String(error?.message || error || "");
  if (/could not find.*create_couple|could not find.*join_couple|could not find.*confirm_connection/i.test(raw)) {
    return "O banco ainda não está pronto. Execute todo o supabase/schema.sql no SQL Editor e confira se não houve erro.";
  }
  if (/could not find the table public\.(couples?|couple_members|user_settings)|schema cache/i.test(raw)) {
    return "As tabelas do casal ainda não existem no Supabase. Execute o supabase/schema.sql atualizado.";
  }
  if (/código inválido/i.test(raw)) return "Código inválido.";
  if (/já pertence a um casal/i.test(raw)) return "Você já pertence a um casal.";
  if (/já tem duas pessoas/i.test(raw)) return "Este casal já tem duas pessoas.";
  if (/não há convite pendente/i.test(raw)) return "Não há convite pendente.";
  if (/não é o dono/i.test(raw)) return "Somente quem criou o casal pode fazer isso.";
  if (/conectado a um casal/i.test(raw)) return "Você não está conectado a um casal.";
  if (/network|fetch|failed to fetch/i.test(raw)) return "Sem conexão com a nuvem.";
  return raw || "Não foi possível concluir. Tente novamente.";
}

function requireClient() {
  const client = getClient();
  if (!client) return { error: { message: "Supabase não configurado." } };
  return { client };
}

export async function loadCouple() {
  const { client, error } = requireClient();
  if (error) return { error };
  const user = getAuthUser();
  if (!user) return { error: { message: "Entre na sua conta primeiro." } };

  const { data, error: dbError } = await client
    .from("couple_members")
    .select("couple_id, role, status, couples(id, name, since, invite_code, status, created_at)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (dbError) return { error: { message: message(dbError) } };
  if (!data) {
    patchCloud({ coupleId: "", coupleName: "", connectionStatus: "none", partnerId: "", partnerName: "" });
    return { couple: null };
  }

  const couple = data.couples;
  const { data: members } = await client
    .from("couple_members")
    .select("user_id, role, status")
    .eq("couple_id", couple.id);

  const partner = (members || []).find(member => member.user_id !== user.id);
  let partnerName = "";
  const profiles = { ...readCloud().profiles };

  const ids = [...new Set((members || []).map(member => member.user_id))];
  if (ids.length) {
    const { data: found } = await client
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const profile of found || []) {
      profiles[profile.id] = profile.display_name || "Um de nós";
    }
    if (partner) partnerName = profiles[partner.user_id] || "Parceiro(a)";
  }

  const connectionStatus = couple.status === "active" && data.status === "active"
    ? "active"
    : data.status === "pending" ? "invited" : couple.status;

  patchCloud({
    coupleId: couple.id,
    coupleName: couple.name,
    inviteCode: couple.invite_code,
    partnerEmail: partnerName,
    partnerName,
    partnerId: partner?.user_id || "",
    role: data.role,
    connectionStatus,
    profiles
  });

  return { couple: { ...couple, role: data.role, memberStatus: data.status, connectionStatus } };
}

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

export async function createCouple(name, since) {
  const { client, error } = requireClient();
  if (error) return { error };
  const user = getAuthUser();
  if (!user) return { error: { message: "Entre na sua conta primeiro." } };

  const result = await client.rpc("create_couple", {
    p_name: name,
    p_since: since || null
  });

  if (result.error && /could not find.*create_couple/i.test(result.error.message)) {
    const { data: couple, error: insertError } = await client.from("couples").insert({
      created_by: user.id,
      name: String(name || "Nosso universo").slice(0, 120),
      since: since || null,
      invite_code: inviteCode(),
      status: "pending"
    }).select().single();

    if (insertError) return { error: { message: message(insertError) } };

    const { error: memberError } = await client.from("couple_members").insert({
      couple_id: couple.id,
      user_id: user.id,
      role: "owner",
      status: "active"
    });
    if (memberError) return { error: { message: message(memberError) } };

    await loadCouple();
    return { ok: true, coupleId: couple.id };
  }

  if (result.error) return { error: { message: message(result.error) } };
  await loadCouple();
  return { ok: true, coupleId: result.data };
}

export async function joinCouple(code) {
  const { client, error } = requireClient();
  if (error) return { error };
  const { data, error: dbError } = await client.rpc("join_couple_with_code", {
    p_code: code
  });
  if (dbError) return { error: { message: message(dbError) } };
  await loadCouple();
  return { ok: true, coupleId: data };
}

export async function confirmConnection() {
  const { client, error } = requireClient();
  if (error) return { error };
  const { error: dbError } = await client.rpc("confirm_connection");
  if (dbError) return { error: { message: message(dbError) } };
  await loadCouple();
  return { ok: true };
}

export async function rejectConnection() {
  const { client, error } = requireClient();
  if (error) return { error };
  const { error: dbError } = await client.rpc("reject_connection");
  if (dbError) return { error: { message: message(dbError) } };
  await loadCouple();
  return { ok: true };
}

export async function disconnectCouple() {
  const { client, error } = requireClient();
  if (error) return { error };
  const { error: dbError } = await client.rpc("disconnect_couple");
  if (dbError) return { error: { message: message(dbError) } };
  const keep = readCloud().ops.filter(op => op.collection === "user-settings");
  patchCloud({ coupleId: "", coupleName: "", connectionStatus: "none", partnerId: "", partnerName: "", ops: keep });
  return { ok: true };
}

export async function regenerateInvite() {
  const { client, error } = requireClient();
  if (error) return { error };
  const { data, error: dbError } = await client.rpc("regenerate_invite_code");
  if (dbError) return { error: { message: message(dbError) } };
  patchCloud({ inviteCode: data });
  return { ok: true, code: data };
}

export async function upsertProfile(displayName) {
  const { client, error } = requireClient();
  if (error) return { error };
  const user = getAuthUser();
  if (!user) return { error: { message: "Entre na sua conta primeiro." } };
  const { error: dbError } = await client.from("profiles").upsert({
    id: user.id,
    display_name: String(displayName || user.email || "").slice(0, 120),
    updated_at: nowISO()
  }, { onConflict: "id" });
  if (dbError) return { error: { message: message(dbError) } };
  return { ok: true };
}

export async function fetchUserSettings() {
  const { client, error } = requireClient();
  if (error) return { error };
  const user = getAuthUser();
  if (!user) return { settings: null };
  const { data, error: dbError } = await client
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (dbError) return { error: { message: message(dbError) } };
  return { settings: data || null };
}

export async function pushUserSettings(data) {
  const { client, error } = requireClient();
  if (error) return { error };
  const user = getAuthUser();
  if (!user) return { error: { message: "Entre na sua conta primeiro." } };
  const { error: dbError } = await client.from("user_settings").upsert({
    user_id: user.id,
    data,
    updated_at: nowISO()
  }, { onConflict: "user_id" });
  if (dbError) return { error: { message: message(dbError) } };
  return { ok: true };
}

export async function fetchRemote(since = "") {
  const { client, error } = requireClient();
  if (error) return { error };
  const coupleId = getCoupleId();
  if (!coupleId) return { records: [], error: { message: "Casal não conectado." } };

  const result = {};
  for (const [collection, table] of Object.entries(TABLES)) {
    let query = client.from(table).select("*").eq("couple_id", coupleId);
    if (since) query = query.gt("updated_at", since);
    const { data, error: dbError } = await query;
    if (dbError) return { error: { message: message(dbError) } };
    result[collection] = data || [];
  }

  const { data: settings, error: settingsError } = await client
    .from("couple_settings")
    .select("*")
    .eq("couple_id", coupleId)
    .maybeSingle();
  if (settingsError) return { error: { message: message(settingsError) } };
  result.settings = settings ? [settings] : [];

  const userSettings = await fetchUserSettings();
  if (userSettings.error) return { error: userSettings.error };
  result.userSettings = userSettings.settings ? [userSettings.settings] : [];

  return { records: result };
}

function rowFromOp(op) {
  const user = getAuthUser();
  const now = nowISO();
  return {
    couple_id: getCoupleId(),
    legacy_id: String(op.legacyId),
    data: op.data || {},
    created_at: op.createdAt || null,
    updated_at: op.updatedAt || now,
    updated_by: user?.id || null,
    created_by: op.createdBy || user?.id || null,
    deleted_at: op.op === "delete" ? (op.deletedAt || now) : null
  };
}

export async function pushOp(op) {
  const { client, error } = requireClient();
  if (error) return { error };
  const table = TABLES[op.collection];
  if (!table) return { error: { message: "Coleção desconhecida." } };

  const { error: dbError } = await client
    .from(table)
    .upsert(rowFromOp(op), { onConflict: "couple_id,legacy_id" });
  if (dbError) return { error: { message: message(dbError) } };
  return { ok: true };
}

export async function pushSettings(data) {
  const { client, error } = requireClient();
  if (error) return { error };
  const user = getAuthUser();
  const { error: dbError } = await client.from("couple_settings").upsert({
    couple_id: getCoupleId(),
    data,
    updated_by: user?.id || null,
    updated_at: nowISO()
  }, { onConflict: "couple_id" });
  if (dbError) return { error: { message: message(dbError) } };
  return { ok: true };
}

export async function logConflict(entry) {
  const { client, error } = requireClient();
  if (error) return;
  const user = getAuthUser();
  await client.from("sync_conflicts").insert({
    couple_id: getCoupleId(),
    collection: entry.collection,
    legacy_id: String(entry.legacyId),
    winner_updated_at: entry.winnerUpdatedAt,
    loser_payload: entry.loserPayload || {},
    detected_by: user?.id || null
  });
}

export function subscribeRealtime(coupleId, onChange) {
  const { client, error } = requireClient();
  if (error || !coupleId) return () => {};
  const user = getAuthUser();

  const channel = client.channel("us-sync-" + coupleId);
  for (const table of Object.values(TABLES)) {
    channel.on("postgres_changes", {
      event: "*",
      schema: "public",
      table,
      filter: "couple_id=eq." + coupleId
    }, payload => onChange(table, payload));
  }
  channel.on("postgres_changes", {
    event: "*", schema: "public", table: "couple_settings",
    filter: "couple_id=eq." + coupleId
  }, payload => onChange("couple_settings", payload));
  channel.on("postgres_changes", {
    event: "*", schema: "public", table: "couples",
    filter: "id=eq." + coupleId
  }, payload => onChange("couples", payload));
  channel.on("postgres_changes", {
    event: "*", schema: "public", table: "couple_members",
    filter: "couple_id=eq." + coupleId
  }, payload => onChange("couple_members", payload));
  if (user) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "user_settings",
      filter: "user_id=eq." + user.id
    }, payload => onChange("user_settings", payload));
  }
  channel.subscribe();

  return () => { client.removeChannel(channel); };
}

export function tableToCollection(table) {
  return Object.keys(TABLES).find(key => TABLES[key] === table) || "";
}
