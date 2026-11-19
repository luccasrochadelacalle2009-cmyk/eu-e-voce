import { COLLECTIONS } from "./constants.js";
import { getState, applyRemote, subscribeChanges, emit as emitStore } from "./store.js";
import { getAuthUser, isAuthenticated, subscribeAuth } from "./auth.js";
import {
  getCoupleId,
  loadCouple,
  fetchRemote,
  pushOp,
  pushSettings,
  pushUserSettings,
  logConflict,
  subscribeRealtime,
  tableToCollection,
  patchCloud,
  readCloud,
  inviteLink
} from "./cloud.js";
import { nowISO, uid } from "./utils.js";

/** Configurações compartilhadas do casal. */
const COUPLE_SETTINGS_FIELDS = ["n1", "n2", "since"];
/** Configurações de cada pessoa: NUNCA vão para o casal. */
const USER_SETTINGS_FIELDS = ["theme", "profile1", "profile2"];

let status = "offline";
let message = "Aguardando conexão.";
let syncing = false;
let started = false;
let unsubscribeRealtime = null;
let unsubscribeChanges = null;
const listeners = new Set();

function emitSync() {
  listeners.forEach(listener => listener());
  emitStore();
}

export function subscribeSync(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncState() {
  const cloud = readCloud();
  return {
    status,
    message,
    pending: cloud.ops.filter(op => op.collection !== "user-settings").length,
    individualPending: cloud.ops.filter(op => op.collection === "user-settings").length,
    conflicts: cloud.conflicts.length,
    lastSyncAt: cloud.lastSyncAt,
    coupleId: cloud.coupleId,
    inviteCode: cloud.inviteCode,
    inviteUrl: inviteLink(cloud.inviteCode),
    connectionStatus: cloud.connectionStatus,
    partnerName: cloud.partnerName,
    role: cloud.role,
    migrated: cloud.migrated
  };
}

function setStatus(next, text) {
  status = next;
  message = text;
  emitSync();
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function newer(left, right) {
  const a = Date.parse(left || "") || 0;
  const b = Date.parse(right || "") || 0;
  if (a !== b) return a > b;
  return String(left || "") > String(right || "");
}

function enqueue(newOps) {
  if (!newOps.length) return;
  const cloud = readCloud();
  const queue = cloud.ops.slice();
  for (const op of newOps) {
    const index = queue.findIndex(item =>
      item.collection === op.collection && item.legacyId === op.legacyId
    );
    if (index >= 0) queue.splice(index, 1);
    queue.push({ id: uid(), attempts: 0, queuedAt: nowISO(), ...op });
  }
  patchCloud({ ops: queue });
  emitSync();
}

function diffRecords(before, after) {
  const previous = new Map((before || []).map(item => [item.id, item]));
  const next = new Map((after || []).map(item => [item.id, item]));
  const ops = [];

  for (const [id, record] of next) {
    if (!previous.has(id) || !same(previous.get(id), record)) {
      ops.push({
        collection: null,
        legacyId: id,
        op: "upsert",
        data: record,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt || nowISO()
      });
    }
  }
  for (const [id, oldRecord] of previous) {
    if (!next.has(id)) {
      ops.push({
        collection: null,
        legacyId: id,
        op: "delete",
        data: oldRecord,
        createdAt: oldRecord.createdAt,
        updatedAt: nowISO(),
        deletedAt: nowISO()
      });
    }
  }
  return ops;
}

function diffChallenges(before, after) {
  const previous = new Set(before || []);
  const next = new Set(after || []);
  const ops = [];
  for (const date of next) {
    if (!previous.has(date)) {
      ops.push({
        collection: "challenges",
        legacyId: date,
        op: "upsert",
        data: { date },
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
    }
  }
  for (const date of previous) {
    if (!next.has(date)) {
      ops.push({
        collection: "challenges",
        legacyId: date,
        op: "delete",
        data: { date },
        updatedAt: nowISO(),
        deletedAt: nowISO()
      });
    }
  }
  return ops;
}

function settingsOps(before, after) {
  const ops = [];
  for (const [collection, fields] of [
    ["settings", COUPLE_SETTINGS_FIELDS],
    ["user-settings", USER_SETTINGS_FIELDS]
  ]) {
    const data = {};
    let changed = false;
    for (const field of fields) {
      if (!same(before?.[field], after?.[field])) {
        data[field] = after?.[field];
        changed = true;
      }
    }
    if (changed) {
      ops.push({
        collection,
        legacyId: collection,
        op: "upsert",
        data,
        updatedAt: nowISO()
      });
    }
  }
  return ops;
}

function onLocalChange(before, after) {
  const ops = settingsOps(before, after);
  if (readCloud().connectionStatus === "active") {
    for (const collection of COLLECTIONS) {
      if (same(before?.[collection], after?.[collection])) continue;
      for (const op of diffRecords(before?.[collection], after?.[collection])) {
        ops.push({ ...op, collection });
      }
    }
    if (!same(before?.challenges, after?.challenges)) {
      ops.push(...diffChallenges(before?.challenges, after?.challenges));
    }
  }
  if (ops.length) enqueue(ops);
  if (ops.some(op => op.collection === "user-settings")) flushIndividualSettings();
}

function localRecord(collection, legacyId) {
  const state = getState();
  if (collection === "challenges") return (state.challenges || []).includes(legacyId);
  return (state[collection] || []).find(item => item.id === legacyId) || null;
}

function recordFromRow(row) {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  return {
    ...data,
    id: data.id || row.legacy_id,
    createdAt: data.createdAt || row.created_at || nowISO(),
    updatedAt: data.updatedAt || row.updated_at || nowISO(),
    createdBy: row.created_by || data.createdBy || "",
    updatedBy: row.updated_by || data.updatedBy || ""
  };
}

function recordConflict(entry) {
  const cloud = readCloud();
  const conflicts = cloud.conflicts.slice(-49);
  conflicts.push({ ...entry, at: nowISO() });
  patchCloud({ conflicts });
  logConflict(entry);
}

function applyRemoteRow(collection, row) {
  if (!row || !row.legacy_id) return;
  const legacyId = String(row.legacy_id);
  const deleted = Boolean(row.deleted_at);
  const local = localRecord(collection, legacyId);
  const user = getAuthUser();
  const cloud = readCloud();
  const pending = cloud.ops.find(op =>
    op.collection === collection && op.legacyId === legacyId
  );

  if (collection === "challenges") {
    if (deleted) {
      if (local) applyRemote(state => {
        state.challenges = state.challenges.filter(date => date !== legacyId);
      });
    } else if (!local) {
      applyRemote(state => {
        if (!state.challenges.includes(legacyId)) state.challenges.push(legacyId);
      });
    }
    return;
  }

  const remoteUpdatedAt = row.updated_at || nowISO();
  if (pending && local) {
    const localUpdatedAt = local.updatedAt || "";
    const localWins = newer(localUpdatedAt, remoteUpdatedAt)
      || (!newer(remoteUpdatedAt, localUpdatedAt) && String(user?.id || "") < String(row.updated_by || ""));

    if (localWins) {
      recordConflict({
        collection,
        legacyId,
        winnerUpdatedAt: localUpdatedAt,
        loserPayload: row.data,
        reason: "local"
      });
      enqueue([{
        collection,
        legacyId,
        op: "upsert",
        data: local,
        createdAt: local.createdAt,
        updatedAt: localUpdatedAt
      }]);
      return;
    }

    recordConflict({
      collection,
      legacyId,
      winnerUpdatedAt: remoteUpdatedAt,
      loserPayload: local,
      reason: "remote"
    });
  }

  const queue = cloud.ops.filter(op =>
    !(op.collection === collection && op.legacyId === legacyId)
  );
  patchCloud({ ops: queue });

  if (deleted) {
    if (local) applyRemote(state => {
      const list = state[collection] || [];
      const index = list.findIndex(item => item.id === legacyId);
      if (index >= 0) list.splice(index, 1);
    });
    return;
  }

  const incoming = recordFromRow(row);
  if (local && !same(local, incoming)) {
    applyRemote(state => {
      const list = state[collection] || [];
      const index = list.findIndex(item => item.id === legacyId);
      if (index >= 0) list[index] = incoming;
      else list.push(incoming);
    });
  } else if (!local) {
    applyRemote(state => {
      state[collection] = state[collection] || [];
      state[collection].push(incoming);
    });
  }
}

function applyRemoteSettings(row, fields, key) {
  if (!row || !row.data) return;
  const cloud = readCloud();
  if (!newer(row.updated_at, cloud[key])) return;
  applyRemote(state => {
    for (const field of fields) {
      if (field in row.data) state[field] = row.data[field];
    }
  });
  patchCloud({ [key]: row.updated_at });
}

function applyRemoteBatch(records) {
  for (const [collection, rows] of Object.entries(records || {})) {
    if (collection === "settings") {
      if (rows[0]) applyRemoteSettings(rows[0], COUPLE_SETTINGS_FIELDS, "lastSettingsAt");
      continue;
    }
    if (collection === "userSettings") {
      if (rows[0]) applyRemoteSettings(rows[0], USER_SETTINGS_FIELDS, "lastUserSettingsAt");
      continue;
    }
    for (const row of rows) applyRemoteRow(collection, row);
  }
}

function latestTimestamp(records) {
  let latest = "";
  for (const [collection, rows] of Object.entries(records || {})) {
    if (collection === "userSettings") continue;
    for (const row of rows) {
      if (newer(row.updated_at, latest)) latest = row.updated_at;
    }
  }
  return latest;
}

async function flushIndividualSettings() {
  const cloud = readCloud();
  const ops = cloud.ops.filter(op => op.collection === "user-settings");
  if (!ops.length) return;
  const remaining = cloud.ops.filter(op => op.collection !== "user-settings");
  for (const op of ops) await pushUserSettings(op.data);
  patchCloud({ ops: remaining });
}

async function pushPending() {
  const cloud = readCloud();
  const ops = cloud.ops.filter(op => op.collection !== "user-settings");
  if (!ops.length) return { ok: true, failed: 0 };

  let failed = 0;
  const remaining = [];
  for (const op of ops) {
    const result = op.collection === "settings"
      ? await pushSettings(op.data)
      : await pushOp(op);
    if (result.ok) continue;
    failed += 1;
    remaining.push({ ...op, attempts: (op.attempts || 0) + 1 });
  }
  patchCloud({ ops: [...remaining, ...cloud.ops.filter(op => op.collection === "user-settings")] });
  return { ok: failed === 0, failed };
}

export async function syncNow(options = {}) {
  if (syncing) return { ok: false, message: "Sincronização já em andamento." };
  if (!options.force && !navigator.onLine) {
    setStatus("offline", "Sem conexão. As alterações ficarão salvas para sincronizar depois.");
    return { ok: false, message };
  }

  const cloud = readCloud();
  if (!cloud.coupleId) {
    await flushIndividualSettings();
    setStatus("no-couple", "Crie ou entre em um casal para compartilhar dados.");
    return { ok: false, message };
  }
  if (cloud.connectionStatus !== "active") {
    await flushIndividualSettings();
    setStatus("pending-connection", cloud.connectionStatus === "invited"
      ? "Convite enviado. Aguardando a outra pessoa aceitar e você confirmar."
      : "Conexão pendente. As preferências pessoais ainda são salvas.");
    return { ok: false, message };
  }

  syncing = true;
  setStatus("syncing", "Sincronizando...");
  try {
    await flushIndividualSettings();
    const pushed = await pushPending();
    const current = readCloud();
    const result = await fetchRemote(options.full ? "" : current.lastSyncAt);
    if (result.error) throw result.error;

    applyRemoteBatch(result.records);
    const latest = latestTimestamp(result.records);
    const patch = {};
    if (latest && newer(latest, current.lastSyncAt)) patch.lastSyncAt = latest;
    if (current.ops.length) patch.ops = current.ops;
    patchCloud(patch);

    if (pushed.failed) {
      setStatus("error", "Algumas alterações ainda não foram enviadas. Tentaremos de novo.");
      return { ok: false, message };
    }
    setStatus("synced", "Tudo atualizado.");
    return { ok: true };
  } catch (error) {
    setStatus("error", error?.message || "Não foi possível sincronizar.");
    return { ok: false, message };
  } finally {
    syncing = false;
  }
}

function onOnline() {
  syncNow({ force: true, full: true });
}

function onOffline() {
  setStatus("offline", "Sem conexão. As alterações ficarão salvas para sincronizar depois.");
}

async function refreshConnection() {
  const before = readCloud().connectionStatus;
  await loadCouple();
  const after = readCloud().connectionStatus;
  if (before !== after) {
    unsubscribeRealtime?.();
    unsubscribeRealtime = subscribeRealtime(getCoupleId(), onRealtime);
    if (after === "active") await syncNow({ force: true, full: true });
  }
  emitSync();
}

function onRealtime(table, payload) {
  if (table === "couples" || table === "couple_members") {
    refreshConnection();
    return;
  }
  const row = payload.eventType === "DELETE"
    ? { ...payload.old, deleted_at: nowISO() }
    : payload.new;
  if (!row) return;

  if (table === "couple_settings") {
    applyRemoteSettings(row, COUPLE_SETTINGS_FIELDS, "lastSettingsAt");
  } else if (table === "user_settings") {
    applyRemoteSettings(row, USER_SETTINGS_FIELDS, "lastUserSettingsAt");
  } else {
    const collection = tableToCollection(table);
    if (collection) applyRemoteRow(collection, row);
  }
  const cloud = readCloud();
  if (row.updated_at && newer(row.updated_at, cloud.lastSyncAt)) {
    patchCloud({ lastSyncAt: row.updated_at });
  }
  setStatus("synced", "Atualizado em tempo real.");
}

export async function startSync() {
  if (started || !isAuthenticated()) return;
  started = true;
  unsubscribeChanges = subscribeChanges(onLocalChange);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  let coupleId = getCoupleId();
  if (!coupleId) {
    await loadCouple();
    coupleId = getCoupleId();
  }
  if (!coupleId) {
    setStatus("no-couple", "Crie ou entre em um casal para sincronizar.");
    return;
  }

  unsubscribeRealtime = subscribeRealtime(coupleId, onRealtime);
  await syncNow({ force: true, full: true });
}

/** Reconecta a sync depois de criar/entrar/sair de um casal. */
export async function restartSync() {
  stopSync();
  await startSync();
}

export function stopSync() {
  if (!started) return;
  started = false;
  unsubscribeRealtime?.();
  unsubscribeRealtime = null;
  unsubscribeChanges?.();
  unsubscribeChanges = null;
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
  setStatus("offline", "Sessão encerrada.");
}

export function initSync() {
  subscribeAuth((state, event) => {
    if (isAuthenticated()) startSync();
    else stopSync();
  });
  if (isAuthenticated()) startSync();
  else if (!navigator.onLine) setStatus("offline", "Sem conexão.");
  else setStatus("idle", "Entre na sua conta para sincronizar.");
}
