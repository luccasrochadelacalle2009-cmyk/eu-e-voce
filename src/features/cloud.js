import { esc, $ } from "../core/utils.js";
import { notify } from "../ui/toast.js";
import { openModal } from "../ui/modal.js";
import { getSyncState, syncNow, restartSync } from "../core/sync.js";
import {
  readCloud,
  createCouple,
  joinCouple,
  confirmConnection,
  rejectConnection,
  disconnectCouple,
  regenerateInvite
} from "../core/cloud.js";
import { getState, emit as emitStore } from "../core/store.js";
import { validateMigration, runMigration } from "../core/migration.js";

const STATUS_LABEL = {
  idle: "Pronto",
  syncing: "Sincronizando…",
  synced: "Atualizado",
  offline: "Offline",
  error: "Atenção",
  "no-couple": "Sem casal",
  "pending-connection": "Aguardando conexão"
};

const CONNECTION_LABEL = {
  none: "Sem conexão",
  pending: "Aguardando a outra pessoa entrar",
  invited: "Convite recebido — aguardando confirmação",
  active: "Conectados",
  disconnected: "Desconectado"
};

function inviteFromUrl() {
  try {
    const code = new URLSearchParams(location.search).get("invite") || "";
    return code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  } catch {
    return "";
  }
}

export function renderCloudSection() {
  const sync = getSyncState();
  const cloud = readCloud();
  let html = '<section class="card"><h2>Nuvem e conexão do casal</h2>' +
    '<p class="sync-status status-' + esc(sync.status) + '"><span class="sync-dot"></span>' +
    "<b>" + esc(STATUS_LABEL[sync.status] || sync.status) + "</b> · " + esc(sync.message) + "</p>";

  if (!cloud.coupleId) {
    html += '<div class="cloud-pair">' +
      '<label for="cloudName">Nome do casal</label>' +
      '<input id="cloudName" value="Nosso universo" placeholder="Nome do casal">' +
      '<label for="cloudSince">Data de início</label>' +
      '<input id="cloudSince" type="date" value="' + esc(getState().since) + '">' +
      '<button type="button" class="btn full" data-action="cloud-create">Criar casal e gerar convite</button>' +
      '<hr><label for="cloudCode">Código ou link recebido</label>' +
      '<input id="cloudCode" maxlength="6" value="' + esc(inviteFromUrl()) + '" placeholder="ABC123" autocomplete="off">' +
      '<button type="button" class="btn secondary full" data-action="cloud-join">Aceitar convite</button>' +
      '<p class="small-note mt-xs">A conexão só é ativada depois que quem criou o casal confirmar.</p>' +
      "</div>";
    return html + "</section>";
  }

  const isOwner = sync.role === "owner";
  const active = sync.connectionStatus === "active";
  const waitingPartner = isOwner && sync.connectionStatus === "pending";
  const invited = sync.connectionStatus === "invited";

  html += '<div class="cloud-pair">' +
    '<h3>Espaço do casal</h3>' +
    '<p class="muted mb-0">' + esc(cloud.coupleName || "Nosso universo") + "</p>" +
    '<p class="connection-state status-' + esc(sync.connectionStatus) + '">' +
    (active ? "✓ " : "○ ") + esc(CONNECTION_LABEL[sync.connectionStatus] || sync.connectionStatus) + "</p>" +
    (cloud.partnerName
      ? '<p class="small-note mt-xs">' + esc(cloud.partnerName) +
        (active ? " está conectado(a) e compartilhando conteúdo." : " foi convidado(a).") + "</p>"
      : '<p class="small-note mt-xs">Ninguém entrou no casal ainda.</p>') +
    "</div>";

  html += '<div class="cloud-pair"><h3>Convite</h3>' +
    '<p class="muted mb-0">Código: <b class="invite-code">' + esc(cloud.inviteCode || "—") + "</b></p>" +
    '<label for="cloudInviteUrl">Link de convite</label>' +
    '<input id="cloudInviteUrl" readonly value="' + esc(sync.inviteUrl) + '" onclick="this.select()">' +
    '<button type="button" class="btn secondary full" data-action="cloud-copy-link">Copiar link</button>' +
    (isOwner
      ? '<button type="button" class="btn ghost full" data-action="cloud-regenerate">Gerar novo código</button>'
      : "") +
    "</div>";

  if (waitingPartner) {
    html += '<div class="cloud-pair">' +
      '<p class="small-note mt-0">Confirme para iniciar o espaço compartilhado. Nada é conectado sem sua confirmação.</p>' +
      '<button type="button" class="btn full" data-action="cloud-confirm">Confirmar conexão</button>' +
      '<button type="button" class="btn ghost full" data-action="cloud-reject">Recusar convite</button>' +
      "</div>";
  }

  if (invited) {
    html += '<div class="cloud-pair">' +
      '<p class="small-note mt-0">Você aceitou o convite. Aguarde ' +
      esc(cloud.partnerName || "a outra pessoa") + " confirmar. Seus dados não foram compartilhados ainda.</p>" +
      "</div>";
  }

  if (active) {
    html += '<div class="cloud-pair">' +
      '<button type="button" class="btn full" data-action="cloud-sync">Sincronizar agora</button>' +
      '<button type="button" class="btn secondary full" data-action="cloud-validate">Validar dados locais</button>' +
      '<button type="button" class="btn ghost full" data-action="cloud-migrate">Migrar este aparelho</button>' +
      '<p class="small-note mt-xs">Pendências: ' + sync.pending + " · Conflitos: " + sync.conflicts + ".</p>" +
      '<hr><h3>Privacidade</h3>' +
      '<p class="small-note mt-0">Tema e preferências pessoais ficam somente nesta conta. ' +
      'Memórias, cartas, planos, agenda, diário, lugares e desafios são compartilhados com o casal.</p>' +
      '<button type="button" class="btn danger full" data-action="cloud-disconnect">Desconectar esta conta</button>' +
      "</div>";
  }

  return html + "</section>";
}

async function handleCreate() {
  const name = ($("cloudName")?.value || "").trim() || "Nosso universo";
  const since = ($("cloudSince")?.value || "").trim();
  const result = await createCouple(name, since);
  if (result.error) return notify(result.error.message);
  notify("Casal criado. Envie o código ou o link para a outra pessoa.");
  emitStore();
  await restartSync();
}

async function handleJoin() {
  const code = ($("cloudCode")?.value || "").trim();
  if (code.length < 4) return notify("Informe o código recebido.");
  const result = await joinCouple(code);
  if (result.error) return notify(result.error.message);
  notify("Convite aceito. Aguarde a confirmação de quem convidou.");
  emitStore();
  await restartSync();
}

async function handleConfirm() {
  const result = await confirmConnection();
  if (result.error) return notify(result.error.message);
  notify("Conexão confirmada. Os dados agora são compartilhados.");
  emitStore();
  await restartSync();
}

async function handleReject() {
  const result = await rejectConnection();
  if (result.error) return notify(result.error.message);
  notify("Convite recusado. O código continua ativo para outra pessoa.");
  emitStore();
}

async function handleDisconnect() {
  openModal({
    title: "Desconectar esta conta?",
    description: "Você perde o acesso aos dados compartilhados imediatamente. Seus dados locais neste aparelho não são apagados.",
    confirmLabel: "Desconectar",
    danger: true,
    onConfirm: async () => {
      const result = await disconnectCouple();
      if (result.error) return notify(result.error.message);
      notify("Conta desconectada do casal.");
      emitStore();
      await restartSync();
    }
  });
}

async function handleCopyLink() {
  const url = getSyncState().inviteUrl;
  try {
    await navigator.clipboard.writeText(url);
    notify("Link copiado.");
  } catch {
    const input = $("cloudInviteUrl");
    input?.select();
    notify("Selecione o link acima para copiar.");
  }
}

async function handleRegenerate() {
  const result = await regenerateInvite();
  if (result.error) return notify(result.error.message);
  notify("Novo código gerado: " + result.code);
  emitStore();
}

async function handleSync() {
  const result = await syncNow({ force: true, full: true });
  if (!result.ok) notify(result.message || "Não foi possível sincronizar.");
}

function handleValidate() {
  const payload = validateMigration();
  if (payload.error) return notify(payload.error);
  notify(payload.summary.records + " registros e " + payload.summary.challenges +
    " desafios prontos para enviar." + (payload.summary.errors ? " " + payload.summary.errors + " ignorados." : ""));
}

async function handleMigrate() {
  const result = await runMigration();
  notify(result.message || (result.ok ? " Migração concluída." : " Falha na migração."));
}

export const actions = {
  "cloud-create": handleCreate,
  "cloud-join": handleJoin,
  "cloud-confirm": handleConfirm,
  "cloud-reject": handleReject,
  "cloud-disconnect": handleDisconnect,
  "cloud-copy-link": handleCopyLink,
  "cloud-regenerate": handleRegenerate,
  "cloud-sync": handleSync,
  "cloud-validate": handleValidate,
  "cloud-migrate": handleMigrate
};
